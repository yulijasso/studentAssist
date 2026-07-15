/**
 * Agent executor factory — LangGraph 1.x.
 *
 * Uses createReactAgent from @langchain/langgraph/prebuilt.
 * Conversation history is passed as the `messages` array in each invocation
 * (no BufferWindowMemory wrapper needed — history is managed externally via
 * SessionMemoryManager and prepended here).
 *
 * Caching: (tenantId, llmApiKey, deptHash) → compiled agent graph
 * Bounded to 128 entries; LRU eviction when full.
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { buildSystemPrompt } from "./prompts";
import { searchUniversityWebsite } from "./tools/web_search";
import { getLlm } from "@/server/llm/factory";
import { agentLog } from "@/server/logger";
import type { Tenant, Department } from "@/server/db/schema";

type CompiledAgent = ReturnType<typeof createReactAgent>;

const _agentCache = new Map<string, CompiledAgent>();
const AGENT_CACHE_MAX = 128;

const TOOLS = [searchUniversityWebsite];

function deptKey(departments: Department[]): string {
  return departments.map((d) => `${d.id}:${d.name}:${d.keywords ?? ""}`).join("|");
}

function getCachedAgent(tenant: Tenant, departments: Department[]): CompiledAgent {
  const cacheKey = `${tenant.id}:${tenant.llmApiKey ?? ""}:${deptKey(departments)}`;

  const cached = _agentCache.get(cacheKey);
  if (cached) return cached;

  const llm = getLlm(tenant.llmApiKey ?? undefined);
  const systemPrompt = buildSystemPrompt(tenant, departments);

  const agent = createReactAgent({
    llm,
    tools: TOOLS,
    // stateModifier adds the system prompt before the messages array
    stateModifier: new SystemMessage(systemPrompt),
  });

  if (_agentCache.size >= AGENT_CACHE_MAX) {
    const oldest = _agentCache.keys().next().value;
    if (oldest !== undefined) _agentCache.delete(oldest);
  }

  _agentCache.set(cacheKey, agent);
  return agent;
}

export interface AgentResult {
  answer: string;
  sources: { title: string; url: string }[];
  intermediateSteps: unknown[];
}

/**
 * Invoke the agent and return the final answer + sources.
 *
 * @param tenant     - Current tenant (used for caching + prompt)
 * @param history    - Prior conversation messages (loaded from Redis)
 * @param userMessage - The user's current message
 * @param departments - Tenant departments for routing prompt
 */
export async function invokeAgent(
  tenant: Tenant,
  history: BaseMessage[],
  userMessage: string,
  departments: Department[],
): Promise<AgentResult> {
  const agent = getCachedAgent(tenant, departments);

  const input = {
    messages: [
      ...history,
      { role: "user" as const, content: userMessage },
    ],
  };

  const result = await agent.invoke(input);

  // Extract the final AI message from the messages array
  const allMessages: BaseMessage[] = result.messages ?? [];
  const lastAI = allMessages.findLast((m) => m._getType() === "ai");
  const answer = stripInlineSource(
    typeof lastAI?.content === "string" ? lastAI.content : "",
  );

  // Extract sources from any tool messages
  const sources = extractSources(allMessages);

  return { answer, sources, intermediateSteps: [] };
}

/**
 * Stream agent events — yields token strings and collects tool outputs.
 * Returns an async generator of token strings; call `.return()` to stop.
 */
export async function* streamAgent(
  tenant: Tenant,
  history: BaseMessage[],
  userMessage: string,
  departments: Department[],
): AsyncGenerator<
  | { type: "token"; token: string }
  | { type: "done"; answer: string; sources: { title: string; url: string }[] }
