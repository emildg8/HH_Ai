/**
 * Нормализация строк для суфлёра (браузер + тесты).
 */

const LINE_KEYS = ['question', 'text', 'q', 'title', 'label', 'tip', 'answer', 'value', 'prompt'];

/** @param {unknown} item */
export function coerceInterviewLine(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number' || typeof item === 'boolean') return String(item).trim();
  if (typeof item === 'object') {
    for (const key of LINE_KEYS) {
      const v = item[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    if (item.question && typeof item.question === 'object') {
      return coerceInterviewLine(item.question);
    }
  }
  const fallback = String(item).trim();
  return fallback === '[object Object]' ? '' : fallback;
}

/** @param {unknown} list */
export function normalizeInterviewLines(list) {
  if (!Array.isArray(list)) return [];
  return list.map(coerceInterviewLine).filter(Boolean);
}
