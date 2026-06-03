/**
 * Уведомление в Telegram после harvest (если добавлено достаточно вакансий).
 */

import { sendTelegramMessage } from './telegram-notify.mjs';
import { dashboardDeepLink } from './dashboard-url.mjs';

/**
 * @param {{ added?: number, skipped?: number, urlsTotal?: number }} stats
 */
export async function notifyHarvestComplete(stats = {}) {
  const added = Number(stats.added) || 0;
  const minN = Math.max(
    1,
    Number(process.env.HH_HARVEST_TELEGRAM_MIN ?? process.env.HH_HARVEST_NOTIFY_MIN ?? 50) || 50
  );
  if (String(process.env.HH_HARVEST_TELEGRAM ?? '1').trim() === '0') {
    return { ok: false, skipped: true, reason: 'HH_HARVEST_TELEGRAM=0' };
  }
  if (added < minN) {
    return { ok: false, skipped: true, reason: `added ${added} < ${minN}` };
  }
  const skipped = Number(stats.skipped) || 0;
  const urlsTotal = Number(stats.urlsTotal) || 0;
  const dash = dashboardDeepLink('', { workflow: 'review' });
  const text =
    `🔍 HH Ai: поиск завершён\n` +
    `+${added} вакансий в очереди` +
    (skipped ? ` · пропуск ${skipped}` : '') +
    (urlsTotal ? ` · обработано ${urlsTotal}` : '') +
    `\n\nРазобрать очередь: ${dash}`;
  return sendTelegramMessage(text);
}
