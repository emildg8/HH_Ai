import fs from 'fs';
import path from 'path';
import {
  getOpenRouterApiKey,
  extractJsonObject,
  fixSmartQuotesInJsonText,
  resolveOpenRouterModelForRequest,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
  isCustomLlmRunnable,
  resolveMaxOpenRouterCallsPerRun,
  stripMarkdownJsonFence,
} from './openrouter-score.mjs';
import { ROOT } from './paths.mjs';
import { buildStyleContextBlock } from './cover-letter-style-context.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const COVER_CANDIDATES = [
  path.join(ROOT, 'config', 'cover-letter.txt'),
  path.join(ROOT, 'config', 'cover-letter.example.txt'),
];

function loadCoverLetterTemplateHint() {
  for (const fp of COVER_CANDIDATES) {
    if (fs.existsSync(fp)) {
      const t = fs.readFileSync(fp, 'utf8').trim();
      if (t) return t.slice(0, 2000);
    }
  }
  return '';
}

/** Сколько вариантов письма генерировать (1–20). По умолчанию 3 — как в публичной версии проекта. Переменная: COVER_LETTER_VARIANT_COUNT. */
export function getCoverLetterVariantCount() {
  const n = Number(process.env.COVER_LETTER_VARIANT_COUNT);
  if (Number.isFinite(n) && n >= 1 && n <= 20) return Math.floor(n);
  return 3;
}

/**
 * @param {unknown} raw — массив строк или (при save-draft) уже нормализованный массив с пустыми слотами
 * @param {{ forSaveDraft?: boolean }} [opts]
 */
export function normalizeVariants(raw, opts = {}) {
  const count = getCoverLetterVariantCount();
  const fromArr = Array.isArray(raw) ? raw.map((s) => String(s).trim()) : [];
  const arr = fromArr.filter(Boolean);
  const { forSaveDraft = false } = opts;

  if (forSaveDraft) {
    let out = fromArr.map((s) => String(s).trim()).filter(Boolean);
    if (out.length > count) out = out.slice(0, count);
    while (out.length < count && out.length > 0) {
      out.push(out[out.length - 1]);
    }
    return out;
  }

  if (!arr.length) {
    throw new Error(
      'В ответе LLM нет ни одного текста в variants (или JSON не разобрался). Проверьте модель, max_tokens или COVER_LETTER_VARIANT_COUNT.'
    );
  }
  if (arr.length > count) return arr.slice(0, count);
  return arr;
}

function isJunkLetterVariant(s) {
  const t = String(s).trim();
  if (!t) return true;
  if (/верни\s+строго|строго\s+один\s+json/i.test(t)) return true;
  if (/текст\s+варианта\s*\d/i.test(t) && /полное\s+письмо/i.test(t)) return true;
  if (/^\s*\{\s*"variants"\s*:/i.test(t)) return true;
  const low = t.toLowerCase();
  if (
    /нет\s+конкретных\s+вопрос|не[тт]\s+конкретных\s+вопрос|представляет\s+собой\s+резюме|ответить\s+с\s+помощью\s+json/i.test(
      low
    )
  ) {
    return true;
  }
  if (t.length < 36 && /json|variants|markdown/.test(low)) return true;
  return false;
}

/** Убирает строки-эхо инструкций и не-письма после слабого разбора модели. */
export function sanitizeLetterVariants(arr) {
  return arr.map((s) => String(s).trim()).filter((t) => t && !isJunkLetterVariant(t));
}

function keepSubstantialLetterVariants(arr, minLen = 120) {
  return arr.filter((t) => {
    const s = String(t).trim();
    if (s.length < minLen) return false;
    if (!/[.!?]/.test(s)) return false;
    const low = s.toLowerCase();
    if (!/\b(я|готов|готова|отклика|откликнуть|буду\s+рад|интересна|позици|ваканси|команд)\b/.test(low)) {
      return false;
    }
    if (
      /\b(бакалавр|магистр|университет|информационные\s+технологии|вычислительные\s+машины)\b/.test(low) &&
      !/\b(ваканси|позици|отклик|команд)\b/.test(low)
    ) {
      return false;
    }
    return true;
  });
}

/** Достаёт массив текстов писем из объекта ответа модели (разные схемы ключей и вложенности). */
export function coerceVariantsFromParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return [];
  const v =
    parsed.variants ??
    parsed.VARIANTS ??
    parsed.letters ??
    parsed.coverLetters ??
    parsed.cover_letters;

  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.text ?? item.body ?? item.content ?? item.letter ?? '').trim();
        }
        return String(item ?? '').trim();
      })
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return [];
    try {
      const inner = JSON.parse(t);
      if (Array.isArray(inner)) return coerceVariantsFromParsed({ variants: inner });
    } catch {
      /* ignore */
    }
    if (/\n---\n/.test(t)) {
      return t
        .split(/\n---\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [t];
  }
  // Некоторые модели возвращают один объект письма без массива variants.
  const single =
    parsed.text ??
    parsed.body ??
    parsed.content ??
    parsed.letter ??
    parsed.coverLetter ??
    parsed.cover_letter;
  if (typeof single === 'string' && single.trim()) {
    return [single.trim()];
  }
  return [];
}

