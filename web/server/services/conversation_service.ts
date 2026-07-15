/**
 * Conversation persistence service.
 *
 * Conversations group messages under a (tenantId, sessionId) pair.
 * Only used when PERSIST_CHAT_MESSAGES=true.
 *
 * Also provides multi-department routing persistence via the
 * conversation_departments junction table.
 */
import { eq, and, desc, sql } from "drizzle-orm";
import type { DB } from "@/server/db";
import {
  conversations,
  messages,
  departments,
  conversationDepartments,
  type Conversation,
  type Message,
} from "@/server/db/schema";
import type { RoutingMatch } from "@/server/agent/routing";

/**
 * Finds the conversation for a (tenantId, sessionId) pair, creating it if needed.
 *
 * When `startNew` is true the lookup is skipped and a new row is always inserted.
 * This is used when Redis session history is empty (new visit or post-TTL expiry),
 * ensuring each inactivity window produces a fresh conversation row.
 *
 * When `startNew` is false (default) the most-recent existing row is returned so
 * that a session_id with multiple historical rows always resolves to the latest one.
 *
 * @param db - Drizzle database client.
 * @param tenantId - Tenant UUID.
 * @param sessionId - Browser session ID.
 * @param startNew - If true, always INSERT a new row instead of finding an existing one.
 * @returns The existing (most-recent) or newly created conversation row.
 */
export async function getOrCreateConversation(
  db: DB,
  tenantId: string,
  sessionId: string,
  startNew = false,
): Promise<Conversation> {
  if (!startNew) {
    const existing = await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.tenantId, tenantId), eq(conversations.sessionId, sessionId)),
      )
      .orderBy(desc(conversations.createdAt))
      .limit(1);

    if (existing[0]) return existing[0];
  }

  const [created] = await db
    .insert(conversations)
    .values({ tenantId, sessionId })
    .returning();
  return created!;
}

/**
 * Updates a conversation's status and optionally marks it as escalated.
 *
 * @param db - Drizzle database client.
 * @param conversationId - UUID of the conversation to update.
 * @param status - New status value.
 * @param wasEscalated - When true, sets the wasEscalated flag permanently.
 */
export async function updateConversationStatus(
  db: DB,
  conversationId: string,
  status: "new" | "open" | "resolved" | "escalated" | "auto-resolved",
  wasEscalated?: boolean,
): Promise<void> {
  const now = new Date();
  const set: Record<string, unknown> = { status, updatedAt: now };
  if (wasEscalated) set.wasEscalated = true;

  // SLA timestamp tracking
  if (status === "resolved") set.resolvedAt = now;
  if (status === "escalated") set.escalatedAt = now;
  if (status === "auto-resolved") {
    set.resolvedAt = now;
    set.autoResolvedAt = now;
  }

  await db
    .update(conversations)
    .set(set)
    .where(eq(conversations.id, conversationId));
}

/**
 * Stores escalation contact details as a JSON object on a conversation.
 *
 * Called when a user confirms they want a city department to reach out.
 * Name and phone are required; email is optional.
 *
 * @param db - Drizzle database client.
 * @param conversationId - UUID of the conversation.
 * @param contact - Contact details: required name + phone, optional email.
 */
