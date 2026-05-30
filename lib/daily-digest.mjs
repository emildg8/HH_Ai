/**
 * Вечерний дайджест активности (очередь, отклики, воронка).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { computeDashboardStats } from './offers-stats.mjs';
import { readBatchRunReport } from './batch-run-report.mjs';
import { loadQueue } from './store.mjs';
import { isVacancyDeferred } from './vacancy-defer.mjs';
import { sendTelegramMessage } from './telegram-notify.mjs';

export const DAILY_DIGEST_FILE = path.join(DATA_DIR, 'daily-digest-last.json');

/**
 * @param {{ periodDays?: number }} [opts]
 */
export function buildDailyDigest(opts = {}) {
  const stats = computeDashboardStats({ periodDays: opts.periodDays ?? 1 });
  const batch = readBatchRunReport();
  const q = loadQueue();
  const deferred = q.filter((x) => isVacancyDeferred(x)).length;
  const pendingHigh = q.filter(
    (x) =>
      x.status === 'pending' &&
      !isVacancyDeferred(x) &&
      (Number(x.scoreOverall ?? x.geminiScore ?? 0) || 0) >= 50
  ).length;

  const f = stats.funnel || {};
  const lines = [
    `📊 HH Ai · ${new Date().toLocaleString('ru-RU')}`,
    '',
    `Очередь: ${stats.byStatus?.pending ?? 0} pending · ${stats.byStatus?.approved ?? 0} approved`,
    `Отклики (период): ${stats.applied ?? f.applied ?? 0}`,
    `Просмотр / пригл. / отказ: ${f.viewed ?? stats.viewed ?? 0} / ${f.invited ?? stats.invited ?? 0} / ${f.declined ?? stats.declined ?? 0}`,
    `Без ответа 7+ дн.: ${stats.staleFollowUp ?? f.staleFollowUp ?? 0}`,
    `Чаты ждут ответ: ${stats.chatNeedsReply ?? 0}`,
    `Анкеты: ${stats.withQuestionnaire ?? 0}`,
    `Отложено: ${deferred}`,
    `Готово к батчу (≥50): ${pendingHigh}`,
  ];

  if (batch?.finishedAt) {
    const age = Date.now() - Date.parse(batch.finishedAt);
    if (Number.isFinite(age) && age < 86_400_000 * 2) {
      lines.push(
        '',
        `Последняя серия: ${batch.done}/${batch.planned} ok · skip ${batch.skipped}${batch.offTargetSkipped ? ` · нецелевых ${batch.offTargetSkipped}` : ''}`
      );
    }
  }

  const text = lines.join('\n');
  return {
    text,
    generatedAt: new Date().toISOString(),
    stats: {
      applied: stats.applied,
      invited: f.invited ?? stats.invited,
      staleFollowUp: stats.staleFollowUp ?? f.staleFollowUp,
      chatNeedsReply: stats.chatNeedsReply,
      deferred,
      pendingHigh,
    },
  };
}

/**
 * @param {{ sendTelegram?: boolean, periodDays?: number }} [opts]
 */
export async function writeDailyDigest(opts = {}) {
  const digest = buildDailyDigest(opts);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DAILY_DIGEST_FILE, `${JSON.stringify(digest, null, 2)}\n`, 'utf8');

  let telegram = { ok: false, skipped: true };
  if (opts.sendTelegram !== false && String(process.env.HH_DAILY_DIGEST_TELEGRAM ?? '1').trim() !== '0') {
    telegram = await sendTelegramMessage(digest.text);
  }

  return { ...digest, telegram, file: DAILY_DIGEST_FILE };
}

export function readDailyDigest() {
  try {
    if (!fs.existsSync(DAILY_DIGEST_FILE)) return null;
    return JSON.parse(fs.readFileSync(DAILY_DIGEST_FILE, 'utf8'));
  } catch {
    return null;
  }
}