> {
  const agent = getCachedAgent(tenant, departments);

  const input = {
    messages: [
      ...history,
      { role: "user" as const, content: userMessage },
    ],
  };

  const log = agentLog.child({ tenant: tenant.slug });
  const t0 = Date.now();

  log.info(
    { historyLen: history.length, userMessage, departments: departments.map((d) => d.name) },
    "Agent invocation started",
  );

  const fullParts: string[] = [];
  const toolOutputs: string[] = [];
  let llmCallCount = 0;
  let tLlm = 0;
  let tTool = 0;

  const stream = agent.streamEvents(input, { version: "v2" });

  try {
    for await (const event of stream) {
      if (event.event === "on_chat_model_start") {
        llmCallCount++;
        tLlm = Date.now();
        const messages = event.data?.input?.messages as unknown[];
        log.debug({ messages, llmCall: llmCallCount }, "LLM call started");
      } else if (event.event === "on_chat_model_stream") {
        const chunk = event.data?.chunk;
        const token =
          typeof chunk?.content === "string" ? chunk.content : "";
        if (token) {
          fullParts.push(token);
          yield { type: "token", token };
        }
      } else if (event.event === "on_chat_model_end") {
        const meta = (event.data?.output as { response_metadata?: { timing?: Record<string, number> } } | undefined)
          ?.response_metadata;
        log.info(
          {
            llmCall: llmCallCount,
            llmDurationMs: Date.now() - tLlm,
            llmTotalSec: meta?.timing?.total_time,
            llmQueueSec: meta?.timing?.queue_time,
            llmPromptSec: meta?.timing?.prompt_time,
            llmCompletionSec: meta?.timing?.completion_time,
          },
          "LLM call completed",
        );
      } else if (event.event === "on_tool_start") {
        tTool = Date.now();
        log.info(
          { tool: event.name, input: event.data?.input },
          "Tool called",
        );
      } else if (event.event === "on_tool_end") {
        const output = event.data?.output;
        let raw: string;
        if (typeof output === "string") {
          raw = output;
        } else {
          // LangGraph wraps the tool return value in a ToolMessage — unwrap it
          const content =
            (output as Record<string, unknown>)?.content ??
            ((output as Record<string, unknown>)?.kwargs as Record<string, unknown>)?.content;
          raw = typeof content === "string" ? content : JSON.stringify(output);
        }
        log.info(
          { tool: event.name, toolDurationMs: Date.now() - tTool, output: raw.slice(0, 500) },
          "Tool completed",
        );
        if (output) toolOutputs.push(raw);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Groq 400 "Failed to call a function" — model generated a malformed tool call.
    // Yield a graceful fallback so the widget doesn't hang.
    if (msg.includes("Failed to call a function") || msg.includes("failed_generation")) {
      log.warn({ err: msg, durationMs: Date.now() - t0 }, "Malformed tool call from LLM — returning fallback");
      const fallback = "I'm sorry, I had trouble processing that request. Could you try rephrasing your question?";
      yield { type: "token", token: fallback };
      yield { type: "done", answer: fallback, sources: [] };
      return;
    }
    // 429 rate limit — yield a friendly message instead of crashing the widget
    const status = (err as { status?: number; response?: { status?: number } }).status
      ?? (err as { response?: { status?: number } }).response?.status;
    if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      log.warn({ err: msg, durationMs: Date.now() - t0 }, "LLM rate limit — returning fallback");
      const fallback = "I'm currently experiencing high demand. Please wait a moment and try again.";
      yield { type: "token", token: fallback };
      yield { type: "done", answer: fallback, sources: [] };
      return;
    }
    throw err;
  }

  const answer = stripInlineSource(fullParts.join(""));
  const sources = extractSourcesFromRaw(toolOutputs);

  log.info(
    { durationMs: Date.now() - t0, answer, sources },
    "Agent invocation completed",
  );

  yield { type: "done", answer, sources };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strips artefacts that should never appear in the final answer text:
 *   - "Source: ..." lines appended by some LLM outputs
 *   - Raw `<function=...>{...}</function>` tool-call syntax leaked by smaller models
 *
 * @param answer - Raw answer string from the LLM.
 * @returns Cleaned answer with artefacts removed.
 */
function stripInlineSource(answer: string): string {
  return answer
    .replace(/\n*\bSource:\s*[^\n]+/gi, "")
    .replace(/<function=[^>]+>\{[^}]*\}<\/function>/g, "")
    .trim();
}

function extractSources(messages: BaseMessage[]): { title: string; url: string }[] {
  const sources: { title: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg._getType() !== "tool") continue;
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    try {
      const parsed = JSON.parse(content) as { results?: { title?: string; url?: string }[] };
      for (const r of parsed.results ?? []) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          sources.push({ title: r.title ?? r.url, url: r.url });
        }
      }
    } catch { /* not JSON */ }
  }
  return sources;
}

function extractSourcesFromRaw(outputs: string[]): { title: string; url: string }[] {
  const sources: { title: string; url: string }[] = [];
  const seen = new Set<string>();

  for (const raw of outputs) {
    try {
      const parsed = JSON.parse(raw) as { results?: { title?: string; url?: string }[] };
      for (const r of parsed.results ?? []) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          sources.push({ title: r.title ?? r.url, url: r.url });
        }
      }
    } catch { /* skip */ }
  }
  return sources;
}
