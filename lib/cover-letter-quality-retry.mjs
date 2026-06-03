/**
 * Повтор генерации, если варианты не проходят evaluateLetterQuality.
 */

import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { buildVacancyFocusBlock } from './cover-letter-vacancy-focus.mjs';
import { getLetterStructureRules } from './cover-letter-role-prompt.mjs';

/**
 * @param {string[]} variants
 * @param {object} record
 * @param {string} role
 * @param {object} prefs
 */
export function anyVariantPassesQuality(variants, record, role, prefs) {
  const list = Array.isArray(variants) ? variants : [];
  if (!list.length) return false;
  // rawPass: без автокрючка prepare — иначе слабый LLM-текст ложно «проходит»
  return list.some((v) => evaluateLetterQuality(record, String(v), role, prefs).rawPass);
}

/**
 * @param {object} record
 * @param {string} desc
 * @param {number} variantCount
 * @param {string} resumeRole
 */
export function buildQualityRetryUserPrompt(record, desc, variantCount, resumeRole) {
  const title = String(record?.title || 'позицию').trim();
  const focus = buildVacancyFocusBlock(record, desc);
  const structure = getLetterStructureRules(resumeRole, record);
  return `Предыдущие варианты НЕ прошли проверку качества (мало фактов / нет терминов роли).

Напиши ${variantCount} НОВЫХ сопроводительных на русском для «${title}».

Жёсткие требования:
- минимум 2 цифры/метрики из резюме;
- минимум 1 термин из заголовка вакансии (в тексте, не в скобках);
- 120–1200 символов каждый вариант;
- без «готов обсудить» без фактов.

${structure}

${focus ? `${focus}\n` : ''}

Формат: только JSON {"variants":["...", ...]} — ровно ${variantCount} строк.`;
}
