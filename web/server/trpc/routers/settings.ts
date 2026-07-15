import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, adminProcedure } from "../init";
import { tenants } from "@/server/db/schema";

const WidgetSettingsSchema = z.object({
  cityName: z.string().optional(),
  assistantName: z.string().optional(),
  primaryColor: z.string().optional(),
  welcomeMessage: z.string().optional(),
  logoUrl: z.string().optional(),
  autoOpen: z.boolean().optional(),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]).optional(),
  slaFirstResponseHours: z.number().min(1).max(720).optional(),
  slaResolutionHours: z.number().min(1).max(720).optional(),
  slaExcludeWeekends: z.boolean().optional(),
  slaBusinessHoursStart: z.number().min(0).max(23).optional(),
  slaBusinessHoursEnd: z.number().min(0).max(23).optional(),
});

export const settingsRouter = router({
  get: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new Error("Tenant not found");
      return {
        apiKey: tenant.apiKey,
        widgetSettings: tenant.widgetSettings ?? {
          cityName: "",
          assistantName: "",
          primaryColor: "#1a56db",
          welcomeMessage: "Hi! Ask me anything about admissions, academics, or campus services.",
          logoUrl: "",
          autoOpen: false,
          position: "bottom-right",
        },
      };
    }),

  update: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        widgetSettings: WidgetSettingsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Merge with existing settings
      const [tenant] = await ctx.db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new Error("Tenant not found");

      const merged: Record<string, unknown> = {
        ...(tenant.widgetSettings ?? {}),
        ...input.widgetSettings,
      };
      // Remove keys explicitly set to undefined (clears the value)
      for (const key of Object.keys(input.widgetSettings)) {
        if ((input.widgetSettings as Record<string, unknown>)[key] === undefined) {
          delete merged[key];
        }
      }

      const [updated] = await ctx.db
        .update(tenants)
        .set({ widgetSettings: merged, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId))
        .returning();

      return updated!.widgetSettings;
    }),
});
