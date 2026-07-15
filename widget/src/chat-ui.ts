/**
 * Campus Assist Widget — chat UI renderer.
 *
 * Builds the Shadow DOM panel, handles streaming token appends, and re-renders
 * the final assistant message as formatted markdown (bold, clickable links)
 * once the stream completes. No external dependencies — uses the DOM API only.
 */
import type { Source } from './types';

export interface ChatUIOptions {
  brandColor: string;
  cityName: string;
  /** AI assistant display name shown in the chat header. Defaults to cityName. */
  assistantName?: string;
  logoUrl: string;
  greeting: string;
  autoOpen?: boolean;
  position?: string; // "bottom-right" | "bottom-left" | "top-right" | "top-left"
}

const STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #111827;
  }

  #launcher {
    position: fixed;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--ca-brand, #1a56db);
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease;
    z-index: 2147483647;
  }
  #launcher:hover { transform: scale(1.08); }
  #launcher svg { width: 26px; height: 26px; fill: #fff; }

  /* Position variants */
  :host([data-pos="bottom-right"]) #launcher { bottom: 24px; right: 24px; }
  :host([data-pos="bottom-left"])  #launcher { bottom: 24px; left: 24px; }
  :host([data-pos="top-right"])    #launcher { top: 24px; right: 24px; }
  :host([data-pos="top-left"])     #launcher { top: 24px; left: 24px; }

  #panel {
    position: fixed;
    width: 360px;
    max-height: 560px;
    border-radius: 16px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18);
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483646;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  :host([data-pos="bottom-right"]) #panel { bottom: 92px; right: 24px; }
  :host([data-pos="bottom-left"])  #panel { bottom: 92px; left: 24px; }
  :host([data-pos="top-right"])    #panel { top: 92px; right: 24px; }
  :host([data-pos="top-left"])     #panel { top: 92px; left: 24px; }

  #panel.hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
  :host([data-pos="top-right"]) #panel.hidden,
  :host([data-pos="top-left"])  #panel.hidden { transform: translateY(-12px); }

  #header {
    padding: 12px 16px;
    background: var(--ca-brand, #1a56db);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  #header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  #header-logo {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    object-fit: contain;
    background: rgba(255,255,255,0.15);
  }
  #header-text {
    display: flex;
    flex-direction: column;
  }
  #header-title { font-weight: 600; font-size: 14px; line-height: 1.2; }
  #header-subtitle { font-size: 11px; opacity: 0.8; line-height: 1.2; }
  #header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #close-btn {
    background: none; border: none; color: #fff; cursor: pointer;
    padding: 2px; line-height: 1;
    font-size: 14px; opacity: 0.6;
  }
  #close-btn:hover { opacity: 1; }

  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #f9fafb;
  }

  #greeting-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px 16px 12px;
    color: #9ca3af;
  }
  #greeting-icon {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: #9ca3af;
    stroke-width: 2;
    margin-bottom: 8px;
  }
  #greeting-text {
    font-size: 12px;
    text-align: center;
    max-width: 220px;
    line-height: 1.5;
    color: #9ca3af;
  }

  .msg {
    max-width: 82%;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 13px;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .msg.user {
    align-self: flex-end;
    background: var(--ca-brand, #1a56db);
    color: #fff;
    border-bottom-right-radius: 4px;
  }
  .msg.assistant {
    align-self: flex-start;
    background: #fff;
    color: #374151;
    border: 1px solid #e5e7eb;
    border-bottom-left-radius: 4px;
  }
  .msg.streaming::after {
    content: '\\258B';
    animation: blink 0.8s step-start infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }

  .sources {
    margin-top: 6px;
    font-size: 11px;
  }
  .sources a { color: var(--ca-brand, #1a56db); text-decoration: underline; display: block; font-weight: 600; }
  .msg.assistant a { color: var(--ca-brand, #1a56db); text-decoration: underline; font-weight: 600; }
  .msg.assistant strong { font-weight: 700; }

  .action-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .action-btn {
    padding: 5px 14px;
    border-radius: 20px;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .action-btn.primary { background: var(--ca-brand, #1a56db); color: #fff; }
  .action-btn.secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }

  .contact-form { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .contact-input {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    font-family: inherit;
    color: #374151;
    background: #f9fafb;
    outline: none;
  }
  .contact-input:focus { border-color: var(--ca-brand, #1a56db); }

  .system-msg {
    align-self: center;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
    font-size: 12px;
    border-radius: 12px;
    padding: 7px 14px;
    max-width: 88%;
    text-align: center;
  }

  .disclaimer {
    align-self: stretch;
    display: flex;
    align-items: flex-start;
    gap: 7px;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-left: 3px solid #f59e0b;
    color: #92400e;
    font-size: 11px;
    line-height: 1.5;
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 2px;
  }
  .disclaimer-icon {
    flex-shrink: 0;
    font-size: 13px;
    line-height: 1.4;
  }

  .session-ended {
    align-self: center;
    font-size: 11px;
    color: #9ca3af;
    margin: 6px 0;
    text-align: center;
  }
  .new-convo-btn {
    align-self: center;
    margin-top: 4px;
    padding: 6px 16px;
    border-radius: 20px;
    border: 1px solid var(--ca-brand, #1a56db);
    background: transparent;
    color: var(--ca-brand, #1a56db);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .new-convo-btn:hover { background: var(--ca-brand, #1a56db); color: #fff; }

  #input-row {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid #e5e7eb;
    background: #fff;
    align-items: center;
  }
  #input {
    flex: 1;
    border: none;
    border-radius: 20px;
    padding: 8px 14px;
    font-size: 12px;
    outline: none;
    font-family: inherit;
    resize: none;
    max-height: 80px;
    background: #f3f4f6;
    color: #374151;
  }
  #input::placeholder { color: #9ca3af; }
  #input:focus { background: #f3f4f6; }
  #send-btn {
    width: 28px;
    height: 28px;
    min-width: 28px;
    background: var(--ca-brand, #1a56db);
    color: #fff;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    flex-shrink: 0;
  }
  #send-btn svg { width: 12px; height: 12px; fill: none; stroke: #fff; stroke-width: 2; }
  #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CHAT_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
</svg>`;

const MESSAGE_CIRCLE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
</svg>`;

const SEND_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="22" y1="2" x2="11" y2="13"></line>
  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
</svg>`;

/**
 * Parses inline markdown tokens in a single line of text and appends
 * the resulting DOM nodes to `parent`. Handles **bold**, [text](url),
 * and bare https:// URLs. Uses DOM API only — no innerHTML, no XSS risk.
 *
 * @param text   - A single line of text to parse.
 * @param parent - The DOM node to append rendered children to.
 */
function renderInline(text: string, parent: Node): void {
  const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    }
    if (m[1] !== undefined) {
      const s = document.createElement('strong');
      s.textContent = m[1];
      parent.appendChild(s);
    } else if (m[2] !== undefined) {
      const a = document.createElement('a');
      a.href = m[3];
      a.textContent = m[2];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      parent.appendChild(a);
    } else {
      const a = document.createElement('a');
      a.href = m[4];
      a.textContent = m[4];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      parent.appendChild(a);
    }
    last = TOKEN.lastIndex;
  }
  if (last < text.length) {
    parent.appendChild(document.createTextNode(text.slice(last)));
  }
}

/**
 * Converts a markdown string to a DocumentFragment using safe DOM API calls.
 * Supports **bold**, [text](url), bare https:// URLs, and newline→<br>.
 *
 * @param text - The raw markdown string to render.
 * @returns A DocumentFragment ready to append into the message bubble.
 */
function renderMarkdown(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) frag.appendChild(document.createElement('br'));
    renderInline(lines[i], frag);
  }
  return frag;
}

export class ChatUI {
  private shadow: ShadowRoot;
  private panel!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private input!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private isOpen = false;
  private currentStreamEl: HTMLElement | null = null;
  private currentStreamText = '';
  private onSend: ((text: string) => void) | null = null;
  private onNewConversation: (() => void) | null = null;
  private opts: ChatUIOptions;

  constructor(host: HTMLElement, opts: ChatUIOptions) {
    this.opts = opts;
    // Set position attribute on host for CSS :host() selectors
    const pos = opts.position || 'bottom-right';
    host.setAttribute('data-pos', pos);
    this.shadow = host.attachShadow({ mode: 'open' });
    this._build();
    if (opts.autoOpen) {
      this._open();
    }
  }

  setOnSend(handler: (text: string) => void): void {
    this.onSend = handler;
  }

  /**
   * Registers a callback invoked when the user clicks "Start a new conversation"
   * after a session has been closed.
   *
   * @param handler - Callback with no arguments.
   */
  setOnNewConversation(handler: () => void): void {
    this.onNewConversation = handler;
  }

  appendUserMessage(text: string): void {
    const el = this._msgEl('user');
    el.textContent = text;
    this.messagesContainer.appendChild(el);
    this._scrollToBottom();
  }

  /** Creates a new streaming assistant bubble and resets the text accumulator. */
  startAssistantMessage(): void {
    const el = this._msgEl('assistant');
    el.classList.add('streaming');
    this.messagesContainer.appendChild(el);
    this.currentStreamEl = el;
    this.currentStreamText = '';
    this._scrollToBottom();
  }

  /**
   * Appends a streaming token to the current assistant bubble.
   * Stores raw text during streaming; markdown is rendered on finalize.
   *
   * @param token - The next streamed token string.
   */
  appendToken(token: string): void {
    if (!this.currentStreamEl) this.startAssistantMessage();
    this.currentStreamText += token;
    this.currentStreamEl!.textContent = this.currentStreamText;
    this._scrollToBottom();
  }

  /**
   * Finalizes the assistant message: re-renders the accumulated text as
   * markdown (bold + clickable links), then appends source links below.
   *
   * @param sources - Source URLs to display below the answer.
   */
  finalizeMessage(sources: Source[]): void {
    if (this.currentStreamEl) {
      this.currentStreamEl.classList.remove('streaming');

      // Re-render plain text as formatted markdown
      while (this.currentStreamEl.firstChild) {
        this.currentStreamEl.removeChild(this.currentStreamEl.firstChild);
      }
      this.currentStreamEl.appendChild(renderMarkdown(this.currentStreamText));
      this.currentStreamText = '';

      if (sources.length > 0) {
        const sourcesEl = document.createElement('div');
        sourcesEl.className = 'sources';
        sources.forEach((s) => {
          const a = document.createElement('a');
          a.href = s.url;
          a.textContent = s.title || s.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          sourcesEl.appendChild(a);
        });
        this.currentStreamEl.appendChild(sourcesEl);
      }
      this.currentStreamEl = null;
    }
    this.sendBtn.disabled = false;
    this.input.disabled = false;
    this.input.focus();
  }

  /**
   * Appends a resolution check prompt with Yes / No buttons.
   *
   * @param onResponse - Called with `true` when Yes is clicked, `false` for No.
   */
  showResolutionCheck(onResponse: (resolved: boolean) => void): void {
    const bubble = this._msgEl('assistant');

    const text = document.createElement('span');
    text.textContent = 'Was your question resolved?';
    bubble.appendChild(text);

    const btnRow = document.createElement('div');
    btnRow.className = 'action-buttons';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'action-btn primary';
    yesBtn.textContent = '✓ Yes';

    const noBtn = document.createElement('button');
    noBtn.className = 'action-btn secondary';
    noBtn.textContent = '✗ No';

    const disable = () => { yesBtn.disabled = true; noBtn.disabled = true; };

    yesBtn.addEventListener('click', () => { disable(); onResponse(true); });
    noBtn.addEventListener('click', () => { disable(); onResponse(false); });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    bubble.appendChild(btnRow);

    this.messagesContainer.appendChild(bubble);
    this._scrollToBottom();
  }

  /**
   * Appends an escalation offer with Yes / No buttons.
   *
   * @param department - Department info to mention, or null for a generic message.
   * @param onAccept - Called when the user clicks Yes.
   */
  showEscalationOffer(
    department: { name: string; phone: string } | null,
    onAccept: () => void,
  ): void {
    const bubble = this._msgEl('assistant');

    const deptName = department?.name ?? 'the relevant office';
    const text = document.createElement('span');
    text.textContent =
      `It looks like your question may need more help. Would you like ${deptName} to reach out to you directly?`;
    bubble.appendChild(text);

    const btnRow = document.createElement('div');
    btnRow.className = 'action-buttons';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'action-btn primary';
    yesBtn.textContent = 'Yes, contact me';

    const noBtn = document.createElement('button');
    noBtn.className = 'action-btn secondary';
    noBtn.textContent = 'No, thanks';

    const disable = () => { yesBtn.disabled = true; noBtn.disabled = true; };

    yesBtn.addEventListener('click', () => { disable(); onAccept(); });
    noBtn.addEventListener('click', () => { disable(); });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    bubble.appendChild(btnRow);

    this.messagesContainer.appendChild(bubble);
    this._scrollToBottom();
  }

  /**
   * Appends an inline contact form (name + phone required, email optional).
   *
   * @param onSubmit - Called with name, phone, and optional email on submission.
   */
  showContactForm(onSubmit: (name: string, phone: string, email?: string) => void): void {
    const bubble = this._msgEl('assistant');

    const text = document.createElement('span');
    text.textContent = 'Please provide your contact details and a representative will reach out within 24 hours.';
    bubble.appendChild(text);

    const form = document.createElement('div');
    form.className = 'contact-form';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'contact-input';
    nameInput.placeholder = 'Your name *';

    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.className = 'contact-input';
    phoneInput.placeholder = 'Phone number *';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'contact-input';
    emailInput.placeholder = 'Email address (optional)';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'action-btn primary';
    submitBtn.textContent = 'Submit';

    submitBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const email = emailInput.value.trim() || undefined;
      if (!name || !phone) return;
      submitBtn.disabled = true;
      nameInput.disabled = true;
      phoneInput.disabled = true;
      emailInput.disabled = true;
      onSubmit(name, phone, email);
    });

    form.appendChild(nameInput);
    form.appendChild(phoneInput);
    form.appendChild(emailInput);
    form.appendChild(submitBtn);
    bubble.appendChild(form);

    this.messagesContainer.appendChild(bubble);
    this._scrollToBottom();
  }

  /**
   * Renders a green informational system message (not a chat bubble).
   * Used for acknowledgments like "Thanks for your feedback!".
   *
   * @param content - The message text to display.
   */
  showSystemMessage(content: string): void {
    const el = document.createElement('div');
    el.className = 'system-msg';
    el.textContent = content;
    this.messagesContainer.appendChild(el);
    this._scrollToBottom();
  }

  /**
   * Renders an amber caution disclaimer box below the last assistant message.
   * Used for sensitive topics (legal, health, financial, permits, emergencies).
   *
   * @param message - The disclaimer text to display.
   */
  showDisclaimer(message: string): void {
    const el = document.createElement('div');
    el.className = 'disclaimer';

    const icon = document.createElement('span');
    icon.className = 'disclaimer-icon';
    icon.textContent = '⚠️';

    const text = document.createElement('span');
    text.textContent = message;

    el.appendChild(icon);
    el.appendChild(text);
    this.messagesContainer.appendChild(el);
    this._scrollToBottom();
  }

  /**
   * Appends a "Do you have any more questions?" prompt with Yes / No buttons.
   *
   * @param onResponse - Called with `true` if user wants to continue, `false` to end.
   */
  showMoreQuestionsCheck(onResponse: (hasMore: boolean) => void): void {
    const bubble = this._msgEl('assistant');

    const text = document.createElement('span');
    text.textContent = 'Do you have any more questions?';
    bubble.appendChild(text);

    const btnRow = document.createElement('div');
    btnRow.className = 'action-buttons';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'action-btn primary';
    yesBtn.textContent = 'Yes';

    const noBtn = document.createElement('button');
    noBtn.className = 'action-btn secondary';
    noBtn.textContent = 'No';

    const disable = () => { yesBtn.disabled = true; noBtn.disabled = true; };

    yesBtn.addEventListener('click', () => { disable(); onResponse(true); });
    noBtn.addEventListener('click', () => { disable(); onResponse(false); });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    bubble.appendChild(btnRow);

    this.messagesContainer.appendChild(bubble);
    this._scrollToBottom();
  }

  /**
   * Closes the session: disables input, shows a closing message, and offers
   * a "Start a new conversation" button.
   *
   * @param reason - Why the session ended (affects the displayed message).
   */
  closeSession(reason: 'auto-resolved' | 'escalated' | 'user-resolved'): void {
    this.input.disabled = true;
    this.sendBtn.disabled = true;

    const endedMsg = document.createElement('div');
    endedMsg.className = 'session-ended';
    endedMsg.textContent =
      reason === 'escalated'
        ? 'Your request has been submitted — a team member will reach out within 24 hours.'
        : 'This session has ended.';
    this.messagesContainer.appendChild(endedMsg);

    const newBtn = document.createElement('button');
    newBtn.className = 'new-convo-btn';
    newBtn.textContent = 'Start a new conversation';
    newBtn.addEventListener('click', () => {
      this.onNewConversation?.();
    });
    this.messagesContainer.appendChild(newBtn);

    this._scrollToBottom();
  }

  showError(message: string): void {
    const el = this._msgEl('assistant');
    el.textContent = `\u26A0\uFE0F ${message}`;
    el.style.color = '#dc2626';
    this.messagesContainer.appendChild(el);
    this.currentStreamEl = null;
    this.sendBtn.disabled = false;
    this.input.disabled = false;
    this._scrollToBottom();
  }

  /**
   * Resets the chat UI to a clean state for a new conversation.
   *
   * Clears all messages (preserving the greeting area), re-enables input,
   * and resets streaming state. Used when the user starts a new conversation
   * after a session has been closed.
   */
  reset(): void {
    // Remove all children and re-add the greeting area
    while (this.messagesContainer.firstChild) {
      this.messagesContainer.removeChild(this.messagesContainer.firstChild);
    }
    const greetingArea = document.createElement('div');
    greetingArea.id = 'greeting-area';
    const greetingIcon = document.createElement('span');
    greetingIcon.innerHTML = MESSAGE_CIRCLE_ICON.replace('viewBox', 'id="greeting-icon" viewBox');
    const greetingText = document.createElement('div');
    greetingText.id = 'greeting-text';
    greetingText.textContent = this.opts.greeting;
    greetingArea.appendChild(greetingIcon);
    greetingArea.appendChild(greetingText);
    this.messagesContainer.appendChild(greetingArea);

    this.currentStreamEl = null;
    this.currentStreamText = '';
    this.input.disabled = false;
    this.sendBtn.disabled = false;
    this.input.value = '';
    this.input.focus();
  }

  private _build(): void {
    const style = document.createElement('style');
    style.textContent = STYLES;

    // Launcher button
    const launcher = document.createElement('button');
    launcher.id = 'launcher';
    launcher.innerHTML = CHAT_ICON;
    launcher.setAttribute('aria-label', `Open ${this.opts.assistantName ?? this.opts.cityName} support assistant`);
    launcher.style.setProperty('--ca-brand', this.opts.brandColor);
    launcher.addEventListener('click', () => this._toggle());

    // Panel
    this.panel = document.createElement('div');
    this.panel.id = 'panel';
    this.panel.classList.add('hidden');
    this.panel.style.setProperty('--ca-brand', this.opts.brandColor);

    // Header — matches settings preview layout
    const header = document.createElement('div');
    header.id = 'header';

    const headerLeft = document.createElement('div');
    headerLeft.id = 'header-left';

    if (this.opts.logoUrl) {
      const logo = document.createElement('img');
      logo.id = 'header-logo';
      logo.src = this.opts.logoUrl;
      logo.alt = 'Logo';
      headerLeft.appendChild(logo);
    }

    const headerText = document.createElement('div');
    headerText.id = 'header-text';
    const title = document.createElement('span');
    title.id = 'header-title';
    title.textContent = this.opts.cityName;
    const subtitle = document.createElement('span');
    subtitle.id = 'header-subtitle';
    subtitle.textContent = `Ask about ${this.opts.cityName} services`;
    headerText.appendChild(title);
    headerText.appendChild(subtitle);
    headerLeft.appendChild(headerText);

    const headerRight = document.createElement('div');
    headerRight.id = 'header-right';
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-btn';
    closeBtn.textContent = '\u2715';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.addEventListener('click', () => this._close());
    headerRight.appendChild(closeBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Messages
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.id = 'messages';
    this.messagesContainer.setAttribute('role', 'log');
    this.messagesContainer.setAttribute('aria-live', 'polite');

    // Greeting area — centered with icon, matching settings preview
    const greetingArea = document.createElement('div');
    greetingArea.id = 'greeting-area';
    const greetingIcon = document.createElement('span');
    greetingIcon.innerHTML = MESSAGE_CIRCLE_ICON.replace('viewBox', 'id="greeting-icon" viewBox');
    const greetingText = document.createElement('div');
    greetingText.id = 'greeting-text';
    greetingText.textContent = this.opts.greeting;
    greetingArea.appendChild(greetingIcon);
    greetingArea.appendChild(greetingText);
    this.messagesContainer.appendChild(greetingArea);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.id = 'input-row';

    this.input = document.createElement('textarea');
    this.input.id = 'input';
    this.input.placeholder = 'Type your question...';
    this.input.rows = 1;
    this.input.setAttribute('aria-label', 'Chat message');
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._submitInput();
      }
    });

    this.sendBtn = document.createElement('button');
    this.sendBtn.id = 'send-btn';
    this.sendBtn.innerHTML = SEND_ICON;
    this.sendBtn.setAttribute('aria-label', 'Send message');
    this.sendBtn.addEventListener('click', () => this._submitInput());

    inputRow.appendChild(this.input);
    inputRow.appendChild(this.sendBtn);

    this.panel.appendChild(header);
    this.panel.appendChild(this.messagesContainer);
    this.panel.appendChild(inputRow);

    this.shadow.appendChild(style);
    this.shadow.appendChild(launcher);
    this.shadow.appendChild(this.panel);
  }

  private _submitInput(): void {
    const text = this.input.value.trim();
    if (!text || this.sendBtn.disabled) return;
    this.input.value = '';
    this.sendBtn.disabled = true;
    this.input.disabled = true;
    this.onSend?.(text);
  }

  private _toggle(): void {
    if (this.isOpen) {
      this._close();
    } else {
      this._open();
    }
  }

  private _open(): void {
    this.isOpen = true;
    this.panel.classList.remove('hidden');
    this.input.focus();
  }

  private _close(): void {
    this.isOpen = false;
    this.panel.classList.add('hidden');
  }

  private _msgEl(role: 'user' | 'assistant'): HTMLElement {
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    return el;
  }

  private _scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}
