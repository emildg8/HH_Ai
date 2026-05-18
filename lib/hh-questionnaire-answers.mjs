/**
 * Генерация ответов на анкету работодателя (OpenRouter / HH_CUSTOM_LLM).
 */

import {
  getOpenRouterApiKey,
  extractJsonObject,
  resolveOpenRouterModelForRequest,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
  isCustomLlmRunnable,
} from './openrouter-score.mjs';

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

function parseAnswersPayload(content) {
  const text = String(content || '').trim();
  if (!text) throw new Error('LLM: пустой ответ');
  let parsed;
  try {
    parsed = extractJsonObject(text);
  } catch (e) {
    throw new Error(`LLM: не JSON: ${e.message}`);
  }
  const raw = parsed.answers ?? parsed.Answers ?? parsed.items;
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('LLM: нет массива answers');
  }
  return raw
    .map((row) => ({
      index: Number(row.index ?? row.i ?? row.questionIndex),
      answer: String(row.answer ?? row.text ?? row.value ?? '').trim(),
    }))
    .filter((a) => Number.isFinite(a.index) && a.index >= 1 && a.answer);
}

/**
 * @param {{
 *   record: { title?: string, company?: string, descriptionForLlm?: string },
 *   questions: Array<{ index: number, label: string, type: string }>,
 *   cvText: string,
 * }} params
 * @returns {Promise<{ answers: Array<{ index: number, answer: string }>, model: string }>}
 */
export async function generateQuestionnaireAnswers({ record, questions, cvText }) {
  const hasOR = Boolean(getOpenRouterApiKey());
  const hasCustom = isCustomLlmRunnable();
  if (!hasOR && !hasCustom) {
    throw new Error(
      'Для авто-анкеты нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_* (см. config/OPENROUTER.md)'
    );
  }

  const desc = String(record.descriptionForLlm || '').slice(0, 6000);
  const qBlock = questions
    .map((q) => `${q.index}. [${q.type}] ${q.label}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content:
        'Ты помогаешь соискателю заполнить дополнительные вопросы работодателя на hh.ru. ' +
        'Отвечай от первого лица, правдиво по резюме, без выдуманного опыта. ' +
        'Верни только JSON: {"answers":[{"index":1,"answer":"текст"}]} — по одному answer на каждый index. ' +
        'Для radio/checkbox — answer = точная короткая формулировка подходящего варианта (Да/Нет/число лет и т.д.). ' +
        'Для textarea — 2–6 предложений, конкретика. Без markdown и пояснений вне JSON.',
    },
    {
      role: 'user',
      content: `Вакансия: ${record.title || '—'}
Компания: ${record.company || '—'}

Описание:
${desc || '—'}

Резюме:
${String(cvText || '').slice(0, 14_000)}

Вопросы работодателя:
${qBlock}`,
    },
  ];

  const payload = {
    messages,
    temperature: 0.35,
    max_tokens: Math.min(4000, 400 + questions.length * 350),
    response_format: { type: 'json_object' },
  };

  let model = 'custom';
  let data;
  if (hasOR) {
    model = resolveOpenRouterModelForRequest();
    data = await postChat(
      OPENROUTER_URL,
      {
        Authorization: `Bearer ${getOpenRouterApiKey()}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
        'X-Title': 'hh-ru-apply-questionnaire',
      },
      { ...payload, model }
    );
  } else {
    model = getCustomLlmModel();
    const headers = {};
    const key = getCustomLlmApiKey();
    if (key) headers.Authorization = `Bearer ${key}`;
    data = await postChat(`${getCustomLlmBaseUrl()}/chat/completions`, headers, {
      ...payload,
      model,
    });
  }

  const content = data?.choices?.[0]?.message?.content;
  const answers = parseAnswersPayload(content);
  const expected = new Set(questions.map((q) => q.index));
  const filtered = answers.filter((a) => expected.has(a.index));
  if (!filtered.length) {
    throw new Error('LLM не вернул ответы для известных вопросов');
  }
  return { answers: filtered, model };
}

export function isQuestionnaireAutoEnabled() {
  return (
    process.argv.includes('--questionnaire-auto') || process.env.HH_QUESTIONNAIRE_AUTO === '1'
  );
}
