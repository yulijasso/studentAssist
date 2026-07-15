/**
 * Custom Next.js server with WebSocket support.
 *
 * Next.js HTTP on PORT (default 3000).
 * WebSocket server on WS_PORT (default 3001) — separate server so Next.js
 * dev mode's internal upgrade handler never interferes.
 */
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./server/db/index";
import { getRedis } from "./server/redis";
import { getTenantByApiKey } from "./server/services/tenant_service";
import { streamAgent } from "./server/agent/executor";
import { setCurrentTenant } from "./server/agent/tools/web_search";
import { SessionMemoryManager } from "./server/memory/session";
import { listDepartments } from "./server/services/department_service";
import {
  getOrCreateConversation,
  logMessage,
  updateConversationStatus,
  addRoutedDepartments,
  storeEscalationContact,
  logDisclaimerMessage,
  updateMessageLanguage,
} from "./server/services/conversation_service";
import { detectDepartments, detectEscalation, detectDisclaimer, type DisclaimerResult } from "./server/agent/routing";
import { env } from "./server/config";
import { wsLog } from "./server/logger";

// Bounds how long the fire-and-forget disclaimer classifier is allowed to run.
// Unlike routing/escalation, a missed disclaimer has real legal/compliance
// weight (see the "legal evidence" comment on logDisclaimerMessage), so a
// timeout here logs at error level rather than failing silently.
const DISCLAIMER_TIMEOUT_MS = 8_000;

/**
 * Races a promise against a timeout, resolving to `fallback` (never
 * rejecting) if the timeout wins.
 *
 * Used to bound the disclaimer classifier's latency without breaking the
 * parallel `Promise.all` it runs alongside — a rejection here would also
 * discard the department-routing and escalation results from the same
 * batch, so timing out must resolve, not throw.
 *
 * @param promise - The promise to bound.
 * @param ms - Timeout in milliseconds.
 * @param fallback - Value to resolve with if the timeout elapses first.
 * @param onTimeout - Called (synchronously) when the timeout wins — used for alerting.
 * @returns The original promise's result, or `fallback` on timeout.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  onTimeout: () => void,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      onTimeout();
      resolve(fallback);
    }, ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

// ── Conversation status detection ─────────────────────────────────────────────

const RESOLVED_PATTERNS = /\b(thank(?:s| you)|got it|that(?:'s| is) helpful|perfect|awesome|great(?:,| )thanks|appreciate it|problem solved|that works|all set|no more questions)\b/i;

/**
 * Returns true if the user's message looks like a resolution acknowledgement.
 *
 * @param userMessage - The user's latest message.
 * @returns Whether the conversation appears resolved.
 */
function detectResolved(userMessage: string): boolean {
  return RESOLVED_PATTERNS.test(userMessage);
}

