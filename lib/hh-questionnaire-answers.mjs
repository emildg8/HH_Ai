/**

 * Ответы на анкету: по умолчанию только из резюме (эвристика).

 * LLM — только при HH_QUESTIONNAIRE_LLM=1 и только для пустых полей.

 */



import {

  getOpenRouterApiKey,

  resolveOpenRouterModelForRequest,

  getCustomLlmBaseUrl,

  getCustomLlmModel,

  getCustomLlmApiKey,

  isCustomLlmRunnable,

} from './openrouter-score.mjs';

import { answerFromCvHeuristic, inferVacancyFocus } from './hh-questionnaire-cv-fill.mjs';
import { answerChoiceFromCvHeuristic, isChoiceQuestion, matchAnswerToOption } from './questionnaire-choice.mjs';
import { buildQuestionnaireExamplesBlock } from './questionnaire-user-edits.mjs';
import { questionnaireTopicKey } from './questionnaire-labels.mjs';
import {
  isCodingQuestionnaireQuestion,
  isBehavioralAmbiguousQuestion,
  looksLikeToolListOnlyAnswer,
  answerCodingQuestionnaire,
  answerBehavioralAmbiguousTask,
} from './questionnaire-special-answers.mjs';



const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';



async function postChat(url, headers, body) {

  const res = await fetch(url, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json', ...headers },

    body: JSON.stringify(body),

  });

  const raw = await res.text();

  if (!res.ok) throw new Error(`LLM ${res.status}: ${raw.slice(0, 400)}`);

  return JSON.parse(raw);

}



/** Явный opt-in LLM для анкеты (по умолчанию выключен). */

export function isQuestionnaireLlmEnabled() {

  return String(process.env.HH_QUESTIONNAIRE_LLM || '').trim() === '1';

}

/** LLM для развёрнутых вопросов, если есть ключ (без HH_QUESTIONNAIRE_LLM=1). */
export function isQuestionnaireLlmEnabledForQuestion(question) {
  if (isQuestionnaireLlmEnabled()) return true;
  if (String(process.env.HH_QUESTIONNAIRE_LLM_PROSE ?? '1').trim() === '0') return false;
  if (!(getOpenRouterApiKey() || isCustomLlmRunnable())) return false;
  if (isChoiceQuestion(question)) return false;
  const label = String(question?.label || '');
  if (isCodingQuestionnaireQuestion(label) || isBehavioralAmbiguousQuestion(label)) return true;
  return /расскажите|опишите|причин|проект|почему|мотивац|успешн|python|питон|библиотек|уровень|напишите|функци|автотест/i.test(
    label
  );
}



/** Английский связный текст вместо русского списка из резюме */

