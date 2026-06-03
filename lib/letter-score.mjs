/**
 * Оценка письма 0–10 для UI (без ML).
 */

/**
 * @param {{ pass?: boolean, rawPass?: boolean, fixable?: boolean, score?: number, reason?: string }} ev
 * @returns {number|null}
 */
export function letterQualityToScore10(ev) {
  if (!ev || typeof ev !== 'object') return null;
  let n = 4 + Math.min(3, Number(ev.score || 0));
  if (ev.rawPass && !ev.fixable) n += 3;
  else if (ev.pass && !ev.fixable) n += 2;
  else if (ev.fixable || ev.reason === 'ok после подготовки') n += 1;
  else if (!ev.pass) n = Math.min(n, 3);
  return Math.max(0, Math.min(10, Math.round(n)));
}

/**
 * @param {object} q — элемент variantQuality
 */
export function variantQualityRankScore(q) {
  if (!q || typeof q !== 'object') return -1;
  return (
    (q.rawPass ? 2000 : 0) +
    (q.pass ? 1000 : 0) +
    (q.fixable ? 100 : 0) +
    (Number(q.letterScore10) || 0) * 50 +
    Number(q.score || 0)
  );
}

/**
 * @param {Array<{ index?: number }>} variantQuality
 * @param {number} variantCount
 */
export function pickBestVariantIndex(variantQuality, variantCount = 0) {
  if (!Array.isArray(variantQuality) || !variantQuality.length) return 0;
  let bestIdx = 0;
  let bestScore = -1;
  for (const q of variantQuality) {
    const idx = Number(q.index);
    const i = Number.isFinite(idx) ? idx : 0;
    const score = variantQualityRankScore(q);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return Math.max(0, Math.min(bestIdx, Math.max(0, variantCount - 1)));
}

/**
 * @param {object} quality
 */
export function enrichLetterQualityForApi(quality) {
  if (!quality || typeof quality !== 'object') return quality;
  const letterScore10 = letterQualityToScore10(quality);
  return letterScore10 == null ? quality : { ...quality, letterScore10 };
}

/** @type {Record<string, number>} */
const LETTER_ISSUE_KIND_ORDER = { fixable: 0, fail: 1, missing: 2, ok: 3 };

/**
 * Ключ сортировки: сначала fixable, затем худшие по 0–10.
 * @param {{ kind?: string, letterScore10?: number|null }} item
 */
export function letterIssueSortKey(item) {
  const kind = LETTER_ISSUE_KIND_ORDER[item?.kind] ?? 9;
  const score10 = Number(item?.letterScore10);
  const scorePart = Number.isFinite(score10) ? score10 : 5;
  return kind * 100 + scorePart;
}

/**
 * Компактный объект для списка вакансий в API.
 * @param {object|null|undefined} letterEv — результат evaluateLetterQuality
 */
export function letterQualityForListRow(letterEv) {
  if (!letterEv) {
    return {
      pass: false,
      rawPass: false,
      reason: 'письмо не утверждено',
      fixable: false,
      letterScore10: null,
      hints: [],
    };
  }
  const letterScore10 = letterEv.letterScore10 ?? letterQualityToScore10(letterEv);
  return {
    pass: letterEv.pass,
    rawPass: letterEv.rawPass,
    reason: letterEv.pass
      ? letterEv.fixable
        ? 'можно улучшить автоматически'
        : null
      : letterEv.reason,
    fixable: letterEv.fixable,
    score: letterEv.score,
    letterScore10,
    hints: (letterEv.hints || []).slice(0, 3),
  };
}
