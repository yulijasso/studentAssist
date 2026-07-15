import { vi } from "vitest";

// Prevent real DB/Redis connections in tests
vi.mock("@/server/db", () => ({
  db: {},
}));

vi.mock("@/server/redis", () => ({
  getRedis: vi.fn(),
}));

// Suppress env validation errors in tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379/0";
process.env.LLM_PROVIDER = "groq";
process.env.LLM_MODEL = "llama-3.1-8b-instant";
process.env.TAVILY_API_KEY = "test-tavily-key";
process.env.GROQ_API_KEY = "test-groq-key";
process.env.RESPONSE_CACHE_TTL_SECONDS = "3600";
