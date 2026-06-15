/**
 * Черновик ответа работодателю в чате hh.ru по резюме (OpenRouter / custom LLM).
 */

import { loadCvBundle } from './cv-load.mjs';
import { interviewNotesContextSnippet } from './interview-notes.mjs';
import { hrScreeningAnswersBlock } from './hr-screening-answers.mjs';
import { extractJdKeywords } from './jd-keyword-extract.mjs';
import {
  getOpenRouterApiKey,
  extractJsonObject,
  resolveOpenRouterModelForRequest,
  isCustomLlmRunnable,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
} from './openrouter-score.mjs';

async function callLlmJson({ system, user, maxTokens = 500 }) {
  const apiKey = getOpenRouterApiKey();
  let url = 'https://openrouter.ai/api/v1/chat/completions';
  let model = resolveOpenRouterModelForRequest();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER || 'http://localhost';
    headers['X-Title'] = 'hh-ru-apply-chat-reply';
  } else if (isCustomLlmRunnable()) {
    url = `${getCustomLlmBaseUrl()}/chat/completions`;
    model = getCustomLlmModel();
    const k = getCustomLlmApiKey();
    if (k) headers.Authorization = `Bearer ${k}`;
  } else {
    throw new Error('Нет LLM для черновика ответа (OpenRouter или HH_CUSTOM_LLM_*)');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.35,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const text = data?.choices?.[0]?.message?.content;
  return extractJsonObject(text);
}

/**
 * @param {{ vacancyTitle: string, company: string, messages: Array<{ text: string, kind: string }> }} input
 */
export async function draftChatReply(input) {
  const cvBundle = await loadCvBundle();
  const interviewCtx = interviewNotesContextSnippet();
  const screening = hrScreeningAnswersBlock();
  const jd = extractJdKeywords({
    title: input.vacancyTitle,
    company: input.company,
    description: input.description || '',
  });
  const thread = (input.messages || [])
    .slice(-12)
    .map((m) => `[${m.kind}] ${m.text}`)
    .join('\n');

  const isBot = (input.messages || []).some((m) => m.kind === 'auto_reply' || m.kind === 'question');

  const userPrompt = `Работодатель написал в чате hh.ru после отклика. Это может быть ИИ-помощник работодателя или живой HR.

Вакансия: ${input.vacancyTitle}
Компания: ${input.company || '—'}
Ключи из вакансии: ${jd.mustHave.join(', ') || '—'}

Переписка:
${thread}

Правила:
- Только факты из резюме, без выдумок.
- ${isBot ? '8–12 предложений, развёрнуто: STAR (ситуация → действие → результат), цифры из опыта.' : '5–8 предложений, по делу.'}
- Мотивация именно к этой вакансии и стеку.
- Используй стандартные ответы где уместно (старт, зарплата, формат).
- Без markdown, вежливое «вы» к работодателю.

СТАНДАРТНЫЕ ОТВЕТЫ:
${screening}

РЕЗЮМЕ:
${cvBundle.text.slice(0, 12000)}
${interviewCtx ? `\n\nЗАМЕТКИ С СОБЕСЕДОВАНИЙ:\n${interviewCtx}` : ''}

Верни JSON: {"reply": "текст ответа"}`;

  try {
    const parsed = await callLlmJson({
      system:
        'Ты помощник соискателя на hh.ru. Если это ИИ-скрининг работодателя — отвечай подробно как на собеседовании. Ответ только JSON {"reply":"..."}.',
      user: userPrompt,
      maxTokens: isBot ? 900 : 600,
    });
    return { reply: String(parsed.reply || '').trim(), source: 'llm' };
  } catch {
    /* fallback below */
  }

  const lastQ = (input.messages || []).filter((m) => m.kind === 'question').pop();
  const fallback = lastQ
    ? `Добрый день! Спасибо за сообщение. По вашему вопросу: релевантный опыт есть (поддержка L2, инфраструктура, мониторинг, CI/CD-культура) — детали в резюме. Готов обсудить на созвоне.`
    : `Добрый день! Спасибо за обратную связь. Заинтересован в позиции, готов ответить на уточняющие вопросы.`;

  return { reply: fallback, source: 'fallback' };
}
