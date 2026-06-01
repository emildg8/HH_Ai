/**
 * Статистика проекта для Telegram-бота.
 */

import { buildDailyDigest, readDailyDigest } from '../daily-digest.mjs';
import { computeDashboardStats } from '../offers-stats.mjs';
import { loadQueue } from '../store.mjs';
import { countByFilter } from '../chat-inbox.mjs';
import { listChatFollowUps } from '../chat-follow-up.mjs';
import { loadChatFollowUpScheduleConfig } from '../chat-follow-up-schedule.mjs';
import { getJobStatus } from '../job-pids.mjs';
import { getBatchControlSummary } from '../batch-control.mjs';
import { getHarvestControlSummary } from '../harvest-control.mjs';
import { getBrowserBusyState } from '../browser-guard.mjs';
import { readBatchRunReport } from '../batch-run-report.mjs';

/**
 * @returns {string}
 */
export function formatJobStatusText() {
  const st = getJobStatus();
  const harvest = getHarvestControlSummary();
  const batch = getBatchControlSummary();
  const busy = getBrowserBusyState();

  const lines = ['⚙️ Задачи HH Ai', ''];
  lines.push(
    `Поиск: ${harvest.harvestRunning ? `идёт (pid ${harvest.harvestPid}, ${harvest.command})` : 'остановлен'}`
  );
  lines.push(
    `Серия откликов: ${batch.batchRunning ? `идёт (pid ${batch.batchPid}, ${batch.command})` : 'остановлена'}`
  );
  if (batch.planned) {
    lines.push(`Серия: ${batch.done}/${batch.planned} ok · skip ${batch.skipped}`);
  }
  if (busy.busy) {
    lines.push('', `Браузер: занят — ${busy.message || busy.reason}`);
  }
  lines.push('', `Harvest pid: ${st.harvest.pid ?? '—'} · Batch pid: ${st.batch.pid ?? '—'}`);
  return lines.join('\n');
}

/**
 * @returns {string}
 */
export function formatStatsText(opts = {}) {
  return buildDailyDigest(opts).text;
}

/**
 * @returns {string}
 */
export function formatChatInboxText() {
  const counts = countByFilter();
  const cfg = loadChatFollowUpScheduleConfig();
  const followUps = listChatFollowUps(loadQueue(), { inviteNudgeAfterDays: cfg.inviteNudgeAfterDays });
  const lines = [
    '💬 Inbox чатов hh.ru',
    '',
    `Нужен ответ: ${counts.needs_reply}`,
    `Напомнить о себе: ${counts.invite_nudge}`,
    `Отказы: ${counts.declined}`,
    `Всего с перепиской: ${counts.all}`,
  ];
  if (followUps.length) {
    lines.push('', 'Приоритетные:');
    for (const fu of followUps.slice(0, 5)) {
      lines.push(`· ${fu.title} — ${fu.label}`);
    }
  }
  return lines.join('\n');
}

/**
 * @returns {string}
 */
export function formatQueueText() {
  const stats = computeDashboardStats();
  const q = loadQueue();
  const by = stats.byStatus || {};
  const lines = [
    '📋 Очередь вакансий',
    '',
    `Pending: ${by.pending ?? 0}`,
    `Approved: ${by.approved ?? 0}`,
    `Rejected: ${by.rejected ?? 0}`,
    `Responded: ${by.responded ?? 0}`,
    `Всего в файле: ${q.length}`,
    '',
    `С анкетой: ${stats.withQuestionnaire ?? 0}`,
    `Чаты ждут ответ: ${stats.chatNeedsReply ?? 0}`,
    `Баллы: ≥70 — ${stats.scoreBuckets?.high ?? 0} · 50–69 — ${stats.scoreBuckets?.mid ?? 0} · <50 — ${stats.scoreBuckets?.low ?? 0}`,
  ];
  return lines.join('\n');
}

/**
 * @returns {string}
 */
export function formatFunnelText(periodDays = 7) {
  const stats = computeDashboardStats({ periodDays });
  const f = stats.funnel || {};
  return [
    `📈 Воронка (${periodDays} дн.)`,
    '',
    `Отклики: ${stats.applied ?? f.applied ?? 0}`,
    `Просмотрели: ${f.viewed ?? stats.viewed ?? 0}`,
    `Приглашения: ${f.invited ?? stats.invited ?? 0}`,
    `Отказы: ${f.declined ?? stats.declined ?? 0}`,
    `Без ответа 7+ дн.: ${stats.staleFollowUp ?? f.staleFollowUp ?? 0}`,
    `Конверсия просмотр→пригл.: ${stats.conversion?.viewToInvitePct ?? '—'}%`,
  ].join('\n');
}

/**
 * @returns {string}
 */
export function formatBatchReportText() {
  const batch = readBatchRunReport();
  if (!batch?.finishedAt) return 'Отчёт последней серии пока пуст.';
  return [
    '📦 Последняя серия откликов',
    '',
    `Завершена: ${new Date(batch.finishedAt).toLocaleString('ru-RU')}`,
    `Успешно: ${batch.done ?? 0} / ${batch.planned ?? '?'}`,
    `Пропуски: ${batch.skipped ?? 0}`,
    batch.offTargetSkipped ? `Нецелевых: ${batch.offTargetSkipped}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @returns {string|null}
 */
export function formatLastDigestText() {
  const d = readDailyDigest();
  if (!d?.text) return null;
  const at = d.generatedAt ? new Date(d.generatedAt).toLocaleString('ru-RU') : '';
  return `${d.text}${at ? `\n\n(сохранено ${at})` : ''}`;
}
