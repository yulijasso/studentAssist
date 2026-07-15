/**
 * Session ID management for the Campus Assist widget.
 *
 * Persists a UUID v4 session ID in localStorage so conversations survive
 * page reloads.  Falls back to an in-memory ID when localStorage is
 * unavailable (private browsing, sandboxed iframes).
 */
// const SESSION_KEY = 'campus_assist_session_id';

/**
 * Generates and returns a brand-new session ID without consulting localStorage.
 * Used when the user explicitly starts a new conversation after session close.
 *
 * @returns A fresh UUID v4 string.
 */
export function createNewSessionId(): string {
  return _generateId();
}

/**
 * Returns the persisted session ID for this browser, or generates and stores
 * a new UUID v4 if none exists.
 */
export function getOrCreateSessionId(): string {
  // DEV: localStorage persistence disabled — every page load gets a fresh session.
  // TODO: re-enable before production by uncommenting the block below.
  return _generateId();

  // try {
  //   const existing = localStorage.getItem(SESSION_KEY);
  //   if (existing) return existing;
  // } catch {
  //   // localStorage unavailable (private browsing / iframe sandbox)
  //   return _generateId();
  // }
  //
  // const id = _generateId();
  // try {
  //   localStorage.setItem(SESSION_KEY, id);
  // } catch {
  //   // Ignore write failures.
  // }
  // return id;
}

/**
 * Generates a UUID v4 using the Web Crypto API, with a legacy fallback.
 *
 * @returns A UUID v4 string.
 */
function _generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments.
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
