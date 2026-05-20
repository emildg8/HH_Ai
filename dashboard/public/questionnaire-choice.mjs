/** Синхронизировать с lib/questionnaire-choice.mjs */

export function isChoiceQuestion(question) {
  const opts = question?.options;
  return Array.isArray(opts) && opts.length >= 2 && (question.type === 'radio' || question.type === 'checkbox');
}

export function normalizeChoiceOptionLabel(label) {
  return String(label || '')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchAnswerToOption(answer, options) {
  const a = normalizeChoiceOptionLabel(answer);
  if (!a || !options?.length) return null;
  for (const opt of options) {
    const ol = normalizeChoiceOptionLabel(opt.label);
    if (!ol) continue;
    if (ol === a || ol.toLowerCase() === a.toLowerCase()) return opt;
  }
  const aLow = a.toLowerCase();
  for (const opt of options) {
    const ol = normalizeChoiceOptionLabel(opt.label).toLowerCase();
    if (!ol) continue;
    if (ol.includes(aLow) || aLow.includes(ol)) return opt;
    if (/удален/.test(aLow) && /удален/.test(ol)) return opt;
    if (/гибрид/.test(aLow) && /гибрид/.test(ol)) return opt;
    if (/офис/.test(aLow) && /офис/.test(ol)) return opt;
    const aNum = a.match(/^(\d+)/);
    const oNum = ol.match(/^(\d+)/);
    if (aNum && oNum && aNum[1] === oNum[1]) return opt;
  }
  return null;
}
