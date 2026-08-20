/**
 * Tenant-scoped team management — lets a `city_admin` invite and manage users
 * within their OWN institution, without global tech-admin access.
 *
 * Every procedure is gated by `tenantAdminProcedure` (admits `city_admin` or
 * `tech_admin`) and then resolves an effective tenant server-side via
 * `resolveTenantId`, so a tenant admin can never act outside their own tenant.
 * Role grants are constrained by `assertRoleGrantable` (no `tech_admin`), and
 * membership mutations are confined by `assertSameTenant`. `tech_admin` retains
 * the full, unchanged global `admin` router.
 */
import { z } from "zod";
import { eq, and, isNull, sql } from "drizzle-orm";
import type Redis from "ioredis";
import type { DB } from "@/server/db";
import { router, tenantAdminProcedure } from "../init";
import {
  roles,
  users,
  tenantMemberships,
  invitations,
  tenants,
} from "@/server/db/schema";
import {
  createInvitation,
  listInvitationsByTenant,
  revokeInvitation,
} from "@/server/services/invitation_service";
import {
  listMemberships,
  updateMembership,
  removeMembership,
  invalidateUserContext,
} from "@/server/services/membership_service";
import { sendInvitationEmail } from "@/server/services/email_service";
import { recordAudit, computeDiff } from "@/server/services/audit_service";
import { getUserByClerkId } from "@/server/services/user_service";
import {
  resolveTenantId,
  assertRoleGrantable,
  assertSameTenant,
  isProtectedAdmin,
  NON_GRANTABLE_ROLES,
} from "../guards";

/** Invalidates a member's cached RBAC context so role changes take effect immediately. */
async function invalidateMemberCache(ctx: { db: DB; redis: Redis }, userId: string) {
  const [user] = await ctx.db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user) await invalidateUserContext(ctx.redis, user.clerkId);
}

