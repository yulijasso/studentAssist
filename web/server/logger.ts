/**
 * Structured logger — pino writing to logs/app.log.
 *
 * Usage:
 *   import { logger } from "@/server/logger";
 *   const log = logger.child({ module: "ws" });
 *   log.info({ sessionId }, "Client connected");
 *
 * Tail logs:
 *   tail -f logs/app.log
 *   tail -f logs/app.log | npx pino-pretty   (pretty-print)
 */
import pino from "pino";
import { mkdirSync } from "fs";
import { resolve } from "path";

const logsDir = resolve(process.cwd(), "logs");
mkdirSync(logsDir, { recursive: true });

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? "debug" },
  pino.destination({ dest: resolve(logsDir, "app.log"), sync: false }),
);

// Named child loggers — filter by module field
export const wsLog      = logger.child({ module: "ws" });
export const agentLog   = logger.child({ module: "agent" });
export const routingLog = logger.child({ module: "routing" });
export const httpLog    = logger.child({ module: "http" });
export const memLog     = logger.child({ module: "memory" });
export const llmLog     = logger.child({ module: "llm" });
