/**
 * Оценка и автоподготовка сопроводительных (без LLM).
 */

import { assessLetterQuality } from './letter-quality.mjs';
import { prepareCoverLetterForSend } from './cover-letter-prepare.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { enrichLetterQualityForApi, pickBestVariantIndex } from './letter-score.mjs';
export { pickBestVariantIndex };

/** @type {Record<string, string[]>} */
const HINTS_BY_REASON = {
  'письмо пустое': ['Утвердите текст или сгенерируйте черновик'],
  'письмо не утверждено': ['Сгенерируйте письмо и нажмите «Утвердить»'],
  'письмо слишком короткое': [
    'Добавьте 2–3 факта из резюме с цифрами',
    'Упомяните стек или задачи из описания вакансии',
  ],
  'письмо слишком длинное': ['Сократите до 4–7 предложений, уберите повторы'],
  'письмо содержит плейсхолдер/черновик': ['Замените шаблонные фразы на конкретику по вакансии'],
  'письмо не отражает профиль роли вакансии': [
    'Впишите 1–2 термина из заголовка (DevOps/Data/Support)',
    'Или нажмите «Подготовить» — добавится фраза под роль',
  ],
  'слишком общее письмо без фактов': ['Добавьте метрики, стек и привязку к требованиям вакансии'],
  'нет цифр/метрик из опыта': ['Вставьте цифры из резюме: годы, %, объём обращений'],
};

/**
 * @param {string} reason
 * @returns {string[]}
 */
export function letterQualityHints(reason) {
  const r = String(reason || '').toLowerCase();
  for (const [key, hints] of Object.entries(HINTS_BY_REASON)) {
    if (r.includes(key)) return hints;
  }
  return ['Перегенерируйте письмо или отредактируйте вручную под требования вакансии'];
}

/**
 * @param {object} rec
 * @param {string} letter
 * @param {string} [resumeRole]
 * @param {object} [prefs]
 */
export function evaluateLetterQuality(rec, letter, resumeRole, prefs = {}) {
  const role = resumeRole || classifyVacancyResumeRole(rec);
  const raw = String(letter || '').replace(/\s+/g, ' ').trim();
  const prepared = prepareCoverLetterForSend(rec, raw, role, prefs);
  const rawCheck = assessLetterQuality(rec, raw, role, prefs);
  const preparedCheck =
    prepared === raw ? rawCheck : assessLetterQuality(rec, prepared, role, prefs);
  const fixable = !rawCheck.pass && preparedCheck.pass;
  const changed = prepared !== raw;

  return enrichLetterQualityForApi({
    role,
    pass: preparedCheck.pass,
    rawPass: rawCheck.pass,
    fixable,
    changed,
    reason: preparedCheck.pass
      ? fixable
        ? 'ok после подготовки'
        : preparedCheck.reason
      : preparedCheck.reason || rawCheck.reason,
    rawReason: rawCheck.reason,
    score: preparedCheck.score ?? 0,
    prepared,
    hints: preparedCheck.pass && !fixable ? [] : letterQualityHints(preparedCheck.reason || rawCheck.reason),
  });
}

/**
 * Сохраняет подготовленный текст в approvedText, если он отличается и проходит проверку.
 * @param {object} rec
 * @param {object} [prefs]
 * @returns {{ ok: boolean, improved: boolean, letter: string, quality: object, reason?: string }}
 */
export function improveApprovedLetterForVacancy(rec, prefs = {}) {
  const letter = String(rec?.coverLetter?.approvedText || '').trim();
  if (!letter) {
    return { ok: false, improved: false, letter: '', quality: null, reason: 'письмо не утверждено' };
  }
  const quality = evaluateLetterQuality(rec, letter, undefined, prefs);
  if (!quality.pass) {
    return {
      ok: false,
      improved: false,
      letter,
      quality,
      reason: quality.reason,
    };
  }
  const improved = quality.changed;
  return {
    ok: true,
    improved,
    letter: quality.prepared,
    quality,
    reason: improved ? 'подготовлено' : 'уже ок',
  };
}

/**
 * @param {object[]} records
 * @param {object} [prefs]
 * @param {{ limit?: number, onUpdate?: (id: string, coverLetter: object) => void }} [opts]
 */
export function bulkImproveApprovedLetters(records, prefs = {}, opts = {}) {
  const limit = Math.max(1, Math.min(500, Number(opts.limit) || 200));
  let scanned = 0;
  let improved = 0;
  let alreadyOk = 0;
  let failed = 0;
  /** @type {Array<{ id: string, title: string, reason: string }>} */
  const samples = [];

  for (const rec of records) {
    if (rec?.coverLetter?.status !== 'approved') continue;
    if (scanned >= limit) break;
    scanned++;
    const result = improveApprovedLetterForVacancy(rec, prefs);
    if (!result.ok) {
      failed++;
      if (samples.length < 5) {
        samples.push({
          id: rec.id,
          title: String(rec.title || rec.id || '').slice(0, 80),
          reason: result.reason || 'не удалось',
        });
      }
      continue;
    }
    if (result.improved) {
      improved++;
      const now = new Date().toISOString();
      const coverLetter = {
        ...rec.coverLetter,
        approvedText: result.letter,
        updatedAt: now,
      };
      opts.onUpdate?.(rec.id, coverLetter);
    } else {
      alreadyOk++;
    }
  }

  return { scanned, improved, alreadyOk, failed, samples };
}

