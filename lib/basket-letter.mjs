/**
 * Единый resolver писем корзин: LLM · custom · ME polish (без day-* шаблонов по умолчанию).
 */
import { generateCoverLetterVariants } from './cover-letter-openrouter.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { prepareCoverLetterForSend } from './cover-letter-prepare.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import {
  hasL2l3OverqualifiedOpening,
  hasOrphanSevenThousand,
} from './letter-cv-framing.mjs';
import { mePolishLetter, softenDevopsOverqualifiedOpening } from './me-letter-polish.mjs';
import { loadLlmBudgetLedger, saveLlmBudgetLedger } from './llm-budget.mjs';
import {
  BASKET_CUSTOM_LETTERS,
  resolveCustomLetterByVacancyId,
} from './basket-letter-custom.mjs';

export { resolveCustomLetterByVacancyId, listCustomLetterSpecs } from './basket-letter-custom.mjs';
export { buildL2l3SafeLetter, buildDevopsSafeLetter } from './basket-letter-templates.mjs';

import { buildDevopsSafeLetter, buildL2l3SafeLetter } from './basket-letter-templates.mjs';

export function letterSleepMs() {
  if (process.argv.includes('--fast')) return 500;
  return Number(process.env.BASKET_LETTER_SLEEP_MS) || 4000;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function basketLetterStrictMode() {
  return (
    process.env.BASKET_LETTER_STRICT === '1' ||
    process.argv.includes('--strict-letters') ||
    String(process.env.BASKET_LETTER_NO_TEMPLATE || '').trim() === '1'
  );
}

/** Шаблон day-* только при явном флаге (по умолчанию — индивидуальное LLM/custom). */
export function allowTemplateFallback() {
  if (basketLetterStrictMode()) return false;
  if (process.argv.includes('--allow-template-fallback')) return true;
  if (process.argv.includes('--no-template-fallback')) return false;
  const env = process.env.BASKET_LETTER_ALLOW_TEMPLATE_FALLBACK;
  if (env === '1' || env === 'true') return true;
  return false;
}

export function isTemplateLetterModel(model) {
  const m = String(model || '').trim().toLowerCase();
  return (
    m.startsWith('template:') ||
    m.startsWith('fallback-template:') ||
    m.includes('cascade-fallback') ||
    m === 'template:premium-policy'
  );
}

export function resetCoinsBudgetHeadroom() {
  const ledger = loadLlmBudgetLedger();
  const cap = Number(process.env.HH_LLM_DAILY_COINS_CAP) || 150;
  ledger.coinsDaily = { total: cap, used: 0, label: 'dslab-coins' };
  saveLlmBudgetLedger(ledger);
}

/** Overqualified — только лид (первые 1–2 предложения), не весь текст. */
export function letterOverqualifiedOpening(text, huntTrack, opts = {}) {
  const polished = String(text || '');
  if (huntTrack === 'l2l3' && opts.l2OverqualifiedOnly !== false) {
    return hasL2l3OverqualifiedOpening(polished);
  }
  if (hasL2l3OverqualifiedOpening(polished)) return true;
  return hasOrphanSevenThousand(polished);
}

function polishForBasket(v, huntTrack) {
  let t = mePolishLetter(v, { huntTrack });
  if (huntTrack === 'devops') t = softenDevopsOverqualifiedOpening(t);
  if (huntTrack === 'l2l3') t = softenDevopsOverqualifiedOpening(t);
  return t;
}

export function pickBestLetter(rec, variants, prefs, huntTrack, opts = {}) {
  const role = classifyVacancyResumeRole(rec);
  let best = '';
  let bestEv = null;
  for (const v of variants || []) {
    const polished = polishForBasket(v, huntTrack);
    const ev = evaluateLetterQuality({ ...rec, huntTrack }, polished, role, prefs);
    const overOpening = letterOverqualifiedOpening(polished, huntTrack, opts);
    const score =
      (ev.pass ? 1000 : 0) +
      (ev.rawPass ? 100 : 0) +
      (ev.fixable ? 50 : 0) -
      (overOpening && !ev.pass ? 200 : 0);
    if (!bestEv || score > bestEv.score) {
      best = polished;
      bestEv = { ...ev, score, overOpening };
    }
  }
  return { letter: best, quality: bestEv };
}

export function meReviewLetterNotes(rec, letter, huntTrack) {
  const notes = [];
  if (/^Привет/i.test(letter)) notes.push('HR: заменить приветствие на «Здравствуйте»');
  if (/IT_One сопровождаю|работаю с контурами СБП/i.test(letter) && !/до июня 2026/i.test(letter)) {
    notes.push('M0: IT_One только в прошедшем времени (увольнение 1 июня)');
  }
  if (huntTrack === 'l2l3' && /14\+\s*лет.*DevOps|7000\+/i.test(letter)) {
    notes.push('HR: l2l3 — не акцентировать 14+/DevOps, фокус L2');
  }
  if (/HashiCorp Vault|Helm|GitLab CI/i.test(letter) && !/разберусь|основы|практик/i.test(letter)) {
    notes.push('hh.ru AI-screen: смягчить hard skills без commercial evidence');
  }
  return notes;
}

export function generateCustomLetter(rec, customSpec, prefs) {
  const huntTrack = customSpec.huntTrack || rec.huntTrack;
  let letter = polishForBasket(customSpec.build(rec), huntTrack);
  if (huntTrack === 'l2l3' && hasL2l3OverqualifiedOpening(letter)) {
    letter = buildL2l3SafeLetter(rec);
  }
  const role = customSpec.resumeOverride?.role || classifyVacancyResumeRole(rec);
  const quality = evaluateLetterQuality({ ...rec, huntTrack }, letter, role, prefs);
  return {
    letter,
    quality,
    model: customSpec.model,
    huntTrack,
    resumeOverride: customSpec.resumeOverride,
  };
}

const METRIC_POOL = [
  'До июня 2026 в Softline держал SLA линии поддержки выше 85% на внутренних контурах.',
  'В IT_One на контурах СБП сопровождал инциденты и релизы: Linux, Grafana, регламенты команды.',
  'В Softline и Aplana сопровождал MSSQL/MySQL: бэкапы, реплики и разбор инцидентов по базам.',
];

/**
 * Метрика в devops-письме: не всегда IT_One+−15% (каскад волны).
 * HH_LETTER_FORCE_MTTR15=1 — старый инжект (откат).
 * @param {string} letter
 * @param {{ seed?: string }} [opts]
 */
export function ensureDevopsLetterMetrics(letter, opts = {}) {
  const t = String(letter || '').trim();
  if (!t) return t;
  if (String(process.env.HH_LETTER_FORCE_MTTR15 || '').trim() === '1') {
    if (/MTTR|−15%|-15%|\b15\s*%/i.test(t)) return t;
    const inject =
      'До июня 2026 в IT_One сопровождал контуры СБП: Linux, Docker, Grafana/Kibana, GitLab CI — время реакции −15%.';
    const m = t.match(/^(Здравствуйте![^.!?]*[.!?])\s*/i);
    if (m) return `${m[1]} ${inject} ${t.slice(m[0].length).trim()}`.replace(/\s{2,}/g, ' ').trim();
    return `${inject} ${t}`.trim();
  }
  // Уже есть конкретная метрика / факт объёма / SLA — не трогаем.
  if (
    /MTTR|−\s*\d+\s*%|-\s*\d+\s*%|\b\d{1,2}\s*%|SLA\s*>?\s*\d|7000\+|более\s+чем\s+\d/i.test(t)
  ) {
    return t;
  }
  // Ротация по seed (vacancy id / длина) — слот 0 = без инжекта.
  const seed = String(opts.seed || t.slice(0, 48));
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i) * (i + 1)) % 997;
  const slot = h % 4; // 0 none, 1..3 pool
  if (slot === 0) return t;
  let inject = METRIC_POOL[slot - 1];
  // Не дублировать IT_One+СБП каркас, если уже есть.
  if (/IT_One/i.test(t) && /СБП/i.test(t)) {
    inject = METRIC_POOL[0]; // Softline SLA
  }
  if (/Softline/i.test(t) && /SLA/i.test(t) && slot === 1) {
    inject = METRIC_POOL[2];
  }
  const m = t.match(/^(Здравствуйте![^.!?]*[.!?])\s*/i);
  if (m) return `${m[1]} ${inject} ${t.slice(m[0].length).trim()}`.replace(/\s{2,}/g, ' ').trim();
  return `${inject} ${t}`.trim();
}

