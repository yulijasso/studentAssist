import { z } from "zod";
import { router, adminProcedure } from "../init";
import {
  createDocument,
  listDocuments,
  updateDocumentStatus,
  deleteDocument,
  createFaq,
  listFaqs,
  updateFaq,
  deleteFaq,
} from "@/server/services/knowledge_base_service";

export const knowledgeBaseRouter = router({
  // ── Documents ────────────────────────────────────────────────────────────

  uploadDocument: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        departmentId: z.string().uuid().nullable(),
        name: z.string().min(1),
        savedAs: z.string().min(1),
        type: z.enum(["pdf", "txt"]),
        size: z.number().int().positive(),
        textContent: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createDocument(ctx.db, {
        tenantId: input.tenantId,
        departmentId: input.departmentId,
        name: input.name,
        savedAs: input.savedAs,
        type: input.type,
        size: input.size,
        status: "processing",
        textContent: input.textContent ?? null,
      });
    }),

  listDocuments: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return listDocuments(ctx.db, input.tenantId);
    }),

  updateDocumentStatus: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        docId: z.string().uuid(),
        status: z.enum(["processing", "ingested", "failed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await updateDocumentStatus(
        ctx.db,
        input.tenantId,
        input.docId,
        input.status,
      );
      if (!doc) throw new Error("Document not found");
      return doc;
    }),

  deleteDocument: adminProcedure
    .input(z.object({ tenantId: z.string().uuid(), docId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteDocument(ctx.db, input.tenantId, input.docId);
      if (!ok) throw new Error("Document not found");
      return { success: true };
    }),

  // ── FAQs ─────────────────────────────────────────────────────────────────

  createFaq: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        departmentId: z.string().uuid().nullable(),
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createFaq(ctx.db, {
        tenantId: input.tenantId,
        departmentId: input.departmentId,
        question: input.question,
        answer: input.answer,
      });
    }),

  listFaqs: adminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return listFaqs(ctx.db, input.tenantId);
    }),

  updateFaq: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        faqId: z.string().uuid(),
        question: z.string().min(1).optional(),
        answer: z.string().min(1).optional(),
        departmentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, faqId, ...data } = input;
      const faq = await updateFaq(ctx.db, tenantId, faqId, data);
      if (!faq) throw new Error("FAQ not found");
      return faq;
    }),

  deleteFaq: adminProcedure
    .input(z.object({ tenantId: z.string().uuid(), faqId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteFaq(ctx.db, input.tenantId, input.faqId);
      if (!ok) throw new Error("FAQ not found");
      return { success: true };
    }),
});
