/**
 * Анкета с вариантами ответа (radio / checkbox), шкала 1–5 на hh.ru.
 */

import { formatQuestionLabel, normalizeQuestionLabel } from './questionnaire-labels.mjs';

/**
 * @param {unknown} question
 */
export function isChoiceQuestion(question) {
  const opts = question?.options;
  return Array.isArray(opts) && opts.length >= 2 && (question.type === 'radio' || question.type === 'checkbox');
}

/**
 * @param {string} label
 */
export function normalizeChoiceOptionLabel(label) {
  return String(label || '')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} answer
 * @param {Array<{ value?: string, label: string }>} options
 */
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

  const numOnly = a.match(/^(\d+)\s*$/);
  if (numOnly) {
    const byNum = options.find((o) => normalizeChoiceOptionLabel(o.label).startsWith(`${numOnly[1]} `));
    if (byNum) return byNum;
  }

  return null;
}

/**
 * @param {{ label: string, options?: Array<{ label: string }> }} question
 * @param {string} cvText
 */
export function suggestChoiceAnswerFromCv(question, cvText) {
  const opts = question.options || [];
  if (!opts.length) return '';

  const label = normalizeQuestionLabel(question.label);
  const cv = String(cvText || '').toLowerCase();

  const pick = (re) => {
    for (const opt of opts) {
      const ol = normalizeChoiceOptionLabel(opt.label);
      if (re.test(ol)) return ol;
    }
    for (const opt of opts) {
      const ol = normalizeChoiceOptionLabel(opt.label);
      const inner = ol.replace(/^\d+\s*[\(.]\s*/, '');
      if (re.test(inner)) return ol;
    }
    return '';
  };

  if (/devops|опыт\s+работы/i.test(label)) {
    if (/6\+|шесть\s+лет|более\s+6/i.test(cv) || /опыт.*(6|7|8|9|10)\s*(\+|\s*лет)/i.test(cv)) {
      return pick(/6\+|6\s*\+/) || pick(/опыт\s+6/i) || '';
    }
    if (/3[\s-–]*6|три.*шесть/i.test(cv)) {
      return pick(/3[\s-–]*6/) || '';
    }
    if (/1[\s-–]*2|год.*два/i.test(cv)) {
      return pick(/1[\s-–]*2/) || '';
    }
    return pick(/3[\s-–]*6/) || pick(/1[\s-–]*2/) || normalizeChoiceOptionLabel(opts[Math.min(2, opts.length - 1)].label);
  }

  if (/грейд|оцениваете\s+свои\s+навыки|junior|middle|senior/i.test(label)) {
    if (/senior|lead|тимлид/i.test(cv)) return pick(/senior|tech\s*lead|team\s*lead/i) || pick(/4\s*\(/i) || '';
    if (/middle|мидл/i.test(cv)) return pick(/middle/i) || pick(/2\s*\(/i) || '';
    if (/junior|джуниор/i.test(cv)) return pick(/junior/i) || pick(/1\s*\(/i) || '';
    return pick(/middle/i) || pick(/2\s*\(/i) || normalizeChoiceOptionLabel(opts[1]?.label || opts[0].label);
  }

  if (/qemu|kvm|vmware|виртуализац/i.test(label)) {
    if (/vmware|proxmox|esxi|vsphere/i.test(cv)) {
      return pick(/профессион|5\s*\(/i) || pick(/хорошо|4\s*\(/i) || '';
    }
    if (/гипервизор|virtual/i.test(cv)) {
      return pick(/хорошо|4\s*\(/i) || pick(/могу\s+объяснить|3\s*\(/i) || '';
    }
    return pick(/базов|2\s*\(/i) || pick(/могу\s+объяснить|3\s*\(/i) || '';
  }

  if (/формат\s+работы|рассматриваешь|офис|удален|гибрид/i.test(label)) {
    const pickRemote = () => pick(/удален/i) || pick(/remote/i) || '';
    const pickHybrid = () => pick(/гибрид/i) || pick(/hybrid/i) || '';
    const pickOffice = () => pick(/^офис/i) || '';
    if (/удален.*гибрид|гибрид.*удален|remote.*hybrid/i.test(cv)) {
      return pickRemote() || pickHybrid() || pickOffice() || '';
    }
    if (/удален|remote/i.test(cv)) return pickRemote() || pickHybrid() || '';
    if (/гибрид|hybrid/i.test(cv)) return pickHybrid() || pickRemote() || '';
    return pickRemote() || pickHybrid() || pickOffice() || normalizeChoiceOptionLabel(opts[0].label);
  }

  if (/да|нет|yes|no|сможешь|электронн|этк|трудов/i.test(label) && opts.length <= 3) {
    if (/да|yes|согласен|предостав/i.test(cv)) return pick(/^да|^yes/i) || normalizeChoiceOptionLabel(opts[0].label);
    return pick(/^да|^yes/i) || normalizeChoiceOptionLabel(opts[0].label);
  }

  return normalizeChoiceOptionLabel(opts[Math.min(2, opts.length - 1)].label);
}

/**
 * @param {{ label: string, options?: Array<{ label: string }> }} question
 * @param {string} cvText
 */
export function answerChoiceFromCvHeuristic(question, cvText) {
  if (!isChoiceQuestion(question)) return '';
  return suggestChoiceAnswerFromCv(question, cvText);
}
