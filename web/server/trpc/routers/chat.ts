/**
 * Chat router — tRPC mutation for REST chat + SSE/WS streaming.
 *
 * LangGraph 1.x execution order (_runAgent):
 * 1. Quota check
 * 2. Load session history (BaseMessage[]) from Redis — determines sessionIsNew
 * 3. Response cache check (uses sessionIsNew for conversation scoping)
 * 4. Load departments
 * 5. Invoke agent (history prepended as messages array)
 * 6. Extract answer + sources
 * 7. Cache response
 * 8. Persist messages (optional, uses sessionIsNew for conversation scoping)
 * 9. Save updated history to Redis
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import { router, tenantProcedure } from "../init";
import { invokeAgent } from "@/server/agent/executor";
import { setCurrentTenant } from "@/server/agent/tools/web_search";
import { SessionMemoryManager } from "@/server/memory/session";
import { listDepartments } from "@/server/services/department_service";
import { checkAndIncrementQuota } from "@/server/services/quota_service";
import {
  getOrCreateConversation,
  logMessage,
  addRoutedDepartments,
  updateConversationStatus,
} from "@/server/services/conversation_service";
import { detectDepartments, detectEscalation } from "@/server/agent/routing";
import { invokeWithBackoff, rateLimitState } from "@/server/llm/groq_rate_limiter";
import { env } from "@/server/config";
import { httpLog } from "@/server/logger";
import type { Tenant } from "@/server/db/schema";
import type { Redis } from "ioredis";
import type { DB } from "@/server/db";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface SourceItem {
  title: string;
  url: string;
}

function cacheKey(tenantId: string, message: string): string {
  const digest = createHash("sha256")
    .update(message.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
  return `cache:${tenantId}:${digest}`;
}

async function getCachedResponse(
  redis: Redis,
  tenantId: string,
  message: string,
): Promise<{ answer: string; sources: SourceItem[] } | null> {
  const raw = await redis.get(cacheKey(tenantId, message));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { answer: string; sources: SourceItem[] };
  } catch {
    return null;
  }
}

async function setCachedResponse(
  redis: Redis,
  tenantId: string,
  message: string,
  answer: string,
  sources: SourceItem[],
): Promise<void> {
  const ttl = env.RESPONSE_CACHE_TTL_SECONDS;
  if (ttl <= 0) return;
  await redis.setex(
    cacheKey(tenantId, message),
    ttl,
    JSON.stringify({ answer, sources }),
  );
}

function calcTokensConsumed(before: number | null, after: number | null) {
  if (before !== null && after !== null) {
    const delta = before - after;
    return delta >= 0 ? delta : null;
  }
  if (after !== null && rateLimitState.limitTokens !== null) {
    return rateLimitState.limitTokens - after;
  }
  return null;
}

// ── Core agent execution ──────────────────────────────────────────────────────

export async function runAgent(
  tenant: Tenant,
  sessionId: string,
  message: string,
  db: DB,
  redis: Redis,
): Promise<{ answer: string; sources: SourceItem[] }> {
  const log = httpLog.child({ tenant: tenant.slug, sessionId });
  const t0 = Date.now();
  log.info({ message }, "chat.send received");

  // 1. Quota check
  const [allowed, currentCount, dailyLimit] = await checkAndIncrementQuota(
    redis,
    tenant.id,
    tenant.dailyRequestQuota,
  );
  if (!allowed) {
    log.warn({ currentCount, dailyLimit }, "Quota exceeded");
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Daily request quota exceeded. Used ${currentCount} of ${dailyLimit} requests today (UTC). Quota resets at midnight UTC.`,
    });
  }

  // 2. Load session history — needed before cache path so sessionIsNew is available
  const memManager = new SessionMemoryManager(redis);
  const history = await memManager.load(sessionId);
  const sessionIsNew = history.length === 0;

  // 3. Cache check
  const cached = await getCachedResponse(redis, tenant.id, message);
  if (cached) {
    log.info({ durationMs: Date.now() - t0, cacheHit: true }, "chat.send responded from cache");
    if (env.PERSIST_CHAT_MESSAGES) {
      const conv = await getOrCreateConversation(db, tenant.id, sessionId, sessionIsNew);
      await logMessage(db, conv.id, "user", message);
      await logMessage(db, conv.id, "assistant", cached.answer);
    }
    return cached;
  }

  // 4. Load departments
  const departments = await listDepartments(db, tenant.id, redis);

  // 5–6. Invoke agent inside tenant context
  let answer = "";
  let sources: SourceItem[] = [];

  await setCurrentTenant(tenant, async () => {
    const tokensBefore = rateLimitState.remainingTokens;

    const result = await invokeWithBackoff(
      {
        invoke: async (input: Record<string, unknown>) => {
          const { invokeAgent: ia } = await import("@/server/agent/executor");
          return ia(
            tenant,
            history,
            input["message"] as string,
            departments,
          ) as unknown as Record<string, unknown>;
        },
      },
      { message },
    );

    const tokensAfter = rateLimitState.remainingTokens;
    void calcTokensConsumed(tokensBefore, tokensAfter);

    const r = result as unknown as { answer: string; sources: SourceItem[] };
    answer = r.answer;
    sources = r.sources;
  });

  // 7. Cache response
  await setCachedResponse(redis, tenant.id, message, answer, sources);

  // 8. Persist messages (optional)
  if (env.PERSIST_CHAT_MESSAGES) {
    const conv = await getOrCreateConversation(db, tenant.id, sessionId, sessionIsNew);
    const userMsgRow = await logMessage(db, conv.id, "user", message);
    await logMessage(db, conv.id, "assistant", answer);

    // Routing + escalation — fire and forget, never blocks response
    void (async () => {
      try {
        const [matches, escalation] = await Promise.all([
          detectDepartments(tenant, departments, history, message),
          detectEscalation(tenant, message, answer, history),
        ]);
        if (matches.length > 0) {
          await addRoutedDepartments(db, conv.id, matches, userMsgRow.id);
        }
        if (escalation.shouldEscalate) {
          await updateConversationStatus(db, conv.id, "escalated", true);
          log.info({ reason: escalation.reason }, "Conversation auto-marked as escalated");
        }
      } catch (err) {
        log.warn({ err }, "Post-response classification failed — skipping");
      }
    })();
  }

  // 9. Save updated history to Redis
  await memManager.save(sessionId, history, message, answer);

  log.info(
    { durationMs: Date.now() - t0, cacheHit: false, sources: sources.length, answer },
    "chat.send responded",
  );

  return { answer, sources };
}

// ── tRPC router ───────────────────────────────────────────────────────────────

export const chatRouter = router({
  send: tenantProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        message: z.string().min(1).max(4096),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { answer, sources } = await runAgent(
        ctx.tenant,
        input.sessionId,
        input.message,
        ctx.db,
        ctx.redis,
      );
      return { answer, sources, sessionId: input.sessionId };
    }),

  // Public config endpoint — used by the widget
  tenantConfig: tenantProcedure.query(async ({ ctx }) => {
    return {
      slug: ctx.tenant.slug,
      name: ctx.tenant.name,
      websiteDomain: ctx.tenant.websiteDomain,
      apiKey: ctx.tenant.apiKey,
    };
  }),
});
