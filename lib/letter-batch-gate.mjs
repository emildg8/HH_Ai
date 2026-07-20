/**
 * Проверка письма для батча: assessLetterQuality + порог batchLetterMinScore10.
 * Mid-floor длины (≥320 devops/infra) — здесь, не в assessLetterQuality (фикстуры).
 */

import { assessLetterQuality } from './letter-quality.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { letterQualityToScore10 } from './letter-score.mjs';
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { resolveLetterMinLength } from './letter-mid-quality.mjs';

/**
 * @param {object} prefs
 * @param {object} rec
 */
export function prefsWithLetterMidFloor(prefs = {}, rec = {}) {
  const huntTrack = rec?.huntTrack || classifyVacancyHuntTrack(rec);
  return {
    ...prefs,
    batchLetterMinLength: resolveLetterMinLength(prefs, huntTrack),
  };
}

/**
 * @param {object} rec
 * @param {string} letter
 * @param {string} resumeRole
 * @param {object} [prefs]
 */
export function assessLetterQualityForBatch(rec, letter, resumeRole, prefs = {}) {
  const prefsFloor = prefsWithLetterMidFloor(prefs, rec);
  const base = assessLetterQuality(rec, letter, resumeRole, prefsFloor);
  if (!base.pass) return base;

  const minScore10 = Number(prefs.batchLetterMinScore10);
  if (!Number.isFinite(minScore10) || minScore10 <= 0) return base;

  const ev = evaluateLetterQuality(rec, letter, resumeRole, prefsFloor);
  const score10 = letterQualityToScore10(ev);
  if (score10 == null) {
    return {
      pass: false,
      reason: 'не удалось вычислить оценку письма (0–10)',
      score: base.score,
    };
  }
  if (score10 < minScore10) {
    return {
      pass: false,
      reason: `оценка письма ${score10}/10 ниже порога ${minScore10}`,
      score: base.score,
      letterScore10: score10,
    };
  }
  return { ...base, letterScore10: score10 };
}

/**
 * @param {object|null|undefined} letterEv — результат evaluateLetterQuality
 * @param {object} prefs
 */
export function passesAutoApproveLetterScore(letterEv, prefs = {}) {
  if (!letterEv?.pass) return false;
  const minScore10 = Number(prefs.batchLetterMinScore10);
  if (!Number.isFinite(minScore10) || minScore10 <= 0) return true;
  const score10 = letterQualityToScore10(letterEv);
  return score10 != null && score10 >= minScore10;
}
