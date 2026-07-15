/**
 * "Me" router — endpoints for the currently authenticated user.
 *
 * Provides user sync (post-login) and membership queries.
 */
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, adminProcedure } from "../init";
import { tenantMemberships, roles, tenants, users } from "@/server/db/schema";
import { syncUser } from "@/server/services/sync_service";

export const meRouter = router({
  /**
   * Syncs the current Clerk user into our DB.
   * Auto-provisions tech_admin from env, auto-accepts pending invitations.
   * Returns the user's role and redirect destination.
   */
  sync: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.clerkId) {
        return { role: null, tenantSlug: null, redirect: "/waiting" };
      }
      const result = await syncUser(
        ctx.db,
        ctx.redis,
        ctx.clerkId,
        input.email,
        input.name,
      );
      return result;
    }),

  /**
   * Returns the current user's active memberships with tenant and role info.
   */
  memberships: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.clerkId) return [];

    const [user] = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, ctx.clerkId))
      .limit(1);

    if (!user) return [];

    const rows = await ctx.db
      .select({
        membershipId: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        departmentId: tenantMemberships.departmentId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        roleName: roles.name,
        permissions: roles.permissions,
      })
      .from(tenantMemberships)
      .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
      .leftJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(
        and(
          eq(tenantMemberships.userId, user.id),
          eq(tenantMemberships.isActive, true),
        ),
      );

    return rows.map((r) => ({
      membershipId: r.membershipId,
      tenantId: r.tenantId,
      departmentId: r.departmentId,
      tenantName: r.tenantName,
      tenantSlug: r.tenantSlug,
      roleName: r.roleName,
      permissions: r.permissions as string[],
    }));
  }),
});
