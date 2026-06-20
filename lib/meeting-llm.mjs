import {
  getCustomLlmApiKey,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getOpenRouterApiKey,
  isCustomLlmRunnable,
  isLikelyOpenRouterQuotaError,
  resolveOpenRouterModelForRequest,
} from './openrouter-score.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {{ system: string, user: string, maxTokens?: number, temperature?: number }} opts
 */
export async function callMeetingLlm(opts) {
  const prefer = (process.env.MEETING_LLM_PREFER || '').trim().toLowerCase();
  if (prefer === 'ollama' || prefer === 'custom') {
    if (isCustomLlmRunnable()) return callCustomLlmWithRetry(opts);
    throw new Error('MEETING_LLM_PREFER=ollama, но HH_CUSTOM_LLM_* не настроен');
  }

  const apiKey = getOpenRouterApiKey();
  if (apiKey) {
    try {
      return await callOpenRouter(opts, apiKey);
    } catch (e) {
      if (isCustomLlmRunnable() && isLikelyOpenRouterQuotaError(e)) {
        console.warn('[meeting-llm] OpenRouter quota, fallback Ollama:', e.message.slice(0, 120));
        return callCustomLlmWithRetry(opts);
      }
      throw e;
    }
  }
  if (isCustomLlmRunnable()) {
    return callCustomLlmWithRetry(opts);
  }
  throw new Error('Нет LLM: задайте OpenRouter_API_KEY или HH_CUSTOM_LLM_*');
}

async function callCustomLlmWithRetry(opts, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callCustomLlm(opts);
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        console.warn(`[meeting-llm] retry ${i + 2}/${attempts}:`, e.message.slice(0, 80));
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }
  throw last;
}

async function callOpenRouter(opts, apiKey) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
    },
    body: JSON.stringify({
      model: resolveOpenRouterModelForRequest(),
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('OpenRouter: пустой ответ');
  return text;
}

async function callCustomLlm(opts) {
  const base = getCustomLlmBaseUrl();
  const model = getCustomLlmModel();
  const headers = { 'Content-Type': 'application/json' };
  const customKey = getCustomLlmApiKey();
  if (customKey) headers.Authorization = `Bearer ${customKey}`;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Custom LLM ${res.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('Custom LLM: пустой ответ');
  return text;
}

export function chunkText(text, size = 12000) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}
