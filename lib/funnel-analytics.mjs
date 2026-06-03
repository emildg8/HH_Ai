/**
 * Воронка и конверсия для дашборда (фильтры, шаги, динамика по дням).
 */

import { HH_SITE_STATES } from './hh-vacancy-response-state.mjs';
import { loadNegotiationsCache } from './hh-negotiations-sync.mjs';
import { parseFunnelPeriodBounds, isoPassesPeriod, DEFAULT_FUNNEL_SINCE } from './funnel-period.mjs';
import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { classifyVacancyResumeRole, loadResumeRoutingConfig } from './resume-routing.mjs';
import { recordResumeRoleForAnalytics, daysSinceApply, isStaleFollowUp } from './resume-role-actual.mjs';

export { daysSinceApply, isStaleFollowUp };

export { DEFAULT_FUNNEL_SINCE };

/**
 * @param {object} rec
 * @returns {string}
 */
export function recordApplyDate(rec) {
  const raw =
    rec.hhApply?.lastAt ||
    rec.queuePrunedAt ||
    rec.hhApply?.hhSiteStateUpdatedAt ||
    rec.createdAt;
  const t = Date.parse(String(raw || ''));
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

/**
 * @param {object} rec
 */
export function isApplied(rec) {
  const st = rec.hhApply?.hhSiteState;
  return Boolean(
    rec.hhApply?.responseSubmitted ||
      rec.status === 'responded' ||
      st === HH_SITE_STATES.ALREADY_APPLIED
  );
}

function isViewed(rec) {
  const st = rec.hhApply?.hhSiteState;
  return st === 'viewed' || st === HH_SITE_STATES.INVITED;
}

function isInvited(rec) {
  return rec.hhApply?.hhSiteState === HH_SITE_STATES.INVITED;
}

function isDeclined(rec) {
  return rec.hhApply?.hhSiteState === HH_SITE_STATES.DECLINED;
}

function isAwaiting(rec) {
  return rec.hhApply?.hhSiteState === 'awaiting';
}

function vacancyIdOf(rec) {
  let v = String(rec?.vacancyId || '').trim();
  if (!v && rec?.url) {
    const m = String(rec.url).match(/vacancy\/(\d+)/i);
    if (m) v = m[1];
  }
  return v;
}

/**
 * @param {object} rec
 * @param {{ sinceMs: number|null, periodDays: number }} bounds
 */
function recordPassesFunnelPeriod(rec, bounds) {
  if (!bounds.sinceMs && !bounds.periodDays) return true;
  const iso = recordApplyDate(rec);
  if (!iso) return isApplied(rec);
  return isoPassesPeriod(iso, bounds);
}

/**
 * @param {object} rec
 * @param {number} minScore
 */
function recordMinScore(rec, minScore) {
  if (!minScore || minScore <= 0) return true;
  const score = Number(rec.scoreOverall ?? rec.geminiScore ?? 0);
  return score >= minScore;
}

function pct(part, whole) {
  const w = Number(whole) || 0;
  if (w <= 0) return 0;
  return Math.round((part / w) * 1000) / 10;
}

const HH_APPLIED_STATUSES = new Set(['submitted', 'viewed', 'invited', 'declined', 'awaiting']);

/**
 * @param {{ periodDays?: number, since?: string, scope?: string, minScore?: number }} opts
 */
export function computeFunnelAnalytics(opts = {}) {
  const bounds = parseFunnelPeriodBounds(opts);
  const scope = String(opts.scope || 'applied').toLowerCase();
  const minScore = Math.max(0, Number(opts.minScore) || 0);

  const union = loadAnalyticsUnionRecords();
  const qAll = union.records;
  const q = qAll.filter((rec) => recordPassesFunnelPeriod(rec, bounds) && recordMinScore(rec, minScore));

  const counts = {
    total: q.length,
    inQueue: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    applied: 0,
    appliedOnHh: 0,
    appliedQueueOnly: 0,
    appliedHhCacheOnly: 0,
    viewed: 0,
    invited: 0,
    declined: 0,
    awaiting: 0,
    withQuestionnaire: 0,
    chatNeedsReply: 0,
    noResponseYet: 0,
  };

  const scoreBuckets = { high: 0, mid: 0, low: 0, none: 0 };
  /** @type {Map<string, { applied: number, invited: number, viewed: number }>} */
  const byDay = new Map();
  /** @type {Map<string, object>} */
  const appliedByVacancy = new Map();
  /** @type {Map<string, { label: string, applied: number, viewed: number, invited: number, declined: number }>} */
  const byResume = new Map();
  const resumeCfg = loadResumeRoutingConfig();

  for (const rec of q) {
    const st = rec.status || 'pending';
    if (st === 'pending') counts.pending++;
    else if (st === 'approved') counts.approved++;
    else if (st === 'rejected') counts.rejected++;

    if (st === 'pending' || st === 'approved') counts.inQueue++;

    const score = Number(rec.scoreOverall ?? rec.geminiScore ?? 0);
    if (!score) scoreBuckets.none++;
    else if (score >= 70) scoreBuckets.high++;
    else if (score >= 50) scoreBuckets.mid++;
    else scoreBuckets.low++;

    if (rec.hhApply?.questionnaire?.questions?.length) counts.withQuestionnaire++;
    if (rec.hhApply?.chatSummary?.needsReply || rec.hhApply?.chatSummary?.questionNeedsReply) counts.chatNeedsReply++;

    const applied = isApplied(rec);
    if (applied) {
      counts.applied++;
      const role = recordResumeRoleForAnalytics(rec);
      const roleEntry = resumeCfg.resumes[role] || resumeCfg.resumes[resumeCfg.defaultRole];
      const roleLabel = roleEntry?.label || role;
      const rr = byResume.get(role) || {
        role,
        label: roleLabel,
        applied: 0,
        viewed: 0,
        invited: 0,
        declined: 0,
      };
      rr.applied++;
      if (isViewed(rec)) rr.viewed++;
      if (isInvited(rec)) rr.invited++;
      if (isDeclined(rec)) rr.declined++;
      byResume.set(role, rr);

      const vid = vacancyIdOf(rec);
      if (vid) appliedByVacancy.set(vid, rec);
      if (!isViewed(rec) && !isInvited(rec) && !isDeclined(rec) && !isAwaiting(rec)) {
        counts.noResponseYet++;
      }
      const iso = recordApplyDate(rec);
      const day = iso ? iso.slice(0, 10) : 'без даты';
      const row = byDay.get(day) || { applied: 0, invited: 0, viewed: 0 };
      row.applied++;
      if (isInvited(rec)) row.invited++;
      if (isViewed(rec)) row.viewed++;
      byDay.set(day, row);
    }
    if (isViewed(rec)) counts.viewed++;
    if (isInvited(rec)) counts.invited++;
    if (isDeclined(rec)) counts.declined++;
    if (isAwaiting(rec)) counts.awaiting++;
  }

  counts.appliedHhCacheOnly = union.hhOnlyVacancyIds;
  counts.appliedOnHh = appliedByVacancy.size;
  counts.appliedQueueOnly = counts.applied - union.hhOnlyVacancyIds;

  const appliedBase = counts.applied;
  const viewedBase = counts.viewed;

  const steps = [
    {
      id: 'inQueue',
      label: 'В очереди',
      shortLabel: 'Очередь',
      count: counts.inQueue,
      pctOfBase: pct(counts.inQueue, counts.total || 1),
      color: 'queue',
    },
    {
      id: 'applied',
      label: 'Откликнулись',
      shortLabel: 'Отклики',
      count: appliedBase,
      pctOfBase: pct(appliedBase, counts.total || appliedBase || 1),
      pctOfPrev: pct(appliedBase, counts.inQueue || appliedBase || 1),
      color: 'applied',
    },
    {
      id: 'viewed',
      label: 'Просмотр резюме',
      shortLabel: 'Просмотр',
      count: counts.viewed,
      pctOfApplied: pct(counts.viewed, appliedBase || 1),
      pctOfPrev: pct(counts.viewed, appliedBase || 1),
      color: 'viewed',
    },
    {
      id: 'invited',
      label: 'Приглашения',
      shortLabel: 'Пригл.',
      count: counts.invited,
      pctOfApplied: pct(counts.invited, appliedBase || 1),
      pctOfPrev: pct(counts.invited, viewedBase || appliedBase || 1),
      color: 'invited',
      highlight: true,
    },
  ];

  if (scope === 'queue') {
    steps.splice(1);
    steps[0].label = 'Карточки в работе';
    steps[0].count = counts.inQueue;
  } else if (scope === 'all') {
    steps.unshift({
      id: 'total',
      label: 'Всего в очереди',
      shortLabel: 'Всего',
      count: counts.total,
      pctOfBase: 100,
      color: 'total',
    });
  }

  const sinceDay = bounds.sinceLabel || DEFAULT_FUNNEL_SINCE;
  const endDay = new Date().toISOString().slice(0, 10);
  const timeline = [];
  if (sinceDay && sinceDay <= endDay) {
    const cur = new Date(`${sinceDay}T12:00:00`);
    const end = new Date(`${endDay}T12:00:00`);
    while (cur <= end) {
      const date = cur.toISOString().slice(0, 10);
      const row = byDay.get(date) || { applied: 0, invited: 0, viewed: 0 };
      timeline.push({ date, ...row });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    timeline.push(
      ...[...byDay.entries()]
        .filter(([date]) => date !== 'без даты' && date !== 'кэш')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, row]) => ({ date, ...row }))
    );
  }

  const negCache = loadNegotiationsCache();
  const hhItems = negCache.items || [];
  const hhNegotiations = {
    total: hhItems.length,
    submitted: hhItems.filter((x) => x.status === 'submitted').length,
    viewed: hhItems.filter((x) => x.status === 'viewed').length,
    invited: hhItems.filter((x) => x.status === 'invited').length,
    declined: hhItems.filter((x) => x.status === 'declined').length,
    awaiting: hhItems.filter((x) => x.status === 'awaiting').length,
    syncedAt: negCache.syncedAt,
  };

  const hhAppliedBase = hhNegotiations.total || 1;

  const byResumeRows = [...byResume.values()]
    .map((row) => ({
      ...row,
      invitePct: pct(row.invited, row.applied || 1),
      viewPct: pct(row.viewed, row.applied || 1),
    }))
    .sort((a, b) => b.applied - a.applied);

  const staleFollowUpDays = Math.max(1, Number(opts.staleFollowUpDays) || 7);
  /** @type {Array<{ id?: string, title?: string, company?: string, days: number, lastAt?: string }>} */
  const staleFollowUp = q
    .filter((rec) => isStaleFollowUp(rec, staleFollowUpDays))
    .map((rec) => ({
      id: rec.id,
      title: rec.title,
      company: rec.company,
      days: daysSinceApply(rec),
      lastAt: rec.hhApply?.lastAt,
    }))
    .sort((a, b) => (b.days || 0) - (a.days || 0))
    .slice(0, 30);

  return {
    filters: {
      periodDays: bounds.periodDays,
      since: bounds.sinceLabel || null,
      sinceDefault: DEFAULT_FUNNEL_SINCE,
      scope,
      minScore,
      dataScope: 'all-queues-and-hh',
    },
    dataSources: union.sources,
    byResume: byResumeRows,
    counts: {
      ...counts,
      staleFollowUp: staleFollowUp.length,
      unionVacancyIds: union.uniqueVacancyIds,
      unionRecords: qAll.length,
    },
    scoreBuckets,
    steps,
    rates: {
      appliedFromQueue: pct(counts.applied, counts.inQueue || counts.applied || 1),
      viewFromApplied: pct(counts.viewed, appliedBase || 1),
      inviteFromApplied: pct(counts.invited, appliedBase || 1),
      inviteFromViewed: pct(counts.invited, viewedBase || 1),
      declineFromApplied: pct(counts.declined, appliedBase || 1),
      awaitingFromApplied: pct(counts.awaiting, appliedBase || 1),
    },
    timeline,
    hhNegotiations,
    hhRates: {
      viewFromAll: pct(hhNegotiations.viewed, hhAppliedBase),
      inviteFromAll: pct(hhNegotiations.invited, hhAppliedBase),
      declineFromAll: pct(hhNegotiations.declined, hhAppliedBase),
    },
    staleFollowUp,
    staleFollowUpDays,
    updatedAt: new Date().toISOString(),
  };
}
