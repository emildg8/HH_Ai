/** Синхронизировать: npm run sync:questionnaire-labels (из lib/questionnaire-labels.mjs) */

const HH_CHAR_COUNTER_RE = /\s+\d+\s+из\s+\d+\s*$/i;

const GENERIC_LABEL_RE = /^текстовое\s+поле\s*\d*$/i;

/** Поля ввода капчи hh.ru (SmartCaptcha), не вопросы работодателя */
const CAPTCHA_FIELD_LABEL_RES = [
  /^текст\s+с\s+картинки/i,
  /неверный\s+текст[^.]{0,80}повторите\s+попытку/i,
  /введите\s+(?:текст|символ|код|значение)[^.]{0,40}(?:капч|картинк|изображен)/i,
  /подтвердите,?\s*что\s*вы\s*(не\s*)?робот/i,
  /я\s+не\s+робот/i,
  /smartcaptcha/i,
  /\bcaptcha\b/i,
  /введите\s+символы/i,
  /код\s+с\s+картинки/i,
];

/** Категории навыков в анкете Gear Games и похожих (без «?» в подписи) */
export const EMPLOYER_SKILL_CATEGORY_TEXT_RE =
  /(\*?nix|unix|виртуализац|контейнеризац|\biac\b|ansible|terraform|язык.*программ|фреймворк|лог|баз.*данн|хранен.*данн|другие\s+инструмент|инструмент|зарплат|мониторинг|ci\s*\/\s*cd|нейросет|prometheus|zabbix|grafana|victoria|gitlab|teamcity|jenkins|helm|kubernetes|\bk8s\b|kafka|consul|vault|minio|redis|opensearch|tarantool|awx|puppet|discovery|сеть|облач)/i;

const SKILL_CATEGORY_LABEL_RE = EMPLOYER_SKILL_CATEGORY_TEXT_RE;

/** Короткие подписи блоков (CI/CD и т.п.) */
export function isSkillCategoryText(label) {
  const t = formatQuestionLabel(label);
  if (!t || t.length < 3) return false;
  if (EMPLOYER_SKILL_CATEGORY_TEXT_RE.test(t)) return true;
  if (/ci\s*\/\s*cd/i.test(t)) return true;
  if (t.includes('/') && t.length >= 4 && !/\?/.test(t)) return true;
  return false;
}

/**
 * Убрать хвост «297 из 10000» у подписи поля.
 * @param {string} label
 */
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u00AD]/g;

export function stripHhCharCounter(label) {
  return String(label || '')
    .replace(ZERO_WIDTH_RE, '')
    .replace(HH_CHAR_COUNTER_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} label */
export function formatQuestionLabel(label) {
  return stripHhCharCounter(label);
}

/** @param {string} label */
export function normalizeQuestionLabel(label) {
  return formatQuestionLabel(label).toLowerCase();
}

/** Тема вопроса для сопоставления ответов при смене числа полей на hh.ru */
export function questionnaireTopicKey(label) {
  const t = normalizeQuestionLabel(label);
  if (/неинтересн|букмекер|крипт|геймдев|област.*бизнес|банки/.test(t)) return 'business';
  // «формат работы» раньше зарплаты: в объединённом тексте блока не уехать в salary из‑за «рассматриваете»
  if (/формат работы|офис.*гибрид|гибрид.*удален|гибрид.*удалён/i.test(t)) return 'format';
  if (/от какой сумм|зарплат|ожидан|доход|вилк|оклад/i.test(t)) return 'salary';
  if (/офис|гибрид|удален|удалён|remote/i.test(t)) return 'format';
  if (/\*?nix|unix|linux\s+систем/i.test(t)) return 'nix';
  if (/виртуализац|контейнеризац/i.test(t)) return 'virt';
  if (/\biac\b|ansible|terraform/i.test(t)) return 'iac';
  if (/язык.*программ|фреймворк/i.test(t)) return 'lang';
  if (/лог|logging|сбор.*\s+лог|opensearch|kibana|elasticsearch/i.test(t)) return 'logs';
  if (/мониторинг|prometheus|zabbix|victoria|alertmanager/i.test(t)) return 'monitoring';
  if (/ci\s*\/\s*cd|gitlab\s*ci|teamcity|jenkins|непрерывн.*интегр|delivery/i.test(t)) return 'cicd';
  if (/rts|жанра\s+rts|warcraft|starcraft/i.test(t)) return 'rts';
  if (/заинтересовало|предстоящих\s+обязанност|понимаете\s+роль|как\s+понимаете\s+роль/i.test(t)) {
    return 'role_interest';
  }
  if (/мобильн.*игр|игр.*мобильн/i.test(t)) return 'mobile_games';
  if (/матчмейкинг|неясн\w*\s+задач|ваши\s+первые\s+действ/i.test(t)) return 'behavioral';
  if (/compress_numbers|подряд\s+идущ.*дубликат|напишите\s+функци/i.test(t)) return 'coding';
  if (/нейросет|llm|machine\s*learning|искусственн/i.test(t)) return 'ai';
  if (/баз.*данн|sql|nosql|tarantool|mysql/i.test(t)) return 'db';
  if (/хранен.*данн|storage|minio|s3\b/i.test(t)) return 'storage';
  if (/discovery|consul|service\s*mesh/i.test(t)) return 'discovery';
  if (/\bk8s\b|kubernetes|helm/i.test(t)) return 'k8s';
  if (/\bkafka\b|vault/i.test(t)) return 'platform';
  if (/облач|aws|azure|gcp/i.test(t)) return 'cloud';
  if (/другие\s+инструмент|инструмент.*владе/i.test(t)) return 'tools';
  return `text:${t.slice(0, 48)}`;
}

const CATEGORY_FALLBACK_RE = /^категория\s+\d+$/i;

/**
 * Убрать повторы: один вопрос на нормализованную подпись / тему (Gear Games: 14, не 22).
 * @param {Array<{ index?: number, label?: string, type?: string, required?: boolean }>} questions
 */
export function dedupeQuestionnaireQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  const seenNorm = new Set();
  const seenTopic = new Map();
  const out = [];

  for (const q of questions) {
    if (!q) continue;
    const label = formatQuestionLabel(q.label);
    if (!label || isGenericQuestionLabel(label)) continue;

    const norm = normalizeQuestionLabel(label);
    if (!norm || seenNorm.has(norm)) continue;

    const topic = questionnaireTopicKey(label);
    const topicKey = topic && !topic.startsWith('text:') ? topic : '';

    if (topicKey && seenTopic.has(topicKey)) {
      const prevIdx = seenTopic.get(topicKey);
      const prevLabel = formatQuestionLabel(out[prevIdx]?.label);
      if (CATEGORY_FALLBACK_RE.test(prevLabel) && !CATEGORY_FALLBACK_RE.test(label)) {
        seenNorm.delete(normalizeQuestionLabel(prevLabel));
        seenNorm.add(norm);
        out[prevIdx] = { ...q, label, index: prevIdx + 1 };
      }
      continue;
    }

    const idx = out.length;
    out.push({
      ...q,
      label,
      index: idx + 1,
    });
    seenNorm.add(norm);
    if (topicKey) seenTopic.set(topicKey, idx);
  }

  return out;
}

