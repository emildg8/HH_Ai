/**
 * Единый PreApplyGate: targeting + red flags + resume-fit + эвристика P(invite).
 */

import { assessVacancyForApply } from './vacancy-targeting.mjs';
import { assessApplyRedFlags } from './apply-red-flags.mjs';
import { scoreResumeVsVacancy } from './resume-fit.mjs';
import { assessLetterQualityForBatch } from './letter-batch-gate.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { letterQualityToScore10 } from './letter-score.mjs';
import { getEmployerScore } from './employer-intelligence.mjs';
import { computeFreshnessHours } from './source-quality.mjs';
import { loadCvBundle } from './cv-load.mjs';
import { resolveApplyIntelligence, resolveApplyIntelligenceForEmployer } from './apply-intelligence-prefs.mjs';
import { emitConversionEvent } from './conversion-glue.mjs';

/** @typedef {'off_target'|'work_format'|'manual_apply'|'hh_state'|'red_flag'|'letter_quality'|'gate_score'|'gate_disabled'} GateSkipReason */

export const GATE_SKIP_REASON = {
  OFF_TARGET: 'off_target',
  WORK_FORMAT: 'work_format',
  MANUAL_APPLY: 'manual_apply',
  HH_STATE: 'hh_state',
  RED_FLAG: 'red_flag',
  LETTER_QUALITY: 'letter_quality',
  GATE_SCORE: 'gate_score',
  GATE_DISABLED: 'gate_disabled',
};

const CATEGORY_TO_SKIP = {
  'work-format': GATE_SKIP_REASON.WORK_FORMAT,
  'manual-apply': GATE_SKIP_REASON.MANUAL_APPLY,
  'off-target-hh-state': GATE_SKIP_REASON.HH_STATE,
  letterQuality: GATE_SKIP_REASON.LETTER_QUALITY,
};

/**
 * @param {string} [category]
 * @returns {GateSkipReason}
 */
export function mapCategoryToSkipReason(category) {
  return CATEGORY_TO_SKIP[category] || GATE_SKIP_REASON.OFF_TARGET;
}

function scoreOf(rec) {
  return Number(rec?.scoreOverall ?? rec?.geminiScore ?? 0) || 0;
}

function vacancyTextBlob(rec) {
  return [
    rec?.title,
    rec?.description,
    rec?.descriptionPreview,
    rec?.requirements,
    rec?.skills,
  ]
    .filter(Boolean)
    .join('\n');
}

function freshnessScore(rec) {
  const hours = computeFreshnessHours(rec?.publishedAt || rec?.createdAt);
  if (hours == null) return 50;
  if (hours <= 24) return 95;
  if (hours <= 72) return 85;
  if (hours <= 168) return 70;
  if (hours <= 336) return 55;
  return 35;
}

function letterQualityScore(rec, prefs, resumeRole) {
  const letter = String(rec?.coverLetter?.approvedText || '').trim();
  if (!letter) return { score: 0, pass: false, reason: 'письмо не утверждено' };
  const ev = evaluateLetterQuality(rec, letter, resumeRole, prefs);
  const score10 = letterQualityToScore10(ev);
  const batch = assessLetterQualityForBatch(rec, letter, resumeRole, prefs);
  return {
    score: score10 != null ? score10 * 10 : ev.pass ? 70 : 30,
    pass: batch.pass,
    reason: batch.reason || ev.reason,
    score10,
    fixable: Boolean(ev.fixable),
  };
}

/**
 * @param {object} components
 * @param {object} weights
 */