const AGENT_FAREWELL_PATTERNS = /\b(have a (great|good|wonderful|nice) day|feel free to (reach out|contact|ask)|goodbye|take care|have a good one|it was (a )?pleasure|hope (that|this) (helps?|answered)|is there anything else I can (help|assist)|don't hesitate to (reach out|ask|contact))\b/i;

/**
 * Returns true if the agent's response looks like a closing farewell,
 * indicating the conversation is naturally over.
 *
 * @param answer - The agent's final response text.
 * @returns Whether the agent appears to have said goodbye.
 */
function detectAgentFarewell(answer: string): boolean {
  return AGENT_FAREWELL_PATTERNS.test(answer);
}

const dev = env.APP_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

interface WSFrame {
  type: string;
  [key: string]: unknown;
}

/** Fixed interval used for all inactivity stages (ms). */
const TIMER_MS = 90_000;

async function handleWebSocket(ws: WebSocket) {
  const redis = getRedis();
  const memManager = new SessionMemoryManager(redis);

  // Per-connection timer state
  let resolutionCheckTimer: NodeJS.Timeout | null = null;
  let resolutionTimeoutTimer: NodeJS.Timeout | null = null; // auto-close if check goes unanswered
  let followUpTimer: NodeJS.Timeout | null = null;
  let userInputTimer: NodeJS.Timeout | null = null;
  let clarificationTimer: NodeJS.Timeout | null = null; // fires escalation offer if user doesn't clarify
  let currentConvId: string | null = null;
  // Set after user confirms resolution — suppresses further resolution_check prompts
  let resolutionConfirmed = false;
  // When true, ws.on("close") will mark the conversation auto-resolved
  let shouldAutoResolve = false;

  /**
   * Clears all active inactivity timers.
   */
  function clearTimers(): void {
    if (resolutionCheckTimer) { clearTimeout(resolutionCheckTimer); resolutionCheckTimer = null; }
    if (resolutionTimeoutTimer) { clearTimeout(resolutionTimeoutTimer); resolutionTimeoutTimer = null; }
    if (followUpTimer) { clearTimeout(followUpTimer); followUpTimer = null; }
    if (userInputTimer) { clearTimeout(userInputTimer); userInputTimer = null; }
    if (clarificationTimer) { clearTimeout(clarificationTimer); clarificationTimer = null; }
  }

  /**
   * Closes the session cleanly: sends session_closed frame, flags for
   * auto-resolve, then closes the WebSocket.
   */
  function closeAutoResolved(): void {
    clearTimers();
    shouldAutoResolve = true;
    ws.send(JSON.stringify({ type: "session_closed", reason: "auto-resolved" }));
    ws.close(1000, "Auto-resolved");
  }

  /**
   * Starts inactivity timer after a completed agent response.
   *
   * - Before resolution confirmed: waits TIMER_MS then sends resolution_check.
   *   A second TIMER_MS timeout auto-closes if the check is never answered.
   * - After resolution confirmed: waits TIMER_MS then sends more_questions_check
   *   (no second resolution_check is ever shown again).
   */
  function startResolutionTimer(): void {
    clearTimers();
    if (!resolutionConfirmed) {
      resolutionCheckTimer = setTimeout(() => {
        resolutionCheckTimer = null;
        ws.send(JSON.stringify({ type: "resolution_check" }));
        // Auto-close if the resolution check is never answered
        resolutionTimeoutTimer = setTimeout(() => {
          resolutionTimeoutTimer = null;
          closeAutoResolved();
        }, TIMER_MS);
      }, TIMER_MS);
    } else {
      // Already confirmed — skip resolution_check, go straight to follow-up
      followUpTimer = setTimeout(() => {
        followUpTimer = null;
        ws.send(JSON.stringify({ type: "more_questions_check" }));
      }, TIMER_MS);
    }
  }

  wsLog.info("Client connected");

  // Auth handshake (10s timeout)
  const rawAuth = await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 10_000);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(data.toString());
    });
  });

  if (!rawAuth) {
    wsLog.warn("Auth timeout — closing connection");
    ws.close(4001, "Auth timeout");
    return;
  }

  let authFrame: WSFrame;
  try { authFrame = JSON.parse(rawAuth) as WSFrame; }
  catch {
    wsLog.warn("Invalid auth frame — closing connection");
    ws.close(4001, "Invalid auth frame");
    return;
  }

  const apiKey = authFrame.api_key as string | undefined;
  const sessionId = (authFrame.session_id as string | undefined) ?? "";

  const tenant = apiKey ? await getTenantByApiKey(db, apiKey, redis) : null;
  if (!tenant || !tenant.isActive) {
    wsLog.warn({ apiKey: apiKey?.slice(0, 8) + "…" }, "Invalid API key — closing connection");
    ws.close(4001, "Invalid API key");
    return;
  }

  const log = wsLog.child({ tenant: tenant.slug, sessionId });
  log.info("Auth OK");

  ws.send(JSON.stringify({ type: "auth_ok" }));

  ws.on("close", (code, reason) => {
    clearTimers();
    log.info({ code, reason: reason.toString() }, "Client disconnected");
    if (shouldAutoResolve && currentConvId && env.PERSIST_CHAT_MESSAGES) {
      void updateConversationStatus(db, currentConvId, "auto-resolved");
    }
  });

  ws.on("message", async (data) => {
    let frame: WSFrame;
    try { frame = JSON.parse(data.toString()) as WSFrame; }
    catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // ── Resolution check response ─────────────────────────────────────────────
    if (frame.type === "resolution_response") {
      clearTimers();
      if ((frame.resolved as boolean) === true) {
        resolutionConfirmed = true;
        // Acknowledge and give the user a chance to ask more questions
        ws.send(JSON.stringify({
          type: "system_message",
          content: "Great! Thanks for your feedback. Feel free to ask if anything else comes to mind.",
        }));
        // After 120 s of silence, ask if they have more questions
        followUpTimer = setTimeout(() => {
          followUpTimer = null;
          ws.send(JSON.stringify({ type: "more_questions_check" }));
        }, TIMER_MS);
      } else {
        // resolved: false → prompt user to clarify; if no response in 45 s, offer escalation
        ws.send(JSON.stringify({
          type: "system_message",
          content: "I'm sorry I wasn't able to fully resolve that. Could you share more details so I can try again?",
        }));
        clarificationTimer = setTimeout(() => {
          clarificationTimer = null;
          ws.send(JSON.stringify({ type: "escalation_offer", department: null }));
        }, 45_000);
      }
      return;
    }

    // ── More-questions check response ─────────────────────────────────────────
    if (frame.type === "more_questions_response") {
      clearTimers();
      if ((frame.hasMore as boolean) === true) {
        // User has more questions — give them 120 s to type; close if silent
        userInputTimer = setTimeout(() => {
          userInputTimer = null;
          closeAutoResolved();
        }, TIMER_MS);
      } else {
        // No more questions — thank and close
        ws.send(JSON.stringify({
          type: "system_message",
          content: "Thank you for using UTRGV Campus Assist! Have a great day.",
        }));
        closeAutoResolved();
      }
      return;
    }

    // ── Escalation: user accepted department callback offer ───────────────────
    if (frame.type === "escalation_accept") {
      ws.send(JSON.stringify({ type: "contact_form" }));
      return;
    }

    // ── Escalation: user submitted contact details ────────────────────────────
    if (frame.type === "contact_submit") {
      clearTimers();
      const name = ((frame.name as string) ?? "").trim();
      const phone = ((frame.phone as string) ?? "").trim();
      const emailRaw = ((frame.email as string) ?? "").trim();
      if (!name || !phone) {
        ws.send(JSON.stringify({ type: "error", content: "Name and phone number are required." }));
        return;
      }
      const contact = { name, phone, ...(emailRaw ? { email: emailRaw } : {}) };
      if (currentConvId && env.PERSIST_CHAT_MESSAGES) {
        try {
          await storeEscalationContact(db, currentConvId, contact);
          await updateConversationStatus(db, currentConvId, "escalated", true);
        } catch { /* ignore */ }
      }
      const confirmMsg = "Your request has been submitted. A representative from UTRGV will reach out to you within 24 hours.";
      // Log the confirmation to DB
      if (currentConvId && env.PERSIST_CHAT_MESSAGES) {
        try {
          await logMessage(db, currentConvId, "assistant", confirmMsg);
        } catch { /* ignore */ }
      }
      // Show confirmation in widget — session stays open so user can continue
      ws.send(JSON.stringify({ type: "system_message", content: confirmMsg }));
      return;
    }

    if (frame.type !== "message") return;
    const userMessage = ((frame.content as string) ?? "").trim();
    if (!userMessage) return;

    // Any new user message resets all inactivity timers
    clearTimers();

    log.info({ userMessage }, "User message received");
    const t0 = Date.now();

    try {
      const history = await memManager.load(sessionId);
      const sessionIsNew = history.length === 0;
      const departments = await listDepartments(db, tenant.id, redis);

      await setCurrentTenant(tenant, async () => {
        let conv: Awaited<ReturnType<typeof getOrCreateConversation>> | null = null;

        let userMsgRowId: string | null = null;
        if (env.PERSIST_CHAT_MESSAGES) {
          conv = await getOrCreateConversation(db, tenant.id, sessionId, sessionIsNew);
          currentConvId = conv.id;
          const userMsgRow = await logMessage(db, conv.id, "user", userMessage);
          userMsgRowId = userMsgRow.id;

          // Mark as open on first real message
          if (conv.status === "new") {
            await updateConversationStatus(db, conv.id, "open");
          }

          // Check if user is expressing gratitude → resolved
          if (detectResolved(userMessage)) {
            await updateConversationStatus(db, conv.id, "resolved");
            log.info("Conversation auto-marked as resolved");
          }
        }

        let finalAnswer = "";
        let finalSources: { title: string; url: string }[] = [];

        for await (const event of streamAgent(tenant, history, userMessage, departments)) {
          if (event.type === "token") {
            ws.send(JSON.stringify({ type: "token", token: event.token }));
          } else {
            finalAnswer = event.answer;
            finalSources = event.sources;
          }
        }

        if (env.PERSIST_CHAT_MESSAGES && conv) {
          const assistantMsgRow = await logMessage(db, conv.id, "assistant", finalAnswer, finalSources.length > 0 ? finalSources : undefined);

          // Routing, escalation, disclaimer — fire and forget, never blocks response
          void (async () => {
            try {
              const [matches, escalation, disclaimer] = await Promise.all([
                detectDepartments(tenant, departments, history, userMessage),
                detectEscalation(tenant, userMessage, finalAnswer, history),
                withTimeout<DisclaimerResult>(
                  detectDisclaimer(tenant, userMessage, finalAnswer),
                  DISCLAIMER_TIMEOUT_MS,
                  { requiresDisclaimer: false, reason: "" },
                  () =>
                    log.error(
                      { tenant: tenant.slug, timeoutMs: DISCLAIMER_TIMEOUT_MS, convId: conv?.id },
                      "ALERT: disclaimer classification timed out — a legally-relevant disclaimer may have been silently skipped",
                    ),
                ),
              ]);
              if (matches.length > 0 && userMsgRowId) {
                await addRoutedDepartments(db, conv!.id, matches, userMsgRowId);
              }
              // Tag both turns of this exchange with the detected language —
              // the assistant is instructed to mirror the user's language, so
              // the same classification applies to both rows.
              await Promise.all([
                userMsgRowId ? updateMessageLanguage(db, userMsgRowId, escalation.language) : null,
                updateMessageLanguage(db, assistantMsgRow.id, escalation.language),
              ]);
              // The client may have already disconnected by the time this
              // background classification finishes — never send on a closed
              // or closing socket.
              const socketOpen = ws.readyState === WebSocket.OPEN;
              if (escalation.shouldEscalate) {
                // Send escalation offer to widget — let the user decide
                const firstMatch = matches[0];
                const deptInfo = firstMatch
                  ? departments.find((d) => d.id === firstMatch.id)
                  : null;
                const deptPayload = deptInfo
                  ? { name: deptInfo.name, phone: deptInfo.phone ?? "" }
                  : null;
                if (socketOpen) {
                  ws.send(JSON.stringify({ type: "escalation_offer", department: deptPayload }));
                  log.info({ reason: escalation.reason }, "Escalation offer sent to client");
                } else {
                  log.info({ reason: escalation.reason }, "Escalation detected but socket closed — offer not sent");
                }
              }
              if (disclaimer.requiresDisclaimer) {
                const disclaimerText = "This information is for general guidance only and may not reflect the most current university policy or your specific situation. Please contact the relevant UTRGV office or consult a qualified professional before taking action.";
                if (socketOpen) {
                  ws.send(JSON.stringify({ type: "disclaimer", message: disclaimerText }));
                  log.info({ reason: disclaimer.reason }, "Disclaimer sent to client and persisted");
                } else {
                  log.warn({ reason: disclaimer.reason }, "Disclaimer required but socket closed — not sent to client, persisting anyway");
                }
                // Persist the disclaimer event regardless of whether the client
                // was reachable — it's the legal-audit record, not just a UI push.
                await logDisclaimerMessage(db, conv!.id, disclaimerText, disclaimer.reason);
              }
            } catch (err) {
              log.warn({ err }, "Post-response classification failed — skipping");
            }
          })();
        }

        await memManager.save(sessionId, history, userMessage, finalAnswer);

        log.info(
          { durationMs: Date.now() - t0, sources: finalSources.length, answer: finalAnswer },
          "Response sent",
        );

        ws.send(JSON.stringify({ type: "done", sources: finalSources }));

        // If the agent said goodbye, skip the resolution check and auto-close after TIMER_MS.
        // Otherwise start the normal inactivity → resolution check flow.
        if (detectAgentFarewell(finalAnswer)) {
          userInputTimer = setTimeout(() => {
            userInputTimer = null;
            closeAutoResolved();
          }, TIMER_MS);
        } else {
          startResolutionTimer();
        }
      });
    } catch (err) {
      log.error({ err }, "Error handling message");
      ws.send(JSON.stringify({ type: "error", message: String(err) }));
    }
  });
}

app.prepare().then(() => {
  // ── Next.js HTTP server (port 3000) ──────────────────────────────────────
  const httpPort = parseInt(process.env.PORT ?? "3000", 10);
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    void handle(req, res, parsedUrl);
  });
  server.listen(httpPort, () => {
    console.log(`> UTRGV Campus Assist ready on http://localhost:${httpPort}`);
  });

  // ── WebSocket server (port 3001) — isolated from Next.js ─────────────────
  const wsPort = parseInt(process.env.WS_PORT ?? "3001", 10);
  const wsHttpServer = createServer();
  const wss = new WebSocketServer({ server: wsHttpServer });
  wss.on("connection", (ws) => { void handleWebSocket(ws); });
  wsHttpServer.listen(wsPort, () => {
    console.log(`> WebSocket ready on ws://localhost:${wsPort}`);
  });
});
