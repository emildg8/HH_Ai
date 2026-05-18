/** Дублирует lib/questionnaire-labels.mjs для дашборда (ESM в браузере). */

const GENERIC_LABEL_RE = /^текстовое\s+поле\s*\d*$/i;

export function isGenericQuestionLabel(label) {
  const t = String(label || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (GENERIC_LABEL_RE.test(t)) return true;
  if (t.length < 8 && !/\?/.test(t)) return true;
  return false;
}

export function meaningfulQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  const out = [];
  for (const q of questions) {
    if (!q || isGenericQuestionLabel(q.label)) continue;
    out.push({ ...q, index: out.length + 1 });
  }
  return out;
}

export function itemHasMeaningfulQuestionnaire(item) {
  return meaningfulQuestions(item?.hhApply?.questionnaire?.questions).length > 0;
}

export function itemQuestionnaireNeedsProbe(item) {
  if (!item?.hhApply?.questionnaire) return false;
  if (item.hhApply.questionnaire.status !== 'pending_manual') return false;
  return !itemHasMeaningfulQuestionnaire(item);
}