function weightedGateScore(components, weights) {
  const w = weights;
  const sumW =
    w.keywordFit + w.resumeFit + w.letterQuality + w.employerHistory + w.freshness + w.hrStackMatch;
  const denom = sumW > 0 ? sumW : 1;
  const raw =
    (components.keywordFit * w.keywordFit +
      components.resumeFit * w.resumeFit +
      components.letterQuality * w.letterQuality +
      components.employerHistory * w.employerHistory +
      components.freshness * w.freshness +
      components.hrStackMatch * w.hrStackMatch) /
    denom;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Эвристика P(invite) для UI (не ML-модель).
 * @param {number} gateScore
 */
export function estimatePInvitePct(gateScore) {
  return Math.max(3, Math.min(42, Math.round(gateScore * 0.14 + 4)));
}

/**
 * @param {object} rec
 * @param {{ prefs?: object, allRecords?: object[], userApproved?: boolean, strictRemoteWork?: boolean, requireLetter?: boolean, relaxedTargeting?: boolean, skipRedFlags?: boolean, cvText?: string, emit?: boolean }} [opts]
 */
export async function runApplyGate(rec, opts = {}) {
  const started = Date.now();
  const prefs = opts.prefs || {};
  const ai = rec?.company
    ? resolveApplyIntelligenceForEmployer(rec.company, prefs)
    : resolveApplyIntelligence(prefs);
  const allRecords = opts.allRecords || [];
  const strictRemoteWork =
    opts.strictRemoteWork ??
    (prefs.batchRequireRemote !== undefined
      ? prefs.batchRequireRemote !== false
      : prefs.requireRemote !== false);

  const targeting = assessVacancyForApply(rec, {
    userApproved: Boolean(opts.userApproved),
    strictRemoteWork,
    prefs,
  });

  let cvText = opts.cvText;
  if (!cvText) {
    try {
      const bundle = await loadCvBundle();
      cvText = bundle?.text || '';
    } catch {
      cvText = '';
    }
  }

  let redFlags;
  if (opts.skipRedFlags) {
    redFlags = { blocked: false, flags: [], keywordGap: { gapScore: 50 } };
  } else {
    redFlags = await assessApplyRedFlags(rec, { prefs, allRecords, cvText });
  }
  const resumeRole = targeting.resumeRole || 'devops';
  const letter = letterQualityScore(rec, prefs, resumeRole);
  const resumeFit = scoreResumeVsVacancy(cvText, vacancyTextBlob(rec));
  const keywordFit = redFlags.keywordGap?.gapScore ?? 50;
  const employerHistory = ai.useEmployerScore
    ? getEmployerScore(rec?.company, allRecords)
    : 50;
  const vacancyScore = scoreOf(rec);

  const components = {
    vacancyScore,
    keywordFit,
    resumeFit: resumeFit.score,
    letterQuality: letter.score,
    employerHistory,
    freshness: freshnessScore(rec),
    hrStackMatch: 50,
  };

  const gateScore = weightedGateScore(components, ai.weights);
  const pInvitePct = estimatePInvitePct(gateScore);
  const reasons = [];

  if (!opts.relaxedTargeting && !targeting.eligible) {
    reasons.push(targeting.skipReason || targeting.category || 'не подходит');
  }
  for (const f of redFlags.flags || []) {
    reasons.push(f.message);
  }
  if (!letter.pass && opts.requireLetter !== false) {
    reasons.push(letter.reason || 'письмо');
  }

  let pass = true;
  let skipReason = null;

  const targetingBlocks = !opts.relaxedTargeting && !targeting.eligible;

  if (!ai.gateEnabled) {
    pass = !targetingBlocks && !redFlags.blocked;
    if (targetingBlocks) skipReason = mapCategoryToSkipReason(targeting.category);
    else if (redFlags.blocked) skipReason = GATE_SKIP_REASON.RED_FLAG;
    else if (!letter.pass && opts.requireLetter !== false) skipReason = GATE_SKIP_REASON.LETTER_QUALITY;
  } else {
    if (targetingBlocks) {
      pass = false;
      skipReason = mapCategoryToSkipReason(targeting.category);
    } else if (redFlags.blocked) {
      pass = false;
      skipReason = GATE_SKIP_REASON.RED_FLAG;
    } else if (!letter.pass && opts.requireLetter !== false) {
      pass = false;
      skipReason = GATE_SKIP_REASON.LETTER_QUALITY;
    } else if (gateScore < ai.effectiveMinGate) {
      pass = false;
      skipReason = GATE_SKIP_REASON.GATE_SCORE;
      reasons.push(`gate ${gateScore} < порог ${ai.effectiveMinGate}`);
    }
  }

  const verdict = {
    recordId: rec?.id,
    pass,
    skipReason,
    gateScore,
    pInvitePct,
    effectiveMinGate: ai.effectiveMinGate,
    gateEnabled: ai.gateEnabled,
    isDreamEmployer: ai.isDreamEmployer,
    resumeRole,
    targeting: {
      eligible: targeting.eligible,
      category: targeting.category,
      skipReason: targeting.skipReason,
    },
    redFlags: redFlags.flags,
    letter: {
      pass: letter.pass,
      score: letter.score,
      score10: letter.score10,
      reason: letter.reason,
      fixable: letter.fixable,
    },
    resumeFit,
    components,
    reasons: [...new Set(reasons.filter(Boolean))],
    ms: Date.now() - started,
  };

  if (opts.emit !== false) {
    const base = {
      correlationId: rec?.id,
      recordId: rec?.id,
      vacancyId: rec?.vacancyId || rec?.id,
      employerId: rec?.company,
    };
    emitConversionEvent(
      'gate.preview',
      {
        recordId: rec?.id,
        gateScore,
        pInvitePct,
        components,
      },
      { ...base, phase: 'gate.preview' }
    );
    emitConversionEvent(
      'gate.decided',
      {
        recordId: rec?.id,
        pass,
        skipReason,
        gateScore,
        pInvitePct,
        reasons: verdict.reasons,
      },
      { ...base, phase: 'gate.decided', ms: verdict.ms }
    );
  }

  return verdict;
}

/** @param {object} rec @param {object} [opts] */
export async function previewApplyGate(rec, opts = {}) {
  return runApplyGate(rec, { ...opts, emit: false });
}

/** @param {object} rec @param {object} [opts] */
export async function decideApplyGate(rec, opts = {}) {
  return runApplyGate(rec, { ...opts, emit: true });
}
