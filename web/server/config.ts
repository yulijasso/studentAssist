import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Database
    DATABASE_URL: z
      .string()
      .default("postgresql://campus_assist:campus_assist@localhost:5432/campus_assist"),

    // Redis
    REDIS_URL: z.string().default("redis://localhost:6379/0"),

    // LLM
    LLM_PROVIDER: z.enum(["groq", "openrouter"]).default("groq"),
    LLM_MODEL: z.string().default("llama-3.1-8b-instant"),
    ROUTING_MODEL: z.string().default("llama-3.3-70b-versatile"),
    LLM_TEMPERATURE: z.coerce.number().default(0.3),
    LLM_MAX_TOKENS: z.coerce.number().int().default(1024),
    GROQ_API_KEY: z.string().default(""),
    OPENROUTER_API_KEY: z.string().default(""),

    // Groq backoff
    RATE_LIMIT_ALERT_THRESHOLD: z.coerce.number().default(0.1),
    BACKOFF_MULTIPLIER: z.coerce.number().default(1.0),
    BACKOFF_MIN_WAIT: z.coerce.number().default(2.0),
    BACKOFF_MAX_WAIT: z.coerce.number().default(60.0),
    BACKOFF_MAX_ATTEMPTS: z.coerce.number().int().default(4),

    // SMTP
    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().default(""),
    SMTP_PASSWORD: z.string().default(""),
    SMTP_TLS: z.coerce.boolean().default(true),
    ALERT_FROM_EMAIL: z.string().default("alerts@campusassist.io"),
    ADMIN_EMAIL: z.string().default(""),

    // Clerk
    CLERK_SECRET_KEY: z.string().default(""),

    // Resend (invitation emails)
    RESEND_API_KEY: z.string().default(""),

    // Internal
    INTERNAL_SECRET: z.string().default(""),

    // Cache
    RESPONSE_CACHE_TTL_SECONDS: z.coerce.number().int().default(3600),

    // Persistence
    PERSIST_CHAT_MESSAGES: z.coerce.boolean().default(false),

    // Tavily
    TAVILY_API_KEY: z.string().default(""),

    // Debug
    LOG_MEMORY_CONTEXT: z.coerce.boolean().default(true),

    // App
    APP_ENV: z.enum(["development", "production", "test"]).default("development"),
    ALLOWED_ORIGINS: z
      .string()
      .default("http://localhost:3000,http://localhost:7860"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().default("http://localhost:3000"),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    LLM_MODEL: process.env.LLM_MODEL,
    ROUTING_MODEL: process.env.ROUTING_MODEL,
    LLM_TEMPERATURE: process.env.LLM_TEMPERATURE,
    LLM_MAX_TOKENS: process.env.LLM_MAX_TOKENS,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    RATE_LIMIT_ALERT_THRESHOLD: process.env.RATE_LIMIT_ALERT_THRESHOLD,
    BACKOFF_MULTIPLIER: process.env.BACKOFF_MULTIPLIER,
    BACKOFF_MIN_WAIT: process.env.BACKOFF_MIN_WAIT,
    BACKOFF_MAX_WAIT: process.env.BACKOFF_MAX_WAIT,
    BACKOFF_MAX_ATTEMPTS: process.env.BACKOFF_MAX_ATTEMPTS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_TLS: process.env.SMTP_TLS,
    ALERT_FROM_EMAIL: process.env.ALERT_FROM_EMAIL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    INTERNAL_SECRET: process.env.INTERNAL_SECRET,
    RESPONSE_CACHE_TTL_SECONDS: process.env.RESPONSE_CACHE_TTL_SECONDS,
    PERSIST_CHAT_MESSAGES: process.env.PERSIST_CHAT_MESSAGES,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    LOG_MEMORY_CONTEXT: process.env.LOG_MEMORY_CONTEXT,
    APP_ENV: process.env.APP_ENV,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  skipValidation: process.env.NODE_ENV === "test",
});

export type Env = typeof env;
