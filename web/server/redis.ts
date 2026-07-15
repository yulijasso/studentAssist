import Redis from "ioredis";
import { env } from "@/server/config";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    _redis.on("error", (err) => console.error("[Redis]", err));
  }
  return _redis;
}