/** Убрать служебные префиксы (chain-of-thought и т.п.) перед поиском JSON. */
function stripLlmNoisePrefix(text) {
  let s = String(text);
  s = s.replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '');
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  return s.trim();
}

/**
 * Вырезать JSON-массив после "variants": если целый объект не парсится
 * (обрыв, лишний текст, кривые кавычки внутри писем).
 */
function sliceBalancedJsonArray(str, startIdx) {
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
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  return '';
}

function extractVariantsArrayLoose(rawText) {
  const t = fixSmartQuotesInJsonText(stripMarkdownJsonFence(stripLlmNoisePrefix(rawText)));
  const m = /"variants"\s*:\s*\[/i.exec(t);
  if (!m) return [];
  const bracketPos = m.index + m[0].length - 1;
  if (t[bracketPos] !== '[') return [];
  const slice = sliceBalancedJsonArray(t, bracketPos);
  if (!slice) return [];
  try {
    const arr = JSON.parse(slice);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return String(item.text ?? item.body ?? item.content ?? item.letter ?? '').trim();
        }
        return String(item ?? '').trim();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Парсинг корневого JSON-массива строк (некоторые модели отдают только [...]). */
function tryParseLeadingJsonStringArray(t) {
  const s = String(t).trim();
  if (!s.startsWith('[')) return [];
  const slice = sliceBalancedJsonArray(s, 0);
  if (!slice) return [];
  try {
    const arr = JSON.parse(slice);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Модель вернула обычный текст без объекта {"variants":…}:
 * массив строк в начале, блоки через ---, «Вариант N:», или одно цельное письмо.
 */
export function extractPlaintextVariants(rawText) {
  const t = stripMarkdownJsonFence(stripLlmNoisePrefix(String(rawText))).trim();
  if (!t || t.length < 60) return [];

  const fromRootArray = tryParseLeadingJsonStringArray(t);
  if (fromRootArray.length) return fromRootArray;

  const dashSplit = t
    .split(/\r?\n-{3,}\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 40);
  if (dashSplit.length >= 2) return dashSplit;

  const headerPieces = t.split(/\n(?=[ \t]*(?:Вариант|вариант)\s*[№#]?\s*\d+\s*[.:)\-–—])/i);
  const headerClean = headerPieces
    .map((chunk) =>
      chunk.replace(/^[ \t]*(?:Вариант|вариант)\s*[№#]?\s*\d+\s*[.:)\-–—]\s*/i, '').trim()
    )
    .filter((x) => x.length >= 40);
  if (headerClean.length >= 2) return headerClean;

  const notJsonObject =
    !/^\s*\{/.test(t) && !/^\s*"variants"\s*:/i.test(t) && !/"variants"\s*:\s*\[/i.test(t);
  if (notJsonObject && t.length >= 120) return [t];
  return [];
}

async function postChatCompletionsJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`LLM ${res.status}: ${rawText.slice(0, 500)}`);
  }
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`LLM: не JSON в теле ответа: ${rawText.slice(0, 300)}`);
  }
}

function parseCoverLetterChatResponse(data, model) {
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('LLM: пустой ответ choices[0].message.content');
  }
  const cleanedInput = stripLlmNoisePrefix(text);
  let coerced = [];
  let jsonErr = null;

  try {
    const parsed = extractJsonObject(cleanedInput);
    coerced = coerceVariantsFromParsed(parsed);
  } catch (e) {
    jsonErr = e;
  }

  if (!coerced.length) {
    coerced = extractVariantsArrayLoose(cleanedInput);
  }
  if (!coerced.length) {
    coerced = extractVariantsArrayLoose(text);
  }
  if (!coerced.length) {
    coerced = extractPlaintextVariants(cleanedInput);
  }
  if (!coerced.length) {
    coerced = extractPlaintextVariants(text);
  }

  let letters = sanitizeLetterVariants(coerced);
  letters = keepSubstantialLetterVariants(letters, 120);
  if (!letters.length) {
    const hint = jsonErr ? ` (${jsonErr.message})` : '';
    throw new Error(
      `LLM: не удалось извлечь варианты писем${hint}. Начало ответа: ${cleanedInput.slice(0, 420)}`
    );
  }

  const variants = normalizeVariants(letters);
  const usedModel = data?.model || model;
  return { variants, providerModel: usedModel };
}

/** Верхняя граница max_tokens на запрос (провайдер/модель могут отклонить или усечь). */
const MAX_COVER_LLM_OUT_TOKENS = (() => {
  const cap = Number(process.env.COVER_LETTER_MAX_OUTPUT_CAP);
  if (Number.isFinite(cap) && cap >= 4096) return Math.min(500_000, Math.floor(cap));
  return 200_000;
})();

function resolvePhaseMaxTokens(envKey, fallback) {
  const raw = process.env[envKey];
  const base =
    raw !== undefined && String(raw).trim() !== '' ? Number(String(raw).trim()) : fallback;
  if (!Number.isFinite(base) || base < 512) return Math.min(fallback, MAX_COVER_LLM_OUT_TOKENS);
  return Math.min(MAX_COVER_LLM_OUT_TOKENS, Math.floor(base));
}

function buildVacancyCvBlob(record, desc, summary, risks, tags, cvText) {
  return `ВАКАНСИЯ:
Заголовок: ${record.title || ''}
Компания: ${record.company || ''}
Зарплата: ${record.salaryRaw || ''}
URL: ${record.url || ''}

Описание:
${desc.slice(0, 9000)}

Краткий разбор (модель-оценка): ${summary}
Риски: ${risks}
Теги: ${tags}

РЕЗЮМЕ КАНДИДАТА (факты для письма, не вставляй весь блок дословно как ответ):
${cvText}`;
}

function buildDeterministicCoverLetters(record, cvText, variantCount) {
  const title = String(record.title || 'позицию').trim();
  const company = String(record.company || 'вашу команду').trim();
  const cvFacts = String(cvText || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 20 && x.length <= 140)
    .slice(0, 6);
  const fact1 = cvFacts[0] || 'есть опыт сопровождения критичных бизнес-процессов и поддержки пользователей';
  const fact2 = cvFacts[1] || 'работаю с SQL, Jira/Confluence и инструментами мониторинга';
  const fact3 = cvFacts[2] || 'быстро вхожу в контекст продукта и довожу задачи до результата';

  const base = [
    `Здравствуйте! Хочу откликнуться на позицию «${title}» в ${company}.`,
    `У меня практический опыт в поддержке и сопровождении систем: ${fact1}.`,
    `В ежедневной работе использую прикладные инструменты и процессы: ${fact2}.`,
    `Мне близок формат, где важно быстро разбирать инциденты, держать коммуникацию с бизнесом и фиксировать результаты в системе задач.`,
    `Если вам подходит такой профиль, буду рад обсудить задачи команды и формат взаимодействия.`,
  ].join(' ');
  const alt1 = [
    `Добрый день! Откликаюсь на вакансию «${title}».`,
    `По опыту могу усилить ${company} в части операционной поддержки и сопровождения: ${fact1}.`,
    `Особое внимание уделяю диагностике причин, прозрачной коммуникации и стабильному SLA; из инструментов регулярно использую ${fact2}.`,
    `Умею работать в кросс-функциональной среде, аккуратно документировать решения и сопровождать изменения до продакшена.`,
    `Готов быстро подключиться к задачам и показать результат в первые недели.`,
  ].join(' ');
  const alt2 = [
    `Здравствуйте! Рассматриваю роль «${title}» и хотел бы присоединиться к ${company}.`,
    `Мой профиль — поддержка прикладных систем и решение инцидентов второго уровня, а также сопровождение релизов.`,
    `Из релевантного опыта: ${fact3}.`,
    `Технически уверен в SQL/логах/мониторинге и умею объяснять статус работ понятным языком для бизнеса и команды.`,
    `Буду рад обсудить ваш стек, приоритеты и как мой опыт может быть полезен именно в этой роли.`,
  ].join(' ');

  return normalizeVariants([base, alt1, alt2].slice(0, variantCount));
}

async function runCoverLetterLlmRound(payloadBase, hasOR, skipOpenRouter, allowCustomFallback) {
  const runOpenRouter = async () => {
    const model = resolveOpenRouterModelForRequest();
    const data = await postChatCompletionsJson(
      OPENROUTER_URL,
      {
        Authorization: `Bearer ${getOpenRouterApiKey()}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
        'X-Title': 'hh-ru-apply-cover-letter',
      },
      { ...payloadBase, model }
    );
    return parseCoverLetterChatResponse(data, model);
  };

  const runCustom = async () => {
    const base = getCustomLlmBaseUrl();
    const model = getCustomLlmModel();
    const headers = {};
    const key = getCustomLlmApiKey();
    if (key) headers.Authorization = `Bearer ${key}`;
    const attempt = async (body) => {
      const data = await postChatCompletionsJson(`${base}/chat/completions`, headers, {
        ...body,
        model,
      });
      return parseCoverLetterChatResponse(data, model);
    };

    try {
      return await attempt(payloadBase);
    } catch (e) {
      const retryMessages = [
        {
          role: 'system',
          content:
            'Ты пишешь сопроводительные письма на русском для отклика на hh.ru. Не анализируй запрос и не упоминай JSON/формат/инструкцию. Верни только JSON {"variants":[...]}: каждый вариант 4-8 предложений и не короче 120 символов.',
        },
        ...payloadBase.messages,
        {
          role: 'user',
          content:
            'Повтор: нужны именно готовые тексты сопроводительных писем. Нельзя отвечать списком кнопок/действий вроде "Сохранить", "Отредактировать".',
        },
      ];
      const retryPayload = {
        ...payloadBase,
        messages: retryMessages,
        temperature: 0.45,
      };
      console.warn('[hh-ru-apply] HH_CUSTOM_LLM_*: повтор генерации писем после невалидного первого ответа:', e.message);
      return await attempt(retryPayload);
    }
  };

  if (hasOR && !skipOpenRouter) {
    try {
      return await runOpenRouter();
    } catch (e) {
      if (allowCustomFallback) {
        console.warn('Сопроводительное: OpenRouter не удался, использую HH_CUSTOM_LLM_*:', e.message);
        return await runCustom();
      }
      throw e;
    }
  }
  return await runCustom();
}

const antiAiRules = `
Жёстко избегай признаков «нейросетевого» текста:
- не начинай с «Уважаемые рекрутеры/меня зовут/я пишу вам, чтобы…» шаблонно;
- не используй цепочки прилагательных и пустые усилители («глубокие знания», «уникальный опыт», «идеально подхожу»);
- не перечисляй качества списком без привязки к фактам из резюме;
- допускай разговорные короткие фразы, одно уместное «я» — как у живого человека;
- конкретика из вакансии и CV, не общие слова про «динамичную компанию».`;

/** Одна генерация `variantCount` вариантов (см. COVER_LETTER_VARIANT_COUNT). */
async function generateCoverLetterSinglePhase(record, cvBundle, variantCount, hasOR, skipOpenRouter, allowCustomFallback) {
  const desc =
    (record.descriptionForLlm && String(record.descriptionForLlm)) ||
    (record.descriptionPreview && String(record.descriptionPreview)) ||
    '';
  const summary = String(record.geminiSummary || '').trim();
  const risks = String(record.geminiRisks || '').trim();
  const tags = Array.isArray(record.geminiTags) ? record.geminiTags.join(', ') : '';

  const templateHint = loadCoverLetterTemplateHint();
  const templateBlock = templateHint
    ? `\nПример структуры/тона (не копируй дословно, адаптируй):\n${templateHint}\n`
    : '';

  const styleBlockRaw = buildStyleContextBlock({
    maxChars: Number(process.env.COVER_LETTER_STYLE_MAX_CHARS) || 5000,
    maxItemsFromQueue: Number(process.env.COVER_LETTER_STYLE_QUEUE_ITEMS) || 4,
  });
  const styleBlock = styleBlockRaw
    ? `\nНиже — эталоны того, КАК автор уже писал сопроводительные (имитируй ритм, длину фраз, тёплость и прямоту; не переноси факты и формулировки из эталонов — пиши заново под эту вакансию).\n\n${styleBlockRaw}\n`
    : '';

  const userPrompt = `Напиши ${variantCount} РАЗНЫХ по смыслу, акцентам и формулировкам вариантов короткого сопроводительного письма на русском для отклика на эту вакансию.
Каждый вариант строго опирается на текст вакансии ниже и на резюме кандидата: разные факты/проекты/угол (техника, процессы, команда, зона ответственности и т.д.), без шаблонной перефразировки одного и того же абзаца.
Варианты не должны совпадать дословно или почти дословно; каждый — 4–8 предложений, по-человечески, без markdown.
${antiAiRules}
${styleBlock}
${templateBlock}
${buildVacancyCvBlob(record, desc, summary, risks, tags, cvBundle.text.slice(0, 16_000))}

Формат вывода: начни ответ с «{». Один JSON {"variants":["письмо1", ...]} — ровно ${variantCount} строк без пояснений до или после.`;

  const messages = [
    {
      role: 'system',
      content:
        `Ты помогаешь одному соискателю писать короткие сопроводительные письма на русском: естественно, без канцелярита и клише нейросетей. Если даны эталоны — копируй только стиль, не содержание.
Запрещено отвечать обычным текстом с пересказом резюме или вакансии — только JSON.
Не комментируй задание, не цитируй фразы из инструкции и не пиши мета-текст — сразу один JSON-объект вида {"variants":["письмо1",...]} (ровно ${variantCount} непустых строк). В строках только тексты писем, без markdown.`,
    },
    { role: 'user', content: userPrompt },
  ];

  const maxTok = resolvePhaseMaxTokens(
    'COVER_LETTER_MAX_TOKENS',
    Math.min(32_000, Math.max(2500, 1200 + variantCount * 1200))
  );
  const payloadBase = {
    messages,
    temperature: 0.52,
    max_tokens: maxTok,
  };
  if (String(process.env.COVER_LETTER_RESPONSE_JSON || '').trim() === '1') {
    payloadBase.response_format = { type: 'json_object' };
  }
  try {
    return await runCoverLetterLlmRound(payloadBase, hasOR, skipOpenRouter, allowCustomFallback);
  } catch (e) {
    if (isCustomLlmRunnable()) {
      const fallbackVariants = buildDeterministicCoverLetters(record, cvBundle.text, variantCount);
      console.warn(
        '[hh-ru-apply] LLM не дал валидные письма, использую локальный шаблонный fallback:',
        String(e.message).slice(0, 220)
      );
      return {
        variants: fallbackVariants,
        providerModel: `fallback-template:${getCustomLlmModel() || 'custom-llm'}`,
      };
    }
    throw e;
  }
}

/**
 * Сопроводительные в дашборде: при наличии ключа OpenRouter **всегда сначала OpenRouter**
 * (один запрос на кнопку; `HH_OPENROUTER_MAX_CALLS_PER_RUN` относится к harvest, не к UI).
 * Запасной канал HH_CUSTOM_LLM_* — только при сбое OpenRouter, если не задано
 * `COVER_LETTER_OPENROUTER_ONLY=1`. См. README и config/OPENROUTER.md.
 *
 * @param {object} record — запись из очереди (vacancies-queue)
 * @param {{ text: string }} cvBundle
 */
export async function generateCoverLetterVariants(record, cvBundle) {
  const hasOR = Boolean(getOpenRouterApiKey());
  const hasCustom = isCustomLlmRunnable();
  const openRouterOnly = String(process.env.COVER_LETTER_OPENROUTER_ONLY || '').trim() === '1';

  if (!hasOR && !hasCustom) {
    throw new Error(
      'Нужен OpenRouter_API_KEY или локальный LLM: HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL (см. config/OPENROUTER.md)'
    );
  }
  if (openRouterOnly && !hasOR) {
    throw new Error(
      'COVER_LETTER_OPENROUTER_ONLY=1: задайте OpenRouter_API_KEY (см. README / config/secrets.local.env)'
    );
  }

  const allowCustomFallback = hasCustom && !openRouterOnly;
  /** При наличии ключа OpenRouter не отдаём UI сначала локальному LLM из‑за HH_OPENROUTER_MAX_CALLS_PER_RUN=0. */
  const skipOpenRouter = hasOR ? false : allowCustomFallback && resolveMaxOpenRouterCallsPerRun() === 0;
  const variantCount = getCoverLetterVariantCount();

  return generateCoverLetterSinglePhase(record, cvBundle, variantCount, hasOR, skipOpenRouter, allowCustomFallback);
}
