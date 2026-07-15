import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, adminProcedure } from "../init";
import {
  conversations,
  messages,
  internalNotes,
  departments,
  tenants,
  conversationDepartments,
} from "@/server/db/schema";
import { translateText } from "@/server/agent/routing";

// ── SLA elapsed-time helper ───────────────────────────────────────────────────

interface SlaConfig {
  firstResponseMs: number;
  resolutionMs: number;
  excludeWeekends: boolean;
  bizStart: number | null; // hour 0-23, null = 24/7
  bizEnd: number | null;
}

/**
 * Calculates elapsed milliseconds between two timestamps, respecting
 * the tenant's SLA schedule:
 *  - excludeWeekends: skip Saturday & Sunday
 *  - bizStart/bizEnd: only count hours within the business window
 *    (e.g. 8–17 means only 8 AM to 5 PM UTC counts)
 *  - If both are null, counts all hours on eligible days.
 */
function slaElapsedMs(startMs: number, endMs: number, cfg: SlaConfig): number {
  if (endMs <= startMs) return 0;

  // Fast path: no restrictions
  if (!cfg.excludeWeekends && cfg.bizStart == null) {
    return endMs - startMs;
  }

  const MS_PER_HOUR = 60 * 60 * 1000;
  let elapsed = 0;
  let cursor = startMs;

  while (cursor < endMs) {
    const d = new Date(cursor);
    const day = d.getUTCDay(); // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6;

    // Next midnight UTC
    const nextMidnight = new Date(cursor);
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const dayEnd = Math.min(nextMidnight.getTime(), endMs);

    if (cfg.excludeWeekends && isWeekend) {
      cursor = dayEnd;
      continue;
    }

    if (cfg.bizStart != null && cfg.bizEnd != null && cfg.bizStart < cfg.bizEnd) {
      // Business hours window for this day
      const dayMidnight = new Date(cursor);
      dayMidnight.setUTCHours(0, 0, 0, 0);
      const windowStart = dayMidnight.getTime() + cfg.bizStart * MS_PER_HOUR;
      const windowEnd = dayMidnight.getTime() + cfg.bizEnd * MS_PER_HOUR;

      // Clamp cursor and dayEnd to the business window
      const effectiveStart = Math.max(cursor, windowStart);
      const effectiveEnd = Math.min(dayEnd, windowEnd);

      if (effectiveStart < effectiveEnd) {
        elapsed += effectiveEnd - effectiveStart;
      }
    } else {
      // No business hour restriction — count full day
      elapsed += dayEnd - cursor;
    }

    cursor = dayEnd;
  }

  return elapsed;
}

async function loadSlaConfig(db: typeof import("@/server/db").db, tenantId: string): Promise<SlaConfig> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const ws = tenant?.widgetSettings as Record<string, unknown> | null;
  return {
    firstResponseMs: ((ws?.slaFirstResponseHours as number) ?? 24) * 60 * 60 * 1000,
    resolutionMs: ((ws?.slaResolutionHours as number) ?? 72) * 60 * 60 * 1000,
    excludeWeekends: (ws?.slaExcludeWeekends as boolean) ?? true,
    bizStart: (ws?.slaBusinessHoursStart as number) ?? null,
    bizEnd: (ws?.slaBusinessHoursEnd as number) ?? null,
  };
}

