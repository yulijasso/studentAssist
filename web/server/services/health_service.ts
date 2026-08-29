/**
 * System health computation shared by the read-only health query and the
 * alerting health-check mutation.
 *
 * `deep` runs live credential probes (LLM /models, SendGrid /scopes); the fast
 * path is presence-only so the admin auth-gate and auto-refresh stay snappy.
 */
import { sql } from "drizzle-orm";
import type { DB } from "@/server/db/index";
import type { getRedis } from "@/server/redis";

type RedisClient = ReturnType<typeof getRedis>;

export type IntegrationStatus =
  | "ok"
  | "invalid"
  | "unreachable"
  | "not_configured"
  | "unknown";

export interface Integration {
  key: string;
  label: string;
  required: boolean;
  status: IntegrationStatus;
  /** true when `status` came from a live credential probe, not just presence. */
  verified: boolean;
  detail?: string;
}

export interface HealthResult {
  db: boolean;
  redis: boolean;
  llmProvider: string | null;
  deep: boolean;
  integrations: Integration[];
}

export async function checkSystemHealth(
  db: DB,
  redis: RedisClient,
  deep: boolean,
): Promise<HealthResult> {
  // Core services — always a real, local liveness check.
  let dbOk = false;
  let redisOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {}
  try {
    await redis.ping();
    redisOk = true;
  } catch {}

  // A value counts as present only if it's not an obvious placeholder stub
  // (e.g. "gsk_", "tvly-", "sk-or-"). Real API keys are long.
  const present = (value: string | undefined, minLen = 12) =>
    !!value && value.trim().length >= minLen;

  // Hit an endpoint and classify the credential outcome.
  const probe = async (
    url: string,
    headers: Record<string, string>,
  ): Promise<IntegrationStatus> => {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(3000) });
      if (res.ok) return "ok";
      if (res.status === 401 || res.status === 403) return "invalid";
      return "unreachable";
    } catch {
      return "unreachable";
    }
  };

  // ── LLM — provider-agnostic (key derived as <PROVIDER>_API_KEY, base URL from
  //    LLM_BASE_URL or a known-provider lookup). New providers need no change.
  const providerId = (process.env.LLM_PROVIDER ?? "").toLowerCase().trim();
  const KNOWN_BASE_URLS: Record<string, string> = {
    groq: "https://api.groq.com/openai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    openai: "https://api.openai.com/v1",
  };
  const llmKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
  const llmBaseURL = process.env.LLM_BASE_URL || KNOWN_BASE_URLS[providerId];

  let llm: Integration;
  if (!providerId) {
    llm = { key: "llm", label: "LLM — not set", required: true, status: "unknown", verified: false, detail: "LLM_PROVIDER is empty" };
  } else if (!present(llmKey)) {
    llm = { key: "llm", label: `LLM — ${providerId}`, required: true, status: "not_configured", verified: false, detail: `${providerId.toUpperCase()}_API_KEY missing` };
  } else if (deep && llmBaseURL) {
    const status = await probe(`${llmBaseURL}/models`, { Authorization: `Bearer ${llmKey}` });
    llm = { key: "llm", label: `LLM — ${providerId}`, required: true, status, verified: true };
  } else {
    llm = { key: "llm", label: `LLM — ${providerId}`, required: true, status: "ok", verified: false, detail: deep ? "no base URL to verify" : undefined };
  }

  // ── Email — SendGrid. Verifiable via /v3/scopes (no send).
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const emailPresent = present(sendgridKey) && !!process.env.SENDGRID_FROM_EMAIL;
  let email: Integration;
  if (!emailPresent) {
    email = { key: "email", label: "Email — SendGrid", required: true, status: "not_configured", verified: false, detail: present(sendgridKey) ? "SENDGRID_FROM_EMAIL missing" : "SENDGRID_API_KEY missing" };
  } else if (deep) {
    const status = await probe("https://api.sendgrid.com/v3/scopes", { Authorization: `Bearer ${sendgridKey}` });
    email = { key: "email", label: "Email — SendGrid", required: true, status, verified: true, detail: status === "ok" ? "key valid (sender must still be verified)" : undefined };
  } else {
    email = { key: "email", label: "Email — SendGrid", required: true, status: "ok", verified: false };
  }

  // ── Auth (Clerk) and Web Search (Tavily) — presence only.
  const auth: Integration = {
    key: "auth",
    label: "Auth — Clerk",
    required: true,
    status: present(process.env.CLERK_SECRET_KEY) ? "ok" : "not_configured",
    verified: false,
  };
  const webSearch: Integration = {
    key: "web_search",
    label: "Web Search — Tavily",
    required: false,
    status: present(process.env.TAVILY_API_KEY) ? "ok" : "not_configured",
    verified: false,
  };

  return {
    db: dbOk,
    redis: redisOk,
    llmProvider: providerId || null,
    deep,
    integrations: [llm, auth, email, webSearch],
  };
}
