import { loadRecentFeedback } from './feedback-context.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Дефолт при отсутствии OPENROUTER_MODEL (и для free, и для allow paid без env). */
export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

/** Раньше по умолчанию давали эту строку — на OpenRouter её больше нет (404). */
function effectiveOpenRouterModelFromEnv() {
  let raw = (process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL).trim();
  if (/qwen3\.6-plus-preview/i.test(raw)) {
    console.warn(
      '[hh-ru-apply] OPENROUTER_MODEL указывает на снятую с маршрута модель — подставляю openrouter/free'
    );
    raw = DEFAULT_OPENROUTER_MODEL;
  }
  return raw;
}

/** Убрать обёртку ```json … ``` если модель её добавила. */
export function stripMarkdownJsonFence(text) {
  let s = String(text).trim();
  if (/^```/i.test(s)) {
    s = s.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  return s;
}

/** Частая причина падения JSON.parse у локальных моделей. */
export function fixSmartQuotesInJsonText(s) {
  return String(s).replace(/[\u201c\u201d\u201e\u00ab\u00bb\u2033\u2036]/g, '"');
}

/**
 * Вырезать первый сбалансированный `{…}` с учётом строк и экранирования.
 * Старый вариант через lastIndexOf('}') ломался, если в значении JSON (текст письма) была символ `}`.
 */
function sliceBalancedJsonObject(str, startIdx) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  throw new Error('В ответе модели нет полного JSON-объекта (скобки { } не сбалансированы)');
}

/**
 * Находит первый сбалансированный объект `{…}`, который удаётся распарсить
 * (если до JSON был текст «Here is:» или лишняя `{` в начале).
 */
export function extractJsonObject(text) {
  const s0 = stripMarkdownJsonFence(text);
  const s = fixSmartQuotesInJsonText(s0);
  let pos = 0;
  while (pos < s.length) {
    const start = s.indexOf('{', pos);
    if (start === -1) {
      break;
    }
    try {
      const jsonStr = sliceBalancedJsonObject(s, start);
      return JSON.parse(jsonStr);
    } catch {
      pos = start + 1;
    }
  }
  throw new Error('В ответе модели нет JSON-объекта');
}

function buildFeedbackNarrative(entries) {
  if (!entries.length) return '';
  const lines = entries
    .filter((e) => e.action === 'reject' && e.reason)
    .slice(-12)
    .map((e) => `- «${(e.title || '').slice(0, 80)}»: ${e.reason}`);
  if (!lines.length) return '';
  return `\nРанее вы отклоняли вакансии с такими формулировками (учти при отклике):\n${lines.join('\n')}\n`;
}

export function getOpenRouterApiKey() {
  return (
    process.env.OpenRouter_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    ''
  ).trim();
}

/** База OpenAI-совместимого API без завершающего слэша (Ollama, LM Studio, vLLM…). */
export function getCustomLlmBaseUrl() {
  const raw = (process.env.HH_CUSTOM_LLM_BASE_URL || process.env.OLLAMA_BASE_URL || '').trim();
  return raw.replace(/\/+$/, '');
}

/** Имя модели на вашем сервере (обязательно, если задан HH_CUSTOM_LLM_BASE_URL). */
export function getCustomLlmModel() {
  return (process.env.HH_CUSTOM_LLM_MODEL || process.env.OLLAMA_MODEL || '').trim();
}

/** Необязательный Bearer для локального API (LM Studio и т.п.). */
export function getCustomLlmApiKey() {
  return (process.env.HH_CUSTOM_LLM_API_KEY || '').trim();
}

export function isCustomLlmConfigured() {
  return Boolean(getCustomLlmBaseUrl());
}

/** Полный набор для вызова внутреннего API: база + имя модели. */
export function isCustomLlmRunnable() {
  return Boolean(getCustomLlmBaseUrl() && getCustomLlmModel());
}

/**
 * Сколько успешных вызовов OpenRouter отдать перед переключением на HH_CUSTOM_LLM (если он задан).
 * По умолчанию: при настроенном внутреннем LLM — **0** (только локальный канал, без 429 у openrouter/free).
 * Явно задайте HH_OPENROUTER_MAX_CALLS_PER_RUN=30 (и т.д.), если нужен гибрид «сначала OpenRouter».
 * 0 = не вызывать OpenRouter, только внутренний LLM.
 */
export function resolveMaxOpenRouterCallsPerRun() {
  const raw = process.env.HH_OPENROUTER_MAX_CALLS_PER_RUN;
  if (raw === undefined || String(raw).trim() === '') {
    return isCustomLlmRunnable() ? 0 : Number.POSITIVE_INFINITY;
  }
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) {
    return isCustomLlmRunnable() ? 0 : Number.POSITIVE_INFINITY;
  }
  return n;
}

/** Состояние на один прогон harvest или одну операцию в дашборде. */
export function createLlmRoutingContext() {
  return {
    openRouterSuccessCount: 0,
    openRouterQuotaExhausted: false,
  };
}

export function isLikelyOpenRouterQuotaError(err) {
  const msg = String(err?.message ?? err);
  const m = msg.match(/\bLLM\s+(\d{3})\b/i) || msg.match(/\bOpenRouter\s+(\d{3})\b/i);
  if (m) {
    const code = m[1];
    if (code === '429' || code === '402' || code === '503') return true;
  }
  return /rate\s*limit|quota|insufficient|credit|billing|limit exceeded|exceeded your|too many requests|temporarily unavailable|overload|payment required/i.test(
    msg
  );
}

/**
 * Для `score-openrouter-until-quota.mjs`: остановить батч при явном исчерпании квоты / лимита.
 * 503 и «no healthy upstream» — не считаем концом бесплатного лимита (временные сбои провайдера).
 */
export function shouldStopOpenRouterQuotaRun(err) {
  const msg = String(err?.message ?? err);
  const m = msg.match(/\bLLM\s+(\d{3})\b/i) || msg.match(/\bOpenRouter\s+(\d{3})\b/i);
  if (m) {
    const code = m[1];
    if (code === '429' || code === '402') return true;
    return false;
  }
  return /rate\s*limit|quota|insufficient\s*credit|billing|payment\s*required|exceeded your|free\s*tier|no\s*credits/i.test(
    msg
  );
}

/**
 * Есть ли канал для оценки вакансий: ключ OpenRouter и/или свой endpoint с моделью.
 */
export function hasScoreProviderCredentials() {
  const hasOrKey = Boolean(getOpenRouterApiKey());
  return isCustomLlmRunnable() || hasOrKey;
}

export function resolveFreeOpenRouterModel() {
  const raw = effectiveOpenRouterModelFromEnv();
  if (raw === 'openrouter/free') return raw;
  if (raw.endsWith(':free')) return raw;
  throw new Error(
    `OPENROUTER_MODEL="${raw}" — не бесплатный вариант. Используйте "openrouter/free" или id модели с суффиксом ":free". Для платных моделей задайте OPENROUTER_ALLOW_PAID=1 (не рекомендуется для тестов).`
  );
}

export function resolveOpenRouterModelForRequest() {
  const allowPaid = process.env.OPENROUTER_ALLOW_PAID === '1';
  if (allowPaid) {
    return effectiveOpenRouterModelFromEnv();
  }
  return resolveFreeOpenRouterModel();
}

function clampScore(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(100, Math.max(0, Math.round(x)));
}

function normalizedWeights(prefs) {
  const w = prefs?.llmScoreWeights || {};
  let v = Number(w.vacancy);
  let c = Number(w.cvMatch);
  if (!Number.isFinite(v)) v = 0.35;
  if (!Number.isFinite(c)) c = 0.65;
  const sum = v + c;
  if (sum <= 0) return { v: 0.35, c: 0.65 };
  return { v: v / sum, c: c / sum };
}

function resolveThreeScores(parsed, prefs) {
  const legacy = Number(parsed.score);
  const svRaw = parsed.scoreVacancy;
  const scRaw = parsed.scoreCvMatch;
  const soRaw = parsed.scoreOverall;

  let scoreVacancy = clampScore(svRaw);
  let scoreCvMatch = clampScore(scRaw);

  if (
    !Number.isFinite(Number(svRaw)) &&
    !Number.isFinite(Number(scRaw)) &&
    Number.isFinite(legacy)
  ) {
    const o = clampScore(legacy);
    return {
      scoreVacancy: o,
      scoreCvMatch: o,
      scoreOverall: o,
    };
  }

  let scoreOverall = clampScore(soRaw);
  const overallValid = Number.isFinite(Number(soRaw)) && Number(soRaw) >= 0 && Number(soRaw) <= 100;
  if (!overallValid) {
    const { v, c } = normalizedWeights(prefs);
    scoreOverall = clampScore(v * scoreVacancy + c * scoreCvMatch);
  }

  return { scoreVacancy, scoreCvMatch, scoreOverall };
}

function buildUserPrompt(vacancy, cvBundle, prefs, feedbackBlock) {
  void prefs;
  return `Ты помощник одного соискателя. Он сам решает, на какие вакансии откликаться. У него ДВЕ версии резюме ниже — ОБЕ его, просто под разные акценты/направления (не два разных человека).
Целевая роль сейчас: DevOps / SRE / платформенная инженерия, уровень junior+ / middle (не senior-only позиции без запаса по стеку).
Жёсткие фильтры (зарплата, удалёнка и т.д.) уже применены скриптом до тебя.
${feedbackBlock}
Оцени вакансию с его точки зрения: стоит ли тратить время на отклик.

Смысл полей scoreVacancy / scoreCvMatch / scoreOverall — целые от 0 до 100:
- scoreVacancy: насколько сама вакансия по тексту объявления уместна и интересна для его профиля (домен, уровень, тип роли, красные флаги). Без построчной сверки с резюме.
- scoreCvMatch: насколько его оба резюме перекрывают требования вакансии; насколько обоснован отклик с этими CV.
- scoreOverall: насколько в целом имеет смысл откликаться (совмести оба сигнала).

Поле summary: кратко для него, обращение на «ты»; без сухого от третьего лица про «кандидата».

Поле risks: нюансы и зоны внимания при отклике с ЕГО двумя резюме. Пиши ТОЛЬКО на «ты» / «у тебя» (например: «У тебя больше опыта в X, а в вакансии упор на Y»). НЕ пиши «кандидаты», «кандидат», «соискатели» — это всегда один и тот же человек с двумя версиями CV.

matchCv: primary | secondary | both | none — какое резюме логичнее вести первым (первый файл в блоке «МОИ РЕЗЮМЕ» = primary, второй = secondary).

Верни СТРОГО один JSON без markdown и без текста до/после:
{
  "scoreVacancy": 0,
  "scoreCvMatch": 0,
  "scoreOverall": 0,
  "summary": "",
  "risks": "",
  "matchCv": "both",
  "tags": []
}
(подставь свои числа и строки вместо примеров)

ВАКАНСИЯ:
Заголовок: ${vacancy.title}
Компания: ${vacancy.company}
Зарплата (как на сайте): ${vacancy.salaryRaw}
URL: ${vacancy.url}

Описание (фрагмент):
${vacancy.description.slice(0, 8000)}

МОИ РЕЗЮМЕ (два варианта):
${cvBundle.text.slice(0, 12_000)}
`;
}

/**
 * Общий путь: POST …/chat/completions (OpenAI-совместимый ответ).
 */
async function scoreVacancyViaChatCompletions({
  url,
  model,
  vacancy,
  cvBundle,
  prefs,
  requestHeaders,
}) {
  const feedbackBlock = buildFeedbackNarrative(loadRecentFeedback(25));
  const userPrompt = buildUserPrompt(vacancy, cvBundle, prefs, feedbackBlock);

  const headers = {
    'Content-Type': 'application/json',
    ...requestHeaders,
  };

  const isOpenRouter = String(url).includes('openrouter.ai');
  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'Ты помогаешь одному соискателю решить, откликаться ли на вакансию. У него два варианта одного резюме под разные роли. В summary и risks обращайся на «ты». Ответ только одним JSON-объектом, без ``` и без текста до/после.',
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.35,
    max_tokens: 800,
    ...(isOpenRouter && process.env.OPENROUTER_FORCE_JSON !== '0'
      ? { response_format: { type: 'json_object' } }
      : {}),
  };
  const ollamaGpu = (process.env.HH_OLLAMA_NUM_GPU || '').trim();
  if (!isOpenRouter && ollamaGpu) {
    const n = Number(ollamaGpu);
    if (Number.isFinite(n) && n >= 0) requestBody.options = { num_gpu: n };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${rawText.slice(0, 500)}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`LLM: не JSON в теле ответа: ${rawText.slice(0, 300)}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('LLM: пустой ответ choices[0].message.content');
  }

  let parsed;
  try {
    parsed = extractJsonObject(text);
  } catch (e) {
    // Некоторые бесплатные модели на OpenRouter игнорируют требование "только JSON".
    // Делаем 1 ремонт-запрос, передавая им их же текст и заставляя выдать JSON.
    if (process.env.OPENROUTER_REPAIR_JSON !== '0') {
      const repairSystem =
        'Ты парсер/структуратор. На входе текст, который может быть невалидным. Верни только JSON-объект с полями: scoreVacancy (0-100), scoreCvMatch (0-100), scoreOverall (0-100), summary (строка), risks (строка), matchCv (string: primary|secondary|both|none), tags (массив строк). Без markdown и без текста до/после.';
      const repairUser = `Исходный ответ модели (может содержать пояснения):\n\n${text}`;

      const repairBody = {
        model,
        messages: [
          { role: 'system', content: repairSystem },
          { role: 'user', content: repairUser },
        ],
        temperature: 0,
        max_tokens: 420,
        ...(isOpenRouter ? { response_format: { type: 'json_object' } } : {}),
      };
      if (!isOpenRouter && ollamaGpu) {
        const n = Number(ollamaGpu);
        if (Number.isFinite(n) && n >= 0) repairBody.options = { num_gpu: n };
      }

      const repairRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(repairBody),
      });
      const repairRaw = await repairRes.text();
      if (!repairRes.ok) {
        throw new Error(`OpenRouter repair failed (${repairRes.status}): ${repairRaw.slice(0, 300)}`);
      }
      let repairData;
      try {
        repairData = JSON.parse(repairRaw);
      } catch {
        throw new Error(`OpenRouter repair: не JSON в теле ответа: ${repairRaw.slice(0, 220)}`);
      }
      const repairText = repairData?.choices?.[0]?.message?.content;
      if (!repairText || typeof repairText !== 'string') {
        throw new Error('OpenRouter repair: пустой choices[0].message.content');
      }
      try {
        parsed = extractJsonObject(repairText);
      } catch (e2) {
        throw new Error(
          `OpenRouter JSON parse error (with repair): ${String(e2?.message || e2)}`
        );
      }
    } else {
      throw new Error(
        `OpenRouter JSON parse error: ${String(e?.message || e)}. Raw message (first 600 chars): ${String(
          text
        ).slice(0, 600)}`
      );
    }
  }
  const usedModel = data?.model || model;
  const { scoreVacancy, scoreCvMatch, scoreOverall } = resolveThreeScores(parsed, prefs);

  return {
    score: scoreOverall,
    scoreVacancy,
    scoreCvMatch,
    scoreOverall,
    summary: String(parsed.summary || '').trim(),
    risks: String(parsed.risks || '').trim(),
    matchCv: String(parsed.matchCv || 'none').trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    rawModelText: text.slice(0, 2000),
    providerModel: usedModel,
  };
}

/**
 * Локальный / свой сервер: OpenAI Chat Completions (Ollama, LM Studio, Azure OpenAI с /v1 и т.д.).
 */
export async function scoreVacancyWithCustomLlm(vacancy, cvBundle, prefs) {
  const base = getCustomLlmBaseUrl();
  const model = getCustomLlmModel();
  if (!base) {
    throw new Error('Задайте HH_CUSTOM_LLM_BASE_URL (например http://127.0.0.1:11434/v1 для Ollama)');
  }
  if (!model) {
    throw new Error('Задайте HH_CUSTOM_LLM_MODEL (имя модели на сервере)');
  }

  const url = `${base}/chat/completions`;
  const customKey = getCustomLlmApiKey();
  const requestHeaders = {};
  if (customKey) {
    requestHeaders.Authorization = `Bearer ${customKey}`;
  }

  return scoreVacancyViaChatCompletions({
    url,
    model,
    vacancy,
    cvBundle,
    prefs,
    requestHeaders,
  });
}

/**
 * Оценка вакансии с приоритетом OpenRouter, затем внутренний LLM (если задан HH_CUSTOM_LLM_BASE_URL).
 * Передайте один `createLlmRoutingContext()` на весь цикл harvest — счётчик успехов OpenRouter общий.
 * Возвращает поле `llmSource`: `'openrouter'` | `'custom'`.
 *
 * @param {{ openRouterSuccessCount: number, openRouterQuotaExhausted: boolean } | null | undefined} routing
 */
export async function scoreVacancyWithLlm(vacancy, cvBundle, prefs, routing) {
  const ctx = routing ?? createLlmRoutingContext();
  const hasOR = Boolean(getOpenRouterApiKey());
  const hasCustom = isCustomLlmRunnable();
  const maxOR = resolveMaxOpenRouterCallsPerRun();
  const withSource = (r, source) => ({ ...r, llmSource: source });

  /** Явно: только локальный LLM, OpenRouter не трогаем (избегаем 429 у openrouter/free). */
  if (maxOR === 0 && hasCustom) {
    return withSource(await scoreVacancyWithCustomLlm(vacancy, cvBundle, prefs), 'custom');
  }

  /** 0 без запасного LLM = без лимита; 0 с запасным = только внутренний. */
  const effectiveMaxOr =
    maxOR === 0 && !hasCustom ? Number.POSITIVE_INFINITY : maxOR;
  const withinOrBudget =
    effectiveMaxOr === Number.POSITIVE_INFINITY || ctx.openRouterSuccessCount < effectiveMaxOr;

  if (hasOR && !ctx.openRouterQuotaExhausted && withinOrBudget) {
    try {
      const r = await scoreVacancyWithOpenRouter(vacancy, cvBundle, prefs);
      ctx.openRouterSuccessCount++;
      return withSource(r, 'openrouter');
    } catch (e) {
      if (hasCustom) {
        ctx.openRouterQuotaExhausted = true;
        console.warn(
          `OpenRouter недоступен (${String(e.message).slice(0, 220)}). Дальше в этом прогоне — HH_CUSTOM_LLM_*`
        );
        return withSource(await scoreVacancyWithCustomLlm(vacancy, cvBundle, prefs), 'custom');
      }
      throw e;
    }
  }

  if (hasCustom) {
    return withSource(await scoreVacancyWithCustomLlm(vacancy, cvBundle, prefs), 'custom');
  }

  if (hasOR) {
    const r = await scoreVacancyWithOpenRouter(vacancy, cvBundle, prefs);
    return withSource(r, 'openrouter');
  }

  throw new Error(
    'Нет OpenRouter_API_KEY и не настроен внутренний LLM (HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL).'
  );
}

/**
 * @param {{ title: string, company: string, salaryRaw: string, description: string, url: string }} vacancy
 * @param {{ text: string }} cvBundle
 * @param {object} prefs — preferences.json (в т.ч. llmScoreWeights)
 */
export async function scoreVacancyWithOpenRouter(vacancy, cvBundle, prefs) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(
      'Нет OpenRouter_API_KEY или OPENROUTER_API_KEY (см. config/secrets.example.env). Либо настройте HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL.'
    );
  }

  const model = resolveOpenRouterModelForRequest();

  return scoreVacancyViaChatCompletions({
    url: OPENROUTER_URL,
    model,
    vacancy,
    cvBundle,
    prefs,
    requestHeaders: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
      'X-Title': 'hh-ru-apply',
    },
  });
}
