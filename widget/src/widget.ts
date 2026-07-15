/**
 * CampusAssistWidget — top-level orchestrator for the embeddable chat widget.
 *
 * Responsibilities:
 *   1. Fetch tenant config from the backend.
 *   2. Mount the Shadow DOM chat UI.
 *   3. Create and manage the WebSocket client.
 *   4. Wire UI send events to the WebSocket.
 */
import { ChatUI } from './chat-ui';
import { fetchTenantConfig } from './config';
import { getOrCreateSessionId, createNewSessionId } from './session';
import type { TenantConfig } from './types';
import { CampusAssistWSClient } from './websocket-client';

export interface WidgetOptions {
  tenantSlug: string;
  apiUrl: string;
  /** WebSocket URL (defaults to derived from apiUrl: http → ws, https → wss) */
  wsUrl?: string;
}

/**
 * Converts an HTTP(S) URL to its WebSocket equivalent.
 *
 * @param url - An http:// or https:// URL.
 * @returns The same URL with the scheme replaced by ws:// or wss://.
 */
function httpToWs(url: string): string {
  return url.replace(/^http/, 'ws');
}

/**
 * Main widget class.  One instance is created per `<script data-tenant>` tag
 * found on the page.
 */
export class CampusAssistWidget {
  private options: WidgetOptions;
  private config: TenantConfig | null = null;
  private ui: ChatUI | null = null;
  private wsClient: CampusAssistWSClient | null = null;
  private sessionId: string;
  private host: HTMLElement;

  constructor(options: WidgetOptions) {
    this.options = options;
    this.sessionId = getOrCreateSessionId();
    this.host = document.createElement('div');
    this.host.id = 'campus-assist-widget-host';
    document.body.appendChild(this.host);
  }

  /**
   * Fetches tenant config, mounts the UI, and connects the WebSocket.
   * Logs and returns early if the tenant config fetch fails.
   */
  async init(): Promise<void> {
    try {
      this.config = await fetchTenantConfig(this.options.apiUrl, this.options.tenantSlug);
    } catch (err) {
      console.error('[CampusAssist] Failed to load tenant config:', err);
      return;
    }

    const displayName = this.config.city_name || this.config.name;
    const assistantName = this.config.assistant_name || displayName;
    const brandColor = this.config.brand_color ?? '#1a56db';
    const logoUrl = this.config.logo_url ?? '';
    const greeting =
      this.config.greeting ??
      `Hi! Ask me anything about ${displayName} admissions, registration, financial aid, academics, or campus services.`;

    this.ui = new ChatUI(this.host, {
      brandColor,
      cityName: displayName,
      assistantName,
      logoUrl,
      greeting,
      autoOpen: this.config.auto_open ?? false,
      position: this.config.position ?? 'bottom-right',
    });

    const wsUrl =
      this.options.wsUrl ?? `${httpToWs(this.options.apiUrl)}/api/ws`;

    this._mountWsClient(wsUrl);

    this.ui.setOnNewConversation(() => this._resetConversation(wsUrl));
  }

  /**
   * Creates and mounts a new WebSocket client, wiring all frame handlers to the UI.
   *
   * @param wsUrl - The WebSocket endpoint URL.
   */
  private _mountWsClient(wsUrl: string): void {
    this.wsClient = new CampusAssistWSClient({
      wsUrl,
      apiKey: this.config!.api_key,
      sessionId: this.sessionId,
      onToken: (token) => this.ui!.appendToken(token),
      onDone: (sources) => this.ui!.finalizeMessage(sources),
      onError: (message) => this.ui!.showError(message),
      onReady: () => {
        // WebSocket authed — widget is fully ready.
      },
      onSystemMessage: (content) => {
        this.ui!.showSystemMessage(content);
      },
      onResolutionCheck: () => {
        this.ui!.showResolutionCheck((resolved) => {
          this.wsClient!.sendFrame({ type: 'resolution_response', resolved });
        });
      },
      onMoreQuestionsCheck: () => {
        this.ui!.showMoreQuestionsCheck((hasMore) => {
          this.wsClient!.sendFrame({ type: 'more_questions_response', hasMore });
        });
      },
      onEscalationOffer: (department) => {
        this.ui!.showEscalationOffer(department, () => {
          this.wsClient!.sendFrame({ type: 'escalation_accept' });
        });
      },
      onContactForm: () => {
        this.ui!.showContactForm((name, phone, email) => {
          this.wsClient!.sendFrame({ type: 'contact_submit', name, phone, ...(email !== undefined ? { email } : {}) });
        });
      },
      onSessionClosed: (reason) => {
        this.ui!.closeSession(reason);
      },
      onDisclaimer: (message) => {
        this.ui!.showDisclaimer(message);
      },
    });

    this.ui!.setOnSend((text) => {
      this.ui!.appendUserMessage(text);
      this.ui!.startAssistantMessage();
      this.wsClient!.send(text);
    });
  }

  /**
   * Resets the widget to a fresh conversation state: new session ID, clears
   * messages, and reconnects the WebSocket with the new session.
   *
   * @param wsUrl - The WebSocket endpoint URL to reconnect to.
   */
  private _resetConversation(wsUrl: string): void {
    this.wsClient?.destroy();
    this.sessionId = createNewSessionId();
    this.ui!.reset();
    this._mountWsClient(wsUrl);
  }

  /**
   * Tears down the widget: closes the WebSocket and removes the host element
   * from the DOM.
   */
  destroy(): void {
    this.wsClient?.destroy();
    this.host.remove();
  }
}
