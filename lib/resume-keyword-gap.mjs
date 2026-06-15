/**
 * Пробелы по ключевым словам: вакансия vs резюме.
 */

import { extractJdKeywords, vacancyTextBlob } from './jd-keyword-extract.mjs';

/**
 * @param {object} rec
 * @param {string} [cvText]
 */
export function assessKeywordGap(rec, cvText = '') {
  const { mustHave, niceToHave } = extractJdKeywords(rec);
  const cvLow = String(cvText || '').toLowerCase();
  const blob = vacancyTextBlob(rec).toLowerCase();
  const check = (skill) => {
    const key = skill.toLowerCase();
    return cvLow.includes(key) || blob.includes(key);
  };
  const missing = mustHave.filter((s) => !check(s));
  const covered = mustHave.filter((s) => check(s));
  const total = mustHave.length || 1;
  const gapScore = Math.round((covered.length / total) * 100);
  return {
    gapScore,
    missing,
    covered,
    niceToHave,
    mustHave,
    critical: missing.length > 0 && gapScore < 50,
  };
}
