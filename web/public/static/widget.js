(function(){"use strict";const x=`
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
`,b=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
</svg>`,g=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
</svg>`,C=`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="22" y1="2" x2="11" y2="13"></line>
  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
</svg>`;function y(r,e){const t=/\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+)/g;let n=0,s;for(;(s=t.exec(r))!==null;){if(s.index>n&&e.appendChild(document.createTextNode(r.slice(n,s.index))),s[1]!==void 0){const i=document.createElement("strong");i.textContent=s[1],e.appendChild(i)}else if(s[2]!==void 0){const i=document.createElement("a");i.href=s[3],i.textContent=s[2],i.target="_blank",i.rel="noopener noreferrer",e.appendChild(i)}else{const i=document.createElement("a");i.href=s[4],i.textContent=s[4],i.target="_blank",i.rel="noopener noreferrer",e.appendChild(i)}n=t.lastIndex}n<r.length&&e.appendChild(document.createTextNode(r.slice(n)))}function w(r){const e=document.createDocumentFragment(),t=r.split(`
`);for(let n=0;n<t.length;n++)n>0&&e.appendChild(document.createElement("br")),y(t[n],e);return e}class E{constructor(e,t){this.isOpen=!1,this.currentStreamEl=null,this.currentStreamText="",this.onSend=null,this.onNewConversation=null,this.opts=t;const n=t.position||"bottom-right";e.setAttribute("data-pos",n),this.shadow=e.attachShadow({mode:"open"}),this._build(),t.autoOpen&&this._open()}setOnSend(e){this.onSend=e}setOnNewConversation(e){this.onNewConversation=e}appendUserMessage(e){const t=this._msgEl("user");t.textContent=e,this.messagesContainer.appendChild(t),this._scrollToBottom()}startAssistantMessage(){const e=this._msgEl("assistant");e.classList.add("streaming"),this.messagesContainer.appendChild(e),this.currentStreamEl=e,this.currentStreamText="",this._scrollToBottom()}appendToken(e){this.currentStreamEl||this.startAssistantMessage(),this.currentStreamText+=e,this.currentStreamEl.textContent=this.currentStreamText,this._scrollToBottom()}finalizeMessage(e){if(this.currentStreamEl){for(this.currentStreamEl.classList.remove("streaming");this.currentStreamEl.firstChild;)this.currentStreamEl.removeChild(this.currentStreamEl.firstChild);if(this.currentStreamEl.appendChild(w(this.currentStreamText)),this.currentStreamText="",e.length>0){const t=document.createElement("div");t.className="sources",e.forEach(n=>{const s=document.createElement("a");s.href=n.url,s.textContent=n.title||n.url,s.target="_blank",s.rel="noopener noreferrer",t.appendChild(s)}),this.currentStreamEl.appendChild(t)}this.currentStreamEl=null}this.sendBtn.disabled=!1,this.input.disabled=!1,this.input.focus()}showResolutionCheck(e){const t=this._msgEl("assistant"),n=document.createElement("span");n.textContent="Was your question resolved?",t.appendChild(n);const s=document.createElement("div");s.className="action-buttons";const i=document.createElement("button");i.className="action-btn primary",i.textContent="✓ Yes";const o=document.createElement("button");o.className="action-btn secondary",o.textContent="✗ No";const a=()=>{i.disabled=!0,o.disabled=!0};i.addEventListener("click",()=>{a(),e(!0)}),o.addEventListener("click",()=>{a(),e(!1)}),s.appendChild(i),s.appendChild(o),t.appendChild(s),this.messagesContainer.appendChild(t),this._scrollToBottom()}showEscalationOffer(e,t){const n=this._msgEl("assistant"),s=e?.name??"the relevant office",i=document.createElement("span");i.textContent=`It looks like your question may need more help. Would you like ${s} to reach out to you directly?`,n.appendChild(i);const o=document.createElement("div");o.className="action-buttons";const a=document.createElement("button");a.className="action-btn primary",a.textContent="Yes, contact me";const d=document.createElement("button");d.className="action-btn secondary",d.textContent="No, thanks";const l=()=>{a.disabled=!0,d.disabled=!0};a.addEventListener("click",()=>{l(),t()}),d.addEventListener("click",()=>{l()}),o.appendChild(a),o.appendChild(d),n.appendChild(o),this.messagesContainer.appendChild(n),this._scrollToBottom()}showContactForm(e){const t=this._msgEl("assistant"),n=document.createElement("span");n.textContent="Please provide your contact details and a representative will reach out within 24 hours.",t.appendChild(n);const s=document.createElement("div");s.className="contact-form";const i=document.createElement("input");i.type="text",i.className="contact-input",i.placeholder="Your name *";const o=document.createElement("input");o.type="tel",o.className="contact-input",o.placeholder="Phone number *";const a=document.createElement("input");a.type="email",a.className="contact-input",a.placeholder="Email address (optional)";const d=document.createElement("button");d.className="action-btn primary",d.textContent="Submit",d.addEventListener("click",()=>{const l=i.value.trim(),p=o.value.trim(),h=a.value.trim()||void 0;!l||!p||(d.disabled=!0,i.disabled=!0,o.disabled=!0,a.disabled=!0,e(l,p,h))}),s.appendChild(i),s.appendChild(o),s.appendChild(a),s.appendChild(d),t.appendChild(s),this.messagesContainer.appendChild(t),this._scrollToBottom()}showSystemMessage(e){const t=document.createElement("div");t.className="system-msg",t.textContent=e,this.messagesContainer.appendChild(t),this._scrollToBottom()}showDisclaimer(e){const t=document.createElement("div");t.className="disclaimer";const n=document.createElement("span");n.className="disclaimer-icon",n.textContent="⚠️";const s=document.createElement("span");s.textContent=e,t.appendChild(n),t.appendChild(s),this.messagesContainer.appendChild(t),this._scrollToBottom()}showMoreQuestionsCheck(e){const t=this._msgEl("assistant"),n=document.createElement("span");n.textContent="Do you have any more questions?",t.appendChild(n);const s=document.createElement("div");s.className="action-buttons";const i=document.createElement("button");i.className="action-btn primary",i.textContent="Yes";const o=document.createElement("button");o.className="action-btn secondary",o.textContent="No";const a=()=>{i.disabled=!0,o.disabled=!0};i.addEventListener("click",()=>{a(),e(!0)}),o.addEventListener("click",()=>{a(),e(!1)}),s.appendChild(i),s.appendChild(o),t.appendChild(s),this.messagesContainer.appendChild(t),this._scrollToBottom()}closeSession(e){this.input.disabled=!0,this.sendBtn.disabled=!0;const t=document.createElement("div");t.className="session-ended",t.textContent=e==="escalated"?"Your request has been submitted — a team member will reach out within 24 hours.":"This session has ended.",this.messagesContainer.appendChild(t);const n=document.createElement("button");n.className="new-convo-btn",n.textContent="Start a new conversation",n.addEventListener("click",()=>{this.onNewConversation?.()}),this.messagesContainer.appendChild(n),this._scrollToBottom()}showError(e){const t=this._msgEl("assistant");t.textContent=`⚠️ ${e}`,t.style.color="#dc2626",this.messagesContainer.appendChild(t),this.currentStreamEl=null,this.sendBtn.disabled=!1,this.input.disabled=!1,this._scrollToBottom()}reset(){for(;this.messagesContainer.firstChild;)this.messagesContainer.removeChild(this.messagesContainer.firstChild);const e=document.createElement("div");e.id="greeting-area";const t=document.createElement("span");t.innerHTML=g.replace("viewBox",'id="greeting-icon" viewBox');const n=document.createElement("div");n.id="greeting-text",n.textContent=this.opts.greeting,e.appendChild(t),e.appendChild(n),this.messagesContainer.appendChild(e),this.currentStreamEl=null,this.currentStreamText="",this.input.disabled=!1,this.sendBtn.disabled=!1,this.input.value="",this.input.focus()}_build(){const e=document.createElement("style");e.textContent=x;const t=document.createElement("button");t.id="launcher",t.innerHTML=b,t.setAttribute("aria-label",`Open ${this.opts.assistantName??this.opts.cityName} support assistant`),t.style.setProperty("--ca-brand",this.opts.brandColor),t.addEventListener("click",()=>this._toggle()),this.panel=document.createElement("div"),this.panel.id="panel",this.panel.classList.add("hidden"),this.panel.style.setProperty("--ca-brand",this.opts.brandColor);const n=document.createElement("div");n.id="header";const s=document.createElement("div");if(s.id="header-left",this.opts.logoUrl){const c=document.createElement("img");c.id="header-logo",c.src=this.opts.logoUrl,c.alt="Logo",s.appendChild(c)}const i=document.createElement("div");i.id="header-text";const o=document.createElement("span");o.id="header-title",o.textContent=this.opts.cityName;const a=document.createElement("span");a.id="header-subtitle",a.textContent=`Ask about ${this.opts.cityName} services`,i.appendChild(o),i.appendChild(a),s.appendChild(i);const d=document.createElement("div");d.id="header-right";const l=document.createElement("button");l.id="close-btn",l.textContent="✕",l.setAttribute("aria-label","Close chat"),l.addEventListener("click",()=>this._close()),d.appendChild(l),n.appendChild(s),n.appendChild(d),this.messagesContainer=document.createElement("div"),this.messagesContainer.id="messages",this.messagesContainer.setAttribute("role","log"),this.messagesContainer.setAttribute("aria-live","polite");const p=document.createElement("div");p.id="greeting-area";const h=document.createElement("span");h.innerHTML=g.replace("viewBox",'id="greeting-icon" viewBox');const m=document.createElement("div");m.id="greeting-text",m.textContent=this.opts.greeting,p.appendChild(h),p.appendChild(m),this.messagesContainer.appendChild(p);const u=document.createElement("div");u.id="input-row",this.input=document.createElement("textarea"),this.input.id="input",this.input.placeholder="Type your question...",this.input.rows=1,this.input.setAttribute("aria-label","Chat message"),this.input.addEventListener("keydown",c=>{c.key==="Enter"&&!c.shiftKey&&(c.preventDefault(),this._submitInput())}),this.sendBtn=document.createElement("button"),this.sendBtn.id="send-btn",this.sendBtn.innerHTML=C,this.sendBtn.setAttribute("aria-label","Send message"),this.sendBtn.addEventListener("click",()=>this._submitInput()),u.appendChild(this.input),u.appendChild(this.sendBtn),this.panel.appendChild(n),this.panel.appendChild(this.messagesContainer),this.panel.appendChild(u),this.shadow.appendChild(e),this.shadow.appendChild(t),this.shadow.appendChild(this.panel)}_submitInput(){const e=this.input.value.trim();!e||this.sendBtn.disabled||(this.input.value="",this.sendBtn.disabled=!0,this.input.disabled=!0,this.onSend?.(e))}_toggle(){this.isOpen?this._close():this._open()}_open(){this.isOpen=!0,this.panel.classList.remove("hidden"),this.input.focus()}_close(){this.isOpen=!1,this.panel.classList.add("hidden")}_msgEl(e){const t=document.createElement("div");return t.className=`msg ${e}`,t}_scrollToBottom(){this.messagesContainer.scrollTop=this.messagesContainer.scrollHeight}}async function v(r,e){const t=`${r}/api/tenants/${encodeURIComponent(e)}`,n=await fetch(t);if(!n.ok)throw new Error(`Failed to load tenant config for "${e}": HTTP ${n.status}`);return n.json()}function k(){return f()}function _(){return f()}function f(){return typeof crypto<"u"&&crypto.randomUUID?crypto.randomUUID():"xxxx-xxxx-4xxx-yxxx".replace(/[xy]/g,r=>{const e=Math.random()*16|0;return(r==="x"?e:e&3|8).toString(16)})}const S=1e3,N=3e4,T=6;class B{constructor(e){this.ws=null,this.reconnectAttempts=0,this.reconnectTimer=null,this.isAuthed=!1,this.messageQueue=[],this.destroyed=!1,this.options=e,this._connect()}send(e){const t=JSON.stringify({type:"message",content:e});this.isAuthed&&this.ws?.readyState===WebSocket.OPEN?this.ws.send(t):this.messageQueue.push(t)}sendFrame(e){this.isAuthed&&this.ws?.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(e))}destroy(){this.destroyed=!0,this.reconnectTimer!==null&&clearTimeout(this.reconnectTimer),this.ws?.close()}_connect(){this.destroyed||(this.ws=new WebSocket(this.options.wsUrl),this.isAuthed=!1,this.ws.onopen=()=>{this.reconnectAttempts=0,this.ws.send(JSON.stringify({type:"auth",api_key:this.options.apiKey,session_id:this.options.sessionId}))},this.ws.onmessage=e=>{let t;try{t=JSON.parse(e.data)}catch{return}if(t.type==="auth_ok"){for(this.isAuthed=!0,this.options.onReady?.();this.messageQueue.length>0;){const n=this.messageQueue.shift();n&&this.ws.send(n)}return}t.type==="token"?this.options.onToken(t.token):t.type==="done"?this.options.onDone(t.sources):t.type==="disclaimer"?this.options.onDisclaimer?.(t.message):t.type==="resolution_check"?this.options.onResolutionCheck?.():t.type==="more_questions_check"?this.options.onMoreQuestionsCheck?.():t.type==="system_message"?this.options.onSystemMessage?.(t.content):t.type==="escalation_offer"?this.options.onEscalationOffer?.(t.department):t.type==="contact_form"?this.options.onContactForm?.():t.type==="session_closed"?this.options.onSessionClosed?.(t.reason):t.type==="error"&&this.options.onError(t.message)},this.ws.onerror=()=>{},this.ws.onclose=e=>{if(!this.destroyed){if(e.code===4001){this.options.onError("Authentication failed. Check your API key.");return}e.code!==1e3&&this._scheduleReconnect()}})}_scheduleReconnect(){if(this.reconnectAttempts>=T){this.options.onError("Connection lost. Please refresh the page.");return}const e=Math.min(S*Math.pow(2,this.reconnectAttempts),N);this.reconnectAttempts++,this.reconnectTimer=setTimeout(()=>this._connect(),e)}}function A(r){return r.replace(/^http/,"ws")}class M{constructor(e){this.config=null,this.ui=null,this.wsClient=null,this.options=e,this.sessionId=_(),this.host=document.createElement("div"),this.host.id="campus-assist-widget-host",document.body.appendChild(this.host)}async init(){try{this.config=await v(this.options.apiUrl,this.options.tenantSlug)}catch(a){console.error("[CampusAssist] Failed to load tenant config:",a);return}const e=this.config.city_name||this.config.name,t=this.config.assistant_name||e,n=this.config.brand_color??"#1a56db",s=this.config.logo_url??"",i=this.config.greeting??`Hi! Ask me anything about ${e} admissions, registration, financial aid, academics, or campus services.`;this.ui=new E(this.host,{brandColor:n,cityName:e,assistantName:t,logoUrl:s,greeting:i,autoOpen:this.config.auto_open??!1,position:this.config.position??"bottom-right"});const o=this.options.wsUrl??`${A(this.options.apiUrl)}/api/ws`;this._mountWsClient(o),this.ui.setOnNewConversation(()=>this._resetConversation(o))}_mountWsClient(e){this.wsClient=new B({wsUrl:e,apiKey:this.config.api_key,sessionId:this.sessionId,onToken:t=>this.ui.appendToken(t),onDone:t=>this.ui.finalizeMessage(t),onError:t=>this.ui.showError(t),onReady:()=>{},onSystemMessage:t=>{this.ui.showSystemMessage(t)},onResolutionCheck:()=>{this.ui.showResolutionCheck(t=>{this.wsClient.sendFrame({type:"resolution_response",resolved:t})})},onMoreQuestionsCheck:()=>{this.ui.showMoreQuestionsCheck(t=>{this.wsClient.sendFrame({type:"more_questions_response",hasMore:t})})},onEscalationOffer:t=>{this.ui.showEscalationOffer(t,()=>{this.wsClient.sendFrame({type:"escalation_accept"})})},onContactForm:()=>{this.ui.showContactForm((t,n,s)=>{this.wsClient.sendFrame({type:"contact_submit",name:t,phone:n,...s!==void 0?{email:s}:{}})})},onSessionClosed:t=>{this.ui.closeSession(t)},onDisclaimer:t=>{this.ui.showDisclaimer(t)}}),this.ui.setOnSend(t=>{this.ui.appendUserMessage(t),this.ui.startAssistantMessage(),this.wsClient.send(t)})}_resetConversation(e){this.wsClient?.destroy(),this.sessionId=k(),this.ui.reset(),this._mountWsClient(e)}destroy(){this.wsClient?.destroy(),this.host.remove()}}(function(){const e=document.querySelectorAll("script[data-tenant]");if(e.length===0){console.warn('[CampusAssist] No <script data-tenant="..."> tag found.');return}const t=e[e.length-1],n=t.getAttribute("data-tenant");if(!n){console.warn("[CampusAssist] data-tenant attribute is empty.");return}const s=t.getAttribute("data-api-url")??"https://campusassist.utrgv.edu",i=t.getAttribute("data-ws-url")||void 0,o=new M({tenantSlug:n,apiUrl:s,...i?{wsUrl:i}:{}}),a=()=>{o.init()};document.readyState==="loading"?document.addEventListener("DOMContentLoaded",a):a()})()})();
