/**
 * Технический мок-собес: вопросы по вакансии и резюме.
 */

import { loadCvBundle } from './cv-load.mjs';
import { extractJdKeywords, vacancyTextBlob } from './jd-keyword-extract.mjs';
import {
  getOpenRouterApiKey,
  resolveOpenRouterModelForRequest,
  isCustomLlmRunnable,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
  extractJsonObject,
} from './openrouter-score.mjs';
import { normalizeInterviewLines } from './interview-text-lines.mjs';

const FALLBACK_QUESTIONS = [
  'Расскажите о последнем инциденте в проде: что случилось, как диагностировали, итог.',
  'Как у вас устроен CI/CD: от коммита до выкладки?',
  'Опыт с Docker/Kubernetes: что деплоили и как мониторили?',
  'Как снижали время простоя или ускоряли релизы — с цифрами?',
  'Что сделаете в первую неделю на новой позиции?',
];

/**
 * @param {object} rec
 */
export async function buildTechnicalMockInterview(rec) {
  const cvBundle = await loadCvBundle();
  const { mustHave } = extractJdKeywords(rec);
  const blob = vacancyTextBlob(rec).slice(0, 5000);

  const apiKey = getOpenRouterApiKey();
  if (!apiKey && !isCustomLlmRunnable()) {
    return {
      mode: 'fallback',
      questions: FALLBACK_QUESTIONS,
      focus: mustHave.slice(0, 6),
    };
  }

  let url = 'https://openrouter.ai/api/v1/chat/completions';
  let model = resolveOpenRouterModelForRequest();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  else {
    url = `${getCustomLlmBaseUrl()}/chat/completions`;
    model = getCustomLlmModel();
    const k = getCustomLlmApiKey();
    if (k) headers.Authorization = `Bearer ${k}`;
  }

  const user = `Вакансия: ${rec.title}
Компания: ${rec.company || '—'}
Ключи: ${mustHave.join(', ')}

Описание:
${blob}

Резюме:
${cvBundle.text.slice(0, 6000)}

JSON: { "questions": ["..."], "focus": ["..."], "tips": ["..."] }
5–7 вопросов middle DevOps/SRE, по-русски, с привязкой к стеку вакансии.`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Интервьюер DevOps. Только JSON.' },
          { role: 'user', content: user },
        ],
        temperature: 0.45,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(raw.slice(0, 200));
    const data = JSON.parse(raw);
    const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || '{}');
    const questions = normalizeInterviewLines(parsed.questions).slice(0, 8);
    if (questions.length >= 3) {
      return {
        mode: 'llm',
        questions,
        focus: normalizeInterviewLines(parsed.focus).slice(0, 8) || mustHave.slice(0, 6),
        tips: normalizeInterviewLines(parsed.tips),
      };
    }
  } catch {
    /* fallback */
  }

  return { mode: 'fallback', questions: FALLBACK_QUESTIONS, focus: mustHave.slice(0, 6), tips: [] };
}
