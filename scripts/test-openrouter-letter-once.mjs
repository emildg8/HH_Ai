import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

import { getOpenRouterApiKey, resolveOpenRouterModelForRequest } from '../lib/openrouter-score.mjs';

const key = getOpenRouterApiKey();
const model = resolveOpenRouterModelForRequest();
const body = {
  model,
  messages: [{ role: 'user', content: 'Верни JSON: {"variants":["Короткое тестовое письмо для проверки API."]}' }],
  max_tokens: 400,
  temperature: 0.3,
  response_format: { type: 'json_object' },
};

const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const raw = await res.text();
console.log('status', res.status);
const data = JSON.parse(raw);
console.log(JSON.stringify(data?.choices?.[0]?.message, null, 2)?.slice(0, 800));