/** Только счётчик символов без текста вопроса */
export function isBareCounterFieldLabel(label) {
  const t = formatQuestionLabel(label);
  return /^\d+\s*из\s*\d+$/i.test(t);
}

/** Строка-заголовок блока навыков (не «Писать тут», не инструкция мастера) */
export function isEmployerSkillCategoryLabel(label) {
  const t = formatQuestionLabel(label);
  if (!t || t.length < 3) return false;
  if (isPlaceholderFieldLabel(t) || isInstructionPageLabel(t)) return false;
  if (GENERIC_LABEL_RE.test(t)) return false;
  if (isSkillCategoryText(t)) return true;
  if (t.includes('/') && t.length >= 10 && !/\?/.test(t)) return true;
  return false;
}

/** Подпись из placeholder поля ввода, а не формулировка работодателя */
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

/** Текст мастера отклика, а не вопрос работодателя */
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

/**
 * @param {string} label
 */
export function isInstructionPageLabel(label) {
  const t = String(label || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  for (const re of INSTRUCTION_LABEL_RES) {
    if (re.test(t)) return true;
  }
  if (/отклик\s+на\s+вакансию/i.test(t) && /необходимо\s+ответить/i.test(t)) {
    return true;
  }
  if (/несколько\s+вопросов\s+работодателя/i.test(t) && !/\?/.test(t) && t.length < 200) {
    return true;
  }
  return false;
}

/**
 * @param {string} label
 */
export function isPlaceholderFieldLabel(label) {
  const t = String(label || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  for (const re of PLACEHOLDER_LABEL_RES) {
    if (re.test(t)) return true;
  }
  return false;
}

/**
 * @param {string} label
 */
export function isCaptchaFieldLabel(label) {
  const t = formatQuestionLabel(label);
  if (!t) return false;
  for (const re of CAPTCHA_FIELD_LABEL_RES) {
    if (re.test(t)) return true;
  }
  return false;
}

/**
 * Сохранённые вопросы — ложная анкета из-за капчи (все поля — капча или generic без смысла).
 * @param {Array<{ label?: string }>} [questions]
 */
export function questionsLookLikeCaptchaMisdetect(questions) {
  if (!Array.isArray(questions) || !questions.length) return false;
  const labels = questions.map((q) => formatQuestionLabel(q?.label)).filter(Boolean);
  if (!labels.length) return false;
  const captchaCount = labels.filter((l) => isCaptchaFieldLabel(l)).length;
  if (captchaCount > 0 && captchaCount === labels.length) return true;
  if (labels.length <= 3 && captchaCount >= 1 && meaningfulQuestions(questions).length === 0) {
    return true;
  }
  return false;
}

/** @param {object} rec */
export function recordLooksLikeCaptchaQuestionnaire(rec) {
  const q = rec?.hhApply?.questionnaire;
  if (!q) return false;
  if (q.clearedAsCaptcha) return false;
  if (itemHasMeaningfulQuestionnaire(rec)) return false;
  return questionsLookLikeCaptchaMisdetect(q.questions);
}

/**
 * Патч для снятия ложной анкеты (капча) с карточки.
 * @param {object} rec
 */
export function patchClearCaptchaQuestionnaire(rec) {
  const prev = rec?.hhApply || {};
  const q = prev.questionnaire || {};
  return {
    hhApply: {
      ...prev,
      questionnaire: {
        ...q,
        status: 'cleared_captcha',
        clearedAsCaptcha: true,
        clearedAt: new Date().toISOString(),
        questions: [],
        needsProbe: false,
        likelyFromVacancyText: false,
        note: 'Сброшено: поля «Текст с картинки» — капча hh.ru, не анкета работодателя',
      },
    },
  };
}

/** Текст из заполненного поля, ошибочно принятый за формулировку вопроса. */
export function isLikelyAnswerTextNotQuestion(label) {
  const t = formatQuestionLabel(label);
  if (!t) return true;
  if (/\?/.test(t)) return false;
  if (/^(def |import pytest|@pytest|class \w|async def )/i.test(t)) return true;
  if (/^python\s+import/i.test(t)) return true;
  if (/готов обсудить на собеседовании/i.test(t)) return true;
  if (/меня заинтересовали автотесты/i.test(t)) return true;
  if (/прозрачно:.*hh\s*ai/i.test(t)) return true;
  if (/драконоборец|warcraft|starcraft|age of emper/i.test(t)) return true;
  if (/^\d+\)\s+/m.test(t) && t.length > 60) return true;
  if (/pytest\.mark\.parametrize/i.test(t)) return true;
  if (t.length > 100 && !/\?/.test(t)) return true;
  return false;
}

export function isGenericQuestionLabel(label) {
  const t = formatQuestionLabel(label);
  if (!t) return true;
  if (isLikelyAnswerTextNotQuestion(t)) return true;
  if (isCaptchaFieldLabel(t)) return true;
  if (isEmployerSkillCategoryLabel(t) || isSkillCategoryText(t)) return false;
  if (isBareCounterFieldLabel(t)) return true;
  if (GENERIC_LABEL_RE.test(t)) return true;
  if (isPlaceholderFieldLabel(t)) return true;
  if (isInstructionPageLabel(t)) return true;
  if (/^вопрос\s+\d+$/i.test(t)) return true;
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
    const index = Number.isFinite(q.index) ? q.index : out.length + 1;
    out.push({
      ...q,
      index,
      label: formatQuestionLabel(q.label),
    });
  }
  return dedupeQuestionnaireQuestions(out);
}

