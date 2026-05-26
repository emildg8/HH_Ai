/**
 * Сводка очереди, сбора и откликов по периодам для дашборда.
 */

import fs from 'fs';
import path from 'path';
import { knownVacancyIds } from './store.mjs';
import { loadAllQueuesForAnalytics, loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { DEFAULT_QUEUE_FILE, getQueueFile } from './paths.mjs';
import { readJobProgress, HARVEST_PROGRESS_FILE } from './job-progress.mjs';
import { isApplied, recordApplyDate } from './funnel-analytics.mjs';
import { parseFunnelPeriodBounds, isoPassesPeriod } from './funnel-period.mjs';

/**
 * @returns {object|null}
 */
export function readLastHarvestStats() {
  const raw = readJobProgress(HARVEST_PROGRESS_FILE);
  if (!raw || raw.job !== 'harvest') return null;
  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  return {
    phase: raw.phase,
    finishedAt: raw.updatedAt || null,
    ...stats,
    message: stats.message || raw.label || '',
  };
}

/**
 * @returns {object}
 */
export function computeQueueOverview() {
  const merged = loadAllQueuesForAnalytics();
  const union = loadAnalyticsUnionRecords();
  const known = knownVacancyIds();
  const activePath = getQueueFile();

  let hidden = 0;
  let responded = 0;
  for (const rec of union.records) {
    if (rec.hidden) hidden++;
    if (rec.status === 'responded') responded++;
  }

  return {
    queueTotal: merged.uniqueVacancyIds,
    unionRecords: union.records.length,
    knownVacancyIds: known.size,
    mainQueueSize: merged.sources.find((s) => s.file === 'vacancies-queue.json')?.count ?? 0,
    activeQueueFile: path.basename(activePath),
    dataSources: union.sources,
    hhCacheItems: union.hhCacheItems,
    hidden,
    respondedStatus: responded,
  };
}

/**
 * Отклики за скользящие окна и с даты воронки.
 * @returns {{ last7d: number, last30d: number, sinceFunnel: number, sinceLabel: string|null }}
 */
export function computeAppliedRolling() {
  const q = loadAnalyticsUnionRecords().records;
  const bounds = parseFunnelPeriodBounds({});
  const b7 = { sinceMs: Date.now() - 7 * 86400000, periodDays: 0 };
  const b30 = { sinceMs: Date.now() - 30 * 86400000, periodDays: 0 };

  let last7d = 0;
  let last30d = 0;
  let sinceFunnel = 0;

  for (const rec of q) {
    if (!isApplied(rec)) continue;
    const iso = recordApplyDate(rec);
    if (isoPassesPeriod(iso, b7)) last7d++;
    if (isoPassesPeriod(iso, b30)) last30d++;
    if (isoPassesPeriod(iso, bounds)) sinceFunnel++;
  }

  return {
    last7d,
    last30d,
    sinceFunnel,
    sinceLabel: bounds.sinceLabel || null,
  };
}

/**
 * @returns {object}
 */
export function computeExtendedDashboardStats() {
  return {
    queue: computeQueueOverview(),
    appliedRolling: computeAppliedRolling(),
    harvestLast: readLastHarvestStats(),
  };
}
