/** Короткая метка времени для логов (локаль ru-RU). */
export function logTimestamp() {
  return new Date().toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * @param {string} msg
 * @param {{ withTime?: boolean }} [opts]
 */
export function formatLogLine(msg, opts = {}) {
  const text = String(msg ?? '').trimEnd();
  if (!text) return '';
  if (opts.withTime === false) return text;
  return `[${logTimestamp()}] ${text}`;
}
