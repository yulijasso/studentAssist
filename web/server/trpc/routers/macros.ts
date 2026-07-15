import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, adminProcedure } from "../init";
import { macros } from "@/server/db/schema";

export const macrosRouter = router({
  list: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(macros)
        .where(eq(macros.tenantId, input.tenantId))
        .orderBy(macros.createdAt);
    }),

  create: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [macro] = await ctx.db
        .insert(macros)
        .values({
          tenantId: input.tenantId,
          title: input.title,
          content: input.content,
        })
        .returning();
      return macro!;
    }),

  delete: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        macroId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(macros)
        .where(
          and(
            eq(macros.id, input.macroId),
            eq(macros.tenantId, input.tenantId),
          ),
        )
        .returning();
      if (!deleted) throw new Error("Macro not found");
      return { success: true };
    }),
});
