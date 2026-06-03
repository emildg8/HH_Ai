import { estimateMonthlyUsd } from './salary-parse.mjs';
import {
  titleLooksDevOpsRole,
  titleLooksSupportRole,
  titleLooksTargetRole,
  isClearlyOverqualifiedTitle,
  titleLooksSeniorDevOpsTitle,
  textMentionsFirstSupportLineOnly,
  titleLooksL1HelpdeskRole,
  titleLooksNonItRole,
  titleLooksOffTargetFieldRole,
} from './role-classify.mjs';
import { parseWorkFormatMeta, passesWorkFormatRules } from './vacancy-work-format.mjs';

export {
  titleLooksDevOpsRole,
  titleLooksSupportRole,
  titleLooksTargetRole,
} from './role-classify.mjs';

function includesAny(text, patterns) {
  const t = text.toLowerCase();
  return patterns.some((p) => t.includes(String(p).toLowerCase()));
}

/** Есть непустой текст описания с карточки hh.ru. */
export function passesDescription(parsed) {
  const d = String(parsed.description ?? '').trim();
  if (d.length > 0) {
    return { pass: true, reason: 'Описание вакансии есть' };
  }
  return { pass: false, reason: 'Нет текста описания вакансии' };
}

/**
 * Запись очереди: есть сохранённый фрагмент описания (для списка в дашборде).
 */
export function recordHasDescription(item) {
  const d1 = String(item.descriptionForLlm ?? '').trim();
  const d2 = String(item.descriptionPreview ?? '').trim();
  return d1.length > 0 || d2.length > 0;
}

/** В summary сохранён текст ошибки LLM/OpenRouter (старые прогоны) — не показывать в списке дашборда. */
export function recordLlmSummaryLooksLikeError(item) {
  const s = String(item.geminiSummary ?? '').trim();
  if (!s) return false;
  if (/^Ошибка\s*(LLM|OpenRouter)/i.test(s)) return true;
  if (/\bLLM\s+\d{3}\b/i.test(s)) return true;
  if (/"code"\s*:\s*(402|403|429|502|503)/i.test(s)) return true;
  if (/rate\s*limit|at capacity|temporarily rate-limited|free-models-per/i.test(s)) return true;
  return false;
}

export function recordPassesLlmList(item) {
  return !recordLlmSummaryLooksLikeError(item);
}

export function passesNotFirstLineRole(parsed) {
  const focus = [parsed.title, parsed.description, parsed.employment]
    .filter(Boolean)
    .join('\n');
  if (textMentionsFirstSupportLineOnly(focus)) {
    return {
      pass: false,
      reason: 'В тексте указана 1-я линия поддержки (L1) — целевой уровень L2/L3',
    };
  }
  return { pass: true, reason: 'Не 1-я линия (L2/L3 допустимы)' };
}

/** Паттерны роли «разработчик» (не DevOps/SRE). Переопределяется в preferences.json → excludeDeveloperRolePatterns */
export const DEFAULT_DEVELOPER_ROLE_PATTERNS = [
  'разработчик',
  'developer',
  'программист',
  'programmer',
  'fullstack',
  'full-stack',
  'full stack',
  'software engineer',
  'software developer',
  'веб-разработ',
  'web developer',
  'backend developer',
  'backend-разработ',
  'frontend developer',
  'frontend-разработ',
  'mobile developer',
  'ios разработ',
  'android разработ',
  'python разработ',
  'java разработ',
  'golang разработ',
  'go разработчик',
  '.net разработ',
  'c++ разработ',
  'node.js разработ',
  'react разработ',
  'vue разработ',
  'angular разработ',
];

/**
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function textMentionsDeveloperRole(text, patterns = DEFAULT_DEVELOPER_ROLE_PATTERNS) {
  const low = String(text || '').toLowerCase();
  if (!low.trim()) return false;
  return patterns.some((p) => {
    const needle = String(p).toLowerCase().trim();
    return needle.length > 0 && low.includes(needle);
  });
}

/**
 * @param {object} prefs
 */
export function developerRolePatterns(prefs) {
  const custom = prefs?.excludeDeveloperRolePatterns;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return DEFAULT_DEVELOPER_ROLE_PATTERNS;
}

