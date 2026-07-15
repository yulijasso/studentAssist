import { type NextRequest } from "next/server";
import { env } from "@/server/config";
import type { DB } from "@/server/db";
import type Redis from "ioredis";
import { getUserContext, type UserContext } from "@/server/services/membership_service";

/**
 * Verify Clerk JWT and resolve the user's role/permissions from our DB.
 *
 * Dev bypass: if CLERK_SECRET_KEY is not set, returns a fake tech_admin context
 * so local development works without Clerk configuration.
 */
export async function resolveUserContext(
  req: NextRequest,
  db: DB,
  redis: Redis,
): Promise<UserContext | null> {
  // Dev bypass — no Clerk key means everyone is tech_admin
  if (!env.CLERK_SECRET_KEY) {
    return {
      clerkId: "dev_user",
      userId: "dev_user",
      role: "tech_admin",
      tenantId: null,
      departmentId: null,
      permissions: ["*"],
    };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  try {
    const { verifyToken } = await import("@clerk/nextjs/server");
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });

    if (!payload?.sub) return null;

    // Look up user context from our RBAC tables
    const ctx = await getUserContext(db, redis, payload.sub);

    // For new users with no DB record yet, return a minimal context
    // so me.sync can still access the clerkId to create the user.
    if (!ctx) {
      return {
        clerkId: payload.sub,
        userId: "",
        role: "",
        tenantId: null,
        departmentId: null,
        permissions: [],
      };
    }

    return ctx;
  } catch (e) {
    console.error("[clerk] JWT verification failed:", String(e));
    return null;
  }
}

/**
 * Backward-compatible: just checks if any valid Clerk JWT is present.
 * Used by adminProcedure for existing dashboard routes.
 */
export async function verifyClerkAdmin(req: NextRequest): Promise<boolean> {
  if (!env.CLERK_SECRET_KEY) return true;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);

  try {
    const { verifyToken } = await import("@clerk/nextjs/server");
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    if (payload && payload.sub) return true;
    return false;
  } catch (e) {
    console.error("[clerk] JWT verification failed:", String(e));
    return false;
  }
}
