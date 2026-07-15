import { describe, it, expect, vi } from "vitest";
import {
  getCachedTenant,
  setCachedTenant,
  getCachedDepartments,
  setCachedDepartments,
  invalidateTenantCache,
} from "@/server/services/cache_service";
import type { Tenant, Department } from "@/server/db/schema";

const mockTenant: Tenant = {
  id: "tenant-uuid-1",
  name: "City of Testville",
  slug: "city-of-testville",
  apiKey: "test-key-123",
  websiteDomain: "testville.gov",
  searchDomains: [],
  logoPath: null,
  isActive: true,
  dailyRequestQuota: null,
  llmApiKey: null,
  widgetSettings: null,
  location: null,
  latitude: null,
  longitude: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockDept: Department = {
  id: "dept-uuid-1",
  tenantId: "tenant-uuid-1",
  name: "Public Works",
  phone: "555-100-2000",
  email: "pw@testville.gov",
  keywords: "roads,water,trash",
  location: null,
  hours: "Mon-Fri 8-5",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function makeMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    _store: store,
  };
}

describe("cache_service", () => {
  it("returns null on cache miss", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof getCachedTenant>[0];
    const result = await getCachedTenant(redis, "unknown-key");
    expect(result).toBeNull();
  });

  it("stores and retrieves tenant", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof getCachedTenant>[0];
    await setCachedTenant(redis, mockTenant.apiKey, mockTenant);
    const retrieved = await getCachedTenant(redis, mockTenant.apiKey);
    expect(retrieved?.id).toBe(mockTenant.id);
    expect(retrieved?.name).toBe(mockTenant.name);
  });

  it("returns null after invalidation", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof getCachedTenant>[0];
    await setCachedTenant(redis, mockTenant.apiKey, mockTenant);
    await invalidateTenantCache(redis, mockTenant.apiKey);
    const result = await getCachedTenant(redis, mockTenant.apiKey);
    expect(result).toBeNull();
  });

  it("stores and retrieves departments", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof getCachedDepartments>[0];
    await setCachedDepartments(redis, "tenant-uuid-1", [mockDept]);
    const retrieved = await getCachedDepartments(redis, "tenant-uuid-1");
    expect(retrieved).toHaveLength(1);
    expect(retrieved![0].name).toBe("Public Works");
  });
});
