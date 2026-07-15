/**
 * User sync service — called after every Clerk sign-in.
 *
 * Handles:
 * 1. Creating/updating the user record in our DB from Clerk profile
 * 2. Auto-provisioning tech_admin if email matches ADMIN_EMAIL env var
 * 3. Auto-accepting any pending invitations for this email
 *
 * Returns the user's resolved destination so the frontend can redirect.
 */
import { eq, and, isNull } from "drizzle-orm";
import type { DB } from "@/server/db";
import type Redis from "ioredis";
import { users, roles, invitations, tenantMemberships, tenants } from "@/server/db/schema";
import { getOrCreateUser } from "./user_service";
import { createMembership, invalidateUserContext } from "./membership_service";
import { acceptInvitation } from "./invitation_service";
import { env } from "@/server/config";

export interface SyncResult {
  userId: string;
  role: string | null;
  tenantSlug: string | null;
  redirect: string;
}

/**
 * Syncs a Clerk user into our DB and resolves their destination.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client for cache invalidation.
 * @param clerkId - Clerk user ID (sub claim from JWT).
 * @param email - User's email address.
 * @param name - User's display name.
 * @returns SyncResult with role and redirect path.
 */
export async function syncUser(
  db: DB,
  redis: Redis,
  clerkId: string,
  email: string,
  name: string | null,
): Promise<SyncResult> {
  // 1. Upsert user record
  const user = await getOrCreateUser(db, clerkId, email, name);

  // Update email/name if changed
  if (user.email !== email || (name && user.name !== name)) {
    await db
      .update(users)
      .set({ email, name: name ?? user.name })
      .where(eq(users.id, user.id));
  }

  // 2. Check if user already has memberships
  let membership = await getActiveMembership(db, user.id);

  // 3. Auto-provision tech_admin from ADMIN_EMAIL env var — these are permanent
  //    admins whose role cannot be overridden by invitations
  if (isAdminEmail(email)) {
    if (!membership || membership.roleName !== "tech_admin") {
      const techAdminRole = await findOrCreateTechAdminRole(db);
      await createMembership(db, {
        userId: user.id,
        tenantId: null,
        roleId: techAdminRole.id,
      });
      await invalidateUserContext(redis, clerkId);
    }
    return { userId: user.id, role: "tech_admin", tenantSlug: null, redirect: "/admin" };
  }

  // 4. Auto-accept pending invitations for this email
  if (!membership) {
    const accepted = await autoAcceptPendingInvitations(db, redis, user.id, email, clerkId);
    if (accepted) {
      membership = await getActiveMembership(db, user.id);
    }
  }

  // 5. Resolve redirect
  if (!membership) {
    return { userId: user.id, role: null, tenantSlug: null, redirect: "/waiting" };
  }

  if (membership.roleName === "tech_admin") {
    return { userId: user.id, role: "tech_admin", tenantSlug: null, redirect: "/admin" };
  }

  const slug = membership.tenantSlug;
  if (slug) {
    return {
      userId: user.id,
      role: membership.roleName,
      tenantSlug: slug,
      redirect: `/dashboard/${slug}/conversations`,
    };
  }

  return { userId: user.id, role: membership.roleName, tenantSlug: null, redirect: "/waiting" };
}

/**
 * Checks if an email matches the ADMIN_EMAIL env var.
 * Supports comma-separated list of admin emails.
 */
function isAdminEmail(email: string): boolean {
  const adminEmails = (env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Finds the tech_admin role, creating it if it doesn't exist.
 */
async function findOrCreateTechAdminRole(db: DB) {
  const [existing] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.name, "tech_admin"), isNull(roles.tenantId)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(roles)
    .values({ tenantId: null, name: "tech_admin", permissions: ["*"] })
    .returning();
  return created!;
}

/**
 * Gets the user's most relevant active membership with role and tenant info.
 */
async function getActiveMembership(db: DB, userId: string) {
  const rows = await db
    .select({
      roleName: roles.name,
      tenantId: tenantMemberships.tenantId,
      tenantSlug: tenants.slug,
    })
    .from(tenantMemberships)
    .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
    .leftJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(and(eq(tenantMemberships.userId, userId), eq(tenantMemberships.isActive, true)));

  if (rows.length === 0) return null;

  // Prefer tech_admin (global) membership
  const global = rows.find((r) => r.tenantId === null);
  return global ?? rows[0];
}

/**
 * Auto-accepts any pending (non-expired, non-accepted) invitations for this email.
 *
 * @returns True if at least one invitation was accepted.
 */
async function autoAcceptPendingInvitations(
  db: DB,
  redis: Redis,
  userId: string,
  email: string,
  clerkId: string,
): Promise<boolean> {
  const pending = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
      ),
    );

  const now = new Date();
  let accepted = false;

  for (const inv of pending) {
    if (new Date(inv.expiresAt) < now) continue;

    // Check if user already has a membership for this tenant
    const existingConditions = [eq(tenantMemberships.userId, userId)];
    if (inv.tenantId) {
      existingConditions.push(eq(tenantMemberships.tenantId, inv.tenantId));
    }
    const [existing] = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(...existingConditions))
      .limit(1);

    if (existing) {
      // Update existing membership with invited role and department
      await db
        .update(tenantMemberships)
        .set({ roleId: inv.roleId, departmentId: inv.departmentId ?? null, isActive: true })
        .where(eq(tenantMemberships.id, existing.id));
    } else {
      await createMembership(db, {
        userId,
        tenantId: inv.tenantId,
        roleId: inv.roleId,
        departmentId: inv.departmentId ?? null,
        invitedBy: inv.invitedBy,
      });
    }
    await acceptInvitation(db, inv.id);
    accepted = true;
  }

  if (accepted) {
    await invalidateUserContext(redis, clerkId);
  }

  return accepted;
}
