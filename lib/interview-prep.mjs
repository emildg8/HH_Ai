/**
 * Подготовка к интервью по карточке вакансии (приглашение на hh.ru).
 */

import { loadInterviewNotes } from './interview-notes.mjs';
import { loadCvBundle } from './cv-load.mjs';
import { extractJsonObject, getOpenRouterApiKey, resolveOpenRouterModelForRequest, isCustomLlmRunnable, getCustomLlmBaseUrl, getCustomLlmModel, getCustomLlmApiKey } from './openrouter-score.mjs';

async function callPrepLlm(system, user) {
  const apiKey = getOpenRouterApiKey();
  let url = 'https://openrouter.ai/api/v1/chat/completions';
  let model = resolveOpenRouterModelForRequest();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (isCustomLlmRunnable()) {
    url = `${getCustomLlmBaseUrl()}/chat/completions`;
    model = getCustomLlmModel();
    const k = getCustomLlmApiKey();
    if (k) headers.Authorization = `Bearer ${k}`;
  } else {
    return null;
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
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = JSON.parse(raw);
  return extractJsonObject(data?.choices?.[0]?.message?.content || '{}');
}

/**
 * @param {object} rec — запись очереди
 */
export async function buildInterviewPrepPack(rec) {
  const notes = loadInterviewNotes();
  const cvBundle = await loadCvBundle();
  const desc = String(rec.descriptionForLlm || rec.descriptionPreview || '').slice(0, 6000);
  const noteExcerpt = (notes.topics || [])
    .slice(0, 5)
    .map((t) => `• ${t.title}: ${(t.excerpt || '').slice(0, 300)}`)
    .join('\n');

  const checklist = [
    'Уточнить формат: удалёнка / гибрид / офис, часовой пояс',
    'Вилка ЗП и оформление (ТК / ИП / самозанятость)',
    'Стек и зона ответственности (дежурства, on-call)',
    'Команда, процессы (Agile, релизы, инциденты)',
    'Подготовить 2–3 кейса: инцидент, автоматизация, релиз/мониторинг',
    'Вопросы работодателю: рост в DevOps, менторство, испытательный срок',
  ];

  let llmBlock = null;
  try {
    llmBlock = await callPrepLlm(
      'Ты карьерный коуч. Ответ JSON без markdown.',
      `Вакансия: ${rec.title}\nКомпания: ${rec.company}\n\nОписание:\n${desc}\n\nРезюме:\n${cvBundle.text.slice(0, 8000)}\n\nЗаметки с прошлых собесов:\n${noteExcerpt || '—'}\n\nВерни JSON: {"strengths":[],"gaps":[],"techQuestions":[],"behavioralQuestions":[],"questionsToEmployer":[],"pitch":"краткий самопитч 60 сек"}`
    );
  } catch {
    llmBlock = null;
  }

  return {
    generatedAt: new Date().toISOString(),
    vacancyTitle: rec.title,
    company: rec.company,
    checklist,
    llm: llmBlock,
    pastNotesUsed: (notes.topics || []).length,
  };
}
