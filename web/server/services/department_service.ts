/**
 * Department service — CRUD operations for tenant departments.
 *
 * Read operations use Redis caching (TTL 1 day) to avoid DB hits on every
 * agent invocation.  All write operations invalidate the dept cache for the
 * affected tenant.
 */
import { eq, and } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { DB } from "@/server/db";
import {
  departments,
  type Department,
  type NewDepartment,
} from "@/server/db/schema";
import {
  getCachedDepartments,
  setCachedDepartments,
  invalidateDeptCache,
} from "./cache_service";

/**
 * Inserts a new department and invalidates the tenant's dept cache.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client for cache invalidation.
 * @param data - Department fields (tenantId is required).
 * @returns The newly created department row.
 */
export async function createDepartment(
  db: DB,
  redis: Redis,
  data: Omit<NewDepartment, "id" | "createdAt" | "updatedAt">,
): Promise<Department> {
  const [dept] = await db.insert(departments).values(data).returning();
  await invalidateDeptCache(redis, data.tenantId);
  return dept!;
}

/**
 * Returns all departments for a tenant, checking the Redis cache first.
 *
 * @param db - Drizzle database client.
 * @param tenantId - Tenant UUID.
 * @param redis - Optional Redis client; when provided, results are cached for 1 day.
 * @returns Array of departments ordered by name.
 */
export async function listDepartments(
  db: DB,
  tenantId: string,
  redis?: Redis,
): Promise<Department[]> {
  if (redis) {
    const cached = await getCachedDepartments(redis, tenantId);
    if (cached) return cached;
  }

  const result = await db
    .select()
    .from(departments)
    .where(eq(departments.tenantId, tenantId))
    .orderBy(departments.name);

  if (redis) {
    await setCachedDepartments(redis, tenantId, result);
  }

  return result;
}

/**
 * Fetches a single department by ID, scoped to the given tenant.
 *
 * @param db - Drizzle database client.
 * @param tenantId - Tenant UUID (enforces tenant isolation).
 * @param deptId - Department UUID.
 * @returns The department, or null if not found.
 */
export async function getDepartmentById(
  db: DB,
  tenantId: string,
  deptId: string,
): Promise<Department | null> {
  const result = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, deptId), eq(departments.tenantId, tenantId)))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Updates mutable department fields and invalidates the tenant's dept cache.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client for cache invalidation.
 * @param tenantId - Tenant UUID (enforces tenant isolation).
 * @param deptId - Department UUID.
 * @param data - Partial set of updatable fields.
 * @returns The updated department, or null if not found.
 */
export async function updateDepartment(
  db: DB,
  redis: Redis,
  tenantId: string,
  deptId: string,
  data: Partial<
    Pick<NewDepartment, "name" | "phone" | "email" | "keywords" | "location" | "hours">
  >,
): Promise<Department | null> {
  const [updated] = await db
    .update(departments)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(departments.id, deptId), eq(departments.tenantId, tenantId)))
    .returning();

  if (updated) await invalidateDeptCache(redis, tenantId);
  return updated ?? null;
}

/**
 * Deletes a department and invalidates the tenant's dept cache.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client for cache invalidation.
 * @param tenantId - Tenant UUID (enforces tenant isolation).
 * @param deptId - Department UUID.
 * @returns True if deleted, false if not found.
 */
export async function deleteDepartment(
  db: DB,
  redis: Redis,
  tenantId: string,
  deptId: string,
): Promise<boolean> {
  const result = await db
    .delete(departments)
    .where(and(eq(departments.id, deptId), eq(departments.tenantId, tenantId)))
    .returning();

  if (result.length > 0) {
    await invalidateDeptCache(redis, tenantId);
    return true;
  }
  return false;
}
