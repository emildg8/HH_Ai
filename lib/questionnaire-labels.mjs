/** Проверка подписей вопросов анкеты (отсекаем «Текстовое поле N»). */

const GENERIC_LABEL_RE =
  /^текстовое\s+поле\s*\d*$/i;

/**
 * @param {string} label
 */
export function isGenericQuestionLabel(label) {
  const t = String(label || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (GENERIC_LABEL_RE.test(t)) return true;
  if (t.length < 8 && !/\?/.test(t)) return true;
  return false;
}

/**
 * @param {Array<{ index?: number, label?: string, type?: string, required?: boolean }>} questions
 */
export function meaningfulQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  const out = [];
  for (const q of questions) {
    if (!q || isGenericQuestionLabel(q.label)) continue;
    out.push({ ...q, index: out.length + 1 });
  }
  return out;
}

/**
 * @param {object} item
 */
export function itemHasMeaningfulQuestionnaire(item) {
  const qs = item?.hhApply?.questionnaire?.questions;
  return meaningfulQuestions(qs).length > 0;
}

/**
 * @param {object} item
 */
export function itemQuestionnaireNeedsProbe(item) {
  if (!item?.hhApply?.questionnaire) return false;
  if (item.hhApply.questionnaire.status !== 'pending_manual') return false;
  return !itemHasMeaningfulQuestionnaire(item);
}
