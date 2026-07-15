import { env } from "@/server/config";
import { llmLog } from "@/server/logger";

// LRU-like cache: api_key → LLM instance (bounded at 64)
const _llmCache = new Map<string, ReturnType<typeof _createLlm>>();
const LLM_CACHE_MAX = 64;

function _createLlm(apiKey?: string) {
  const provider = env.LLM_PROVIDER;

  if (provider === "groq") {
    const { ChatGroq } = require("@langchain/groq");
    return new ChatGroq({
      model: env.LLM_MODEL,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
      apiKey: apiKey ?? env.GROQ_API_KEY,
      // Groq SDK uses custom fetch — we intercept via callbacks
      callbacks: [
        {
          handleLLMEnd: (_output: unknown, _runId: string, _parentRunId: string, tags: string[] | undefined) => {
            // Rate limit headers are captured at the HTTP layer; this is a no-op fallback
            void tags;
          },
        },
      ],
    });
  }

  if (provider === "openrouter") {
    const { ChatOpenAI } = require("@langchain/openai");
    return new ChatOpenAI({
      modelName: env.LLM_MODEL,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
      apiKey: apiKey ?? env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://campusassist.app",
          "X-Title": "Campus Assist",
        },
      },
    });
  }

  throw new Error(`Unsupported LLM_PROVIDER: "${provider}". Supported: groq, openrouter`);
}

export function getLlm(apiKey?: string): ReturnType<typeof _createLlm> {
  const cacheKey = apiKey ?? "__default__";
  const cached = _llmCache.get(cacheKey);
  if (cached) return cached;

  const llm = _createLlm(apiKey);
  llmLog.info(
    { provider: env.LLM_PROVIDER, model: env.LLM_MODEL, cached: false },
    "LLM instance created",
  );

  if (_llmCache.size >= LLM_CACHE_MAX) {
    const firstKey = _llmCache.keys().next().value;
    if (firstKey !== undefined) _llmCache.delete(firstKey);
  }

  _llmCache.set(cacheKey, llm);
  return llm;
}
