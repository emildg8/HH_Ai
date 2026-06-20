/**
 * Проверка письма для батча: assessLetterQuality + порог batchLetterMinScore10.
 */

import { assessLetterQuality } from './letter-quality.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { letterQualityToScore10 } from './letter-score.mjs';

/**
 * @param {object} rec
 * @param {string} letter
 * @param {string} resumeRole
 * @param {object} [prefs]
 */
export function assessLetterQualityForBatch(rec, letter, resumeRole, prefs = {}) {
  const base = assessLetterQuality(rec, letter, resumeRole, prefs);
  if (!base.pass) return base;

  const minScore10 = Number(prefs.batchLetterMinScore10);
  if (!Number.isFinite(minScore10) || minScore10 <= 0) return base;

  const ev = evaluateLetterQuality(rec, letter, resumeRole, prefs);
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
