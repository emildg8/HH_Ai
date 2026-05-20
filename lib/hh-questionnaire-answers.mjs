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

import { answerFromCvHeuristic } from './hh-questionnaire-cv-fill.mjs';
import { answerChoiceFromCvHeuristic, isChoiceQuestion, matchAnswerToOption } from './questionnaire-choice.mjs';



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

async function generatePlainTextAnswer(record, question, cvText, routing) {

  const desc = String(record.descriptionForLlm || '').slice(0, 2500);

  const isSalary = /зарплат|ожидан|доход/i.test(question.label);



  const messages = [

    {

      role: 'system',

      content:

        'Ты соискатель на hh.ru. Отвечай только на русском языке. ' +

        'Пиши от первого лица («я», «мой опыт»). Только факты из резюме. ' +

        'Не пиши от лица компании («мы предлагаем»). Не выдумывай зарплатные цифры. ' +

        'Для стека — короткий список технологий через запятую. ' +

        'Верни только текст ответа, без JSON и без повтора вопроса.',

    },

    {

      role: 'user',

      content: `Вакансия: ${record.title || '—'}

Вопрос работодателя: ${question.label}

${isSalary ? 'Для зарплаты: «готов обсудить на собеседовании» или вилка только если она явно есть в резюме.' : 'Формат: список технологий через запятую или 1–3 коротких предложения на русском.'}



Резюме:

${String(cvText || '').slice(0, 10_000)}



Описание вакансии (не копируй формулировки работодателя):

${desc || '—'}`,

    },

  ];



  const payload = {

    messages,

    temperature: 0.2,

    max_tokens: isSalary ? 120 : 400,

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

function finalFallbackAnswer(question, cvText) {

  const h = answerFromCvHeuristic(question, cvText);

  if (h && !isWeakQuestionnaireAnswer(question, h)) return h;

  if (/зарплат|ожидан/i.test(question.label)) {

    return 'Готов обсудить на собеседовании; ориентиры по рынку уточню лично.';

  }

  return 'См. резюме — опыт в эксплуатации, мониторинге и CI/CD (детали в сопроводительном письме).';

}



/**

 * @param {{

 *   record: { title?: string, company?: string, descriptionForLlm?: string },

 *   questions: Array<{ index: number, label: string, type: string }>,

 *   cvText: string,

 * }} params

 */

export async function generateQuestionnaireAnswers({ record, questions, cvText }) {

  const llmEnabled = isQuestionnaireLlmEnabled();

  const hasOR = Boolean(getOpenRouterApiKey());

  const hasCustom = isCustomLlmRunnable();



  if (llmEnabled && !hasOR && !hasCustom) {

    throw new Error(

      'HH_QUESTIONNAIRE_LLM=1: нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_* (см. config/OPENROUTER.md)'

    );

  }



  const useOpenRouter =

    llmEnabled && hasOR && String(process.env.HH_QUESTIONNAIRE_OPENROUTER || '').trim() === '1';

  const routing = {

    hasOR,

    skipOpenRouter: !useOpenRouter,

    allowCustomFallback: hasCustom,

  };



  const answers = [];

  let usedLlmModel = null;



  for (const q of questions) {

    let answer = isChoiceQuestion(q)
      ? answerChoiceFromCvHeuristic(q, cvText)
      : answerFromCvHeuristic(q, cvText);

    if (acceptGeneratedAnswer(q, answer)) {

      answers.push({ index: q.index, answer });

      continue;

    }



    if (llmEnabled && (hasOR || hasCustom)) {

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
      ? answerChoiceFromCvHeuristic(q, cvText) || finalFallbackAnswer(q, cvText)
      : finalFallbackAnswer(q, cvText);

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


