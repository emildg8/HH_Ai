/**
 * Push в Telegram после завершения серии откликов.
 */

import { sendTelegramMessage } from './telegram-notify.mjs';
import { batchScopeUiLabel } from './batch-scope.mjs';
import { dashboardDeepLink } from './dashboard-url.mjs';

/**
 * @param {import('./batch-run-report.mjs').readBatchRunReport extends () => infer R ? NonNullable<R> : object} report
 */
export async function notifyBatchComplete(report = {}) {
  if (String(process.env.HH_BATCH_TELEGRAM ?? '1').trim() === '0') {
    return { ok: false, skipped: true, reason: 'HH_BATCH_TELEGRAM=0' };
  }
  const done = Number(report.done) || 0;
  const planned = Number(report.planned) || 0;
  const skipped = Number(report.skipped) || 0;
  const failed = Number(report.failed) || 0;
  const scope = batchScopeUiLabel(report.batchScope || 'noQuestionnaire');

  const lines = [
    '📦 HH Ai: серия откликов завершена',
    `✅ ${done}/${planned || '?'} · пропуск ${skipped}${failed ? ` · ошибки ${failed}` : ''}`,
    `Область: ${scope}`,
  ];
  if (report.stopReason && report.stopReason !== 'complete') {
    lines.push(`Статус: ${report.stopReason}`);
  }
  if (report.offTargetSkipped) {
    lines.push(`Нецелевых откликов: ${report.offTargetSkipped}`);
  }
  const dash = dashboardDeepLink('apply', { batchReport: '1' });
  lines.push('', `Открыть дашборд: ${dash}`, '', '/batch — отчёт · /chats — inbox');
  return sendTelegramMessage(lines.join('\n'));
}
