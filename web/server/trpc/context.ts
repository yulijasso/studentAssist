/**
 * tRPC request context — resolved once per HTTP request.
 *
 * Injects the authenticated tenant (from X-Campus-Assist-Key), user context
 * (from Clerk JWT + our RBAC tables), and shared db/redis singletons.
 */
import { type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getRedis } from "@/server/redis";
import { getTenantByApiKey } from "@/server/services/tenant_service";
import { verifyClerkAdmin, resolveUserContext } from "./clerk";
import type { Tenant } from "@/server/db/schema";
import type { UserContext } from "@/server/services/membership_service";

/** Shared context available to all tRPC procedures. */
export interface Context {
  db: typeof db;
  redis: ReturnType<typeof getRedis>;
  tenant: Tenant | null;
  isAdmin: boolean;
  req: NextRequest;
  // RBAC fields
  clerkId: string | null;
  user: UserContext | null;
  role: string | null;
  userTenantId: string | null;
  userDepartmentId: string | null;
  permissions: string[];
}

/**
 * Builds the tRPC context for each incoming request.
 */
export async function createContext(req: NextRequest): Promise<Context> {
  const redis = getRedis();

  // Resolve tenant from widget API key
  let tenant: Tenant | null = null;
  const apiKey = req.headers.get("x-campus-assist-key");
  if (apiKey) {
    tenant = await getTenantByApiKey(db, apiKey, redis);
    if (tenant && !tenant.isActive) tenant = null;
  }

  // Resolve Clerk admin (backward-compatible)
  const isAdmin = await verifyClerkAdmin(req);

  // Resolve full user context from our RBAC tables
  const userCtx = await resolveUserContext(req, db, redis);

  return {
    db,
    redis,
    tenant,
    isAdmin,
    req,
    clerkId: userCtx?.clerkId ?? null,
    user: userCtx,
    role: userCtx?.role ?? null,
    userTenantId: userCtx?.tenantId ?? null,
    userDepartmentId: userCtx?.departmentId ?? null,
    permissions: userCtx?.permissions ?? [],
  };
}
