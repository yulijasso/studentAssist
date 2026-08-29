import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkSystemHealth } from "@/server/services/health_service";

// Minimal db/redis doubles — checkSystemHealth only calls db.execute() and redis.ping().
function makeDeps({ db = true, redis = true }: { db?: boolean; redis?: boolean } = {}) {
  return {
    db: {
      execute: async () => {
        if (!db) throw new Error("db down");
        return [];
      },
    } as never,
    redis: {
      ping: async () => {
        if (!redis) throw new Error("redis down");
        return "PONG";
      },
    } as never,
  };
}

const REAL_KEY = "x".repeat(20); // passes the >=12-char "present" check
const ENV_KEYS = [
  "LLM_PROVIDER", "LLM_BASE_URL", "GROQ_API_KEY", "OPENROUTER_API_KEY",
  "CLERK_SECRET_KEY", "SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL", "TAVILY_API_KEY",
];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const find = (r: Awaited<ReturnType<typeof checkSystemHealth>>, key: string) =>
  r.integrations.find((i) => i.key === key)!;

describe("checkSystemHealth (presence mode)", () => {
  it("reports live db and redis status", async () => {
    const { db, redis } = makeDeps({ db: true, redis: true });
    const ok = await checkSystemHealth(db, redis, false);
    expect(ok.db).toBe(true);
    expect(ok.redis).toBe(true);

    const down = makeDeps({ db: false, redis: false });
    const bad = await checkSystemHealth(down.db, down.redis, false);
    expect(bad.db).toBe(false);
    expect(bad.redis).toBe(false);
  });

  it("marks LLM ok when the active provider's key is present", async () => {
    process.env.LLM_PROVIDER = "groq";
    process.env.GROQ_API_KEY = REAL_KEY;
    const { db, redis } = makeDeps();
    const llm = find(await checkSystemHealth(db, redis, false), "llm");
    expect(llm.status).toBe("ok");
    expect(llm.verified).toBe(false); // presence-only, not a live probe
  });

  it("treats a short placeholder key as not configured", async () => {
    process.env.LLM_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gsk_"; // placeholder stub
    const { db, redis } = makeDeps();
    const llm = find(await checkSystemHealth(db, redis, false), "llm");
    expect(llm.status).toBe("not_configured");
  });

  it("is provider-agnostic — derives the key from LLM_PROVIDER", async () => {
    process.env.LLM_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = REAL_KEY;
    const { db, redis } = makeDeps();
    const r = await checkSystemHealth(db, redis, false);
    expect(r.llmProvider).toBe("openrouter");
    expect(find(r, "llm").status).toBe("ok");
  });

  it("reports unknown when no provider is set", async () => {
    const { db, redis } = makeDeps();
    const llm = find(await checkSystemHealth(db, redis, false), "llm");
    expect(llm.status).toBe("unknown");
  });

  it("requires both key and from-address for email", async () => {
    process.env.SENDGRID_API_KEY = REAL_KEY;
    const { db, redis } = makeDeps();
    expect(find(await checkSystemHealth(db, redis, false), "email").status).toBe("not_configured");

    process.env.SENDGRID_FROM_EMAIL = "noreply@example.com";
    expect(find(await checkSystemHealth(db, redis, false), "email").status).toBe("ok");
  });

  it("checks auth (Clerk) and web search (Tavily) presence", async () => {
    const { db, redis } = makeDeps();
    const r1 = await checkSystemHealth(db, redis, false);
    expect(find(r1, "auth").status).toBe("not_configured");
    expect(find(r1, "web_search").status).toBe("not_configured");

    process.env.CLERK_SECRET_KEY = REAL_KEY;
    process.env.TAVILY_API_KEY = REAL_KEY;
    const r2 = await checkSystemHealth(db, redis, false);
    expect(find(r2, "auth").status).toBe("ok");
    expect(find(r2, "web_search").status).toBe("ok");
  });

  it("marks LLM, auth, and email as required; web search as optional", async () => {
    const { db, redis } = makeDeps();
    const r = await checkSystemHealth(db, redis, false);
    expect(find(r, "llm").required).toBe(true);
    expect(find(r, "auth").required).toBe(true);
    expect(find(r, "email").required).toBe(true); // invitations depend on SendGrid
    expect(find(r, "web_search").required).toBe(false);
  });
});