export async function storeEscalationContact(
  db: DB,
  conversationId: string,
  contact: { name: string; phone: string; email?: string },
): Promise<void> {
  await db
    .update(conversations)
    .set({ escalationContact: contact, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/**
 * Appends a single message to a conversation.
 *
 * @param db - Drizzle database client.
 * @param conversationId - UUID of the parent conversation.
 * @param role - "user" or "assistant".
 * @param content - Raw message text.
 * @param sources - Optional web source links (assistant messages only).
 * @returns The inserted message row.
 */
export async function logMessage(
  db: DB,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  sources?: { title: string; url: string }[],
): Promise<Message> {
  const [msg] = await db
    .insert(messages)
    .values({ conversationId, role, content, sources: sources ?? null })
    .returning();

  // Track first response time for SLA
  if (role === "assistant") {
    const conv = await db
      .select({ firstResponseAt: conversations.firstResponseAt })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (conv[0] && !conv[0].firstResponseAt) {
      await db
        .update(conversations)
        .set({ firstResponseAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
  }

  return msg!;
}

/**
 * Sets the detected language on a message row.
 *
 * Called after the fire-and-forget escalation classifier resolves (see
 * `detectEscalation` in `agent/routing.ts`), since language is only known
 * after that LLM call completes — well after the message itself was
 * already persisted and streamed to the client.
 *
 * @param db - Drizzle database client.
 * @param messageId - UUID of the message row to update.
 * @param language - Detected language: "en", "es", or "mixed".
 */
export async function updateMessageLanguage(
  db: DB,
  messageId: string,
  language: "en" | "es" | "mixed",
): Promise<void> {
  await db
    .update(messages)
    .set({ language })
    .where(eq(messages.id, messageId));
}

/**
 * Stores a disclaimer event as a message row with role "disclaimer".
 *
 * The disclaimer text shown to the user is stored in `content`.
 * The LLM's reason for triggering the disclaimer is stored in
 * `metadata.disclaimerReason` for legal audit purposes.
 *
 * Does NOT update `firstResponseAt` — that SLA field is reserved for
 * role "assistant" messages only.
 *
 * @param db - Drizzle database client.
 * @param conversationId - UUID of the parent conversation.
 * @param disclaimerText - The disclaimer text shown to the user.
 * @param reason - The LLM classifier's explanation for why the disclaimer was triggered.
 * @returns The inserted message row.
 */
export async function logDisclaimerMessage(
  db: DB,
  conversationId: string,
  disclaimerText: string,
  reason: string,
): Promise<Message> {
  const [msg] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "disclaimer",
      content: disclaimerText,
      metadata: { disclaimerReason: reason },
    })
    .returning();
  return msg!;
}

/**
 * Inserts routing matches into the conversation_departments junction table.
 *
 * Uses ON CONFLICT DO NOTHING so duplicate department detections are silently
 * ignored — the unique constraint (conversationId, departmentId) is the guard.
 *
 * Also sets conversations.departmentId to the first match when it is currently
 * NULL, providing backward compatibility for queries that rely on the single FK.
 * The update uses WHERE department_id IS NULL to be race-safe.
 *
 * @param db - Drizzle database client.
 * @param conversationId - UUID of the conversation.
 * @param matches - Routing matches from detectDepartments().
 * @param triggerMessageId - UUID of the assistant message that triggered routing.
 */
export async function addRoutedDepartments(
  db: DB,
  conversationId: string,
  matches: RoutingMatch[],
  triggerMessageId?: string,
): Promise<void> {
  if (matches.length === 0) return;

  // Bulk insert — ignore conflicts so duplicates are silently dropped
  await db
    .insert(conversationDepartments)
    .values(
      matches.map((m) => ({
        conversationId,
        departmentId: m.id,
        reason: m.reason,
        triggerMessageId: triggerMessageId ?? null,
      })),
    )
    .onConflictDoNothing();

  // Backward compat: set the single-FK column to the first match if still NULL
  await db
    .update(conversations)
    .set({ departmentId: matches[0]!.id })
    .where(
      and(
        eq(conversations.id, conversationId),
        sql`${conversations.departmentId} IS NULL`,
      ),
    );
}

/**
 * Returns all departments routed to a conversation, ordered by detection time.
 *
 * @param db - Drizzle database client.
 * @param conversationId - UUID of the conversation.
 * @returns Array of routed department records with department name.
 */
export async function getRoutedDepartments(
  db: DB,
  conversationId: string,
): Promise<
  {
    departmentId: string;
    departmentName: string;
    reason: string | null;
    detectedAt: Date;
  }[]
> {
  const rows = await db
    .select({
      departmentId: conversationDepartments.departmentId,
      departmentName: departments.name,
      reason: conversationDepartments.reason,
      detectedAt: conversationDepartments.detectedAt,
    })
    .from(conversationDepartments)
    .innerJoin(departments, eq(conversationDepartments.departmentId, departments.id))
    .where(eq(conversationDepartments.conversationId, conversationId))
    .orderBy(conversationDepartments.detectedAt);

  return rows;
}
