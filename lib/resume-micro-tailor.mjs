/**
 * Текст блока «О себе» под вакансию (для последующей записи на hh.ru).
 */

import { loadCvBundle } from './cv-load.mjs';
import { extractJdKeywords, vacancyTextBlob } from './jd-keyword-extract.mjs';
import { hrScreeningAnswersBlock } from './hr-screening-answers.mjs';
import {
  getOpenRouterApiKey,
  resolveOpenRouterModelForRequest,
  isCustomLlmRunnable,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
} from './openrouter-score.mjs';

/**
 * @param {object} vacancy
 */
export async function buildMicroAboutText(vacancy) {
  const cvBundle = await loadCvBundle();
  const { mustHave } = extractJdKeywords(vacancy);
  const screening = hrScreeningAnswersBlock();
  const blob = vacancyTextBlob(vacancy).slice(0, 4000);

  const apiKey = getOpenRouterApiKey();
  if (!apiKey && !isCustomLlmRunnable()) {
    return fallbackAbout(mustHave);
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

  const user = `Напиши блок «О себе» для hh.ru (400–600 символов).
Вакансия: ${vacancy.title}
Компания: ${vacancy.company || '—'}
Ключи: ${mustHave.join(', ') || 'DevOps, Linux, Docker'}

Правила: только факты из резюме, 1 кейс с цифрой, без списков тегов, живой русский.

Резюме:
${cvBundle.text.slice(0, 8000)}

Стандартные ответы:
${screening}

Описание вакансии:
${blob}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Карьерный редактор. Только текст блока, без markdown.' },
          { role: 'user', content: user },
        ],
        temperature: 0.35,
        max_tokens: 500,
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(raw.slice(0, 200));
    const data = JSON.parse(raw);
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (text.length >= 120) return text.slice(0, 1200);
  } catch {
    /* fallback */
  }
  return fallbackAbout(mustHave);
}

/**
 * @param {string[]} mustHave
 */
function fallbackAbout(mustHave) {
  const keys = mustHave.length ? mustHave.slice(0, 5).join(', ') : 'Linux, Docker, мониторинг, CI/CD';
  return `DevOps junior+/middle: опыт L2 и инфраструктуры в банковском проде — инциденты, релизы, ${keys}. Готов к удалёнке, выход через 1–2 недели.`.slice(
    0,
    600
  );
}
