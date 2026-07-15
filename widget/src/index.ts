/**
 * UTRGV Campus Assist widget — entry point.
 *
 * Embed via:
 *   <script src="https://campusassist.utrgv.edu/static/widget.js"
 *           data-tenant="utrgv"
 *           async></script>
 *
 * Optional data attributes:
 *   data-api-url  — Backend URL (default: https://campusassist.utrgv.edu)
 *   data-ws-url   — WebSocket URL override
 */

import { CampusAssistWidget } from './widget';

(function bootstrap() {
  // Find the <script> tag that loaded this bundle.
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-tenant]');
  if (scripts.length === 0) {
    console.warn('[CampusAssist] No <script data-tenant="..."> tag found.');
    return;
  }

  // Use the last matching script tag.
  const scriptTag = scripts[scripts.length - 1];
  const tenantSlug = scriptTag.getAttribute('data-tenant');
  if (!tenantSlug) {
    console.warn('[CampusAssist] data-tenant attribute is empty.');
    return;
  }

  const apiUrl =
    scriptTag.getAttribute('data-api-url') ?? 'https://campusassist.utrgv.edu';
  const wsUrl = scriptTag.getAttribute('data-ws-url') || undefined;

  const widget = new CampusAssistWidget({ tenantSlug, apiUrl, ...(wsUrl ? { wsUrl } : {}) });

  const run = () => {
    void widget.init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