export function isDeveloperRoleFilterEnabled(prefs) {
  return prefs?.excludeDeveloperRoles !== false;
}

export function passesNotDeveloperRole(parsed, prefs) {
  if (!isDeveloperRoleFilterEnabled(prefs)) {
    return { pass: true, reason: 'Фильтр разработчиков отключён' };
  }
  if (titleLooksTargetRole(parsed.title)) {
    return { pass: true, reason: 'Целевая роль в названии (DevOps / поддержка / TAM)' };
  }
  const patterns = developerRolePatterns(prefs);
  const focus = [parsed.title, parsed.description, parsed.employment].filter(Boolean).join('\n');
  if (textMentionsDeveloperRole(focus, patterns)) {
    return {
      pass: false,
      reason: 'Вакансия на роль разработчика (разработчик / developer / программист и т.п.)',
    };
  }
  return { pass: true, reason: 'Не похоже на вакансию разработчика' };
}

/** Senior / Lead — не Middle/Junior. preferences.json → excludeSeniorRolePatterns */
export const DEFAULT_SENIOR_ROLE_PATTERNS = [
  'senior',
  'сеньор',
  '(senior)',
  'middle/senior',
  'middle+ / senior',
  'старший devops',
  'старший sre',
  'ведущий devops',
  'ведущий sre',
  'tech lead',
  'team lead',
  'techlead',
  'техлид',
  'тимлид',
  'тим лид',
  'тех лид',
  'lead devops',
  'lead sre',
  'lead golang',
  'lead go',
  'golang lead',
  'go lead',
  'lead ml',
  'ml lead',
  'lead python',
  'lead java',
];

const SENIOR_LEAD_REGEX = [
  /\bsenior\b/i,
  /\bсеньор\b/i,
  /\btech\s*lead\b/i,
  /\bteam\s*lead\b/i,
  /\btechlead\b/i,
  /\bтех\s*лид\b/i,
  /\bтим\s*лид\b/i,
  /\bтехлид\b/i,
  /\bтимлид\b/i,
  /\blead\s+(go|golang|python|java|ml|mlops|devops|sre|backend|frontend)\b/i,
  /\b(go|golang|python|java|ml|mlops|devops|sre)\s+lead\b/i,
  /\bведущий\s+(разработ|инженер|devops|sre|ml)/i,
  /\bстарший\s+(разработ|инженер|devops|sre)/i,
];

/**
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function textMentionsSeniorRole(text, patterns = DEFAULT_SENIOR_ROLE_PATTERNS) {
  const raw = String(text || '');
  if (!raw.trim()) return false;
  if (SENIOR_LEAD_REGEX.some((re) => re.test(raw))) return true;
  const low = raw.toLowerCase();
  return patterns.some((p) => {
    const needle = String(p).toLowerCase().trim();
    return needle.length > 0 && low.includes(needle);
  });
}

/**
 * @param {object} prefs
 */
export function seniorRolePatterns(prefs) {
  const custom = prefs?.excludeSeniorRolePatterns;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return DEFAULT_SENIOR_ROLE_PATTERNS;
}

export function isSeniorRoleFilterEnabled(prefs) {
  return prefs?.excludeSeniorRoles !== false;
}

export function passesNotSeniorRole(parsed, prefs) {
  if (!isSeniorRoleFilterEnabled(prefs)) {
    return { pass: true, reason: 'Фильтр Senior отключён' };
  }
  if (isClearlyOverqualifiedTitle(parsed.title)) {
    return {
      pass: false,
      reason: 'Уровень выше целевого (главный / chief / lead DevOps и т.п.)',
    };
  }
  if (titleLooksSupportRole(parsed.title) && !titleLooksDevOpsRole(parsed.title)) {
    return { pass: true, reason: 'Поддержка L2/L3 — senior-фильтр не режет' };
  }
  const patterns = seniorRolePatterns(prefs);
  const focus = [parsed.title, parsed.description, parsed.employment].filter(Boolean).join('\n');
  if (titleLooksSeniorDevOpsTitle(parsed.title) || textMentionsSeniorRole(focus, patterns)) {
    return {
      pass: false,
      reason: 'Вакансия уровня Senior / Lead по DevOps/SRE',
    };
  }
  return { pass: true, reason: 'Уровень подходит (junior+/middle или L2/L3)' };
}

