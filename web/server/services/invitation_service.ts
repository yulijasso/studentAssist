import { eq, and, isNull, isNotNull, lt, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import type { DB } from "@/server/db";
import { invitations, roles, tenants, departments } from "@/server/db/schema";

export async function createInvitation(
  db: DB,
  opts: {
    email: string;
    tenantId: string | null;
    roleId: string;
    departmentId?: string | null;
    invitedBy: string | null;
    expiresInDays?: number;
  },
) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (opts.expiresInDays ?? 7));

  const [row] = await db
    .insert(invitations)
    .values({
      email: opts.email,
      tenantId: opts.tenantId,
      roleId: opts.roleId,
      departmentId: opts.departmentId ?? null,
      token,
      invitedBy: opts.invitedBy,
      expiresAt,
    })
    .returning();
  return row;
}

export async function getInvitationByToken(db: DB, token: string) {
  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      tenantId: invitations.tenantId,
      roleId: invitations.roleId,
      departmentId: invitations.departmentId,
      token: invitations.token,
      invitedBy: invitations.invitedBy,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      createdAt: invitations.createdAt,
      roleName: roles.name,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      departmentName: departments.name,
    })
    .from(invitations)
    .innerJoin(roles, eq(invitations.roleId, roles.id))
    .leftJoin(tenants, eq(invitations.tenantId, tenants.id))
    .leftJoin(departments, eq(invitations.departmentId, departments.id))
    .where(eq(invitations.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function acceptInvitation(db: DB, invitationId: string) {
  const [updated] = await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitationId))
    .returning();
  return updated ?? null;
}

export async function listInvitations(db: DB) {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      tenantId: invitations.tenantId,
      roleId: invitations.roleId,
      departmentId: invitations.departmentId,
      token: invitations.token,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      createdAt: invitations.createdAt,
      roleName: roles.name,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      departmentName: departments.name,
    })
    .from(invitations)
    .innerJoin(roles, eq(invitations.roleId, roles.id))
    .leftJoin(tenants, eq(invitations.tenantId, tenants.id))
    .leftJoin(departments, eq(invitations.departmentId, departments.id))
    .orderBy(invitations.createdAt);
}

export async function revokeInvitation(db: DB, id: string) {
  const [deleted] = await db.delete(invitations).where(eq(invitations.id, id)).returning();
  return !!deleted;
}

/**
 * Deletes expired and accepted invitations older than the given number of days.
 *
 * @param db - Database instance.
 * @param olderThanDays - Delete invitations older than this many days (default 30).
 * @returns The number of deleted rows.
 */
export async function deleteOldInvitations(db: DB, olderThanDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const deleted = await db
    .delete(invitations)
    .where(
      and(
        lt(invitations.createdAt, cutoff),
        or(
          isNotNull(invitations.acceptedAt),
          lt(invitations.expiresAt, new Date()),
        ),
      ),
    )
    .returning();
  return deleted.length;
}
