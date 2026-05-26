/**
 * Убрать из активной очереди (pending/approved) вакансии, где отклик уже есть на hh.ru.
 */

import { loadQueue, saveQueue } from './store.mjs';
import { vacancyHasHhApply, vacancyHhSiteBlocked } from './vacancy-hh-apply.mjs';

export const QUEUE_STATUS_RESPONDED = 'responded';

const ACTIVE_STATUSES = new Set(['pending', 'approved']);

/**
 * @param {object} rec
 */
export function vacancyShouldPruneFromActiveQueue(rec) {
  if (!ACTIVE_STATUSES.has(String(rec?.status || ''))) return false;
  return vacancyHasHhApply(rec) || vacancyHhSiteBlocked(rec);
}

/**
 * @param {{ dryRun?: boolean, log?: (msg: string) => void }} [opts]
 */
/**
 * Одна карточка → status responded (не удаляем — остаётся во вкладке «Отклики»).
 * @param {string} recordId
 */
export function pruneVacancyFromActiveQueue(recordId) {
  const id = String(recordId || '').trim();
  if (!id) return false;
  const q = loadQueue();
  const i = q.findIndex((x) => x.id === id);
  if (i === -1) return false;
  if (!vacancyShouldPruneFromActiveQueue(q[i])) return false;
  q[i] = {
    ...q[i],
    status: QUEUE_STATUS_RESPONDED,
    queuePrunedAt: new Date().toISOString(),
    queuePruneReason: q[i].hhApply?.hhSiteState || 'auto',
  };
  saveQueue(q);
  return true;
}

export function pruneRespondedFromActiveQueue(opts = {}) {
  const log = opts.log || (() => {});
  const dryRun = Boolean(opts.dryRun);
  const q = loadQueue();
  let changed = 0;
  const titles = [];

  const next = q.map((rec) => {
    if (!vacancyShouldPruneFromActiveQueue(rec)) return rec;
    changed++;
    titles.push(rec.title || rec.id);
    if (dryRun) return rec;
    return {
      ...rec,
      status: QUEUE_STATUS_RESPONDED,
      queuePrunedAt: new Date().toISOString(),
      queuePruneReason: rec.hhApply?.hhSiteState || (rec.hhApply?.responseSubmitted ? 'responseSubmitted' : 'hh_apply'),
    };
  });

  if (!dryRun && changed > 0) saveQueue(next);

  return { total: q.length, changed, dryRun, titles };
}
