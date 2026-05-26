/**
 * Расширенная статистика для дашборда (воронка, конверсия, чаты, собесы).
 */

import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { computeConversionStats } from './conversion-stats.mjs';
import { loadNegotiationsCache } from './hh-negotiations-sync.mjs';
import { computeFunnelAnalytics } from './funnel-analytics.mjs';
import { parseFunnelPeriodBounds } from './funnel-period.mjs';
import { computeExtendedDashboardStats } from './dashboard-summary.mjs';

/**
 * @returns {object}
 */
export function computeDashboardStats(opts = {}) {
  const q = loadAnalyticsUnionRecords().records;
  const conversion = computeConversionStats();
  const bounds = parseFunnelPeriodBounds(opts);
  const funnelDetail = computeFunnelAnalytics({
    since: opts.since,
    periodDays: opts.periodDays ?? bounds.periodDays,
    scope: 'applied',
    minScore: 0,
  });

  const byStatus = { pending: 0, approved: 0, rejected: 0, responded: 0 };
  const scoreBuckets = { high: 0, mid: 0, low: 0, none: 0 };
  let withQuestionnaire = 0;
  let chatNeedsReply = 0;
  let interviewPrepReady = 0;

  for (const rec of q) {
    const st = rec.status || 'pending';
    if (byStatus[st] != null) byStatus[st]++;
    else byStatus.pending++;

    const score = Number(rec.scoreOverall ?? rec.geminiScore ?? 0);
    if (!score) scoreBuckets.none++;
    else if (score >= 70) scoreBuckets.high++;
    else if (score >= 50) scoreBuckets.mid++;
    else scoreBuckets.low++;

    if (rec.hhApply?.questionnaire?.questions?.length) withQuestionnaire++;
    if (rec.hhApply?.chatSummary?.needsReply) chatNeedsReply++;
    if (rec.hhApply?.hhSiteState === 'invited' || rec.interviewPrep) interviewPrepReady++;
  }

  const appliedSince = funnelDetail.counts.applied;
  const appliedOnHh = funnelDetail.counts.appliedOnHh;
  const appliedBase = appliedSince || 1;

  const negCache = loadNegotiationsCache();
  const hhNegotiationsTotal = (negCache.items || []).length;
  const hhViewed = (negCache.items || []).filter((x) => x.status === 'viewed').length;
  const hhDeclined = (negCache.items || []).filter((x) => x.status === 'declined').length;
  const hhInvited = (negCache.items || []).filter((x) => x.status === 'invited').length;

  const extended = computeExtendedDashboardStats();

  return {
    ...conversion,
    ...extended,
    applied: appliedSince,
    appliedOnHh,
    appliedHhCacheOnly: funnelDetail.counts.appliedHhCacheOnly,
    funnelSince: bounds.sinceLabel || null,
    hhNegotiations: {
      total: hhNegotiationsTotal,
      viewed: hhViewed,
      declined: hhDeclined,
      invited: hhInvited,
      syncedAt: negCache.syncedAt,
    },
    byStatus,
    scoreBuckets,
    withQuestionnaire,
    chatNeedsReply,
    interviewInvites: conversion.invited,
    interviewPrepReady,
    funnel: {
      inQueue: byStatus.pending + byStatus.approved,
      applied: appliedSince,
      appliedOnHh,
      viewed: conversion.viewed,
      invited: conversion.invited,
      declined: conversion.declined,
      viewRatePct: Math.round((conversion.viewed / appliedBase) * 1000) / 10,
      inviteRatePct: conversion.rates.invitePct,
      declineRatePct: conversion.rates.declinePct,
    },
    updatedAt: new Date().toISOString(),
  };
}
