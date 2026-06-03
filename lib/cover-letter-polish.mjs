/**
 * Постобработка и ранжирование вариантов сопроводительных.
 */

import { assessLetterQuality } from './letter-quality.mjs';
import { prepareCoverLetterForSend } from './cover-letter-prepare.mjs';

const BANNED_OPENERS = [
  /^уважаемые\s+(рекрутер|работодател|коллег)/i,
  /^меня\s+зовут/i,
  /^я\s+пишу\s+вам,?\s+чтобы/i,
  /^данное\s+письмо/i,
];

const BANNED_PHRASES = [
  [/идеально\s+подхожу/gi, 'хорошо стыкуюсь с задачами'],
  [/уникальный\s+опыт/gi, 'релевантный опыт'],
  [/глубокие\s+знания/gi, 'уверенная практика'],
  [/динамичн\w+\s+компани\w+/gi, 'вашей команде'],
  [/буду\s+рад\s+стать\s+частью\s+вашей\s+команды/gi, 'буду рад обсудить задачи'],
  [/ценным\s+дополнением/gi, 'полезен по опыту'],
  [/развитие\s+вашей\s+компании/gi, 'ваши текущие задачи'],
  [/применить\s+свои\s+знания\s+и\s+опыт\s+для\s+развития/gi, 'подключиться к вашим задачам'],
  [/уверен,?\s+что\s+мой\s+опыт\s+работы\s+вам\s+пригодится/gi, 'готов показать это на кейсах'],
  [/впечатляет\s+подход\s+вашей\s+компании/gi, 'откликнулось описание роли'],
  [/с\s+удовольствием\s+присоединюсь/gi, 'готов подключиться'],
  [/мой\s+опыт\s+полностью\s+соответствует/gi, 'по опыту закрываю'],
  [/высокомотивирован/gi, 'заинтересован'],
  [/комплексн\w+\s+подход/gi, 'практический подход'],
];

/**
 * @param {string} text
 */
export function polishCoverLetter(text) {
  let t = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!t) return t;

  for (const re of BANNED_OPENERS) {
    if (re.test(t)) {
      t = t.replace(re, 'Здравствуйте!');
    }
  }

  for (const [re, repl] of BANNED_PHRASES) {
    t = t.replace(re, repl);
  }

  t = t
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim();

  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length > 2) {
    const seen = new Set();
    const uniq = [];
    for (const s of sentences) {
      const key = s.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(s);
    }
    if (uniq.length < sentences.length) t = uniq.join(' ');
  }

  if (!/^здравствуйте|^добрый\s+день|^доброе\s+утро|^привет/i.test(t)) {
    t = `Здравствуйте! ${t.replace(/^[!.?\s]+/, '')}`;
  }

  return t;
}

/**
 * @param {string} letter
 * @param {object} record
 * @param {string} desc
 */
export function scoreLetterVariant(letter, record, desc) {
  const t = String(letter || '').trim();
  if (!t) return 0;
  let score = 0;

  const len = t.length;
  if (len >= 380 && len <= 1600) score += 3;
  else if (len >= 220 && len <= 2200) score += 1;
  else score -= 2;

  if (/\d/.test(t)) score += 3;
  if ((t.match(/[.!?]/g) || []).length >= 3) score += 2;

  const title = String(record?.title || '').toLowerCase();
  const company = String(record?.company || '').toLowerCase();
  const low = t.toLowerCase();
  if (title && title.length > 4 && low.includes(title.slice(0, Math.min(24, title.length)))) score += 2;
  if (company && company.length > 3 && low.includes(company.slice(0, Math.min(20, company.length)))) {
    score += 2;
  }

  const kw = String(desc || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 5)
    .slice(0, 40);
  let kwHit = 0;
  for (const w of kw) {
    if (low.includes(w)) kwHit++;
    if (kwHit >= 4) break;
  }
  score += Math.min(4, kwHit);

  if (/\b(отклик|позици|ваканси|готов|буду\s+рад|интересн)\b/i.test(t)) score += 2;
  if (/контактная\s+информация|телефон:\s*\+7|telegram:\s*@/i.test(t)) score -= 2;
  if (/мой\s+технический\s+стек\s+включает/i.test(t) && !/\b(задач|кейс|инцидент)\b/i.test(t)) score -= 2;
  if (/^(вариант\s*\d|текст\s+варианта)/i.test(t)) score -= 10;

  return score;
}

/**
 * @param {string[]} variants
 * @param {object} record
 * @param {string} desc
 * @param {{ resumeRole?: string, prefs?: object }} [opts]
 * @returns {string[]}
 */
export function rankLetterVariants(variants, record, desc, opts = {}) {
  const resumeRole = opts.resumeRole || 'devops';
  const prefs = opts.prefs || {};
  return [...variants]
    .map((v, i) => {
      const prepared = prepareCoverLetterForSend(record, v, resumeRole, prefs, { injectHook: false });
      const polished = polishCoverLetter(prepared);
      const quality = assessLetterQuality(record, polished, resumeRole, prefs);
      const base = scoreLetterVariant(polished, record, desc);
      const qualityBonus = quality.pass ? 8 : -6;
      const metricBonus = /\d/.test(polished) ? 2 : 0;
      return {
        v: polished,
        i,
        score: base + qualityBonus + metricBonus + (quality.score || 0) * 0.1,
      };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.v);
}
