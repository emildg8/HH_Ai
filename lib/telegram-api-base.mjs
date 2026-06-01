/**
 * Базовый URL Telegram Bot API (прямой или через CF Worker).
 */

/** @returns {string} */
export function getTelegramApiBase() {
  return String(process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/$/, '');
}

/** @returns {string} */
export function getTelegramApiSecret() {
  return String(process.env.TELEGRAM_API_SECRET || '').trim();
}

/** @param {string} botToken @param {string} method */
export function telegramApiUrl(botToken, method) {
  return `${getTelegramApiBase()}/bot${botToken}/${method}`;
}

/** @returns {Record<string, string>} */
export function telegramApiHeaders(extra = {}) {
  const headers = { ...extra };
  const secret = getTelegramApiSecret();
  if (secret) headers['X-Tg-Proxy-Secret'] = secret;
  return headers;
}

/** @returns {string} */
export function telegramAccessHint() {
  const parts = [];
  const base = getTelegramApiBase();
  if (base !== 'https://api.telegram.org') {
    parts.push(`api: ${base}`);
  }
  const proxy = String(
    process.env.TELEGRAM_PROXY || process.env.ALL_PROXY || process.env.HTTPS_PROXY || ''
  ).trim();
  if (proxy) {
    const safe = proxy.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
    parts.push(`proxy: ${safe}`);
  }
  return parts.join(', ');
}