/** SRE: убрать тикетный объём — звучит как L2, не как надёжность. */
function stripSreTicketVolumeFraming(letter, rec) {
  const title = String(rec?.title || '');
  if (!/\bsre\b|site reliability|надёжност/i.test(title)) return letter;
  return String(letter || '')
    .replace(/более\s+чем\s+7000\s+обращений[^.;]*/gi, 'восстановление сервиса в SLA')
    .replace(/7000\+?\s*(?:обращений|инцидентов)[^.;]*/gi, 'инциденты и восстановление сервиса')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function finalizeBasketLetter(rec, picked, prefs, huntTrack) {
  const role = classifyVacancyResumeRole(rec);
  let letter = polishForBasket(picked.letter || '', huntTrack);
  if (huntTrack === 'devops') {
    letter = ensureDevopsLetterMetrics(letter, { seed: String(rec?.id || rec?.vacancyId || '') });
  }
  letter = stripSreTicketVolumeFraming(letter, rec);
  let quality = evaluateLetterQuality({ ...rec, huntTrack }, letter, role, prefs);
  if (!quality.pass && quality.fixable) {
    letter = prepareCoverLetterForSend(rec, letter, role, prefs);
    letter = stripSreTicketVolumeFraming(letter, rec);
    quality = evaluateLetterQuality({ ...rec, huntTrack }, letter, role, prefs);
  }
  if (!quality.pass && huntTrack === 'devops') {
    letter = ensureDevopsLetterMetrics(letter, { seed: String(rec?.id || '') + ':retry' });
    letter = stripSreTicketVolumeFraming(letter, rec);
    quality = evaluateLetterQuality({ ...rec, huntTrack }, letter, role, prefs);
  }
  return { letter, quality };
}

function letterUsableForBasket(picked, huntTrack, opts = {}) {
  if (!picked?.letter) return false;
  if (letterOverqualifiedOpening(picked.letter, huntTrack, opts)) return false;
  const q = picked.quality || {};
  if (q.pass) return true;
  if (q.fixable && q.rawPass) return true;
  if (q.rawPass) return true;
  return false;
}

async function tryLlmBasketLetter(rec, cvBundle, prefs, huntTrack, mode) {
  const maxAttempts = mode === 'day' ? 3 : 1;
  let lastModel = null;
  const retryHints = [
    '',
    'В первых 2 предложениях убери «14+ лет», «7000+», «руководил», lead/head. Начни с задачи вакансии и практической работы DevOps (без англ. hands-on).',
    'Opening только: роль из заголовка + 1 задача JD + MTTR −15%. Без лет стажа и без руководства в начале.',
  ];
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const prevStrict = process.env.BASKET_LETTER_STRICT;
      const prevHint = process.env.COVER_LETTER_RETRY_HINT;
      process.env.BASKET_LETTER_STRICT = '1';
      process.env.COVER_LETTER_RETRY_HINT = retryHints[i] || retryHints[retryHints.length - 1];
      const result = await generateCoverLetterVariants(rec, cvBundle);
      if (prevStrict === undefined) delete process.env.BASKET_LETTER_STRICT;
      else process.env.BASKET_LETTER_STRICT = prevStrict;
      if (prevHint === undefined) delete process.env.COVER_LETTER_RETRY_HINT;
      else process.env.COVER_LETTER_RETRY_HINT = prevHint;

      lastModel = result.providerModel || result.cascadeProvider || 'dslab';
      if (isTemplateLetterModel(lastModel)) {
        console.warn(`[basket-letter] skip template model ${lastModel} for ${rec.company}`);
        continue;
      }

      const picked = pickBestLetter(rec, result.variants, prefs, huntTrack, {
        l2OverqualifiedOnly: huntTrack === 'l2l3',
      });
      const finalized = finalizeBasketLetter(rec, picked, prefs, huntTrack);
      if (
        letterUsableForBasket(finalized, huntTrack, { l2OverqualifiedOnly: huntTrack === 'l2l3' })
      ) {
        return {
          letter: finalized.letter,
          quality: finalized.quality,
          model: lastModel,
        };
      }
      console.warn(
        `[basket-letter] LLM не прошёл opening/quality для ${rec.company} (attempt ${i + 1}/${maxAttempts})`
      );
    } catch (e) {
      const msg = String(e.message || e);
      if (/502|503|temporarily unavailable/i.test(msg) && i < maxAttempts - 1) {
        await sleep(6000);
        continue;
      }
      if (mode !== 'day') throw e;
    }
    if (i < maxAttempts - 1) await sleep(letterSleepMs());
  }
  return null;
}

