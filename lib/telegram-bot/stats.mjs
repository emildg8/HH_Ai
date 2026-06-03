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
import { batchScopeUiLabel } from '../batch-scope.mjs';
import { BRAND } from './copy.mjs';
import { esc, kv, section, statusIcon } from './format.mjs';

function jobSnapshot() {
  const harvest = getHarvestControlSummary();
  const batch = getBatchControlSummary();
  const busy = getBrowserBusyState();
  return { harvest, batch, busy };
}

/**
 * Главный экран бота — краткая сводка.
 * @returns {string} HTML
 */
export function formatHomeDashboard(cfg = {}) {
  const { harvest, batch, busy } = jobSnapshot();
  const stats = computeDashboardStats();
  const by = stats.byStatus || {};
  const chat = countByFilter();

  const harvestLine = harvest.harvestRunning
    ? `${statusIcon('run')} Поиск: <b>идёт</b> (pid ${esc(harvest.harvestPid)})`
    : `${statusIcon('idle')} Поиск: свободен`;

  let batchLine;
  if (batch.batchRunning) {
    batchLine = `${statusIcon('run')} Серия: <b>идёт</b> ${esc(batch.done)}/${esc(batch.planned)}`;
  } else if (batch.planned) {
    batchLine = `${statusIcon('ok')} Серия: пауза · ${esc(batch.done)}/${esc(batch.planned)} ok`;
  } else {
    batchLine = `${statusIcon('idle')} Серия: не запущена`;
  }

  const browserLine = busy.busy
    ? `${statusIcon('busy')} Браузер: занят`
    : `${statusIcon('ok')} Браузер: свободен`;

  const lines = [
    `<b>${esc(BRAND.name)}</b>`,
    `<i>${esc(BRAND.tagline)}</i>`,
    '',
    section('Сейчас', [harvestLine, batchLine, browserLine]),
    '',
    section('Очередь', [
      `${kv('Pending', by.pending ?? 0)} · ${kv('Отклики', by.responded ?? 0)} · ${kv('Отказ', by.rejected ?? 0)}`,
      `${kv('Чаты ждут', chat.needs_reply)} · ${kv('Высокий балл', stats.scoreBuckets?.high ?? 0)}`,
    ]),
    '',
    `<i>${esc(BRAND.footer)}</i>`,
  ];
  if (cfg.dashboardUrl) {
    lines.push('', `🖥 <a href="${esc(cfg.dashboardUrl)}">Открыть дашборд</a>`);
  }
  return lines.join('\n');
}

/**
 * @returns {string} HTML
 */
