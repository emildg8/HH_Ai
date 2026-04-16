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
