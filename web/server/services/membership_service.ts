import { eq, and, isNull } from "drizzle-orm";
import type { DB } from "@/server/db";
import { tenantMemberships, roles, users } from "@/server/db/schema";
import type Redis from "ioredis";

export interface UserContext {
  clerkId: string;
  userId: string;
  role: string;
  tenantId: string | null;
  departmentId: string | null;
  permissions: string[];
}

const CACHE_PREFIX = "user_ctx:";
const CACHE_TTL = 300; // 5 minutes

export async function getUserContext(
  db: DB,
  redis: Redis,
  clerkId: string,
): Promise<UserContext | null> {
  // Check cache first
  const cached = await redis.get(`${CACHE_PREFIX}${clerkId}`);
  if (cached) {
    try {
      return JSON.parse(cached) as UserContext;
    } catch {
      // Invalid cache entry, fall through
    }
  }

  // Look up user
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return null;

  // Find active membership (prefer tech_admin / global role first)
  const memberships = await db
    .select({
      membershipId: tenantMemberships.id,
      tenantId: tenantMemberships.tenantId,
      departmentId: tenantMemberships.departmentId,
      roleName: roles.name,
      permissions: roles.permissions,
    })
    .from(tenantMemberships)
    .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
    .where(and(eq(tenantMemberships.userId, user.id), eq(tenantMemberships.isActive, true)));

  if (memberships.length === 0) return null;

  // Prefer global (tech_admin) membership
  const globalMembership = memberships.find((m) => m.tenantId === null);
  const membership = globalMembership ?? memberships[0];

  const ctx: UserContext = {
    clerkId,
    userId: user.id,
    role: membership.roleName,
    tenantId: membership.tenantId,
    departmentId: membership.departmentId ?? null,
    permissions: membership.permissions as string[],
  };

  // Cache
  await redis.set(`${CACHE_PREFIX}${clerkId}`, JSON.stringify(ctx), "EX", CACHE_TTL);
  return ctx;
}

export function invalidateUserContext(redis: Redis, clerkId: string) {
  return redis.del(`${CACHE_PREFIX}${clerkId}`);
}

export async function createMembership(
  db: DB,
  opts: {
    userId: string;
    tenantId: string | null;
    roleId: string;
    departmentId?: string | null;
    invitedBy?: string | null;
  },
) {
  const [row] = await db
    .insert(tenantMemberships)
    .values({
      userId: opts.userId,
      tenantId: opts.tenantId,
      roleId: opts.roleId,
      departmentId: opts.departmentId ?? null,
      invitedBy: opts.invitedBy ?? null,
      joinedAt: new Date(),
      isActive: true,
    })
    .returning();
  return row;
}

export async function listMemberships(db: DB, tenantId: string) {
  return db
    .select({
      id: tenantMemberships.id,
      userId: tenantMemberships.userId,
      tenantId: tenantMemberships.tenantId,
      roleId: tenantMemberships.roleId,
      isActive: tenantMemberships.isActive,
      joinedAt: tenantMemberships.joinedAt,
      createdAt: tenantMemberships.createdAt,
      userName: users.name,
      userEmail: users.email,
      roleName: roles.name,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(tenantMemberships.userId, users.id))
    .innerJoin(roles, eq(tenantMemberships.roleId, roles.id))
    .where(eq(tenantMemberships.tenantId, tenantId));
}

export async function updateMembership(
  db: DB,
  membershipId: string,
  data: { roleId?: string; departmentId?: string | null; isActive?: boolean },
) {
  const [updated] = await db
    .update(tenantMemberships)
    .set(data)
    .where(eq(tenantMemberships.id, membershipId))
    .returning();
  return updated ?? null;
}

export async function removeMembership(db: DB, membershipId: string) {
  const [deleted] = await db
    .delete(tenantMemberships)
    .where(eq(tenantMemberships.id, membershipId))
    .returning();
  return !!deleted;
}
