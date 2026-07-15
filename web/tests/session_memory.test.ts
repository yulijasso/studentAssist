import { describe, it, expect, vi } from "vitest";
import { SessionMemoryManager } from "@/server/memory/session";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { Redis } from "ioredis";

function makeMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    }),
    expire: vi.fn(async (_key: string, _ttl: number) => 1),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    _store: store,
  };
}

describe("SessionMemoryManager", () => {
  it("returns empty array for new session", async () => {
    const redis = makeMockRedis() as unknown as Redis;
    const manager = new SessionMemoryManager(redis);
    const history = await manager.load("new-session");
    expect(history).toHaveLength(0);
  });

  it("saves and reloads messages", async () => {
    const redis = makeMockRedis() as unknown as Redis;
    const manager = new SessionMemoryManager(redis);

    const history = await manager.load("session-1");
    await manager.save("session-1", history, "Hello", "Hi there!");

    const reloaded = await manager.load("session-1");
    expect(reloaded).toHaveLength(2);
    expect(reloaded[0]._getType()).toBe("human");
    expect(reloaded[1]._getType()).toBe("ai");
  });

  it("uses correct Redis key format", async () => {
    const redis = makeMockRedis() as unknown as Redis;
    const manager = new SessionMemoryManager(redis);
    await manager.load("test-session");
    expect(vi.mocked(redis.get)).toHaveBeenCalledWith("session:test-session:memory");
  });

  it("enforces window of k=6 pairs (12 messages max)", async () => {
    const redis = makeMockRedis() as unknown as Redis;
    const manager = new SessionMemoryManager(redis);

    // Build 7 pairs = 14 messages, should keep last 6 pairs = 12
    let history: Awaited<ReturnType<SessionMemoryManager["load"]>> = [];
    for (let i = 0; i < 7; i++) {
      await manager.save("windowed-session", history, `Q${i}`, `A${i}`);
      history = await manager.load("windowed-session");
    }

    expect(history.length).toBe(12);
  });

  it("resets TTL on load of existing session", async () => {
    const redis = makeMockRedis() as unknown as Redis;
    const { _store } = redis as unknown as { _store: Map<string, string> };
    // Pre-fill with a human+AI message pair
    const { mapChatMessagesToStoredMessages } = await import("@langchain/core/messages");
    const stored = mapChatMessagesToStoredMessages([
      new HumanMessage("hello"),
      new AIMessage("hi"),
    ]);
    _store.set("session:ttl-session:memory", JSON.stringify(stored));

    const manager = new SessionMemoryManager(redis);
    await manager.load("ttl-session");
    expect(vi.mocked(redis.expire)).toHaveBeenCalledWith("session:ttl-session:memory", 1800);
  });
});
