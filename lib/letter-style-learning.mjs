/**
 * Подсказки для промпта из писем с приглашением vs обычный отклик (без LLM).
 */

import { loadQueue } from './store.mjs';

const TOKEN_RE = /[a-zа-яё0-9][a-zа-яё0-9\-/]{2,}/gi;
const STOP = new Set([
  'здравствуйте',
  'добрый',
  'день',
  'откликаюсь',
  'готов',
  'обсудить',
  'вакансию',
  'позицию',
  'команды',
  'задачи',
  'опыт',
  'есть',
  'этой',
  'вашей',
  'компании',
  'меня',
  'могу',
  'буду',
  'наш',
  'вас',
  'для',
  'при',
  'или',
  'что',
  'как',
  'все',
  'также',
]);

/**
 * @param {string} text
 */
function tokenizeLetter(text) {
  const m = String(text || '').toLowerCase().match(TOKEN_RE) || [];
  return m.filter((w) => w.length >= 4 && !STOP.has(w));
}

/**
 * @param {string[]} texts
 */
function termFreq(texts) {
  /** @type {Map<string, number>} */
  const freq = new Map();
  for (const t of texts) {
    const seen = new Set();
    for (const w of tokenizeLetter(t)) {
      if (seen.has(w)) continue;
      seen.add(w);
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return freq;
}

/**
 * @param {object[]} records
 * @param {object} [_prefs]
 */
export function buildLetterStyleInsights(records, _prefs = {}) {
  const invitedTexts = [];
  const appliedTexts = [];
  for (const rec of records) {
    const letter = String(rec?.coverLetter?.approvedText || '').trim();
    if (!letter || letter.length < 80 || rec.coverLetter?.status !== 'approved') continue;
    const st = String(rec?.hhApply?.hhSiteState || '').toLowerCase();
    if (st === 'invited') invitedTexts.push(letter);
    else if (st === 'already_applied' || rec?.status === 'responded') appliedTexts.push(letter);
  }

  const invFreq = termFreq(invitedTexts);
  const appFreq = termFreq(appliedTexts);
  const invN = Math.max(1, invitedTexts.length);
  const appN = Math.max(1, appliedTexts.length);

  /** @type {Array<{ term: string, invitedRate: number, appliedRate: number, lift: number }>} */
  const scored = [];
  const terms = new Set([...invFreq.keys(), ...appFreq.keys()]);
  for (const term of terms) {
    const ir = (invFreq.get(term) || 0) / invN;
    const ar = (appFreq.get(term) || 0) / appN;
    if (ir < 0.15) continue;
    const lift = ir / Math.max(0.05, ar);
    if (lift < 1.2) continue;
    scored.push({
      term,
      invitedRate: Math.round(ir * 100),
      appliedRate: Math.round(ar * 100),
      lift: Math.round(lift * 100) / 100,
    });
  }
  scored.sort((a, b) => b.lift - a.lift || b.invitedRate - a.invitedRate);

  const topTerms = scored.slice(0, 12);
  let insight = '';
  if (invitedTexts.length >= 3 && appliedTexts.length >= 5 && topTerms.length) {
    insight = `В приглашениях чаще: ${topTerms
      .slice(0, 5)
      .map((x) => x.term)
      .join(', ')}.`;
  }

  return {
    ok: true,
    invitedCount: invitedTexts.length,
    appliedCount: appliedTexts.length,
    topTerms,
    insight,
  };
}

/**
 * @param {object} [prefs]
 */
export function buildLetterStyleInsightsFromQueue(prefs = {}) {
  return buildLetterStyleInsights(loadQueue(), prefs);
}