export const conversationsAdminRouter = router({
  list: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sla = await loadSlaConfig(ctx.db, input.tenantId);

      const convs = await ctx.db
        .select()
        .from(conversations)
        .where(eq(conversations.tenantId, input.tenantId))
        .orderBy(desc(conversations.updatedAt));

      // Fetch messages and notes for each conversation
      const result = await Promise.all(
        convs.map(async (conv) => {
          const [msgs, notes, dept, routedDepts] = await Promise.all([
            ctx.db
              .select()
              .from(messages)
              .where(eq(messages.conversationId, conv.id))
              .orderBy(messages.createdAt),
            ctx.db
              .select()
              .from(internalNotes)
              .where(eq(internalNotes.conversationId, conv.id))
              .orderBy(internalNotes.createdAt),
            conv.departmentId
              ? ctx.db
                  .select()
                  .from(departments)
                  .where(eq(departments.id, conv.departmentId))
                  .limit(1)
                  .then((r) => r[0] ?? null)
              : Promise.resolve(null),
            ctx.db
              .select({
                departmentId: conversationDepartments.departmentId,
                departmentName: departments.name,
                reason: conversationDepartments.reason,
                detectedAt: conversationDepartments.detectedAt,
                triggerMessageId: conversationDepartments.triggerMessageId,
              })
              .from(conversationDepartments)
              .innerJoin(departments, eq(conversationDepartments.departmentId, departments.id))
              .where(eq(conversationDepartments.conversationId, conv.id))
              .orderBy(conversationDepartments.detectedAt),
          ]);
          // Compute SLA status using tenant config
          const now = Date.now();
          const isClosed = conv.status === "resolved" || conv.status === "auto-resolved";
          const endTime = isClosed && conv.resolvedAt ? conv.resolvedAt.getTime() : now;
          const bizAge = slaElapsedMs(conv.createdAt.getTime(), endTime, sla);
          let slaStatus: "ok" | "warning" | "breached" = "ok";
          let slaRemainingMs: number | null = null;
          if (bizAge > sla.resolutionMs) {
            slaStatus = "breached";
          } else if (!isClosed && bizAge > sla.resolutionMs * 0.75) {
            slaStatus = "warning";
          }
          if (!isClosed) {
            slaRemainingMs = sla.resolutionMs - slaElapsedMs(conv.createdAt.getTime(), now, sla);
          }

          return {
            ...conv,
            departmentName: dept?.name ?? null,
            routedDepartments: routedDepts.map((rd) => ({
              departmentId: rd.departmentId,
              departmentName: rd.departmentName,
              reason: rd.reason,
              detectedAt: rd.detectedAt.toISOString(),
              triggerMessageId: rd.triggerMessageId ?? null,
            })),
            slaStatus,
            slaRemainingMs,
            escalationContact: conv.escalationContact ?? null,
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              metadata: (m.metadata as { disclaimerReason?: string } | null) ?? null,
              webSources: (m.sources as { title: string; url: string }[] | null) ?? null,
              language: (m.language as "en" | "es" | "mixed" | null) ?? null,
              timestamp: m.createdAt.toISOString(),
            })),
            notes: notes.map((n) => ({
              id: n.id,
              content: n.content,
              authorId: n.authorId,
              authorName: n.authorName,
              timestamp: n.createdAt.toISOString(),
            })),
          };
        }),
      );
      return result;
    }),

  update: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        conversationId: z.string().uuid(),
        status: z.enum(["new", "open", "resolved", "escalated", "auto-resolved"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        departmentId: z.string().uuid().nullable().optional(),
        intent: z.string().nullable().optional(),
        assignedTo: z.string().nullable().optional(),
        wasEscalated: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, conversationId, ...data } = input;

      // Guard: auto-resolved tickets are locked — status cannot be changed
      if (data.status !== undefined) {
        const [current] = await ctx.db
          .select({ status: conversations.status })
          .from(conversations)
          .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
          .limit(1);
        if (current?.status === "auto-resolved") {
          throw new Error("Auto-resolved tickets cannot be edited");
        }
      }

      const now = new Date();
      const set: Record<string, unknown> = { ...data, updatedAt: now };

      // SLA timestamp tracking on status changes
      if (data.status === "resolved") set.resolvedAt = now;
      if (data.status === "escalated") set.escalatedAt = now;

      const [updated] = await ctx.db
        .update(conversations)
        .set(set)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.tenantId, tenantId),
          ),
        )
        .returning();
      if (!updated) throw new Error("Conversation not found");
      return updated;
    }),

  addNote: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        conversationId: z.string().uuid(),
        content: z.string().min(1),
        authorId: z.string().min(1),
        authorName: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify conversation belongs to tenant
      const conv = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      if (!conv[0]) throw new Error("Conversation not found");

      const [note] = await ctx.db
        .insert(internalNotes)
        .values({
          conversationId: input.conversationId,
          content: input.content,
          authorId: input.authorId,
          authorName: input.authorName,
        })
        .returning();
      return note!;
    }),

  addMessage: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        conversationId: z.string().uuid(),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify conversation belongs to tenant
      const conv = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.tenantId, input.tenantId),
          ),
        )
        .limit(1);
      if (!conv[0]) throw new Error("Conversation not found");

      const [msg] = await ctx.db
        .insert(messages)
        .values({
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
        })
        .returning();

      // Update conversation timestamp
      await ctx.db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId));

      return msg!;
    }),

  /**
   * On-demand message translation for staff reviewing non-English messages.
   *
   * Only ever called when a staff member explicitly clicks "Translate" in the
   * dashboard — never automatic, so translation cost is only incurred for
   * conversations someone actually reviews. The original message content in
   * the DB is never modified; this returns a translation for display only.
   */
  translateMessage: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        messageId: z.string().uuid(),
        targetLanguage: z.enum(["en", "es"]).default("en"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ content: messages.content, tenantId: conversations.tenantId })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(eq(messages.id, input.messageId))
        .limit(1);
      if (!row || row.tenantId !== input.tenantId) throw new Error("Message not found");

      const [tenant] = await ctx.db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new Error("Tenant not found");

      return translateText(tenant, row.content, input.targetLanguage);
    }),

  // Analytics aggregation
  stats: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sla = await loadSlaConfig(ctx.db, input.tenantId);

      const convs = await ctx.db
        .select()
        .from(conversations)
        .where(eq(conversations.tenantId, input.tenantId));

      const total = convs.length;
      const resolved = convs.filter(
        (c) => c.status === "resolved" || c.status === "auto-resolved",
      ).length;
      const escalated = convs.filter(
        (c) => c.status === "escalated" || c.wasEscalated,
      ).length;

      // Count messages
      let totalMessages = 0;
      for (const conv of convs) {
        const msgs = await ctx.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conv.id));
        totalMessages += msgs.length;
      }

      // SLA metrics (using tenant config)
      const responseTimesMs: number[] = [];
      const resolutionTimesMs: number[] = [];

      for (const conv of convs) {
        if (conv.firstResponseAt) {
          responseTimesMs.push(slaElapsedMs(conv.createdAt.getTime(), conv.firstResponseAt.getTime(), sla));
        }
        if (conv.resolvedAt) {
          resolutionTimesMs.push(slaElapsedMs(conv.createdAt.getTime(), conv.resolvedAt.getTime(), sla));
        }
      }

      const avgFirstResponseMs = responseTimesMs.length > 0
        ? responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length
        : null;
      const avgResolutionMs = resolutionTimesMs.length > 0
        ? resolutionTimesMs.reduce((a, b) => a + b, 0) / resolutionTimesMs.length
        : null;

      const responseCompliant = responseTimesMs.filter((t) => t <= sla.firstResponseMs).length;
      const resolutionCompliant = resolutionTimesMs.filter((t) => t <= sla.resolutionMs).length;

      // Conversations currently breaching SLA
      const now = Date.now();
      const breaching = convs.filter((c) => {
        if (c.status === "resolved") return false;
        const age = slaElapsedMs(c.createdAt.getTime(), now, sla);
        return age > sla.resolutionMs;
      }).length;

      // Total ever breached (resolved past SLA + currently breaching)
      const totalBreached = convs.filter((c) => {
        const endTime = c.resolvedAt ? c.resolvedAt.getTime() : now;
        const age = slaElapsedMs(c.createdAt.getTime(), endTime, sla);
        return age > sla.resolutionMs;
      }).length;

      return {
        total,
        resolved,
        escalated,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        escalationRate: total > 0 ? Math.round((escalated / total) * 100) : 0,
        avgMessages: total > 0 ? (totalMessages / total).toFixed(1) : "0",
        sla: {
          avgFirstResponseMs,
          avgResolutionMs,
          firstResponseCompliance: responseTimesMs.length > 0
            ? Math.round((responseCompliant / responseTimesMs.length) * 100)
            : null,
          resolutionCompliance: resolutionTimesMs.length > 0
            ? Math.round((resolutionCompliant / resolutionTimesMs.length) * 100)
            : null,
          totalWithResponse: responseTimesMs.length,
          totalResolved: resolutionTimesMs.length,
          currentlyBreaching: breaching,
          totalBreached,
          excludeWeekends: sla.excludeWeekends,
          thresholds: {
            firstResponseMs: sla.firstResponseMs,
            resolutionMs: sla.resolutionMs,
          },
        },
      };
    }),
});
