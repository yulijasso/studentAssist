/**
 * WebSocket client for the Campus Assist widget.
 *
 * Handles connection lifecycle, auth handshake, token/done/error frame
 * dispatch, message queueing before auth completes, and exponential-backoff
 * reconnection (max 6 attempts, up to 30 s delay).
 */
import type { WSMessage, WSClientMessage } from './types';

export type TokenHandler = (token: string) => void;
export type DoneHandler = (sources: { title: string; url: string }[]) => void;
export type ErrorHandler = (message: string) => void;
export type ResolutionCheckHandler = () => void;
export type MoreQuestionsCheckHandler = () => void;
export type SystemMessageHandler = (content: string) => void;
export type EscalationOfferHandler = (department: { name: string; phone: string } | null) => void;
export type ContactFormHandler = () => void;
export type SessionClosedHandler = (reason: 'auto-resolved' | 'escalated' | 'user-resolved') => void;
export type DisclaimerHandler = (message: string) => void;

interface WSClientOptions {
  wsUrl: string;
  apiKey: string;
  sessionId: string;
  onToken: TokenHandler;
  onDone: DoneHandler;
  onError: ErrorHandler;
  onReady?: () => void;
  onResolutionCheck?: ResolutionCheckHandler;
  onMoreQuestionsCheck?: MoreQuestionsCheckHandler;
  onSystemMessage?: SystemMessageHandler;
  onEscalationOffer?: EscalationOfferHandler;
  onContactForm?: ContactFormHandler;
  onSessionClosed?: SessionClosedHandler;
  onDisclaimer?: DisclaimerHandler;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 6;

/**
 * Manages a WebSocket connection to the Campus Assist server.
 *
 * Messages sent before authentication completes are queued and flushed once
 * the server responds with an `auth_ok` frame.
 */
export class CampusAssistWSClient {
  private ws: WebSocket | null = null;
  private options: WSClientOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isAuthed = false;
  private messageQueue: string[] = [];
  private destroyed = false;

  constructor(options: WSClientOptions) {
    this.options = options;
    this._connect();
  }

  /**
   * Sends a chat message to the server.
   * Queues the message if the WebSocket is not yet authenticated.
   *
   * @param userMessage - The raw text typed by the user.
   */
  send(userMessage: string): void {
    const frame = JSON.stringify({ type: 'message', content: userMessage });
    if (this.isAuthed && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      this.messageQueue.push(frame);
    }
  }

  /**
   * Sends a structured client-to-server frame (resolution_response,
   * escalation_accept, contact_submit, etc.) immediately.
   *
   * @param frame - A typed WSClientMessage object to serialize and send.
   */
  sendFrame(frame: WSClientMessage): void {
    if (this.isAuthed && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  /**
   * Permanently closes the connection and cancels any pending reconnect.
   * The instance should not be used after calling this method.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }

  /** Opens a new WebSocket connection and wires all event handlers. */
  private _connect(): void {
    if (this.destroyed) return;

    this.ws = new WebSocket(this.options.wsUrl);
    this.isAuthed = false;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Send auth frame.
      this.ws!.send(
        JSON.stringify({
          type: 'auth',
          api_key: this.options.apiKey,
          session_id: this.options.sessionId,
        }),
      );
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let frame: WSMessage;
      try {
        frame = JSON.parse(event.data as string) as WSMessage;
      } catch {
        return;
      }

      if (frame.type === 'auth_ok') {
        this.isAuthed = true;
        this.options.onReady?.();
        // Flush queued messages.
        while (this.messageQueue.length > 0) {
          const queued = this.messageQueue.shift();
          if (queued) this.ws!.send(queued);
        }
        return;
      }

      if (frame.type === 'token') {
        this.options.onToken(frame.token);
      } else if (frame.type === 'done') {
        this.options.onDone(frame.sources);
      } else if (frame.type === 'disclaimer') {
        this.options.onDisclaimer?.(frame.message);
      } else if (frame.type === 'resolution_check') {
        this.options.onResolutionCheck?.();
      } else if (frame.type === 'more_questions_check') {
        this.options.onMoreQuestionsCheck?.();
      } else if (frame.type === 'system_message') {
        this.options.onSystemMessage?.(frame.content);
      } else if (frame.type === 'escalation_offer') {
        this.options.onEscalationOffer?.(frame.department);
      } else if (frame.type === 'contact_form') {
        this.options.onContactForm?.();
      } else if (frame.type === 'session_closed') {
        this.options.onSessionClosed?.(frame.reason);
      } else if (frame.type === 'error') {
        this.options.onError(frame.message);
      }
    };

    this.ws.onerror = () => {
      // onclose will fire next; handle reconnect there.
    };

    this.ws.onclose = (event: CloseEvent) => {
      if (this.destroyed) return;
      if (event.code === 4001) {
        // Auth failure — do not reconnect.
        this.options.onError('Authentication failed. Check your API key.');
        return;
      }
      if (event.code === 1000) {
        // Clean close (session ended normally) — do not reconnect.
        return;
      }
      this._scheduleReconnect();
    };
  }

  /**
   * Schedules the next reconnection attempt using exponential backoff.
   * Calls onError and stops after MAX_RECONNECT_ATTEMPTS failures.
   */
  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.options.onError('Connection lost. Please refresh the page.');
      return;
    }
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }
}
