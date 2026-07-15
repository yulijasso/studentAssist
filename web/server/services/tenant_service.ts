/**
 * Tenant lookup service — read-only queries used by the request pipeline.
 *
 * All lookups check the Redis cache first to avoid hitting Postgres on every
 * request.  Write operations (create, update, delete) live in tenant_admin_service.
 */
import { eq } from "drizzle-orm";
import type { Redis } from "ioredis";
import type { DB } from "@/server/db";
import { tenants, type Tenant } from "@/server/db/schema";
import { getCachedTenant, setCachedTenant } from "./cache_service";

/**
 * Look up a tenant by API key, checking the Redis cache first.
 *
 * @param db - Drizzle database client.
 * @param apiKey - The raw API key from the request header.
 * @param redis - Optional Redis client; when provided, results are cached for 1 day.
 * @returns The matching tenant, or null if not found.
 */
export async function getTenantByApiKey(
  db: DB,
  apiKey: string,
  redis?: Redis,
): Promise<Tenant | null> {
  if (redis) {
    const cached = await getCachedTenant(redis, apiKey);
    if (cached) return cached;
  }

  const result = await db
    .select()
    .from(tenants)
    .where(eq(tenants.apiKey, apiKey))
    .limit(1);

  const tenant = result[0] ?? null;

  if (tenant && redis) {
    await setCachedTenant(redis, apiKey, tenant);
  }

  return tenant;
}

/**
 * Look up a tenant by URL slug.  Used by the public widget config endpoint.
 *
 * @param db - Drizzle database client.
 * @param slug - The tenant's unique URL slug (e.g. "city-of-pharr").
 * @returns The matching tenant, or null if not found.
 */
export async function getTenantBySlug(
  db: DB,
  slug: string,
): Promise<Tenant | null> {
  const result = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return result[0] ?? null;
}
