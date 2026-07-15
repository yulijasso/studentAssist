/**
 * Shared TypeScript types for the Campus Assist widget.
 *
 * These interfaces describe the data contracts between the widget and the
 * backend: tenant config, chat messages, WebSocket frames, and sources.
 */

/** Configuration returned by GET /tenants/{slug}/config */
export interface TenantConfig {
  slug: string;
  name: string;
  website_domain: string;
  api_key: string;
  /** Primary brand colour (hex, e.g. "#1a56db"). Defaults to blue. */
  brand_color?: string;
  /** Greeting shown on widget open. */
  greeting?: string;
  /** Display name override (from widget settings). */
  city_name?: string;
  /** AI assistant name (e.g. "UTRGV Campus Assist"). Defaults to tenant name. */
  assistant_name?: string;
  /** Logo image URL. */
  logo_url?: string;
  /** Auto-open the widget on page load. */
  auto_open?: boolean;
  /** Widget position: "bottom-right" | "bottom-left" | "top-right" | "top-left". */
  position?: string;
}

/** A single message displayed in the chat UI. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Streaming: true while tokens are still arriving. */
  streaming?: boolean;
}

/** Source link returned in the `done` frame. */
export interface Source {
  title: string;
  url: string;
}

/** WebSocket frames sent by the server. */
export type WSMessage =
  | { type: 'token'; token: string }
  | { type: 'done'; sources: Source[] }
  | { type: 'disclaimer'; message: string }
  | { type: 'resolution_check' }
  | { type: 'more_questions_check' }
  | { type: 'system_message'; content: string }
  | { type: 'escalation_offer'; department: { name: string; phone: string } | null }
  | { type: 'contact_form' }
  | { type: 'session_closed'; reason: 'auto-resolved' | 'escalated' | 'user-resolved' }
  | { type: 'error'; message: string }
  | { type: 'auth_ok' };

/** WebSocket frames sent by the widget to the server. */
export type WSClientMessage =
  | { type: 'message'; content: string }
  | { type: 'resolution_response'; resolved: boolean }
  | { type: 'more_questions_response'; hasMore: boolean }
  | { type: 'escalation_accept' }
  | { type: 'contact_submit'; name: string; phone: string; email?: string };
