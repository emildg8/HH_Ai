/**
 * Сводка качества писем для дашборда (один запрос).
 */

import { summarizeLetterMetrics, computeLetterMetricsSparkline7d } from './letter-metrics-summary.mjs';
import { readLetterQualityReport } from './batch-letter-quality-report.mjs';
import { computeQualityBaseline } from './quality-baseline.mjs';
import { readRecentUserEditSnippets } from './cover-letter-user-edits.mjs';
import { runLetterQualityGoldenRegression } from './letter-quality-golden-set.mjs';
import { runTargetingGoldenRegression } from './targeting-golden-set.mjs';
import { loadQueue } from './store.mjs';
import { summarizeLetterInviteCorrelation } from './letter-invite-correlation.mjs';
import { buildLetterStyleInsightsFromQueue } from './letter-style-learning.mjs';
import { computeLetterNoEditKpi } from './letter-apply-kpi.mjs';
import { computeFalsePositiveSparkline7d } from './false-positive-analytics.mjs';

/**
 * @param {object} [prefs]
 */
export function buildCoverLetterQualityHub(prefs = {}) {
  const metrics = summarizeLetterMetrics();
  const batchReport = readLetterQualityReport();
  let baseline = null;
  try {
    baseline = computeQualityBaseline(prefs);
  } catch {
    baseline = null;
  }
  const letterGolden = runLetterQualityGoldenRegression(prefs);
  const targetingGolden = runTargetingGoldenRegression(prefs);
  const userEditSnippets = readRecentUserEditSnippets(3);
  const responded = loadQueue().filter(
    (r) =>
      r.hhApply?.hhSiteState === 'invited' ||
      r.hhApply?.hhSiteState === 'already_applied' ||
      r.hhApply?.hhSiteState === 'declined' ||
      r.status === 'responded'
  );
  const correlation = summarizeLetterInviteCorrelation(responded, prefs);
  const styleInsights = buildLetterStyleInsightsFromQueue(prefs);
  const letterNoEdit = computeLetterNoEditKpi();

  return {
    ok: true,
    at: new Date().toISOString(),
    trends: {
      falsePositive7d: computeFalsePositiveSparkline7d(),
      letterPass7d: computeLetterMetricsSparkline7d(),
    },
    letterNoEdit,
    metrics: {
      generate: metrics.generate,
      totalEvents: metrics.total,
    },
    batchReport: batchReport
      ? {
          finishedAt: batchReport.finishedAt,
          letterQualitySkips: batchReport.letterQualitySkips,
          samples: (batchReport.samples || []).slice(0, 5),
        }
      : null,
    baseline: baseline
      ? {
          falsePositiveRate: baseline.falsePositives?.rate,
          falsePositives: baseline.falsePositives?.total,
          letterBatchReadyRate: baseline.letters?.batchReadyRate,
          inviteRate: baseline.outcomes?.inviteRate,
          responded: baseline.outcomes?.responded,
        }
      : null,
    golden: {
      letters: {
        ok: letterGolden.ok,
        passed: letterGolden.passed,
        total: letterGolden.total,
      },
      targeting: {
        ok: targetingGolden.ok,
        passed: targetingGolden.passed,
        total: targetingGolden.total,
      },
    },
    userEdits: {
      recentCount: userEditSnippets.length,
      preview: userEditSnippets.map((s) => String(s).slice(0, 120)),
    },
    correlation: {
      insight: correlation.insight || '',
      withLetter: correlation.withLetter,
      invitedPassRate: correlation.invited?.passRate,
      appliedPassRate: correlation.applied?.passRate,
    },
    styleInsights: {
      insight: styleInsights.insight || '',
      invitedCount: styleInsights.invitedCount,
      terms: (styleInsights.topTerms || []).slice(0, 5),
    },
  };
}