export function formatJobStatusText() {
  const { harvest, batch, busy } = jobSnapshot();
  const st = getJobStatus();

  const lines = [
    section('Задачи', [
      harvest.harvestRunning
        ? `${statusIcon('run')} Поиск: идёт · pid ${esc(harvest.harvestPid)}`
        : `${statusIcon('idle')} Поиск: остановлен`,
      batch.batchRunning
        ? `${statusIcon('run')} Серия: идёт · pid ${esc(batch.batchPid)}`
        : `${statusIcon('idle')} Серия: остановлена`,
      batch.planned
        ? `   ${kv('Прогресс', `${batch.done}/${batch.planned}`)} · skip ${esc(batch.skipped)}`
        : null,
      busy.busy
        ? `${statusIcon('busy')} ${esc(busy.message || busy.reason || 'Браузер занят')}`
        : `${statusIcon('ok')} Браузер свободен`,
    ]),
    '',
    `<code>harvest pid: ${esc(st.harvest.pid ?? '—')} · batch pid: ${esc(st.batch.pid ?? '—')}</code>`,
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * @returns {string}
 */
export function formatStatsText(opts = {}) {
  return buildDailyDigest(opts).text;
}

/**
 * @returns {string} HTML
 */
export function formatChatInboxText() {
  const counts = countByFilter();
  const cfg = loadChatFollowUpScheduleConfig();
  const followUps = listChatFollowUps(loadQueue(), { inviteNudgeAfterDays: cfg.inviteNudgeAfterDays });

  const lines = [
    section('Inbox чатов hh.ru', [
      `${statusIcon(counts.needs_reply ? 'warn' : 'ok')} ${kv('Нужен ответ', counts.needs_reply)}`,
      `${kv('Напомнить', counts.invite_nudge)} · ${kv('Отказы', counts.declined)} · ${kv('Всего', counts.all)}`,
    ]),
  ];
  if (followUps.length) {
    lines.push('', '<b>Приоритет</b>');
    for (const fu of followUps.slice(0, 5)) {
      lines.push(`• ${esc(fu.title)} — <i>${esc(fu.label)}</i>`);
    }
  }
  return lines.join('\n');
}

/**
 * @returns {string} HTML
 */
export function formatQueueText() {
  const stats = computeDashboardStats();
  const q = loadQueue();
  const by = stats.byStatus || {};

  return [
    section('Очередь вакансий', [
      `${kv('Pending', by.pending ?? 0)} · ${kv('Approved', by.approved ?? 0)} · ${kv('Rejected', by.rejected ?? 0)}`,
      `${kv('Responded', by.responded ?? 0)} · ${kv('В файле', q.length)}`,
      `${kv('С анкетой', stats.withQuestionnaire ?? 0)} · ${kv('Чаты', stats.chatNeedsReply ?? 0)}`,
    ]),
    '',
    section('Баллы', [
      `🟢 ≥70: ${esc(stats.scoreBuckets?.high ?? 0)} · 🟡 50–69: ${esc(stats.scoreBuckets?.mid ?? 0)} · ⚪ &lt;50: ${esc(stats.scoreBuckets?.low ?? 0)}`,
    ]),
  ].join('\n');
}

/**
 * @returns {string} HTML
 */
export function formatFunnelText(periodDays = 7) {
  const stats = computeDashboardStats({ periodDays });
  const f = stats.funnel || {};
  return [
    section(`Воронка · ${periodDays} дн.`, [
      `${kv('Отклики', stats.applied ?? f.applied ?? 0)} · ${kv('Просмотрели', f.viewed ?? stats.viewed ?? 0)}`,
      `${kv('Приглашения', f.invited ?? stats.invited ?? 0)} · ${kv('Отказы', f.declined ?? stats.declined ?? 0)}`,
      `${kv('Без ответа 7+ дн.', stats.staleFollowUp ?? f.staleFollowUp ?? 0)}`,
      `${kv('Конверсия', `${stats.conversion?.viewToInvitePct ?? '—'}%`)}`,
    ]),
  ].join('\n');
}

/**
 * @returns {string} HTML
 */
export function formatBatchReportText() {
  const batch = readBatchRunReport();
  if (!batch?.finishedAt) {
    return `${statusIcon('idle')} Отчёт последней серии пока пуст.`;
  }
  return section('Последняя серия откликов', [
    `${kv('Завершена', new Date(batch.finishedAt).toLocaleString('ru-RU'))}`,
    batch.batchScope ? `${kv('Область', batchScopeUiLabel(batch.batchScope))}` : null,
    `${kv('Успешно', `${batch.done ?? 0} / ${batch.planned ?? '?'}`)} · ${kv('Пропуски', batch.skipped ?? 0)}`,
    batch.failed ? kv('Ошибки', batch.failed) : null,
    batch.offTargetSkipped ? kv('Нецелевых', batch.offTargetSkipped) : null,
    batch.stopReason && batch.stopReason !== 'complete' ? kv('Статус', batch.stopReason) : null,
  ].filter(Boolean));
}

/**
 * @returns {string|null}
 */
export function formatLastDigestText() {
  const d = readDailyDigest();
  if (!d?.text) return null;
  const at = d.generatedAt ? new Date(d.generatedAt).toLocaleString('ru-RU') : '';
  return `${d.text}${at ? `\n\n<i>(сохранено ${esc(at)})</i>` : ''}`;
}
