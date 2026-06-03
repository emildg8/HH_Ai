/**
 * Сводный «готовность к отклику» по карточке (0–100).
 */

import { assessVacancyForApply } from './vacancy-targeting.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { letterQualityToScore10 } from './letter-score.mjs';
import { pickBestPreparedVariant } from './cover-letter-prepare.mjs';

function vacancyScore(rec) {
  return Number(rec?.scoreOverall ?? rec?.geminiScore ?? 0) || 0;
}

/**
 * @param {object} rec
 * @param {object} [prefs]
 * @param {{ userApproved?: boolean, strictRemoteWork?: boolean, letterQualityEval?: object }} [opts]
 */
export function computeLetterReadiness(rec, prefs = {}, opts = {}) {
  const parts = { vacancy: 0, targeting: 0, letter: 0, questionnaire: 0 };
  const vac = vacancyScore(rec);
  parts.vacancy = Math.min(35, Math.round((vac / 100) * 35));

  const targeting = assessVacancyForApply(rec, {
    userApproved: opts.userApproved,
    strictRemoteWork: opts.strictRemoteWork,
    prefs,
  });
  parts.targeting = targeting.eligible ? 30 : 0;

  const role = targeting.resumeRole || classifyVacancyResumeRole(rec);
  const approved = String(rec?.coverLetter?.approvedText || '').trim();
  const clStatus = rec?.coverLetter?.status;
  let letterEv = opts.letterQualityEval || null;

  if (!letterEv && approved && clStatus === 'approved') {
    letterEv = evaluateLetterQuality(rec, approved, role, prefs);
  } else if (!letterEv) {
    const variants = (rec?.coverLetter?.variants || []).filter(Boolean);
    if (variants.length) {
      const best = pickBestPreparedVariant(variants, rec, role, prefs);
      if (best) letterEv = evaluateLetterQuality(rec, best, role, prefs);
    }
  }

  if (letterEv) {
    if (letterEv.pass && !letterEv.fixable) parts.letter = 25;
    else if (letterEv.pass && letterEv.fixable) parts.letter = 18;
    else parts.letter = 5;
  } else if ((rec?.coverLetter?.variants || []).filter(Boolean).length) {
    parts.letter = 8;
  }

  if (!rec?.hhApply?.questionnaire?.questions?.length) {
    parts.questionnaire = 10;
  } else if ((rec?.hhApply?.questionnaire?.savedAnswers || []).length) {
    parts.questionnaire = 8;
  }

  const score = parts.vacancy + parts.targeting + parts.letter + parts.questionnaire;
  return {
    score: Math.min(100, score),
    parts,
    targetingEligible: targeting.eligible,
    letterPass: letterEv?.pass ?? false,
    letterRawPass: letterEv?.rawPass ?? false,
    letterScore10: letterEv ? letterQualityToScore10(letterEv) : null,
  };
}
