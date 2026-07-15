/**
 * LLM rate-limit monitoring, exponential backoff, and admin email alerts.
 *
 * 1. Captures x-ratelimit-* response headers on Groq API calls (no-op for other providers).
 * 2. Fires a background admin email when token budget < threshold OR 429.
 * 3. Wraps executor.invoke() with p-retry exponential backoff on 429s.
 */
import pRetry, { AbortError } from "p-retry";
import nodemailer from "nodemailer";
import { env } from "@/server/config";

const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ── Rate-limit state singleton ────────────────────────────────────────────────

/**
 * Singleton that tracks the latest LLM provider rate-limit header values and manages
 * the alert cooldown timer. Populated only for providers that return x-ratelimit-* headers (e.g. Groq).
 */
class RateLimitState {
  remainingTokens: number | null = null;
  remainingRequests: number | null = null;
  limitTokens: number | null = null;
  limitRequests: number | null = null;
  private lastAlertAt = 0;

  /**
   * Parses and stores rate-limit values from response headers.
   * No-op if x-ratelimit-* headers are absent (e.g. OpenRouter, Anthropic).
   *
   * @param headers - Response headers keyed by lowercase header name.
   */
  update(headers: Record<string, string | undefined>): void {
    // Only update if at least one rate-limit header is present (Groq-specific headers)
    if (!headers["x-ratelimit-remaining-tokens"] && !headers["x-ratelimit-limit-tokens"]) return;
    const parse = (v: string | undefined) =>
      v !== undefined ? parseInt(v, 10) : null;
    this.remainingTokens = parse(headers["x-ratelimit-remaining-tokens"]);
    this.remainingRequests = parse(headers["x-ratelimit-remaining-requests"]);
    this.limitTokens = parse(headers["x-ratelimit-limit-tokens"]);
    this.limitRequests = parse(headers["x-ratelimit-limit-requests"]);
  }

  /** Returns a plain-object snapshot of current rate-limit values for logging. */
  snapshot() {
    return {
      remainingTokens: this.remainingTokens,
      remainingRequests: this.remainingRequests,
      limitTokens: this.limitTokens,
      limitRequests: this.limitRequests,
    };
  }

  /**
   * Returns true if an alert email should fire now.
   * Enforces a 5-minute cooldown between successive alerts.
   *
   * @param threshold - Fraction of token budget remaining below which to alert (e.g. 0.1 = 10%).
   */
  shouldAlert(threshold: number): boolean {
    if (this.limitTokens === null || this.remainingTokens === null) return false;
    if (this.remainingTokens / this.limitTokens > threshold) return false;
    if (Date.now() - this.lastAlertAt < ALERT_COOLDOWN_MS) return false;
    this.lastAlertAt = Date.now();
    return true;
  }
}

export const rateLimitState = new RateLimitState();

// ── Fetch interceptor for Groq responses ──────────────────────────────────────

export function onGroqResponse(headers: Record<string, string | undefined>, statusCode: number): void {
  rateLimitState.update(headers);
  maybeSendAlert(statusCode);
}

// ── Exponential backoff wrapper ───────────────────────────────────────────────

/**
 * Returns true if an error represents a Groq 429 rate-limit response.
 *
 * @param err - The thrown error.
 */
function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("rate limit") || msg.includes("429")) return true;
    const status = (err as { status?: number }).status;
    if (status === 429) return true;
  }
  return false;
}

export async function invokeWithBackoff(
  executor: { invoke: (input: Record<string, unknown>) => Promise<Record<string, unknown>> },
  inputData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return pRetry(
    async (attemptNumber) => {
      try {
        return await executor.invoke(inputData);
      } catch (err) {
        if (!isRateLimitError(err)) {
          throw new AbortError(err instanceof Error ? err : new Error(String(err)));
        }
        if (attemptNumber >= env.BACKOFF_MAX_ATTEMPTS) throw err;
        throw err;
      }
    },
    {
      retries: env.BACKOFF_MAX_ATTEMPTS - 1,
      minTimeout: env.BACKOFF_MIN_WAIT * 1000,
      maxTimeout: env.BACKOFF_MAX_WAIT * 1000,
      factor: env.BACKOFF_MULTIPLIER * 2,
    },
  );
}

// ── Admin email alert ─────────────────────────────────────────────────────────

/**
 * Fires a background admin email alert if the rate-limit state warrants it.
 * Silent no-op if ADMIN_EMAIL / SMTP_HOST are not configured.
 *
 * @param statusCode - HTTP status code from the Groq response.
 */
function maybeSendAlert(statusCode: number): void {
  const triggeredBy429 = statusCode === 429;
  const triggeredByPressure = rateLimitState.shouldAlert(env.RATE_LIMIT_ALERT_THRESHOLD);
  if (!triggeredBy429 && !triggeredByPressure) return;

  const reason = triggeredBy429
    ? "429 Rate Limit Exceeded"
    : `token budget below ${env.RATE_LIMIT_ALERT_THRESHOLD * 100}%`;

  // Fire-and-forget
  sendAlertEmail(reason, rateLimitState.snapshot()).catch(() => {});
}

/**
 * Sends a rate-limit warning email via SMTP.
 *
 * @param reason - Human-readable reason string (e.g. "429 Rate Limit Exceeded").
 * @param snap - Current rate-limit snapshot for inclusion in the email body.
 */
async function sendAlertEmail(
  reason: string,
  snap: ReturnType<RateLimitState["snapshot"]>,
): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.SMTP_HOST) return;

  const body = [
    "Campus Assist — LLM Rate Limit Alert",
    "=".repeat(45),
    "",
    `Reason      : ${reason}`,
    `Provider    : ${env.LLM_PROVIDER}`,
    `Model       : ${env.LLM_MODEL}`,
    `Environment : ${env.APP_ENV}`,
    "",
    `Tokens   remaining : ${snap.remainingTokens} / ${snap.limitTokens}`,
    `Requests remaining : ${snap.remainingRequests} / ${snap.limitRequests}`,
    "",
    "Reduce request volume or upgrade your LLM provider plan to avoid service interruption.",
  ].join("\n");

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_TLS,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  await transporter.sendMail({
    from: env.ALERT_FROM_EMAIL,
    to: env.ADMIN_EMAIL,
    subject: `[Campus Assist] LLM Rate Limit — ${reason}`,
    text: body,
  });
}
