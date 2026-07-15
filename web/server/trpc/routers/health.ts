import { router, publicProcedure } from "../init";
import { getRedis } from "@/server/redis";

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    let dbOk = false;
    let redisOk = false;

    try {
      await ctx.db.execute("SELECT 1" as unknown as Parameters<typeof ctx.db.execute>[0]);
      dbOk = true;
    } catch {}

    try {
      const redis = getRedis();
      await redis.ping();
      redisOk = true;
    } catch {}

    return {
      status: dbOk && redisOk ? "ok" : "degraded",
      db: dbOk,
      redis: redisOk,
      timestamp: new Date().toISOString(),
    };
  }),
});
