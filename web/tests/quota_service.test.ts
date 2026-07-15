import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndIncrementQuota, getCurrentUsage } from "@/server/services/quota_service";

function makeMockRedis() {
  const store = new Map<string, string>();
  const expirations = new Map<string, number>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
    pipeline: vi.fn(() => {
      const ops: Array<() => void> = [];
      const pipe = {
        incr: vi.fn((key: string) => {
          ops.push(() => {
            const current = parseInt(store.get(key) ?? "0", 10);
            store.set(key, String(current + 1));
          });
          return pipe;
        }),
        expire: vi.fn((_key: string, _ttl: number) => {
          ops.push(() => {});
          return pipe;
        }),
        exec: vi.fn(async () => {
          const results: Array<[null, unknown]> = [];
          for (const op of ops) {
            op();
            // Return the current count after incr
            results.push([null, 1]);
          }
          // Fix: return the actual incremented value for first op
          const lastKey = Array.from(store.keys()).find((k) => k.startsWith("quota:"));
          const val = lastKey ? parseInt(store.get(lastKey)!, 10) : 1;
          return [[null, val], [null, true]];
        }),
      };
      return pipe;
    }),
    _store: store,
  };
}

describe("checkAndIncrementQuota", () => {
  it("allows request when no quota set", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof checkAndIncrementQuota>[0];
    const [allowed, , limit] = await checkAndIncrementQuota(redis, "tenant-1", null);
    expect(allowed).toBe(true);
    expect(limit).toBeNull();
  });

  it("allows request when under quota", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof checkAndIncrementQuota>[0];
    const [allowed] = await checkAndIncrementQuota(redis, "tenant-2", 100);
    expect(allowed).toBe(true);
  });

  it("denies request when at quota limit", async () => {
    const redis = makeMockRedis() as unknown as Parameters<typeof checkAndIncrementQuota>[0];
    // Pre-fill with 100 requests
    (redis as unknown as { _store: Map<string, string> })._store.set(
      `quota:tenant-3:${new Date().toISOString().slice(0, 10)}`,
      "100",
    );
    const [allowed, current, limit] = await checkAndIncrementQuota(redis, "tenant-3", 100);
    expect(allowed).toBe(false);
    expect(current).toBe(100);
    expect(limit).toBe(100);
  });
});
