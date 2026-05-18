import { estimateMonthlyUsd } from './salary-parse.mjs';

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

/** 1-я линия / L1 в контексте поддержки (hh.ru). Без \\b у кириллицы: в JS \\b — только ASCII [A-Za-z0-9_]. */
function textMentionsFirstSupportLine(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  const low = t.toLowerCase();

  // «1 линия», «1-линия», «(1 линия, Битрикс24)»; (?<![0-9]) — не цеплять «11 линия»
  if (/(?<![0-9])1\s*[-–]?\s*линия/i.test(t)) return true;
  if (/1\s*[-–]я\s+линия/i.test(t)) return true;
  if (/первая\s+линия/i.test(low)) return true;
  // «1-линии», «1 линии» (падеж), как в тексте модели
  if (/(?<![0-9])1\s*[-–]?\s*линии/i.test(t)) return true;
  if (/1[-\u2011\u2012\u2013]\s*линии/i.test(t)) return true;

  if (/линия\s*l1/i.test(low)) return true;
  if (/уровня\s+l1/i.test(low)) return true;
  if (/поддержки\s+l1/i.test(low)) return true;
  if (/поддержк[аи]\s+l1/i.test(low)) return true;
  if (/\(\s*l1\s*\)/i.test(t)) return true;
  if (/l1\s*[-/]\s*лини/i.test(low)) return true;

  if (
    /(^|[^a-z0-9])l1([^a-z0-9]|$)/i.test(t) &&
    /поддержк|технич\.\s*поддерж|технической поддержк|help\s*desk|service\s*desk|сервис[\s-]*деск/i.test(low)
  ) {
    return true;
  }
  return false;
}

export function passesNotFirstLineRole(parsed) {
  const focus = [parsed.title, parsed.description, parsed.employment]
    .filter(Boolean)
    .join('\n');
  if (textMentionsFirstSupportLine(focus)) {
    return {
      pass: false,
      reason: 'В тексте указана 1-я линия поддержки (1 линия / L1 и т.п.)',
    };
  }
  return { pass: true, reason: 'Без явной 1-й линии поддержки' };
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

/** В заголовке явно DevOps/SRE без Senior/Lead — не отсекать из‑за слова «разработчик» в описании/LLM. */
export function titleLooksDevOpsRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (/\b(senior|сеньор|сеньёр|старш|lead|лид|techlead|tech lead|team lead)\b/i.test(t)) {
    return false;
  }
  return /\bdevops\b|\bsre\b|platform engineer|инженер инфраструктуры|инженер по эксплуатации/i.test(
    t
  );
}

export function passesNotDeveloperRole(parsed, prefs) {
  if (!isDeveloperRoleFilterEnabled(prefs)) {
    return { pass: true, reason: 'Фильтр разработчиков отключён' };
  }
  if (titleLooksDevOpsRole(parsed.title)) {
    return { pass: true, reason: 'DevOps/SRE в названии вакансии' };
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
  const patterns = seniorRolePatterns(prefs);
  const focus = [parsed.title, parsed.description, parsed.employment].filter(Boolean).join('\n');
  if (textMentionsSeniorRole(focus, patterns)) {
    return {
      pass: false,
      reason: 'Вакансия уровня Senior / Lead (senior, tech lead, lead go и т.п.)',
    };
  }
  return { pass: true, reason: 'Не похоже на Senior-уровень' };
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
  const patterns = seniorRolePatterns(prefs);
  return !textMentionsSeniorRole(queueRecordTextBlob(item), patterns);
}

/** Запись очереди: скрыть вакансии-разработчика в дашборде. */
export function recordPassesNotDeveloper(item, prefs) {
  if (!isDeveloperRoleFilterEnabled(prefs)) return true;
  if (titleLooksDevOpsRole(item.title)) return true;
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

/** Почему вакансия скрыта фильтрами роли в дашборде (пустой массив = видна в основном списке). */
export function recordHiddenRoleReasons(item, prefs) {
  const reasons = [];
  if (!recordPassesNotFirstLine(item)) reasons.push('1-я линия');
  if (!recordPassesNotSenior(item, prefs)) reasons.push('Senior/Lead');
  if (!recordPassesNot1C(item, prefs)) reasons.push('1С');
  if (!recordPassesNotDeveloper(item, prefs)) reasons.push('разработчик');
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
  return !textMentionsFirstSupportLine(blob);
}

export function passesRemote(textBlob, prefs) {
  const t = textBlob.toLowerCase();
  const pos = includesAny(t, prefs.remotePositivePatterns || []);
  const hyb = includesAny(t, prefs.hybridPatterns || []);
  const off = includesAny(t, prefs.officeOnlyPatterns || []);

  if (off && !pos) {
    return { pass: false, reason: 'В тексте акцент на офис без явной удалёнки' };
  }
  if (pos) return { pass: true, reason: 'Есть признаки удалённой работы' };
  if (hyb && prefs.allowHybrid) return { pass: true, reason: 'Гибрид (разрешён в preferences)' };
  if (prefs.requireRemote) {
    return { pass: false, reason: 'Нет явной удалёнки/гибрида в описании' };
  }
  return { pass: true, reason: 'Удалёнка не обязательна по настройкам' };
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

export function runHardFilters(parsed, prefs) {
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

  return {
    pass: true,
    remoteReason: remote.reason,
    salaryReason: salary.reason,
    salaryEstimate: salary.estimate,
  };
}