export function isLikelyEnglishAnswer(text) {

  const s = String(text || '').trim();

  if (!s) return false;



  const proseHints =

    /\b(experience|experienced|proficiency|skilled|knowledge|familiar|comfortable|including|working with|I have|I'm)\b/i;

  const cyrillic = (s.match(/[а-яёА-ЯЁ]/g) || []).length;

  const latin = (s.match(/[a-zA-Z]/g) || []).length;



  if (proseHints.test(s) && latin > cyrillic) return true;



  const words = s.split(/\s+/).filter(Boolean);

  if (words.length >= 7 && latin > 60 && cyrillic < 12) return true;



  return false;

}



/** Текст от работодателя, а не от соискателя */

export function isEmployerVoiceAnswer(answer) {

  const a = String(answer || '').toLowerCase();

  return (

    /\bмы\s+предлагаем\b/.test(a) ||

    /\bнаша\s+компания\b/.test(a) ||

    /\bв\s+нашей\s+компании\b/.test(a) ||

    (/\bот\s+\d/.test(a) && /\bруб/.test(a) && !/\bготов\b/.test(a) && !/\bрассматриваю\b/.test(a))

  );

}



/**

 * @param {{ label: string }} question

 * @param {string} answer

 */

export function isWeakQuestionnaireAnswer(question, answer) {

  const a = String(answer || '').replace(/\s+/g, ' ').trim();

  const q = String(question?.label || '').replace(/\s+/g, ' ').trim();

  if (isChoiceQuestion(question) && matchAnswerToOption(a, question.options)) {
    return a.length < 2;
  }

  if (a.length < 3) return true;

  if (isEmployerVoiceAnswer(a)) return true;

  if (isLikelyEnglishAnswer(a)) return true;

  if (q && a.toLowerCase() === q.toLowerCase()) return true;

  if (q.length > 24 && a.toLowerCase().includes(q.toLowerCase().slice(0, Math.min(40, q.length)))) {

    return true;

  }

  if (/^укажите,?\s+пожалуйста/i.test(a) && /зарплат/i.test(a) && !/\d/.test(a)) return true;

  if (/^см\.?\s*резюме/i.test(a) && q.length > 20) return true;

  if (
    /python|питон|pandas|numpy|sklearn|библиотек.*машинн|машинн.*обуч/i.test(q) &&
    /docker|kubernetes|openshift|grafana|zabbix/i.test(a) &&
    !/python|pandas|numpy|sklearn|pytorch|tensorflow/i.test(a)
  ) {
    return true;
  }

  if (/причин.*поиск|смен.*мест/i.test(q) && /см\.?\s*резюме.*эксплуатац/i.test(a)) return true;

  if (isCodingQuestionnaireQuestion(q) && (looksLikeToolListOnlyAnswer(a) || !/def\s|import\s|pytest/i.test(a))) {
    return true;
  }

  if (
    isBehavioralAmbiguousQuestion(q) &&
    /готов обсудить детали на собеседовании|релевантный опыт в резюме/i.test(a)
  ) {
    return true;
  }

  return false;

}



/**

 * @param {Array<{ index: number, answer: string }>} answers

 * @param {Array<{ index: number, label: string }>} questions

 */

export function alignAnswersToQuestions(answers, questions) {

  const byIndex = new Map();

  for (const a of answers) {

    if (Number.isFinite(a.index) && a.answer) byIndex.set(a.index, a.answer);

  }



  const aligned = [];

  for (let i = 0; i < questions.length; i++) {

    const q = questions[i];

    const answer =

      byIndex.get(q.index) ||

      byIndex.get(i + 1) ||

      (answers[i] && String(answers[i].answer || '').trim()) ||

      '';

    if (answer) aligned.push({ index: q.index, answer });

  }

  return aligned;

}



function cleanPlainAnswer(text) {

  let s = String(text || '').trim();

  s = s.replace(/^["'`]+|["'`]+$/g, '').trim();

  if (/^```/.test(s)) {

    s = s.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();

  }

  return s.replace(/\s+/g, ' ').trim();

}



function acceptGeneratedAnswer(question, answer) {

  return (

    Boolean(answer) &&

    !isWeakQuestionnaireAnswer(question, answer) &&

    !isEmployerVoiceAnswer(answer) &&

    !isLikelyEnglishAnswer(answer)

  );

}



/**

 * @param {object} record

 * @param {{ index: number, label: string, type: string }} question

 * @param {string} cvText

 * @param {{ hasOR: boolean, skipOpenRouter: boolean, allowCustomFallback: boolean }} routing

 */

function vacancyQuestionnaireScore(record) {
  return Number(record?.scoreOverall ?? record?.geminiScore ?? 0) || 0;
}

function isHighPriorityQuestionnaireVacancy(record) {
  const min = Number(process.env.HH_QUESTIONNAIRE_HIGH_SCORE_MIN ?? 72);
  return vacancyQuestionnaireScore(record) >= min;
}

async function generatePlainTextAnswer(record, question, cvText, routing) {

  const desc = String(record.descriptionForLlm || '').slice(0, 2500);

  const label = String(question.label || '');
  const isSalary = /зарплат|ожидан|доход/i.test(label);
  const isCoding = isCodingQuestionnaireQuestion(label);
  const isBehavioral = isBehavioralAmbiguousQuestion(label);
  const highPriority = isHighPriorityQuestionnaireVacancy(record);
  const topic = questionnaireTopicKey(label);
  const examplesBlock = buildQuestionnaireExamplesBlock({ topic });

  const systemCoding =
    'Ты соискатель на hh.ru (SDET/QA). Верни готовый код на Python: функция по ТЗ + автотесты pytest. ' +
    'Без markdown-ограждений, без повтора текста вопроса. Комментарии кратко на русском при необходимости.';
  const systemBehavioral =
    'Ты соискатель SDET/QA. Отвечай на русском, от первого лица: 4–5 нумерованных шагов — ' +
    'уточнение метрик, baseline, гипотезы, тест-план, итерации. Без общих фраз «обсудим на собеседовании».';
  const systemDefault =
    'Ты соискатель на hh.ru. Цель — пройти отбор и получить приглашение на собеседование. ' +
    'Отвечай только на русском, от первого лица («я», «мой опыт»). ' +
    'Только факты из резюме: технологии, годы, масштаб (highload, команда), без воды. ' +
    'Звучи уверенно. Не пиши от лица компании. Не выдумывай зарплату. ' +
    'Для стека — список через запятую; для опыта — 2–4 коротких предложения. ' +
    'Верни только текст ответа, без JSON и без повтора вопроса.' +
    examplesBlock;

  let formatHint =
    'Формат: список технологий через запятую или 1–3 коротких предложения на русском.';
  if (isSalary) formatHint = 'Для зарплаты: «готов обсудить на собеседовании» или вилка только если она явно есть в резюме.';
  else if (isCoding) formatHint = 'Только код Python + pytest по условию задачи.';
  else if (isBehavioral) formatHint = 'Нумерованный план действий (4–5 пунктов), по делу.';
  else if (highPriority) formatHint = 'Формат: 2–4 предложения с конкретикой из резюме или список технологий.';

  const messages = [
    {
      role: 'system',
      content: isCoding ? systemCoding : isBehavioral ? systemBehavioral : systemDefault,
    },
    {
      role: 'user',
      content: `Вакансия: ${record.title || '—'}${highPriority ? ' (приоритет: высокий балл совпадения)' : ''}
Фокус отклика: ${inferVacancyFocus(record.title, record.descriptionForLlm)} — отвечай строго по типу вопроса (код / поведение / стек).

Вопрос работодателя: ${label}

${formatHint}



Резюме:

${String(cvText || '').slice(0, 10_000)}



Описание вакансии (не копируй формулировки работодателя):

${desc || '—'}`,

    },

  ];



  const payload = {

    messages,

    temperature: 0.2,

    max_tokens: isSalary ? 120 : isCoding ? 2200 : isBehavioral ? 600 : highPriority ? 520 : 400,

  };



  const { hasOR, skipOpenRouter, allowCustomFallback } = routing;



  const callCustom = async () => {

    const model = getCustomLlmModel();

    const headers = {};

    const key = getCustomLlmApiKey();

    if (key) headers.Authorization = `Bearer ${key}`;

    const data = await postChat(`${getCustomLlmBaseUrl()}/chat/completions`, headers, {

      ...payload,

      model,

    });

    return { text: cleanPlainAnswer(data?.choices?.[0]?.message?.content), model };

  };



  const callOr = async () => {

    const model = resolveOpenRouterModelForRequest();

    const data = await postChat(

      OPENROUTER_URL,

      {

        Authorization: `Bearer ${getOpenRouterApiKey()}`,

        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',

        'X-Title': 'hh-ru-apply-questionnaire',

      },

      { ...payload, model }

    );

    return { text: cleanPlainAnswer(data?.choices?.[0]?.message?.content), model };

  };



  if (hasOR && !skipOpenRouter) {

    try {

      return await callOr();

    } catch (e) {

      if (allowCustomFallback) {

        console.warn('[hh-questionnaire] plain-text OR fail → custom:', e.message);

        return await callCustom();

      }

      throw e;

    }

  }

  return await callCustom();

}



/**

 * @param {{ label: string }} question

 * @param {string} cvText

 */

function questionnaireCtx(record) {
  return {
    vacancyTitle: record?.title,
    description: record?.descriptionForLlm,
    focus: inferVacancyFocus(record?.title, record?.descriptionForLlm),
  };
}

function finalFallbackAnswer(question, cvText, record) {

  const h = answerFromCvHeuristic(question, cvText, questionnaireCtx(record));

  if (h && !isWeakQuestionnaireAnswer(question, h)) return h;

  if (/зарплат|ожидан/i.test(question.label)) {

    return 'Готов обсудить на собеседовании; ориентиры по рынку уточню лично.';

  }

  const focus = inferVacancyFocus(record?.title, record?.descriptionForLlm);
  if (isCodingQuestionnaireQuestion(question.label)) {
    return answerCodingQuestionnaire(question.label, focus);
  }
  if (isBehavioralAmbiguousQuestion(question.label)) {
    return answerBehavioralAmbiguousTask(focus);
  }
  if (focus === 'ml') {
    return 'Готов обсудить на собеседовании: сильная сторона — эксплуатация и автоматизация, целенаправленно развиваю ML-компетенции под ваши задачи.';
  }
  if (focus === 'qa') {
    return 'Готов обсудить детали на собеседовании; в резюме — автоматизация, проверки, Python/bash под тестирование.';
  }

  return 'Готов обсудить детали на собеседовании — релевантный опыт в резюме и сопроводительном письме.';

}



/**

 * @param {{

 *   record: { title?: string, company?: string, descriptionForLlm?: string },

 *   questions: Array<{ index: number, label: string, type: string }>,

 *   cvText: string,

 * }} params

 */

export async function generateQuestionnaireAnswers({ record, questions, cvText }) {

  const llmGlobal = isQuestionnaireLlmEnabled();

  const hasOR = Boolean(getOpenRouterApiKey());

  const hasCustom = isCustomLlmRunnable();

  if (llmGlobal && !hasOR && !hasCustom) {
    throw new Error(
      'HH_QUESTIONNAIRE_LLM=1: нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_* (см. config/OPENROUTER.md)'
    );
  }

  const useOpenRouter =
    llmGlobal && hasOR && String(process.env.HH_QUESTIONNAIRE_OPENROUTER || '').trim() === '1';
  const routing = {
    hasOR,
    skipOpenRouter: !useOpenRouter,
    allowCustomFallback: hasCustom,
  };

  const ctx = questionnaireCtx(record);

  const answers = [];

  let usedLlmModel = null;



  for (const q of questions) {
    if (isCodingQuestionnaireQuestion(q.label)) {
      const codeAns = answerCodingQuestionnaire(q.label, ctx.focus);
      if (codeAns && acceptGeneratedAnswer(q, codeAns)) {
        answers.push({ index: q.index, answer: codeAns });
        continue;
      }
    }
    if (isBehavioralAmbiguousQuestion(q.label)) {
      const beh = answerBehavioralAmbiguousTask(ctx.focus);
      if (beh && acceptGeneratedAnswer(q, beh)) {
        answers.push({ index: q.index, answer: beh });
        continue;
      }
    }

    let answer = isChoiceQuestion(q)
      ? answerChoiceFromCvHeuristic(q, cvText)
      : answerFromCvHeuristic(q, cvText, ctx);

    if (acceptGeneratedAnswer(q, answer)) {

      answers.push({ index: q.index, answer });

      continue;

    }



    const llmForQ = llmGlobal || isQuestionnaireLlmEnabledForQuestion(q);

    if (llmForQ && (hasOR || hasCustom)) {

      try {

        const llm = await generatePlainTextAnswer(record, q, cvText, routing);

        answer = llm.text;

        usedLlmModel = llm.model;

        if (acceptGeneratedAnswer(q, answer)) {

          answers.push({ index: q.index, answer });

          continue;

        }

      } catch (e) {

        console.warn(`[hh-questionnaire] LLM вопрос ${q.index}:`, e.message);

      }

    }



    answer = isChoiceQuestion(q)
      ? answerChoiceFromCvHeuristic(q, cvText) || finalFallbackAnswer(q, cvText, record)
      : finalFallbackAnswer(q, cvText, record);

    answers.push({ index: q.index, answer });

  }



  const aligned = alignAnswersToQuestions(answers, questions);

  if (aligned.length < questions.length) {

    throw new Error(`Сгенерировано ${aligned.length} из ${questions.length} ответов`);

  }



  const model = usedLlmModel ? `cv+${usedLlmModel}` : 'cv-heuristic';

  return { answers: aligned, model };

}



export function isQuestionnaireAutoEnabled() {

  return (

    process.argv.includes('--questionnaire-auto') || process.env.HH_QUESTIONNAIRE_AUTO === '1'

  );

}


