/** Синхронизировать с lib/questionnaire-labels.mjs */



const HH_CHAR_COUNTER_RE = /\s+\d+\s+из\s+\d+\s*$/i;



const GENERIC_LABEL_RE = /^текстовое\s+поле\s*\d*$/i;



const SKILL_CATEGORY_LABEL_RE =
  /(\*?nix|unix|виртуализац|контейнеризац|\biac\b|ansible|terraform|язык.*программ|фреймворк|лог|баз.*данн|хранен.*данн|другие\s+инструмент|инструмент|зарплат|мониторинг|ci\/cd|сеть|облач)/i;



const PLACEHOLDER_LABEL_RES = [

  /^писать\s+(?:сюда|тут|здесь)\s*$/i,

  /^введите[\s,.:!?-]/i,

  /^введите\s*$/i,

  /^your\s+answer\s*$/i,

  /^type\s+here\s*$/i,

  /^ответьте\s+здесь\s*$/i,

  /^опишите\s+здесь\s*$/i,

  /^комментарий\s*$/i,

];



const INSTRUCTION_LABEL_RES = [

  /^отклик\s+на\s+вакансию\b/i,

  /\bдля\s+отклика\s+необходимо\b/i,

  /\bнеобходимо\s+ответить\s+на\s+несколько\b/i,

  /\bответьте\s+на\s+(несколько\s+)?вопрос/i,

  /\bзаполните\s+анкету\b/i,

  /^дополнительные\s+вопросы\b/i,

  /^вопросы\s+от\s+работодателя\s*$/i,

  /^анкета\s+работодателя\s*$/i,

  /\bоткликнуться\s+на\s+вакансию\b/i,

  /\bвыберите\s+резюме\b/i,

  /\bсопроводительн/i,

];



export function stripHhCharCounter(label) {

  return String(label || '')

    .replace(HH_CHAR_COUNTER_RE, '')

    .replace(/\s+/g, ' ')

    .trim();

}



export function formatQuestionLabel(label) {

  return stripHhCharCounter(label);

}



export function normalizeQuestionLabel(label) {

  return formatQuestionLabel(label).toLowerCase();

}

export function questionnaireTopicKey(label) {
  const t = normalizeQuestionLabel(label);
  if (/неинтересн|букмекер|крипт|геймдев|област.*бизнес|банки/.test(t)) return 'business';
  if (/от какой сумм|зарплат|ожидан|доход|вилк|оклад/i.test(t)) return 'salary';
  if (/офис|гибрид|удален|удалён|формат работы|remote/i.test(t)) return 'format';
  if (/\*?nix|unix|linux\s+систем/i.test(t)) return 'nix';
  if (/виртуализац|контейнеризац/i.test(t)) return 'virt';
  if (/\biac\b|ansible|terraform/i.test(t)) return 'iac';
  if (/язык.*программ|фреймворк/i.test(t)) return 'lang';
  if (/лог|logging|сбор.*хранен/i.test(t)) return 'logs';
  if (/баз.*данн|sql|nosql/i.test(t)) return 'db';
  if (/хранен.*данн|storage/i.test(t)) return 'storage';
  if (/другие\s+инструмент|инструмент.*владе/i.test(t)) return 'tools';
  return `text:${t.slice(0, 48)}`;
}

export function isBareCounterFieldLabel(label) {
  const t = formatQuestionLabel(label);
  return /^\d+\s*из\s*\d+$/i.test(t);
}

export function isEmployerSkillCategoryLabel(label) {
  const t = formatQuestionLabel(label);
  if (!t || t.length < 4) return false;
  if (isPlaceholderFieldLabel(t) || isInstructionPageLabel(t)) return false;
  if (GENERIC_LABEL_RE.test(t)) return false;
  if (SKILL_CATEGORY_LABEL_RE.test(t)) return true;
  if (t.includes('/') && t.length >= 10 && !/\?/.test(t)) return true;
  return false;
}



export function isInstructionPageLabel(label) {

  const t = formatQuestionLabel(label);

  if (!t) return true;

  for (const re of INSTRUCTION_LABEL_RES) {

    if (re.test(t)) return true;

  }

  if (/отклик\s+на\s+вакансию/i.test(t) && /необходимо\s+ответить/i.test(t)) return true;

  if (/несколько\s+вопросов\s+работодателя/i.test(t) && !/\?/.test(t) && t.length < 200) {

    return true;

  }

  return false;

}



export function isPlaceholderFieldLabel(label) {

  const t = formatQuestionLabel(label);

  if (!t) return true;

  for (const re of PLACEHOLDER_LABEL_RES) {

    if (re.test(t)) return true;

  }

  return false;

}



export function isGenericQuestionLabel(label) {

  const t = formatQuestionLabel(label);

  if (!t) return true;

  if (isEmployerSkillCategoryLabel(t)) return false;

  if (isBareCounterFieldLabel(t)) return true;

  if (GENERIC_LABEL_RE.test(t)) return true;

  if (isPlaceholderFieldLabel(t)) return true;

  if (isInstructionPageLabel(t)) return true;

  if (t.length < 8 && !/\?/.test(t)) return true;

  return false;

}



export function meaningfulQuestions(questions) {

  if (!Array.isArray(questions)) return [];

  const out = [];

  for (const q of questions) {

    if (!q || isGenericQuestionLabel(q.label)) continue;

    const index = Number.isFinite(q.index) ? q.index : out.length + 1;

    out.push({

      ...q,

      index,

      label: formatQuestionLabel(q.label),

    });

  }

  return out;

}



export function itemHasMeaningfulQuestionnaire(item) {

  return meaningfulQuestions(item?.hhApply?.questionnaire?.questions).length > 0;

}

export function recordNeedsQuestionnaireWork(rec) {
  if (rec?.hhApply?.responseSubmitted) return false;
  if (rec?.hhApply?.questionnaire?.status === 'pending_manual') return true;
  if (rec?.hhApply?.questionnaire?.likelyFromVacancyText) return true;
  return itemHasMeaningfulQuestionnaire(rec);
}

export function itemQuestionnaireNeedsProbe(item) {

  if (!item?.hhApply?.questionnaire) return false;

  if (itemHasMeaningfulQuestionnaire(item)) return false;

  const q = item.hhApply.questionnaire;

  if (q.status === 'pending_manual') return true;

  if (q.likelyFromVacancyText) return true;

  return false;

}



export function itemQuestionnaireShouldAutoProbe(item) {

  if (!item?.hhApply?.questionnaire) return false;

  if (itemHasMeaningfulQuestionnaire(item)) return false;

  const q = item.hhApply.questionnaire;

  if (q.status === 'pending_manual') return true;

  if (q.likelyFromVacancyText) return true;

  return false;

}


