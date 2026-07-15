import { z } from "zod";
import { router, adminProcedure, publicProcedure } from "../init";
import {
  createTenant,
  listTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  rotateTenantKey,
  generateApiKey,
} from "@/server/services/tenant_admin_service";
import { listDepartments } from "@/server/services/department_service";
import { clearAllTenantCaches } from "@/server/services/cache_service";
import { getTenantBySlug } from "@/server/services/tenant_service";
import { tenants } from "@/server/db/schema";

const TenantCreateInput = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  websiteDomain: z.string().min(1).max(255),
  searchDomains: z.array(z.string()).optional(),
  location: z.string().max(255).optional(),
});

const TenantUpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  websiteDomain: z.string().min(1).max(255).optional(),
  searchDomains: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  dailyRequestQuota: z.number().int().positive().nullable().optional(),
  llmApiKey: z.string().nullable().optional(),
});

export const tenantsRouter = router({
  create: adminProcedure.input(TenantCreateInput).mutation(async ({ ctx, input }) => {
    const tenant = await createTenant(ctx.db, input);
    const departments = await listDepartments(ctx.db, tenant.id, ctx.redis);
    return { ...tenant, departments };
  }),

  list: adminProcedure.query(async ({ ctx }) => {
    return listTenants(ctx.db);
  }),

  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenant = await getTenantById(ctx.db, input.id);
      if (!tenant) throw new Error("Tenant not found");
      const departments = await listDepartments(ctx.db, tenant.id, ctx.redis);
      return { ...tenant, departments };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenant = await getTenantBySlug(ctx.db, input.slug);
      if (!tenant) throw new Error("Tenant not found");
      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        websiteDomain: tenant.websiteDomain,
        apiKey: tenant.apiKey,
        location: tenant.location,
      };
    }),

  // Auto-provision: find tenant by slug or create it if it doesn't exist
  getOrCreateBySlug: adminProcedure
    .input(z.object({ slug: z.string(), orgName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getTenantBySlug(ctx.db, input.slug);
      if (existing) {
        return {
          id: existing.id,
          slug: existing.slug,
          name: existing.name,
          websiteDomain: existing.websiteDomain,
          apiKey: existing.apiKey,
          location: existing.location,
        };
      }

      // Auto-create tenant for this Clerk org
      const name = input.orgName || input.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const tenant = await createTenant(ctx.db, {
        name,
        slug: input.slug,
        websiteDomain: `${input.slug}.example.com`,
        searchDomains: [],
      });

      return {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        websiteDomain: tenant.websiteDomain,
        apiKey: tenant.apiKey,
        location: tenant.location,
      };
    }),

  /** Sets location + coordinates for a tenant during onboarding. */
  setLocation: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        location: z.string().min(1).max(255),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await updateTenant(ctx.db, ctx.redis, id, data);
      if (!updated) throw new Error("Tenant not found");
      return { location: updated.location, latitude: updated.latitude, longitude: updated.longitude };
    }),

  update: adminProcedure.input(TenantUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const updated = await updateTenant(ctx.db, ctx.redis, id, data);
    if (!updated) throw new Error("Tenant not found");
    return updated;
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteTenant(ctx.db, ctx.redis, input.id);
      if (!ok) throw new Error("Tenant not found");
      return { success: true };
    }),

  rotateKey: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const newKey = await rotateTenantKey(ctx.db, ctx.redis, input.id);
      if (!newKey) throw new Error("Tenant not found");
      return { apiKey: newKey };
    }),

  clearCache: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await getTenantById(ctx.db, input.id);
      if (!tenant) throw new Error("Tenant not found");
      const keysDeleted = await clearAllTenantCaches(ctx.redis, tenant.apiKey, tenant.id);
      return { keysDeleted, tenantId: input.id };
    }),
});
