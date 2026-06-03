/**
 * Форматирование сообщений бота (HTML для Telegram).
 */

/** @param {unknown} v */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** @param {'idle'|'run'|'busy'|'ok'|'warn'|'err'} kind */
export function statusIcon(kind) {
  switch (kind) {
    case 'run':
      return '🟡';
    case 'busy':
      return '🟠';
    case 'ok':
      return '🟢';
    case 'warn':
      return '⚠️';
    case 'err':
      return '🔴';
    default:
      return '⚪';
  }
}

/** @param {string} title @param {string[]} lines */
export function section(title, lines) {
  const body = lines.filter(Boolean).join('\n');
  return body ? `<b>${esc(title)}</b>\n${body}` : `<b>${esc(title)}</b>`;
}

/** @param {string} label @param {string|number} value */
export function kv(label, value) {
  return `${esc(label)}: <b>${esc(value)}</b>`;
}

/** @param {string} url @param {string} label */
export function link(url, label) {
  return `<a href="${esc(url)}">${esc(label)}</a>`;
}
