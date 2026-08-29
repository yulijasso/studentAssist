/**
 * tRPC initialisation — defines the base procedures and middleware.
 *
 * Exports procedure builders:
 *   - publicProcedure      — no authentication required
 *   - tenantProcedure      — requires a valid X-Campus-Assist-Key header
 *   - adminProcedure       — requires a valid Clerk JWT (backward-compatible)
 *   - techAdminProcedure   — requires role === 'tech_admin'
 *   - tenantAdminProcedure — requires role === 'institution_admin' + matching tenantId
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Tenant-authenticated procedure — requires X-Campus-Assist-Key
export const tenantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing or invalid X-Campus-Assist-Key" });
  }
  return next({ ctx: { ...ctx, tenant: ctx.tenant } });
});

// Clerk admin procedure — requires valid Clerk JWT with admin role (backward-compatible)
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin access required" });
  }
  return next({ ctx });
});

// Tech admin procedure — requires role === 'tech_admin'
export const techAdminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.role !== "tech_admin") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Tech admin access required" });
  }
  return next({ ctx });
});

// Tenant admin procedure — requires institution_admin (or tech_admin) role
export const tenantAdminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.role === "tech_admin") {
    return next({ ctx });
  }
  if (ctx.role !== "institution_admin") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "City admin access required" });
  }
  return next({ ctx });
});