/**
 * @param {object} item
 */
export function itemHasMeaningfulQuestionnaire(item) {
  const qs = item?.hhApply?.questionnaire?.questions;
  return meaningfulQuestions(qs).length > 0;
}

/** Вакансия с анкетой работодателя (ждёт заполнения или уже сняты вопросы с hh.ru). */
export function recordNeedsQuestionnaireWork(rec) {
  if (rec?.hhApply?.responseSubmitted) return false;
  const q = rec?.hhApply?.questionnaire;
  if (!q || q.clearedAsCaptcha || q.status === 'cleared_captcha') return false;
  if (recordLooksLikeCaptchaQuestionnaire(rec)) return false;
  if (q.likelyFromVacancyText) return true;
  return itemHasMeaningfulQuestionnaire(rec);
}

/**
 * @param {object} item
 */
/** В JSON есть поля, но осмысленных подписей нет (заглушки hh.ru). */
export function recordQuestionnaireNeedsRelabel(rec) {
  const q = rec?.hhApply?.questionnaire;
  if (!q || q.clearedAsCaptcha) return false;
  if (q.needsProbe === true) return true;
  const raw = Array.isArray(q.questions) ? q.questions : [];
  if (!raw.length) return q.status === 'pending_manual' || Boolean(q.likelyFromVacancyText);
  return meaningfulQuestions(raw).length === 0;
}

export function itemQuestionnaireNeedsProbe(item) {
  return recordQuestionnaireNeedsRelabel(item) && !itemHasMeaningfulQuestionnaire(item);
}

/**
 * Автозагрузка с hh.ru при открытии модалки: нет осмысленных вопросов
 * (в т.ч. после прошлого probe с заглушками «Писать тут» / «Текстовое поле N»).
 */
export function itemQuestionnaireShouldAutoProbe(item) {
  if (!item?.hhApply?.questionnaire) return false;
  if (itemHasMeaningfulQuestionnaire(item)) return false;
  const q = item.hhApply.questionnaire;
  if (q.status === 'pending_manual') return true;
  if (q.likelyFromVacancyText) return true;
  return false;
}
