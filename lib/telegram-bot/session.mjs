/**
 * Сессия multi-step UI Telegram-бота (in-memory, на время работы процесса).
 */

/** @typedef {{ mode?: string, threadId?: string, text?: string, filter?: string, page?: number, threads?: { id: string, title: string }[] }} ChatSession */

/** @type {Map<string, ChatSession>} */
const sessions = new Map();

/** @param {string|number} chatId */
export function getSession(chatId) {
  const key = String(chatId);
  if (!sessions.has(key)) sessions.set(key, {});
  return sessions.get(key);
}

/** @param {string|number} chatId @param {Partial<ChatSession>} patch */
export function patchSession(chatId, patch) {
  const cur = getSession(chatId);
  Object.assign(cur, patch);
  return cur;
}

/** @param {string|number} chatId */
export function clearPending(chatId) {
  const s = getSession(chatId);
  delete s.mode;
  delete s.threadId;
  delete s.text;
  delete s.applyDraft;
}
