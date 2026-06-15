/**
 * Anti-AI audit для писем, чатов и «О себе».
 */

import { AIDetector } from '../vendor/avoid-ai-writing/detector/patterns.js';
import { humanizeLetterText } from './letter-humanize.mjs';

/**
 * @param {string} text
 * @param {{ lang?: string, contextMode?: string, maxScore?: number }} [opts]
 */
export function auditText(text, opts = {}) {
  const t = String(text || '').trim();
  if (!t) return { score: 0, band: 'Light', pass: true, hits: [] };

  const hasCyrillic = /[а-яё]/i.test(t);
  const lang = opts.lang || (hasCyrillic ? 'auto' : 'en');
  const analysis = AIDetector.analyzeText(t, { lang });
  const maxScore = Number(opts.maxScore ?? 35);
  return {
    ...analysis,
    pass: analysis.score <= maxScore,
    maxScore,
  };
}

/**
 * @param {string} text
 * @param {{ maxScore?: number, prefs?: object }} [opts]
 */
export function prepareHumanText(text, opts = {}) {
  let t = humanizeLetterText(text);
  const maxScore = Number(opts.maxScore ?? opts.prefs?.batchLetterMaxAiScore ?? 35);
  let audit = auditText(t, { maxScore, prefs: opts.prefs });
  if (!audit.pass && audit.band === 'Heavy') {
    t = t
      .replace(/\b(I am|I'm) (excited|thrilled|passionate)\b/gi, 'I')
      .replace(/в связи с вышеизложенным/gi, 'поэтому')
      .replace(/осуществлял[аи]?/gi, 'делал')
      .replace(/командный игрок/gi, 'работаю в команде');
    audit = auditText(t, { maxScore });
  }
  return { text: t, audit };
}
