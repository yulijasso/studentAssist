/**
 * Drizzle database client — module-level singleton.
 *
 * Creates one postgres.js connection pool per process (max 10 connections).
 * Query logging is enabled in development via the APP_ENV env var.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/server/config";
import * as schema from "./schema";

// Module-level singleton — one connection pool per process.
const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema, logger: env.APP_ENV === "development" });
export type DB = typeof db;
