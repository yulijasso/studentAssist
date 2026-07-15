import { eq, and } from "drizzle-orm";
import type { DB } from "@/server/db";
import {
  documents,
  faqs,
  type Document,
  type NewDocument,
  type FAQ,
  type NewFAQ,
} from "@/server/db/schema";

// ── Documents ────────────────────────────────────────────────────────────────

export async function createDocument(
  db: DB,
  data: Omit<NewDocument, "id" | "createdAt" | "updatedAt">,
): Promise<Document> {
  const [doc] = await db.insert(documents).values(data).returning();
  return doc!;
}

export async function listDocuments(
  db: DB,
  tenantId: string,
): Promise<Document[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.tenantId, tenantId))
    .orderBy(documents.createdAt);
}

export async function updateDocumentStatus(
  db: DB,
  tenantId: string,
  docId: string,
  status: string,
): Promise<Document | null> {
  const [updated] = await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(documents.id, docId), eq(documents.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteDocument(
  db: DB,
  tenantId: string,
  docId: string,
): Promise<boolean> {
  const result = await db
    .delete(documents)
    .where(and(eq(documents.id, docId), eq(documents.tenantId, tenantId)))
    .returning();
  return result.length > 0;
}

// ── FAQs ─────────────────────────────────────────────────────────────────────

export async function createFaq(
  db: DB,
  data: Omit<NewFAQ, "id" | "createdAt" | "updatedAt">,
): Promise<FAQ> {
  const [faq] = await db.insert(faqs).values(data).returning();
  return faq!;
}

export async function listFaqs(
  db: DB,
  tenantId: string,
): Promise<FAQ[]> {
  return db
    .select()
    .from(faqs)
    .where(eq(faqs.tenantId, tenantId))
    .orderBy(faqs.createdAt);
}

export async function updateFaq(
  db: DB,
  tenantId: string,
  faqId: string,
  data: Partial<Pick<NewFAQ, "question" | "answer" | "departmentId">>,
): Promise<FAQ | null> {
  const [updated] = await db
    .update(faqs)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(faqs.id, faqId), eq(faqs.tenantId, tenantId)))
    .returning();
  return updated ?? null;
}

export async function deleteFaq(
  db: DB,
  tenantId: string,
  faqId: string,
): Promise<boolean> {
  const result = await db
    .delete(faqs)
    .where(and(eq(faqs.id, faqId), eq(faqs.tenantId, tenantId)))
    .returning();
  return result.length > 0;
}
