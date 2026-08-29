/**
 * Shared authorization guards for admin / tenant-admin procedures.
 *
 * These helpers centralize the security rules that keep tenant admins
 * (`institution_admin`) confined to their own tenant and prevent privilege
 * escalation. Keeping them here (rather than inline in each router) makes
 * the boundaries auditable and unit-testable in isolation.
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { DB } from "@/server/db";
import { roles } from "@/server/db/schema";

/**
 * Permanent tech admin emails that cannot be removed or demoted.
 */
export const PROTECTED_ADMINS = [
  "yulianadenissejasso@gmail.com",
  "abdulbasitm810@gmail.com",
];

/** Whether an email belongs to a permanent, non-modifiable tech admin. */
export function isProtectedAdmin(email: string): boolean {
  return PROTECTED_ADMINS.includes(email.toLowerCase());
}

/**
 * Role names a tenant admin may never grant — granting these would be a
 * privilege-escalation path out of the tenant.
 */
export const NON_GRANTABLE_ROLES = ["tech_admin"];

/**
 * Resolves the tenant the caller is allowed to act on, rejecting cross-tenant access.
 *
 * - `tech_admin` (global) may act on any tenant — the requested id is trusted.
 * - `institution_admin` is locked to their own tenant (`ctx.userTenantId`); any request
 *   for a different tenant is rejected server-side (not merely hidden in the UI).
 *
 * @throws TRPCError FORBIDDEN on a missing tenant association or cross-tenant attempt.
 */
export function resolveTenantId(
  ctx: { role: string | null; userTenantId: string | null },
  requestedTenantId: string,
): string {
  if (ctx.role === "tech_admin") {
    return requestedTenantId;
  }
  if (!ctx.userTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is not associated with a tenant.",
    });
  }
  if (requestedTenantId !== ctx.userTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only manage your own institution.",
    });
  }
  return ctx.userTenantId;
}

/**
 * Asserts that a membership belongs to the effective tenant before it is
 * mutated. Prevents a tenant admin from editing/removing a membership in
 * another tenant by passing a foreign `membershipId`.
 *
 * @throws TRPCError FORBIDDEN when the membership is in a different tenant.
 */
export function assertSameTenant(
  membershipTenantId: string | null,
  effectiveTenantId: string,
): void {
  if (membershipTenantId !== effectiveTenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This member belongs to another institution.",
    });
  }
}

/**
 * Loads a role by id and asserts it may be granted by a tenant admin.
 * Blocks granting `tech_admin` (or any other `NON_GRANTABLE_ROLES`), closing
 * the privilege-escalation path.
 *
 * @returns The role's id and name (name is needed for invitation emails).
 * @throws TRPCError BAD_REQUEST if the role does not exist; FORBIDDEN if it is not grantable.
 */
export async function assertRoleGrantable(
  db: DB,
  roleId: string,
): Promise<{ id: string; name: string }> {
  const [role] = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!role) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Role not found" });
  }
  if (NON_GRANTABLE_ROLES.includes(role.name)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You are not allowed to grant the ${role.name} role.`,
    });
  }
  return role;
}
