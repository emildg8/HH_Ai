/**
 * Анкета с вариантами ответа (radio / checkbox), шкала 1–5 на hh.ru.
 */

import { formatQuestionLabel, normalizeQuestionLabel } from './questionnaire-labels.mjs';
import { answerLlmRadioWithDisclosure } from './questionnaire-disclosure.mjs';

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

  if (/smoke|критический модуль|не упал/i.test(label)) {
    return pick(/smoke/i) || pick(/основн.*сценари/i) || '';
  }
  if (/регресс|связанн.*систем|минимизац.*риск/i.test(label)) {
    return pick(/регрессионн/i) || pick(/интеграц/i) || pick(/затронут/i) || '';
  }
  if (/тест-дизайн|оптимизац.*набор|эквивалент|попарн/i.test(label)) {
    return pick(/тест-дизайн|эквивалент|попарн/i) || '';
  }
  if (/новая функция.*первую очередь|что тестируете в первую/i.test(label)) {
    return pick(/основн.*сценари|production/i) || pick(/smoke/i) || '';
  }
  if (/бонус|неправильно.*тестирован/i.test(label)) {
    return pick(/матриц/i) || pick(/соберу данн|лог/i) || pick(/гранич/i) || '';
  }
  if (/инструмент.*оптимизац|практика.*оптимизац/i.test(label) && /тестов.*набор/i.test(label)) {
    return pick(/тест-дизайн|эквивалент|попарн/i) || pick(/чек-лист/i) || '';
  }
  if (/метрик.*A\/B|проблема не массовая|low priority/i.test(label) || /соберу данн.*лог/i.test(label)) {
    return pick(/соберу данн|лог|тикет/i) || pick(/метрик/i) || '';
  }
  if (/подключиться.*ТО|техническ.*описан/i.test(label)) {
    return pick(/до.*утвержд|проработк|ранн/i) || pick(/сразу после согласован/i) || '';
  }
  if (/когда и какие автотест/i.test(label)) {
    return pick(/ранн|параллельн|до.*релиз/i) || pick(/не только после/i) || '';
  }
  if (/готова к релизу|готов.*к релизу/i.test(label)) {
    return pick(/основн.*сценари/i) || pick(/критер/i) || pick(/деградац/i) || '';
  }
  if (/приоритет автоматизац/i.test(label)) {
    return pick(/критич|риск|частот/i) || pick(/основн/i) || '';
  }
  if (/минимизировать время прогона/i.test(label)) {
    return (
      pick(/пирамид|разделить тесты по уровням/i) ||
      pick(/параллел|селектив|smoke|приоритиз/i) ||
      ''
    );
  }
  if (/участвовать в разработке фичи/i.test(label)) {
    return pick(/ранн|до начала|согласован/i) || pick(/в ходе разработки/i) || '';
  }
  if (/белым ящиком|структурн/i.test(label) && /тестирован/i.test(label)) {
    return pick(/белым ящиком|структурн/i) || '';
  }

  if (/\bllm\b|нейросет|chatgpt|openai|промт|prompt/i.test(label)) {
    const a = answerLlmRadioWithDisclosure({ label, options: opts });
    if (a) return a;
    if (/пользуетесь|используете/i.test(label)) {
      return pick(/постоянно/i) || pick(/ежедневно/i) || pick(/иногда/i) || '';
    }
    if (/развернуть|развернёте|deploy|агент/i.test(label)) {
      return pick(/^да/i) || pick(/нет,\s*но\s*теперь|научусь/i) || pick(/нет/i) || '';
    }
    if (/промт|prompt|инжиниринг/i.test(label)) {
      return pick(/^да/i) || pick(/готов/i) || '';
    }
    if (/как\s+работают|знаете/i.test(label)) {
      return pick(/примерно/i) || pick(/^да/i) || pick(/нет/i) || '';
    }
    return pick(/постоянно/i) || pick(/примерно/i) || pick(/^да/i) || '';
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
