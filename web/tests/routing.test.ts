/**
 * Tests for the LLM-based department routing layer.
 *
 * All LLM calls are mocked via vi.mock — no real Groq/Anthropic calls are made.
 * No Redis mock needed: routing no longer uses a cache.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Department, Tenant } from "@/server/db/schema";
import type { DB } from "@/server/db";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────

// Mock LLM providers — we configure invoke() per-test via the factory
const mockInvoke = vi.fn();

vi.mock("@langchain/groq", () => ({
  ChatGroq: vi.fn(() => ({
    withStructuredOutput: vi.fn(() => ({ invoke: mockInvoke })),
  })),
}));

vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: vi.fn(() => ({
    withStructuredOutput: vi.fn(() => ({ invoke: mockInvoke })),
  })),
}));

// Import after mocks are established
import { detectDepartments } from "@/server/agent/routing";
import { addRoutedDepartments } from "@/server/services/conversation_service";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-uuid-1";
const CONV_ID = "conv-uuid-1";

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: TENANT_ID,
    name: "Test City",
    slug: "test-city",
    apiKey: "key-123",
    websiteDomain: "testcity.gov",
    searchDomains: [],
    logoPath: null,
    isActive: true,
    dailyRequestQuota: null,
    llmApiKey: null,
    location: null,
    latitude: null,
    longitude: null,
    widgetSettings: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeDepartment(id: string, name: string, keywords: string): Department {
  return {
    id,
    tenantId: TENANT_ID,
    name,
    phone: null,
    email: null,
    keywords,
    location: null,
    hours: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };
}

// ── detectDepartments tests ───────────────────────────────────────────────────

describe("detectDepartments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] immediately when no departments are configured — no LLM call", async () => {
    const result = await detectDepartments(makeTenant(), [], [], "Hello");

    expect(result).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("calls LLM even when message contains no department keyword — no keyword gate", async () => {
    const depts = [makeDepartment("dept-1", "Public Works", "pothole, road, sidewalk")];

    mockInvoke.mockResolvedValueOnce({ raw: {}, parsed: { departments: [] } });

    const result = await detectDepartments(
      makeTenant(),
      depts,
      [],
      "What are the library hours?",
    );

    expect(result).toEqual([]);
    expect(mockInvoke).toHaveBeenCalledOnce();
  });

  it("returns matched department when LLM returns a valid result", async () => {
    const depts = [makeDepartment("dept-pw", "Public Works", "pothole, road, street")];

    mockInvoke.mockResolvedValueOnce({
      raw: {},
      parsed: { departments: [{ id: "dept-pw", reason: "User asked about a pothole" }] },
    });

    const result = await detectDepartments(
      makeTenant(),
      depts,
      [],
      "There is a large pothole on Main Street",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "dept-pw", reason: "User asked about a pothole" });
    expect(mockInvoke).toHaveBeenCalledOnce();
  });

  it("filters out hallucinated UUIDs not present in the department list", async () => {
    const depts = [makeDepartment("dept-pw", "Public Works", "pothole, road")];

    mockInvoke.mockResolvedValueOnce({
      raw: {},
      parsed: {
        departments: [
          { id: "dept-pw", reason: "Matches pothole" },
          { id: "dept-does-not-exist", reason: "Hallucinated department" },
        ],
      },
    });

    const result = await detectDepartments(
      makeTenant(),
      depts,
      [],
      "pothole on elm street",
    );

    // Only dept-pw is valid — hallucinated UUID is filtered out
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("dept-pw");
  });

  it("returns [] and never throws when the LLM call throws an error", async () => {
    const depts = [makeDepartment("dept-fire", "Fire Department", "fire, emergency, smoke")];

    mockInvoke.mockRejectedValueOnce(new Error("LLM rate limit"));

    const result = await detectDepartments(
      makeTenant(),
      depts,
      [],
      "fire emergency on Oak Ave",
    );

    expect(result).toEqual([]);
  });

  it("passes history to the LLM prompt so follow-ups route correctly", async () => {
    const depts = [makeDepartment("dept-pw", "Public Works", "pothole, road")];
    const history = [
      { _getType: () => "human", content: "There is a pothole on Elm Street" },
      { _getType: () => "ai", content: "I can help you report that." },
    ] as never;

    mockInvoke.mockResolvedValueOnce({
      raw: {},
      parsed: { departments: [{ id: "dept-pw", reason: "Follow-up about pothole from prior turn" }] },
    });

    const result = await detectDepartments(
      makeTenant(),
      depts,
      history,
      "Who do I contact about it?",
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("dept-pw");
    // Verify the LLM received a prompt that included the history
    const invokeArgs = mockInvoke.mock.calls[0]![0] as Array<{ role: string; content: string }>;
    const humanMsg = invokeArgs.find((m) => m.role === "human")!;
    expect(humanMsg.content).toContain("pothole on Elm Street");
    expect(humanMsg.content).toContain("Who do I contact about it?");
  });
});

// ── addRoutedDepartments tests ────────────────────────────────────────────────

describe("addRoutedDepartments", () => {
  /**
   * Builds a minimal mock DB for addRoutedDepartments.
   * insert chain: .values().onConflictDoNothing()
   * update chain: .set().where()
   */
  function makeDb() {
    const onConflictDoNothing = vi.fn(async () => []);
    const insertValues = vi.fn(() => ({ onConflictDoNothing }));
    const insertSpy = vi.fn(() => ({ values: insertValues }));

    const updateWhere = vi.fn(async () => []);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const updateSpy = vi.fn(() => ({ set: updateSet }));

    const db = {
      insert: insertSpy,
      update: updateSpy,
    } as unknown as DB;

    return { db, insertSpy, insertValues, onConflictDoNothing, updateSpy, updateSet, updateWhere };
  }

  it("is a no-op when matches array is empty", async () => {
    const { db, insertSpy, updateSpy } = makeDb();

    await addRoutedDepartments(db, CONV_ID, []);

    expect(insertSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("inserts all matches into conversation_departments table", async () => {
    const { db, insertValues } = makeDb();
    const matches = [
      { id: "dept-1", reason: "Reason A" },
      { id: "dept-2", reason: "Reason B" },
    ];

    await addRoutedDepartments(db, CONV_ID, matches, "msg-uuid-1");

    expect(insertValues).toHaveBeenCalledOnce();
    const rows = (insertValues.mock.calls[0] as unknown as [unknown])[0] as Array<{
      conversationId: string;
      departmentId: string;
      reason: string;
      triggerMessageId: string | null;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ conversationId: CONV_ID, departmentId: "dept-1", reason: "Reason A", triggerMessageId: "msg-uuid-1" });
    expect(rows[1]).toMatchObject({ conversationId: CONV_ID, departmentId: "dept-2", reason: "Reason B", triggerMessageId: "msg-uuid-1" });
  });

  it("calls onConflictDoNothing to avoid duplicate rows", async () => {
    const { db, onConflictDoNothing } = makeDb();

    await addRoutedDepartments(db, CONV_ID, [{ id: "dept-1", reason: "r" }]);

    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("sets conversations.departmentId to the first match for backward compat", async () => {
    const { db, updateSet } = makeDb();
    const matches = [
      { id: "dept-first", reason: "First" },
      { id: "dept-second", reason: "Second" },
    ];

    await addRoutedDepartments(db, CONV_ID, matches);

    expect(updateSet).toHaveBeenCalledWith({ departmentId: "dept-first" });
  });

  it("passes triggerMessageId as null when not provided", async () => {
    const { db, insertValues } = makeDb();

    await addRoutedDepartments(db, CONV_ID, [{ id: "dept-1", reason: "r" }]);

    const rows = (insertValues.mock.calls[0] as unknown as [unknown])[0] as Array<{ triggerMessageId: string | null }>;
    expect(rows[0]!.triggerMessageId).toBeNull();
  });
});
