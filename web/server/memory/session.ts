/**
 * Session memory manager — serialises LangChain message history to/from Redis.
 *
 * In LangGraph 1.x there is no AgentExecutor memory wrapper. Instead we store
 * the raw BaseMessage array and prepend it to each agent invocation as the
 * conversation history, then append the new turn after the response.
 *
 * Keys:   session:{session_id}:memory
 * TTL:    30 minutes (reset on every read/write)
 * Window: last k=6 message pairs (12 messages max)
 */
import type { Redis } from "ioredis";
import { memLog } from "@/server/logger";
import {
  type BaseMessage,
  mapStoredMessagesToChatMessages,
  mapChatMessagesToStoredMessages,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";

const TTL_SECONDS = 30 * 60;
const WINDOW_K = 6; // keep last 6 human+AI pairs = 12 messages

function redisKey(sessionId: string): string {
  return `session:${sessionId}:memory`;
}

function applyWindow(messages: BaseMessage[]): BaseMessage[] {
  // Keep the last WINDOW_K * 2 messages (k pairs)
  const maxMessages = WINDOW_K * 2;
  return messages.length > maxMessages
    ? messages.slice(messages.length - maxMessages)
    : messages;
}

export class SessionMemoryManager {
  constructor(private redis: Redis) {}

  async load(sessionId: string): Promise<BaseMessage[]> {
    const key = redisKey(sessionId);
    const raw = await this.redis.get(key);

    if (!raw) {
      memLog.debug({ sessionId }, "Session memory miss — starting fresh");
      return [];
    }

    try {
      const stored = JSON.parse(raw) as ReturnType<
        typeof mapChatMessagesToStoredMessages
      >;
      const messages = mapStoredMessagesToChatMessages(stored);
      await this.redis.expire(key, TTL_SECONDS);
      const windowed = applyWindow(messages);
      memLog.debug(
        { sessionId, totalMessages: messages.length, windowedMessages: windowed.length },
        "Session memory loaded",
      );
      return windowed;
    } catch {
      memLog.warn({ sessionId }, "Corrupted session memory — starting fresh");
      return [];
    }
  }

  async save(
    sessionId: string,
    history: BaseMessage[],
    userMessage: string,
    assistantReply: string,
  ): Promise<void> {
    const updated = applyWindow([
      ...history,
      new HumanMessage(userMessage),
      new AIMessage(assistantReply),
    ]);
    const stored = mapChatMessagesToStoredMessages(updated);
    await this.redis.setex(
      redisKey(sessionId),
      TTL_SECONDS,
      JSON.stringify(stored),
    );
    memLog.debug(
      { sessionId, savedMessages: updated.length, ttlSeconds: TTL_SECONDS },
      "Session memory saved",
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(redisKey(sessionId));
    memLog.info({ sessionId }, "Session memory deleted");
  }
}
