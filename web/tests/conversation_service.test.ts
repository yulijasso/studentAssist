/**
 * Tests for getOrCreateConversation — specifically the startNew session-window scoping.
 *
 * Uses a minimal chainable DB mock to avoid any real database connection.
 */
import { describe, it, expect, vi } from "vitest";
import { getOrCreateConversation } from "@/server/services/conversation_service";
import type { DB } from "@/server/db";
import type { Conversation } from "@/server/db/schema";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-uuid-1";
const SESSION_ID = "session-abc";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-uuid-1",
    tenantId: TENANT_ID,
    sessionId: SESSION_ID,
    status: "new",
    priority: "normal",
    departmentId: null,
    intent: null,
    assignedTo: null,
    wasEscalated: false,
    firstResponseAt: null,
    resolvedAt: null,
    escalatedAt: null,
    autoResolvedAt: null,
    escalationContact: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

// ── DB Mock Builders ──────────────────────────────────────────────────────────

/**
 * Builds a mock DB that returns `rows` from .select() queries
 * and `inserted` from .insert() queries.
 *
 * @param rows - Rows returned by the select chain.
 * @param inserted - Row returned by insert().returning().
 * @returns Mock DB and spy accessors.
 */
function makeDb(rows: Conversation[], inserted: Conversation) {
  const insertSpy = vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [inserted]),
    })),
  }));

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => rows),
  };

  const db = {
    select: vi.fn(() => selectChain),
    insert: insertSpy,
  } as unknown as DB;

  return { db, insertSpy, selectChain };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getOrCreateConversation", () => {
  it("returns existing row when startNew is false (default)", async () => {
    const existing = makeConversation({ id: "conv-existing" });
    const { db, insertSpy } = makeDb([existing], makeConversation({ id: "conv-new" }));

    const result = await getOrCreateConversation(db, TENANT_ID, SESSION_ID);

    expect(result.id).toBe("conv-existing");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("inserts a new row when no existing conversation found (startNew=false)", async () => {
    const inserted = makeConversation({ id: "conv-brand-new" });
    const { db, insertSpy } = makeDb([], inserted);

    const result = await getOrCreateConversation(db, TENANT_ID, SESSION_ID);

    expect(result.id).toBe("conv-brand-new");
    expect(insertSpy).toHaveBeenCalledOnce();
  });

  it("always inserts a new row when startNew is true, even when existing rows exist", async () => {
    const existing = makeConversation({ id: "conv-existing" });
    const inserted = makeConversation({ id: "conv-after-expiry" });
    const { db, insertSpy, selectChain } = makeDb([existing], inserted);

    const result = await getOrCreateConversation(db, TENANT_ID, SESSION_ID, true);

    expect(result.id).toBe("conv-after-expiry");
    expect(insertSpy).toHaveBeenCalledOnce();
    // select should not have been called — startNew skips the lookup
    expect(selectChain.from).not.toHaveBeenCalled();
  });

  it("uses orderBy(desc) when performing the select lookup", async () => {
    const existing = makeConversation({ id: "conv-latest" });
    const { db, selectChain } = makeDb([existing], makeConversation());

    await getOrCreateConversation(db, TENANT_ID, SESSION_ID, false);

    expect(selectChain.orderBy).toHaveBeenCalledOnce();
  });
});
