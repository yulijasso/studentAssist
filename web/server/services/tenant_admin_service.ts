/**
 * Tenant admin service — CRUD operations for the admin dashboard.
 *
 * All mutating functions invalidate the relevant Redis cache entries so that
 * subsequent reads via tenant_service see fresh data immediately.
 */
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import type { Redis } from "ioredis";
import type { DB } from "@/server/db";
import { tenants, departments, type Tenant, type NewTenant } from "@/server/db/schema";
import {
  invalidateTenantCache,
  invalidateDeptCache,
  clearAllTenantCaches,
} from "./cache_service";
import { geocodeCity } from "./geocode_service";

/**
 * Generates a cryptographically random 64-character hex API key.
 *
 * @returns A 64-character lowercase hex string.
 */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Creates a new tenant with a freshly generated API key.
 *
 * @param db - Drizzle database client.
 * @param data - Tenant creation fields (name, slug, websiteDomain, optional searchDomains).
 * @returns The newly created tenant row.
 */
export async function createTenant(
  db: DB,
  data: {
    name: string;
    slug: string;
    websiteDomain: string;
    searchDomains?: string[];
    location?: string;
  },
): Promise<Tenant> {
  // Auto-geocode from location field, falling back to name
  const searchTerm = data.location || data.name;
  const coords = await geocodeCity(searchTerm, data.websiteDomain);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: data.name,
      slug: data.slug,
      apiKey: generateApiKey(),
      websiteDomain: data.websiteDomain,
      searchDomains: data.searchDomains ?? [],
      location: data.location ?? null,
      isActive: true,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    })
    .returning();
  return tenant!;
}

/**
 * Returns all tenants ordered by creation date (oldest first).
 *
 * @param db - Drizzle database client.
 */
export async function listTenants(db: DB): Promise<Tenant[]> {
  return db.select().from(tenants).orderBy(tenants.createdAt);
}

/**
 * Fetches a single tenant by primary key.
 *
 * @param db - Drizzle database client.
 * @param id - Tenant UUID.
 * @returns The tenant, or null if not found.
 */
export async function getTenantById(db: DB, id: string): Promise<Tenant | null> {
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] ?? null;
}

/**
 * Updates mutable tenant fields and invalidates the Redis cache.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client used to invalidate the tenant and dept caches.
 * @param id - Tenant UUID.
 * @param data - Partial set of updatable fields.
 * @returns The updated tenant, or null if the tenant was not found.
 */
export async function updateTenant(
  db: DB,
  redis: Redis,
  id: string,
  data: Partial<
    Pick<
      NewTenant,
      | "name"
      | "websiteDomain"
      | "searchDomains"
      | "isActive"
      | "dailyRequestQuota"
      | "llmApiKey"
      | "location"
      | "latitude"
      | "longitude"
    >
  >,
): Promise<Tenant | null> {
  const existing = await getTenantById(db, id);
  if (!existing) return null;

  // Auto-geocode if location changed and no explicit coordinates provided
  if (data.location && data.location !== existing.location && data.latitude === undefined && data.longitude === undefined) {
    const coords = await geocodeCity(data.location);
    if (coords) {
      data.latitude = coords.latitude;
      data.longitude = coords.longitude;
    }
  }

  const [updated] = await db
    .update(tenants)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();

  if (updated) {
    await invalidateTenantCache(redis, existing.apiKey);
    await invalidateDeptCache(redis, id);
  }

  return updated ?? null;
}

/**
 * Deletes a tenant and clears all associated Redis cache entries.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client for cache invalidation.
 * @param id - Tenant UUID.
 * @returns True if deleted, false if the tenant was not found.
 */
export async function deleteTenant(
  db: DB,
  redis: Redis,
  id: string,
): Promise<boolean> {
  const existing = await getTenantById(db, id);
  if (!existing) return false;

  await db.delete(tenants).where(eq(tenants.id, id));
  await clearAllTenantCaches(redis, existing.apiKey, id);
  return true;
}

/**
 * Generates a new API key for a tenant, invalidating the old cached key.
 *
 * @param db - Drizzle database client.
 * @param redis - Redis client for cache invalidation.
 * @param id - Tenant UUID.
 * @returns The new API key string, or null if the tenant was not found.
 */
export async function rotateTenantKey(
  db: DB,
  redis: Redis,
  id: string,
): Promise<string | null> {
  const existing = await getTenantById(db, id);
  if (!existing) return null;

  const newKey = generateApiKey();
  await db
    .update(tenants)
    .set({ apiKey: newKey, updatedAt: new Date() })
    .where(eq(tenants.id, id));

  await invalidateTenantCache(redis, existing.apiKey);
  return newKey;
}