/** Вакансии 1С / ИТ-архитектор 1С — не DevOps. preferences.json → exclude1CRolePatterns */
export const DEFAULT_1C_ROLE_PATTERNS = [
  '1с:предприятие',
  '1с: предприятие',
  '1c enterprise',
  'архитектор 1с',
  'архитектор 1c',
  'ит-архитектор 1с',
  'ит-архитектор 1c',
  'ит архитектор 1с',
  'программист 1с',
  'разработчик 1с',
  'консультант 1с',
  'внедрение 1с',
  'erp 1с',
  ' платформа 1с',
  ' платформе 1с',
];

const ONE_C_REGEX = [
  /\b1\s*[-:.]?\s*[сc]\b/i,
  /1[сc]:/i,
  /1[\s.-]?[сc][\s.-]?предприят/i,
  /\b(ит[-\s]?)?архитектор\b[^.\n]{0,80}\b1\s*[-.]?\s*[сc]\b/i,
  /\b1\s*[-.]?\s*[сc]\b[^.\n]{0,40}\bархитектор\b/i,
];

/**
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function textMentions1CRole(text, patterns = DEFAULT_1C_ROLE_PATTERNS) {
  const raw = String(text || '');
  if (!raw.trim()) return false;
  if (ONE_C_REGEX.some((re) => re.test(raw))) return true;
  const low = raw.toLowerCase().replace(/1c/g, '1с');
  if (/\b1с\b/.test(low) || low.includes('1с:')) return true;
  if (/архитектор/i.test(low) && /1\s*[-.]?\s*[сc]/i.test(raw)) return true;
  if (/ит[-\s]?архитектор/i.test(low) && /1\s*[-.]?\s*[сc]/i.test(raw)) return true;
  return patterns.some((p) => {
    const needle = String(p).toLowerCase().trim();
    return needle.length > 0 && low.includes(needle.replace(/1c/g, '1с'));
  });
}

/**
 * @param {object} prefs
 */
export function oneCRolePatterns(prefs) {
  const custom = prefs?.exclude1CRolePatterns;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return DEFAULT_1C_ROLE_PATTERNS;
}

export function is1CRoleFilterEnabled(prefs) {
  return prefs?.exclude1CRoles !== false;
}

export function passesNot1CRole(parsed, prefs) {
  if (!is1CRoleFilterEnabled(prefs)) {
    return { pass: true, reason: 'Фильтр 1С отключён' };
  }
  const patterns = oneCRolePatterns(prefs);
  const focus = [parsed.title, parsed.description, parsed.employment].filter(Boolean).join('\n');
  if (textMentions1CRole(focus, patterns)) {
    return {
      pass: false,
      reason: 'Вакансия по 1С / ИТ-архитектор 1С (не DevOps-роль)',
    };
  }
  return { pass: true, reason: 'Без признаков вакансии 1С' };
}

