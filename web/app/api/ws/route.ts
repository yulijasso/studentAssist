/**
 * WebSocket streaming chat endpoint.
 *
 * This route handles the WebSocket upgrade. Next.js 14 does not natively
 * support WebSockets in the App Router — this is handled via a custom server
 * setup. For development, the WS upgrade is proxied via the Next.js dev server
 * using a custom `server.ts` at the project root (see web/server.ts).
 *
 * For production, run `next start` with a custom Node server that attaches ws.
 *
 * Protocol:
 *   Client → auth frame:    { type: "auth", api_key: "...", session_id: "..." }
 *   Server → auth confirm:  { type: "auth_ok" }
 *   Client → message frame: { type: "message", content: "..." }
 *   Server → token stream:  { type: "token", token: "..." }
 *   Server → done frame:    { type: "done", sources: [...] }
 *   Server → error frame:   { type: "error", message: "..." }
 */
import { NextResponse } from "next/server";

// This route exists as a documentation placeholder.
// Actual WS logic is wired in web/server.ts (custom Next.js server).
export async function GET() {
  return NextResponse.json(
    { error: "WebSocket upgrade required" },
    { status: 426, headers: { Upgrade: "websocket" } },
  );
}
