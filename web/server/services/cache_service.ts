/**
 * Redis caching for tenant and department lookups.
 *
 * Key schema:
 *   tenant:apikey:{api_key}  → JSON tenant     TTL 1 day
 *   dept_list:{tenant_id}    → JSON dept list  TTL 1 day
 *   cache:{tid}:{h}          → response cache  managed by chat router
 */
import type { Redis } from "ioredis";
import type { Tenant, Department } from "@/server/db/schema";

const TENANT_CACHE_TTL = 86_400; // 1 day
const DEPT_CACHE_TTL = 86_400;

// ── Key helpers ───────────────────────────────────────────────────────────────

/** Returns the Redis key for a cached tenant row. */
export const tenantKey = (apiKey: string) => `tenant:apikey:${apiKey}`;
/** Returns the Redis key for a cached department list. */
export const deptListKey = (tenantId: string) => `dept_list:${tenantId}`;

// ── Tenant cache ──────────────────────────────────────────────────────────────

/**
 * Reads a tenant from the Redis cache.
 *
 * @returns The cached tenant, or null on a miss or parse error.
 */
export async function getCachedTenant(
  redis: Redis,
  apiKey: string,
): Promise<Tenant | null> {
  const raw = await redis.get(tenantKey(apiKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tenant;
  } catch {
    return null;
  }
}

/** Writes a tenant to the Redis cache with a 1-day TTL. */
export async function setCachedTenant(
  redis: Redis,
  apiKey: string,
  tenant: Tenant,
): Promise<void> {
  await redis.setex(tenantKey(apiKey), TENANT_CACHE_TTL, JSON.stringify(tenant));
}

/** Removes a tenant from the Redis cache. */
export async function invalidateTenantCache(
  redis: Redis,
  apiKey: string,
): Promise<void> {
  await redis.del(tenantKey(apiKey));
}

// ── Department cache ──────────────────────────────────────────────────────────

/**
 * Reads the department list for a tenant from the Redis cache.
 *
 * @returns The cached array, or null on a miss or parse error.
 */
export async function getCachedDepartments(
  redis: Redis,
  tenantId: string,
): Promise<Department[] | null> {
  const raw = await redis.get(deptListKey(tenantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Department[];
  } catch {
    return null;
  }
}

/** Writes the department list for a tenant to Redis with a 1-day TTL. */
export async function setCachedDepartments(
  redis: Redis,
  tenantId: string,
  departments: Department[],
): Promise<void> {
  await redis.setex(
    deptListKey(tenantId),
    DEPT_CACHE_TTL,
    JSON.stringify(departments),
  );
}

/** Removes the department list for a tenant from the Redis cache. */
export async function invalidateDeptCache(
  redis: Redis,
  tenantId: string,
): Promise<void> {
  await redis.del(deptListKey(tenantId));
}

// ── Bulk clear ────────────────────────────────────────────────────────────────

/**
 * Clears all Redis cache entries for a tenant: tenant row, dept list, and all
 * response-cache keys matching `cache:{tenantId}:*`.
 *
 * @returns The number of keys deleted.
 */
export async function clearAllTenantCaches(
  redis: Redis,
  apiKey: string,
  tenantId: string,
): Promise<number> {
  const keysToDelete: string[] = [tenantKey(apiKey), deptListKey(tenantId)];
  const responseCacheKeys = await redis.keys(`cache:${tenantId}:*`);
  keysToDelete.push(...responseCacheKeys);
  if (keysToDelete.length === 0) return 0;
  return redis.del(...keysToDelete);
}