function queueRecordTextBlob(item) {
  const tags = Array.isArray(item.geminiTags) ? item.geminiTags.join(' ') : '';
  return [
    item.title,
    item.company,
    item.searchQuery,
    item.descriptionPreview,
    item.descriptionForLlm,
    item.geminiSummary,
    item.geminiRisks,
    tags,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Запись очереди: скрыть вакансии 1С в дашборде. */
export function recordPassesNot1C(item, prefs) {
  if (!is1CRoleFilterEnabled(prefs)) return true;
  return !textMentions1CRole(queueRecordTextBlob(item), oneCRolePatterns(prefs));
}

/** Запись очереди: скрыть Senior в дашборде. */
export function recordPassesNotSenior(item, prefs) {
  if (!isSeniorRoleFilterEnabled(prefs)) return true;
  if (isClearlyOverqualifiedTitle(item.title)) return false;
  if (titleLooksSupportRole(item.title) && !titleLooksDevOpsRole(item.title)) return true;
  if (titleLooksSeniorDevOpsTitle(item.title)) return false;
  const patterns = seniorRolePatterns(prefs);
  const blob = queueRecordTextBlob(item);
  if (textMentionsSeniorRole(blob, patterns) && titleLooksDevOpsRole(item.title)) return false;
  return true;
}

/** Запись очереди: скрыть вакансии-разработчика в дашборде. */
export function recordPassesNotDeveloper(item, prefs) {
  if (!isDeveloperRoleFilterEnabled(prefs)) return true;
  if (titleLooksTargetRole(item.title)) return true;
  const patterns = developerRolePatterns(prefs);
  const tags = Array.isArray(item.geminiTags) ? item.geminiTags.join(' ') : '';
  const blob = [
    item.title,
    item.company,
    item.searchQuery,
    item.descriptionPreview,
    item.descriptionForLlm,
    item.geminiSummary,
    tags,
  ]
    .filter(Boolean)
    .join('\n');
  return !textMentionsDeveloperRole(blob, patterns);
}

/** Запись очереди: промышленный / телеком / продажи — не целевой IT-профиль. */
export function recordPassesNotFieldRole(item) {
  return !titleLooksOffTargetFieldRole(item?.title || '');
}

export function recordHasRoleFilterBypass(item) {
  return Boolean(item?.roleFilterBypass);
}

/** «Подходят» / «Отклонённые» — решение пользователя, не режем список порогом зарплаты и ролями. */
export function isDecidedQueueStatus(status) {
  return status === 'rejected' || status === 'approved';
}

/** Видна в основной очереди (не «Скрытые»): bypass или проходит все фильтры роли. */
export function recordPassesRoleFiltersForList(item, prefs) {
  if (recordHasRoleFilterBypass(item)) return true;
  return (
    recordPassesNotFirstLine(item) &&
    recordPassesNotDeveloper(item, prefs) &&
    recordPassesNotSenior(item, prefs) &&
    recordPassesNot1C(item, prefs) &&
    recordPassesNotFieldRole(item)
  );
}

/** Почему вакансия скрыта фильтрами роли в дашборде (пустой массив = видна в основном списке). */
export function recordHiddenRoleReasons(item, prefs) {
  if (recordHasRoleFilterBypass(item)) return [];
  const reasons = [];
  if (!recordPassesNotFirstLine(item)) reasons.push('1-я линия');
  if (!recordPassesNotSenior(item, prefs)) reasons.push('Senior/Lead');
  if (!recordPassesNot1C(item, prefs)) reasons.push('1С');
  if (!recordPassesNotDeveloper(item, prefs)) reasons.push('разработчик');
  if (!recordPassesNotFieldRole(item)) reasons.push('не IT');
  return reasons;
}

export function recordIsHiddenByRoleFilters(item, prefs) {
  return recordHiddenRoleReasons(item, prefs).length > 0;
}

/** Запись очереди: скрыть вакансии с 1-й линией в заголовке/описании/запросе. */
export function recordPassesNotFirstLine(item) {
  const tags = Array.isArray(item.geminiTags) ? item.geminiTags.join(' ') : '';
  const blob = [
    item.title,
    item.company,
    item.searchQuery,
    item.descriptionPreview,
    item.descriptionForLlm,
    item.geminiSummary,
    item.geminiRisks,
    tags,
  ]
    .filter(Boolean)
    .join('\n');
  return !textMentionsFirstSupportLineOnly(blob);
}

export function passesRemote(textBlob, prefs) {
  const meta = parseWorkFormatMeta(textBlob, prefs);
  const wf = passesWorkFormatRules(meta, prefs);
  return { pass: wf.pass, reason: wf.reason, workFormat: meta };
}

export function passesSalary(salaryRaw, prefs) {
  const est = estimateMonthlyUsd(salaryRaw, prefs.rubPerUsd || 98);
  if (!est.ok) {
    if (prefs.allowUnknownSalary === false) {
      return {
        pass: false,
        reason: 'Зарплата не указана — при allowUnknownSalary:false вакансия отсеивается',
        estimate: est,
      };
    }
    return {
      pass: true,
      reason: 'Зарплата не указана или не распознана — порог minMonthlyRub/USD применяется только к разобранной вилке',
      estimate: est,
    };
  }

  const rub = prefs.rubPerUsd || 98;
  let minNeed;
  if (prefs.minMonthlyRub != null && Number(prefs.minMonthlyRub) > 0) {
    minNeed = Number(prefs.minMonthlyRub) / rub;
  } else {
    minNeed = prefs.minMonthlyUsd ?? 1500;
  }
  if (est.minUsd >= minNeed) {
    return { pass: true, reason: `Нижняя оценка ≥ ${minNeed} USD/мес`, estimate: est };
  }
  if (est.maxUsd >= minNeed) {
    return {
      pass: true,
      reason: `Вилка задевает ≥ ${minNeed} USD/мес (верх ${est.maxUsd})`,
      estimate: est,
    };
  }

  return {
    pass: false,
    reason: `Оценка ниже порога ${minNeed} USD/мес (≈${est.minUsd}–${est.maxUsd})`,
    estimate: est,
  };
}

/**
 * Запись очереди (дашборд): скрыть, если верх вилки в ₽ ниже порога.
 * Без разобранной вилки (`salaryEstimate.ok`) карточки не режем — только «явно ниже порога».
 */
export function recordPassesMinSalary(item, prefs) {
  const rub = prefs.rubPerUsd || 98;
  let minRub = 0;
  if (prefs.minMonthlyRub != null && Number(prefs.minMonthlyRub) > 0) {
    minRub = Number(prefs.minMonthlyRub);
  } else if (prefs.minMonthlyUsd != null && Number(prefs.minMonthlyUsd) > 0) {
    minRub = Number(prefs.minMonthlyUsd) * rub;
  }
  if (!minRub || minRub <= 0) return true;

  const est = item.salaryEstimate;
  if (!est || !est.ok) {
    return true;
  }
  const maxRub = (est.maxUsd ?? 0) * rub;
  return maxRub >= minRub;
}

/** Роли вне DevOps/SRE/инфраструктуры — отсекаем по заголовку (поиск и harvest). */
export const DEFAULT_IRRELEVANT_TITLE_PATTERNS = [
  'android',
  'kotlin multiplat',
  'ios разработ',
  'swift разработ',
  'flutter разработ',
  'ml engineer',
  'machine learning engineer',
  'data scientist',
  'data science',
  'nlp engineer',
  'computer vision',
  'тестировщик',
  'qa engineer',
  'manual qa',
  'автотестировщик',
  'product manager',
  'продакт-менеджер',
  'project manager',
  'менеджер проект',
  'ux designer',
  'ui designer',
  'графический дизайнер',
  'маркетолог',
  'sales manager',
  'account manager',
  'hr manager',
  'рекрутер',
  'бухгалтер',
  'юрист',
  'copywriter',
  'копирайтер',
  'аналитик данных',
  'data analyst',
  'bi analyst',
  'php разработ',
  'ruby разработ',
  'c# разработ',
  'c++ разработ',
  '.net разработ',
  'node.js разработ',
  'react разработ',
  'vue разработ',
  'angular разработ',
  'сервисный инженер',
  'геодезист',
  'инженер пто',
  'инженер-сметчик',
  'асутп',
  'кипиа',
  'гидротех',
  'теплотех',
  'пусконалад',
  'сетевой инженер',
  'network engineer',
  'solution sales',
  'presale',
  'пресейл',
];

/**
 * @param {object} prefs
 * @returns {string[]}
 */
export function irrelevantTitlePatterns(prefs) {
  const custom = prefs?.excludeIrrelevantTitlePatterns;
  if (Array.isArray(custom) && custom.length > 0) {
    return [...new Set([...DEFAULT_IRRELEVANT_TITLE_PATTERNS, ...custom.map(String)])];
  }
  return DEFAULT_IRRELEVANT_TITLE_PATTERNS;
}

export function isIrrelevantTitleFilterEnabled(prefs) {
  return prefs?.excludeIrrelevantTitles !== false;
}

/**
 * @param {string} title
 * @param {string[]} patterns
 */
export function textMentionsIrrelevantTitle(title, patterns = DEFAULT_IRRELEVANT_TITLE_PATTERNS) {
  const low = String(title || '').toLowerCase();
  if (!low.trim()) return false;
  if (titleLooksOffTargetFieldRole(title)) return true;
  if (titleLooksTargetRole(title)) return false;
  if (titleLooksNonItRole(title)) return true;
  if (/\bmlops\b/i.test(low)) return false;
  return patterns.some((p) => {
    const needle = String(p).toLowerCase().trim();
    return needle.length > 0 && low.includes(needle);
  });
}

/**
 * Быстрый фильтр по заголовку (выдача поиска, до открытия карточки).
 * @param {string} title
 * @param {object} prefs
 */
export function runTitleOnlyFilters(title, prefs) {
  const parsed = { title: title || '', description: '', employment: '' };

  if (isIrrelevantTitleFilterEnabled(prefs) && textMentionsIrrelevantTitle(title, irrelevantTitlePatterns(prefs))) {
    return {
      pass: false,
      stage: 'irrelevantTitle',
      reason: 'Заголовок вне целевых ролей (DevOps / поддержка L2+ / TAM)',
    };
  }

  const notDev = passesNotDeveloperRole(parsed, prefs);
  if (!notDev.pass) {
    return { pass: false, stage: 'developerRole', reason: notDev.reason };
  }

  const notSenior = passesNotSeniorRole(parsed, prefs);
  if (!notSenior.pass) {
    return { pass: false, stage: 'seniorRole', reason: notSenior.reason };
  }

  const not1c = passesNot1CRole(parsed, prefs);
  if (!not1c.pass) {
    return { pass: false, stage: 'oneCRole', reason: not1c.reason };
  }

  if (titleLooksNonItRole(title)) {
    return { pass: false, stage: 'nonIt', reason: 'Роль вне IT (продавец и т.п.)' };
  }

  if (isClearlyOverqualifiedTitle(title)) {
    return { pass: false, stage: 'overqualified', reason: 'Слишком высокий уровень в названии' };
  }

  if (textMentionsFirstSupportLineOnly(title)) {
    return {
      pass: false,
      stage: 'firstLine',
      reason: 'В названии только 1-я линия (L1)',
    };
  }

  if (titleLooksL1HelpdeskRole(title)) {
    return {
      pass: false,
      stage: 'l1Helpdesk',
      reason: 'L1 поддержка — вы ищете L2/L3 или DevOps, не операторов/helpdesk L1',
    };
  }

  return { pass: true, reason: 'Заголовок проходит предфильтр' };
}

export function runHardFilters(parsed, prefs) {
  const titleOnly = runTitleOnlyFilters(parsed.title || '', prefs);
  if (!titleOnly.pass) {
    return titleOnly;
  }

  const desc = passesDescription(parsed);
  if (!desc.pass) {
    return { pass: false, stage: 'description', ...desc };
  }

  const firstLine = passesNotFirstLineRole(parsed);
  if (!firstLine.pass) {
    return { pass: false, stage: 'firstLine', ...firstLine };
  }

  const notDev = passesNotDeveloperRole(parsed, prefs);
  if (!notDev.pass) {
    return { pass: false, stage: 'developerRole', ...notDev };
  }

  const notSenior = passesNotSeniorRole(parsed, prefs);
  if (!notSenior.pass) {
    return { pass: false, stage: 'seniorRole', ...notSenior };
  }

  const not1c = passesNot1CRole(parsed, prefs);
  if (!not1c.pass) {
    return { pass: false, stage: 'oneCRole', ...not1c };
  }

  const blob = [
    parsed.title,
    parsed.company,
    parsed.salaryRaw,
    parsed.employment,
    parsed.address,
    parsed.description,
  ]
    .join('\n')
    .toLowerCase();

  const remote = passesRemote(blob, prefs);
  if (!remote.pass) {
    return { pass: false, stage: 'remote', ...remote };
  }

  const salary = passesSalary(parsed.salaryRaw, prefs);
  if (!salary.pass) {
    return { pass: false, stage: 'salary', ...salary };
  }

  const workFormatNote = formatWorkFormatNote(remote.workFormat);

  return {
    pass: true,
    remoteReason: remote.reason,
    workFormatNote,
    workFormat: remote.workFormat,
    salaryReason: salary.reason,
    salaryEstimate: salary.estimate,
  };
}

/** @param {ReturnType<typeof parseWorkFormatMeta>} meta */
export function formatWorkFormatNote(meta) {
  if (!meta) return '';
  const parts = [meta.format];
  if (meta.city) parts.push(meta.city);
  if (meta.timezone) parts.push(meta.timezone);
  if (meta.hasRemote) parts.push('удалёнка явно');
  if (meta.officeOnly) parts.push('только офис');
  return parts.filter(Boolean).join(' · ');
}
