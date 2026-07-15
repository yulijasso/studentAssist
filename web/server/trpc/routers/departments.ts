import { z } from "zod";
import { router, adminProcedure } from "../init";
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
} from "@/server/services/department_service";

const LocationSchema = z
  .object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipcode: z.string().optional(),
    country: z.string().optional(),
  })
  .optional();

const DeptCreateInput = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  keywords: z.array(z.string()).optional(),
  location: LocationSchema,
  hours: z.string().optional().nullable(),
});

const DeptUpdateInput = z.object({
  tenantId: z.string().uuid(),
  deptId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  keywords: z.array(z.string()).optional(),
  location: LocationSchema,
  hours: z.string().optional().nullable(),
});

export const departmentsRouter = router({
  create: adminProcedure.input(DeptCreateInput).mutation(async ({ ctx, input }) => {
    return createDepartment(ctx.db, ctx.redis, {
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      keywords: input.keywords?.join(",") ?? null,
      location: input.location ?? null,
      hours: input.hours ?? null,
    });
  }),

  list: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return listDepartments(ctx.db, input.tenantId, ctx.redis);
    }),

  getById: adminProcedure
    .input(z.object({ tenantId: z.string().uuid(), deptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const dept = await getDepartmentById(ctx.db, input.tenantId, input.deptId);
      if (!dept) throw new Error("Department not found");
      return dept;
    }),

  update: adminProcedure.input(DeptUpdateInput).mutation(async ({ ctx, input }) => {
    const { tenantId, deptId, keywords, ...rest } = input;
    const updated = await updateDepartment(ctx.db, ctx.redis, tenantId, deptId, {
      ...rest,
      keywords: keywords !== undefined ? keywords.join(",") : undefined,
    });
    if (!updated) throw new Error("Department not found");
    return updated;
  }),

  delete: adminProcedure
    .input(z.object({ tenantId: z.string().uuid(), deptId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteDepartment(ctx.db, ctx.redis, input.tenantId, input.deptId);
      if (!ok) throw new Error("Department not found");
      return { success: true };
    }),
});