export const teamRouter = router({
  // ── Roles (assignable within a tenant) ───────────────────────────────────────
  /** Roles a tenant admin may grant: global roles + this tenant's roles, minus tech_admin. */
  listRoles: tenantAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);
      const rows = await ctx.db
        .select({ id: roles.id, name: roles.name, tenantId: roles.tenantId })
        .from(roles)
        .orderBy(roles.name);
      // Keep global roles (tenantId null) and this tenant's roles; drop non-grantable ones.
      return rows.filter(
        (r) =>
          (r.tenantId === null || r.tenantId === tenantId) &&
          !NON_GRANTABLE_ROLES.includes(r.name),
      );
    }),

  // ── Invitations ──────────────────────────────────────────────────────────────
  sendInvitation: tenantAdminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        email: z.string().email(),
        roleId: z.string().uuid(),
        departmentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);

      // Reject non-grantable roles (e.g. tech_admin) up front.
      const role = await assertRoleGrantable(ctx.db, input.roleId);

      // Block if the user already has an active membership.
      const [existingUser] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (existingUser) {
        const [activeMembership] = await ctx.db
          .select({ id: tenantMemberships.id })
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.userId, existingUser.id),
              eq(tenantMemberships.isActive, true),
            ),
          )
          .limit(1);
        if (activeMembership) {
          throw new Error("This user already has an active membership");
        }
      }

      // Block duplicate pending invitations for the same email.
      const [existingInvite] = await ctx.db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.email, input.email),
            isNull(invitations.acceptedAt),
            sql`${invitations.expiresAt} > NOW()`,
          ),
        )
        .limit(1);
      if (existingInvite) {
        throw new Error("A pending invitation already exists for this email");
      }

      // Resolve inviter name and tenant name for the email.
      let inviterName = "Campus Assist Admin";
      if (ctx.clerkId && ctx.clerkId !== "dev_user") {
        const inviter = await getUserByClerkId(ctx.db, ctx.clerkId);
        if (inviter?.name) inviterName = inviter.name;
      }
      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const invitation = await createInvitation(ctx.db, {
        email: input.email,
        tenantId,
        roleId: input.roleId,
        departmentId: input.departmentId ?? null,
        invitedBy: ctx.user?.userId ?? null,
      });

      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
      const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

      await sendInvitationEmail({
        to: input.email,
        inviterName,
        cityName: tenant?.name ?? null,
        role: role.name,
        inviteUrl,
      });

      await recordAudit(ctx.db, {
        actor: { userId: ctx.user?.userId ?? null, clerkId: ctx.clerkId },
        scope: "tenant",
        action: "invitation.create",
        targetType: "invitation",
        targetId: invitation.id,
        targetLabel: input.email,
        tenantId,
        metadata: { role: role.name },
      });

      return invitation;
    }),

  listInvitations: tenantAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);
      const rows = await listInvitationsByTenant(ctx.db, tenantId);
      return rows.map((row) => ({
        ...row,
        status: row.acceptedAt
          ? "accepted"
          : new Date(row.expiresAt) < new Date()
            ? "expired"
            : "pending",
      }));
    }),

  revokeInvitation: tenantAdminProcedure
    .input(z.object({ tenantId: z.string().uuid(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);
      const [invite] = await ctx.db
        .select({ tenantId: invitations.tenantId, email: invitations.email })
        .from(invitations)
        .where(eq(invitations.id, input.id))
        .limit(1);
      if (!invite) throw new Error("Invitation not found");
      assertSameTenant(invite.tenantId, tenantId);

      const ok = await revokeInvitation(ctx.db, input.id);
      if (!ok) throw new Error("Invitation not found");

      await recordAudit(ctx.db, {
        actor: { userId: ctx.user?.userId ?? null, clerkId: ctx.clerkId },
        scope: "tenant",
        action: "invitation.revoke",
        targetType: "invitation",
        targetId: input.id,
        targetLabel: invite.email,
        tenantId,
      });

      return { success: true };
    }),

  // ── Members ────────────────────────────────────────────────────────────────
  listMembers: tenantAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);
      return listMemberships(ctx.db, tenantId);
    }),

  updateMember: tenantAdminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        membershipId: z.string().uuid(),
        roleId: z.string().uuid().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);
      const { membershipId } = input;

      // Load the membership (with current values for the audit diff) and confirm
      // it belongs to the caller's tenant.
      const [membership] = await ctx.db
        .select({
          userId: tenantMemberships.userId,
          tenantId: tenantMemberships.tenantId,
          roleId: tenantMemberships.roleId,
          departmentId: tenantMemberships.departmentId,
          isActive: tenantMemberships.isActive,
        })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.id, membershipId))
        .limit(1);
      if (!membership) throw new Error("Membership not found");
      assertSameTenant(membership.tenantId, tenantId);

      // A tenant admin may only grant grantable roles (never tech_admin).
      if (input.roleId) {
        await assertRoleGrantable(ctx.db, input.roleId);
      }

      // Only forward the fields that were actually provided.
      const data: { roleId?: string; departmentId?: string | null; isActive?: boolean } = {};
      if (input.roleId !== undefined) data.roleId = input.roleId;
      if (input.departmentId !== undefined) data.departmentId = input.departmentId;
      if (input.isActive !== undefined) data.isActive = input.isActive;

      // Block role changes / deactivation for permanent tech admins.
      if (data.roleId || data.isActive === false) {
        const [u] = await ctx.db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, membership.userId))
          .limit(1);
        if (u && isProtectedAdmin(u.email)) {
          throw new Error(
            "This account is a permanent tech admin and cannot be modified.",
          );
        }
      }

      const updated = await updateMembership(ctx.db, membershipId, data);
      if (!updated) throw new Error("Membership not found");

      await recordAudit(ctx.db, {
        actor: { userId: ctx.user?.userId ?? null, clerkId: ctx.clerkId },
        scope: "tenant",
        action: "member.update",
        targetType: "member",
        targetId: membershipId,
        tenantId,
        metadata: computeDiff(membership, updated, Object.keys(data)),
      });

      await invalidateMemberCache(ctx, updated.userId);
      return updated;
    }),

  removeMember: tenantAdminProcedure
    .input(z.object({ tenantId: z.string().uuid(), membershipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = resolveTenantId(ctx, input.tenantId);

      const [membership] = await ctx.db
        .select({
          userId: tenantMemberships.userId,
          tenantId: tenantMemberships.tenantId,
        })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.id, input.membershipId))
        .limit(1);
      if (!membership) throw new Error("Membership not found");
      assertSameTenant(membership.tenantId, tenantId);

      // Block removal of permanent tech admins.
      const [user] = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, membership.userId))
        .limit(1);
      if (user && isProtectedAdmin(user.email)) {
        throw new Error(
          "This account is a permanent tech admin and cannot be removed.",
        );
      }

      const ok = await removeMembership(ctx.db, input.membershipId);
      if (!ok) throw new Error("Membership not found");

      await recordAudit(ctx.db, {
        actor: { userId: ctx.user?.userId ?? null, clerkId: ctx.clerkId },
        scope: "tenant",
        action: "member.remove",
        targetType: "member",
        targetId: input.membershipId,
        tenantId,
        metadata: { userId: membership.userId, email: user?.email ?? null },
      });

      await invalidateMemberCache(ctx, membership.userId);
      return { success: true };
    }),
});