function templateFallbackLetter(rec, prefs, huntTrack) {
  const safe = huntTrack === 'l2l3' ? buildL2l3SafeLetter(rec) : buildDevopsSafeLetter(rec);
  const q = pickBestLetter(rec, [safe], prefs, huntTrack, { l2OverqualifiedOnly: false });
  return {
    letter: q.letter,
    quality: q.quality,
    model: huntTrack === 'l2l3' ? 'template:day-l2l3-safe' : 'template:day-devops-safe',
  };
}

/**
 * @param {'day'|'me'|'top10'} mode — top10/me без safe-fallback retries
 */
export async function generateBasketLetter(rec, cvBundle, prefs, spec, mode = 'day') {
  const custom = resolveCustomLetterByVacancyId(spec.id || rec.id);
  if (custom) return generateCustomLetter(rec, custom, prefs);

  const huntTrack = spec.huntTrack || rec.huntTrack;
  const llm = await tryLlmBasketLetter(rec, cvBundle, prefs, huntTrack, mode);
  if (llm) return llm;

  if (allowTemplateFallback() && mode === 'day') {
    return templateFallbackLetter(rec, prefs, huntTrack);
  }

  const hint = basketLetterStrictMode()
    ? 'LLM не дал индивидуальное письмо — проверьте DS Lab/Ollama и пересоберите'
    : 'BASKET_LETTER_ALLOW_TEMPLATE_FALLBACK=1 только для аварийного режима';
  throw new Error(`индивидуальное письмо не получено для ${rec.company || rec.title || rec.id} — ${hint}`);
}

export { BASKET_CUSTOM_LETTERS };
