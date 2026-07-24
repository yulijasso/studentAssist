import { z } from "zod";
import { eq, and, sql, count, isNull, desc } from "drizzle-orm";
import { router, techAdminProcedure } from "../init";
import { tenants, conversations, messages, roles, users, tenantMemberships, invitations, departments } from "@/server/db/schema";
import { updateTenant } from "@/server/services/tenant_admin_service";
import { geocodeCity } from "@/server/services/geocode_service";
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  deleteOldInvitations,
} from "@/server/services/invitation_service";
import {
  createMembership,
  listMemberships,
  updateMembership,
  removeMembership,
  invalidateUserContext,
} from "@/server/services/membership_service";
import { sendInvitationEmail } from "@/server/services/email_service";
import { getUserByClerkId } from "@/server/services/user_service";
import { getCurrentUsage } from "@/server/services/quota_service";
import { PROTECTED_ADMINS } from "../guards";

export const adminRouter = router({
  // ── Overview ───────────────────────────────────────────────────────────────
  overview: techAdminProcedure.query(async ({ ctx }) => {
    const [tenantStats] = await ctx.db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${tenants.isActive} = true)`,
      })
      .from(tenants);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [convoStats] = await ctx.db
      .select({ today: count() })
      .from(conversations)
      .where(sql`${conversations.createdAt} >= ${today.toISOString()}`);

    // Health checks
    let dbOk = false;
    let redisOk = false;
    try {
      await ctx.db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {}
    try {
      await ctx.redis.ping();
      redisOk = true;
    } catch {}

    return {
      tenants: { total: tenantStats.total, active: tenantStats.active },
      conversationsToday: convoStats.today,
      health: { db: dbOk, redis: redisOk },
    };
  }),

  // ── Cities ─────────────────────────────────────────────────────────────────
  listCities: techAdminProcedure.query(async ({ ctx }) => {
    const cities = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        isActive: tenants.isActive,
        dailyRequestQuota: tenants.dailyRequestQuota,
        websiteDomain: tenants.websiteDomain,
        location: tenants.location,
        latitude: tenants.latitude,
        longitude: tenants.longitude,
        widgetSettings: tenants.widgetSettings,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(tenants.name);

    // Get conversation counts per tenant
    const convoCounts = await ctx.db
      .select({
        tenantId: conversations.tenantId,
        count: count(),
      })
      .from(conversations)
      .groupBy(conversations.tenantId);

    const countMap = new Map(convoCounts.map((c) => [c.tenantId, c.count]));

    return cities.map(({ widgetSettings, ...city }) => ({
      ...city,
      brandColor: widgetSettings?.primaryColor ?? null,
      conversationCount: countMap.get(city.id) ?? 0,
    }));
  }),

  updateCity: techAdminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        websiteDomain: z.string().min(1).max(255).optional(),
        searchDomains: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
        dailyRequestQuota: z.number().int().positive().nullable().optional(),
        llmApiKey: z.string().nullable().optional(),
        location: z.string().max(255).nullable().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await updateTenant(ctx.db, ctx.redis, id, data);
      if (!updated) throw new Error("Tenant not found");
      return updated;
    }),

  triggerCrawl: techAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // Stub — will connect to crawl service when Firecrawl is implemented
      console.log(`[admin] Crawl triggered for tenant ${input.tenantId}`);
      return { success: true, message: "Crawl triggered (stub)" };
    }),

  /** Permanently deletes a city/tenant and all associated data (cascades via FK). */
  deleteCity: techAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(tenants)
        .where(eq(tenants.id, input.tenantId))
        .returning();
      if (!deleted) throw new Error("City not found");
      return { success: true };
    }),

  // ── Invitations ────────────────────────────────────────────────────────────
  sendInvitation: techAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        tenantId: z.string().uuid().nullable(),
        roleId: z.string().uuid(),
        departmentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Block if user already has an active membership
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

      // Block duplicate pending invitations for the same email
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

      // Find the inviter's user record
      let inviterName = "Campus Assist Admin";
      if (ctx.clerkId && ctx.clerkId !== "dev_user") {
        const inviter = await getUserByClerkId(ctx.db, ctx.clerkId);
        if (inviter?.name) inviterName = inviter.name;
      }

      // Get role and city name for email
      const [role] = await ctx.db
        .select()
        .from(roles)
        .where(eq(roles.id, input.roleId))
        .limit(1);
      if (!role) throw new Error("Role not found");

      let cityName: string | null = null;
      if (input.tenantId) {
        const [city] = await ctx.db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);
        cityName = city?.name ?? null;
      }

      const invitation = await createInvitation(ctx.db, {
        email: input.email,
        tenantId: input.tenantId,
        roleId: input.roleId,
        departmentId: input.departmentId ?? null,
        invitedBy: ctx.user?.userId ?? null,
      });

      // Build invite URL and send email
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
      const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

      await sendInvitationEmail({
        to: input.email,
        inviterName,
        cityName,
        role: role.name,
        inviteUrl,
      });

      return invitation;
    }),

  listInvitations: techAdminProcedure.query(async ({ ctx }) => {
    const rows = await listInvitations(ctx.db);
    return rows.map((row) => ({
      ...row,
      status: row.acceptedAt
        ? "accepted"
        : new Date(row.expiresAt) < new Date()
          ? "expired"
          : "pending",
    }));
  }),

  revokeInvitation: techAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await revokeInvitation(ctx.db, input.id);
      if (!ok) throw new Error("Invitation not found");
      return { success: true };
    }),

  deleteOldInvitations: techAdminProcedure
    .input(z.object({ olderThanDays: z.number().int().min(1).default(30) }))
    .mutation(async ({ ctx, input }) => {
      const count = await deleteOldInvitations(ctx.db, input.olderThanDays);
      return { deleted: count };
    }),

  // ── Members ────────────────────────────────────────────────────────────────
  listMembers: techAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return listMemberships(ctx.db, input.tenantId);
    }),

  updateMember: techAdminProcedure
    .input(
      z.object({
        membershipId: z.string().uuid(),
        roleId: z.string().uuid().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { membershipId, ...data } = input;

      // Block role changes or deactivation for protected tech admins
      if (data.roleId || data.isActive === false) {
        const [mem] = await ctx.db
          .select({ userId: tenantMemberships.userId })
          .from(tenantMemberships)
          .where(eq(tenantMemberships.id, membershipId))
          .limit(1);
        if (mem) {
          const [u] = await ctx.db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, mem.userId))
            .limit(1);
          if (u && PROTECTED_ADMINS.includes(u.email.toLowerCase())) {
            throw new Error("This account is a permanent tech admin and cannot be modified.");
          }
        }
      }

      const updated = await updateMembership(ctx.db, membershipId, data);
      if (!updated) throw new Error("Membership not found");

      // Invalidate cached user context so the new role takes effect immediately
      const [user] = await ctx.db
        .select({ clerkId: users.clerkId })
        .from(users)
        .where(eq(users.id, updated.userId))
        .limit(1);
      if (user) {
        await invalidateUserContext(ctx.redis, user.clerkId);
      }

      return updated;
    }),

  removeMember: techAdminProcedure
    .input(z.object({ membershipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Look up userId before deleting so we can invalidate their cache
      const [membership] = await ctx.db
        .select({ userId: tenantMemberships.userId })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.id, input.membershipId))
        .limit(1);

      // Block removal of protected tech admins
      if (membership) {
        const [user] = await ctx.db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, membership.userId))
          .limit(1);
        if (user && PROTECTED_ADMINS.includes(user.email.toLowerCase())) {
          throw new Error("This account is a permanent tech admin and cannot be removed.");
        }
      }

      const ok = await removeMembership(ctx.db, input.membershipId);
      if (!ok) throw new Error("Membership not found");

      if (membership) {
        const [user] = await ctx.db
          .select({ clerkId: users.clerkId })
          .from(users)
          .where(eq(users.id, membership.userId))
          .limit(1);
        if (user) await invalidateUserContext(ctx.redis, user.clerkId);
      }

      return { success: true };
    }),

  /** Directly assigns a role to a user without sending an invitation email. */
  assignRole: techAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
        tenantId: z.string().uuid().nullable(),
        departmentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already has an active membership
      const [existing] = await ctx.db
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.userId, input.userId),
            eq(tenantMemberships.isActive, true),
          ),
        )
        .limit(1);
      if (existing) {
        throw new Error("User already has an active membership. Edit their existing role instead.");
      }

      // Check for inactive membership to reactivate
      const [inactive] = await ctx.db
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.userId, input.userId))
        .limit(1);

      if (inactive) {
        // Update existing membership
        const [updated] = await ctx.db
          .update(tenantMemberships)
          .set({
            roleId: input.roleId,
            tenantId: input.tenantId,
            departmentId: input.departmentId ?? null,
            isActive: true,
          })
          .where(eq(tenantMemberships.id, inactive.id))
          .returning();

        const [user] = await ctx.db
          .select({ clerkId: users.clerkId })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (user) await invalidateUserContext(ctx.redis, user.clerkId);

        return updated;
      }

      // Create new membership
      const membership = await createMembership(ctx.db, {
        userId: input.userId,
        tenantId: input.tenantId,
        roleId: input.roleId,
        departmentId: input.departmentId ?? null,
        invitedBy: ctx.user?.userId ?? null,
      });

      const [user] = await ctx.db
        .select({ clerkId: users.clerkId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (user) await invalidateUserContext(ctx.redis, user.clerkId);

      return membership;
    }),

  // ── System Health ──────────────────────────────────────────────────────────
  systemHealth: techAdminProcedure.query(async ({ ctx }) => {
    let dbOk = false;
    let redisOk = false;
    try {
      await ctx.db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {}
    try {
      await ctx.redis.ping();
      redisOk = true;
    } catch {}

    const envKeys = {
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
    };

    return { db: dbOk, redis: redisOk, envKeys };
  }),

  // ── Roles ──────────────────────────────────────────────────────────────────
  listRoles: techAdminProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(roles).orderBy(roles.name);
  }),

  createRole: techAdminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid().nullable(),
        name: z.string().min(1).max(100),
        permissions: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [role] = await ctx.db
        .insert(roles)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          permissions: input.permissions,
        })
        .returning();
      return role;
    }),

  // ── User Stats ───────────────────────────────────────────────────────────
  userStats: techAdminProcedure.query(async ({ ctx }) => {
    // Total users
    const [totalResult] = await ctx.db.select({ count: count() }).from(users);

    // Users by role
    const roleBreakdown = await ctx.db
      .select({
        roleName: roles.name,
        count: count(),
      })
      .from(tenantMemberships)
      .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
      .where(eq(tenantMemberships.isActive, true))
      .groupBy(roles.name);

    // Users with no membership at all (registered but never assigned)
    const usersWithMembership = ctx.db
      .select({ userId: tenantMemberships.userId })
      .from(tenantMemberships);

    const [unassignedResult] = await ctx.db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.id} NOT IN (${usersWithMembership})`);

    // Pending invitations
    const [pendingResult] = await ctx.db
      .select({ count: count() })
      .from(invitations)
      .where(
        sql`${invitations.acceptedAt} IS NULL AND ${invitations.expiresAt} > NOW()`,
      );

    // Recently joined (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [recentResult] = await ctx.db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo.toISOString()}`);

    // Users per city
    const usersPerCity = await ctx.db
      .select({
        tenantId: tenantMemberships.tenantId,
        tenantName: tenants.name,
        count: count(),
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(eq(tenantMemberships.isActive, true))
      .groupBy(tenantMemberships.tenantId, tenants.name)
      .orderBy(sql`count(*) DESC`);

    return {
      totalUsers: totalResult.count,
      unassignedUsers: unassignedResult.count,
      pendingInvitations: pendingResult.count,
      recentSignups: recentResult.count,
      byRole: roleBreakdown.map((r) => ({ role: r.roleName, count: r.count })),
      byCity: usersPerCity.map((r) => ({
        tenantId: r.tenantId,
        cityName: r.tenantName,
        count: r.count,
      })),
    };
  }),

  // ── Users ───────────────────────────────────────────────────────────────
  listUsers: techAdminProcedure.query(async ({ ctx }) => {
    const allUsers = await ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const allMemberships = allUsers.length > 0
      ? await ctx.db
          .select({
            membershipId: tenantMemberships.id,
            userId: tenantMemberships.userId,
            roleId: tenantMemberships.roleId,
            roleName: roles.name,
            tenantId: tenantMemberships.tenantId,
            cityName: tenants.name,
            departmentId: tenantMemberships.departmentId,
            departmentName: departments.name,
            isActive: tenantMemberships.isActive,
          })
          .from(tenantMemberships)
          .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
          .leftJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
          .leftJoin(departments, eq(tenantMemberships.departmentId, departments.id))
      : [];

    const membershipMap = new Map<string, { membershipId: string; roleId: string; role: string; tenantId: string | null; city: string | null; departmentId: string | null; department: string | null; isActive: boolean }[]>();
    for (const m of allMemberships) {
      const list = membershipMap.get(m.userId) ?? [];
      list.push({ membershipId: m.membershipId, roleId: m.roleId, role: m.roleName, tenantId: m.tenantId, city: m.cityName, departmentId: m.departmentId, department: m.departmentName, isActive: m.isActive });
      membershipMap.set(m.userId, list);
    }

    return allUsers.map((u) => ({
      ...u,
      memberships: membershipMap.get(u.id) ?? [],
    }));
  }),

  /** Updates a user's name or email. */
  updateUser: techAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        name: z.string().max(255).optional(),
        email: z.string().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...data } = input;
      const sets: Record<string, unknown> = {};
      if (data.name !== undefined) sets.name = data.name;
      if (data.email !== undefined) sets.email = data.email;
      if (Object.keys(sets).length === 0) return null;
      const [updated] = await ctx.db
        .update(users)
        .set(sets)
        .where(eq(users.id, userId))
        .returning();
      return updated ?? null;
    }),

  /** Deactivates a user by disabling all their memberships. */
  deactivateUser: techAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (target && PROTECTED_ADMINS.includes(target.email.toLowerCase())) {
        throw new Error("This account is a permanent platform administrator and cannot be deactivated.");
      }

      await ctx.db
        .update(tenantMemberships)
        .set({ isActive: false })
        .where(eq(tenantMemberships.userId, input.userId));

      const [user] = await ctx.db
        .select({ clerkId: users.clerkId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (user) await invalidateUserContext(ctx.redis, user.clerkId);

      return { success: true };
    }),

  /** Reactivates a user by enabling all their memberships. */
  reactivateUser: techAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tenantMemberships)
        .set({ isActive: true })
        .where(eq(tenantMemberships.userId, input.userId));

      const [user] = await ctx.db
        .select({ clerkId: users.clerkId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (user) await invalidateUserContext(ctx.redis, user.clerkId);

      return { success: true };
    }),

  /** Deletes a user and all their memberships permanently, including from Clerk. */
  deleteUser: techAdminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [target] = await ctx.db
        .select({ email: users.email, clerkId: users.clerkId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!target) throw new Error("User not found");

      if (PROTECTED_ADMINS.includes(target.email.toLowerCase())) {
        throw new Error("This account is a permanent platform administrator and cannot be deleted.");
      }

      // Remove from Clerk so the user can no longer sign in
      try {
        const { clerkClient } = await import("@clerk/nextjs/server");
        const clerk = await clerkClient();
        await clerk.users.deleteUser(target.clerkId);
      } catch (err) {
        console.error("[admin] Failed to delete Clerk user:", err);
        // Continue with local deletion even if Clerk fails
      }

      // Memberships cascade-delete via FK, but delete explicitly for clarity
      await ctx.db
        .delete(tenantMemberships)
        .where(eq(tenantMemberships.userId, input.userId));
      await ctx.db
        .delete(users)
        .where(eq(users.id, input.userId));

      await invalidateUserContext(ctx.redis, target.clerkId);

      return { success: true };
    }),

  // ── Recent Activity ──────────────────────────────────────────────────────
  recentActivity: techAdminProcedure.query(async ({ ctx }) => {
    // Latest 10 user signups with their role assignments
    const recentUsers = await ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10);

    // Get memberships for these users
    const userIds = recentUsers.map((u) => u.id);
    const memberships = userIds.length > 0
      ? await ctx.db
          .select({
            userId: tenantMemberships.userId,
            roleName: roles.name,
            cityName: tenants.name,
          })
          .from(tenantMemberships)
          .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
          .leftJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
          .where(sql`${tenantMemberships.userId} IN (${sql.join(userIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    const membershipMap = new Map<string, { role: string; city: string | null }[]>();
    for (const m of memberships) {
      const list = membershipMap.get(m.userId) ?? [];
      list.push({ role: m.roleName, city: m.cityName });
      membershipMap.set(m.userId, list);
    }

    return recentUsers.map((u) => ({
      ...u,
      memberships: membershipMap.get(u.id) ?? [],
    }));
  }),

  // ── Platform Usage ──────────────────────────────────────────────────────
  platformUsage: techAdminProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total conversations per city
    const perCity = await ctx.db
      .select({
        tenantId: conversations.tenantId,
        cityName: tenants.name,
        total: count(),
        today: sql<number>`count(*) filter (where ${conversations.createdAt} >= ${today.toISOString()})`,
      })
      .from(conversations)
      .innerJoin(tenants, eq(conversations.tenantId, tenants.id))
      .groupBy(conversations.tenantId, tenants.name)
      .orderBy(sql`count(*) DESC`);

    // Overall totals
    const [totals] = await ctx.db
      .select({
        totalConversations: count(),
        totalToday: sql<number>`count(*) filter (where ${conversations.createdAt} >= ${today.toISOString()})`,
      })
      .from(conversations);

    // Message count
    const [msgTotals] = await ctx.db
      .select({ totalMessages: count() })
      .from(messages);

    return {
      totalConversations: totals.totalConversations,
      conversationsToday: totals.totalToday,
      totalMessages: msgTotals.totalMessages,
      perCity: perCity.map((r) => ({
        tenantId: r.tenantId,
        cityName: r.cityName,
        total: r.total,
        today: r.today,
      })),
    };
  }),

  // ── Usage Stats (API requests from Redis) ────────────────────────────────
  usageStats: techAdminProcedure.query(async ({ ctx }) => {
    const allTenants = await ctx.db
      .select({ id: tenants.id, name: tenants.name, dailyRequestQuota: tenants.dailyRequestQuota })
      .from(tenants)
      .where(eq(tenants.isActive, true));

    const perCity = await Promise.all(
      allTenants.map(async (t) => {
        const todayCount = await getCurrentUsage(ctx.redis, t.id);
        return {
          tenantId: t.id,
          cityName: t.name,
          requestsToday: todayCount,
          dailyLimit: t.dailyRequestQuota,
        };
      }),
    );

    const totalRequestsToday = perCity.reduce((sum, c) => sum + c.requestsToday, 0);

    return {
      totalRequestsToday,
      cities: perCity.sort((a, b) => b.requestsToday - a.requestsToday),
    };
  }),

  // ── Geocode backfill ─────────────────────────────────────────────────────
  geocodeAll: techAdminProcedure
    .input(z.object({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const force = input?.force ?? false;
      const cities = force
        ? await ctx.db.select({ id: tenants.id, name: tenants.name, location: tenants.location, websiteDomain: tenants.websiteDomain }).from(tenants)
        : await ctx.db.select({ id: tenants.id, name: tenants.name, location: tenants.location, websiteDomain: tenants.websiteDomain }).from(tenants).where(isNull(tenants.latitude));

      let updated = 0;
      for (const city of cities) {
        const searchTerm = city.location || city.name;
        const coords = await geocodeCity(searchTerm, city.websiteDomain);
        if (coords) {
          await ctx.db
            .update(tenants)
            .set({ latitude: coords.latitude, longitude: coords.longitude, updatedAt: new Date() })
            .where(eq(tenants.id, city.id));
          updated++;
        }
        // Nominatim rate limit: 1 req/sec
        await new Promise((r) => setTimeout(r, 1100));
      }
      return { total: cities.length, updated };
    }),
});
