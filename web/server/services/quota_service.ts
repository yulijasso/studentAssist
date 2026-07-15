/**
 * Per-tenant daily request quota tracking backed by Redis.
 *
 * Key:   quota:{tenant_id}:{YYYY-MM-DD}   (UTC date)
 * Value: integer count of requests made today
 * TTL:   seconds remaining until next UTC midnight
 */
import type { Redis } from "ioredis";

function quotaKey(tenantId: string, dateStr: string): string {
  return `quota:${tenantId}:${dateStr}`;
}

function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Check and increment the request counter for today.
 * Returns [allowed, currentCount, dailyLimit].
 * Counter is NOT incremented when denied.
 */
export async function checkAndIncrementQuota(
  redis: Redis,
  tenantId: string,
  dailyLimit: number | null,
): Promise<[allowed: boolean, current: number, limit: number | null]> {
  const key = quotaKey(tenantId, todayUtc());
  const raw = await redis.get(key);
  const current = raw ? parseInt(raw, 10) : 0;

  if (dailyLimit !== null && current >= dailyLimit) {
    return [false, current, dailyLimit];
  }

  const ttl = secondsUntilMidnightUtc();
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttl);
  const results = await pipeline.exec();
  const newCount = (results?.[0]?.[1] as number) ?? current + 1;

  return [true, newCount, dailyLimit];
}

export async function getCurrentUsage(redis: Redis, tenantId: string): Promise<number> {
  const raw = await redis.get(quotaKey(tenantId, todayUtc()));
  return raw ? parseInt(raw, 10) : 0;
}
