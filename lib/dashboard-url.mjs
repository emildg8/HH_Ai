/**
 * Базовый URL локального дашборда (Telegram, digest, уведомления).
 */

/** @returns {string} */
export function dashboardBaseUrl() {
  const port = String(process.env.DASHBOARD_PORT || '3849').trim() || '3849';
  const host = String(process.env.DASHBOARD_HOST || '127.0.0.1').trim() || '127.0.0.1';
  return `http://${host}:${port}`;
}

/**
 * @param {string} [tab] system | targeting | apply | letters | appearance
 * @param {Record<string, string>} [extra]
 */
export function dashboardDeepLink(tab = '', extra = {}) {
  const u = new URL(dashboardBaseUrl());
  if (tab) u.searchParams.set('settings', tab);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== '') u.searchParams.set(k, String(v));
  }
  return u.toString();
}
