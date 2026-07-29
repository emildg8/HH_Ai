import fs from 'fs';
import path from 'path';
import {
  getOpenRouterApiKey,
  extractJsonObject,
  fixSmartQuotesInJsonText,
  resolveOpenRouterModelForRequest,
  openRouterModelFallbackChain,
  isOpenRouterModelUnavailableError,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
  getDslabLlmBaseUrl,
  getDslabLlmModel,
  getDslabLlmApiKey,
  isCustomLlmRunnable,
  resolveMaxOpenRouterCallsPerRun,
  isCustomLlmOpenRouterFallbackEnabled,
  stripMarkdownJsonFence,
} from './openrouter-score.mjs';
import { notifyIfCustomToOpenRouterFallback, notifyLlmProviderSwitch } from './llm-provider-notify.mjs';
import { ROOT } from './paths.mjs';
import { buildStyleContextBlock } from './cover-letter-style-context.mjs';
import { loadOutcomeFeedbackBlock } from './outcome-feedback.mjs';
import { loadEmployerRagBlockForRecord } from './employer-rag.mjs';
import { buildCvFactsBlock, buildCombinedCvFactsBlock, extractCvHighlights, buildAntiPatternsPromptBlock, pickM0FallbackPhrases } from './cover-letter-cv-facts.mjs';
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { buildCandidateKnowledgePack, isLetterKnowledgePackEligible } from './candidate-knowledge-pack.mjs';
import { buildVacancyFocusBlock } from './cover-letter-vacancy-focus.mjs';
import {
  generateMatchingBrief,
  formatBriefForPrompt,
  isCoverLetterTwoPhaseEnabled,
} from './cover-letter-brief.mjs';
import {
  getCachedMatchingBrief,
  buildMatchingBriefPatch,
} from './cover-letter-brief-cache.mjs';
import { updateVacancyRecord, loadQueue } from './store.mjs';
import { scoreSource } from './source-quality.mjs';
import {
  spendLlmBudget,
  spendOrBudget,
  spendCoinsBudget,
  recordLlmUsage,
  estimateCoinsFromUsage,
} from './llm-budget.mjs';
import {
  isLetterCascadeEnabled,
  resolveLetterCascadeOrder,
  resolveContextTierForProvider,
  assertLetterProviderBudget,
  isProviderSkippableError,
} from './llm-letter-cascade.mjs';
import { polishCoverLetter, rankLetterVariants } from './cover-letter-polish.mjs';
import { pickBestPreparedVariant } from './cover-letter-prepare.mjs';
import { classifyVacancyResumeRole, isQaProfileActive } from './resume-routing.mjs';
import { isQaLetterBannedPhrase } from './letter-inventory-honesty.mjs';
import { buildQaLetterPhrasingPromptBlock } from './qa-letter-phrasing.mjs';
import { applyCandidateLetterGender } from './letter-candidate-gender.mjs';
import {
  getLetterStructureRules,
  getCoverLetterSystemTail,
  getHuntTrackAntiFramingBlock,
} from './cover-letter-role-prompt.mjs';
import { appendLetterMetric, appendTierAFallbackMetric } from './letter-metrics.mjs';
import { loadPreferences } from './preferences.mjs';
import {
  anyVariantPassesQuality,
  buildQualityRetryUserPrompt,
} from './cover-letter-quality-retry.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import {
  shouldLetterHumanizeTwoPass,
  humanizeLetterVariantsRulePass,
} from './letter-humanize-pass.mjs';

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

function isMetaOnlyLlmReply(text) {
  const t = String(text).trim();
  if (!t || t.length > 200) return false;
  if (/^need\s+\d+\s+variants?\.?$/i.test(t)) return true;
  if (/^variants?\s*[:\-]?\s*\d+$/i.test(t)) return true;
  return /^(please|write|generate|return)\s/i.test(t) && /variant/i.test(t);
}

/** Кириллица: \\b в JS не граница слова — без \\b. */
const LETTER_DRAFT_HINT_RE =
  /(здравств|добрый\s+день|отклик|devops|опыт|готов|интерес|позици|ваканси|команд)/i;

function looksLikeLetterDraft(text) {
  const s = String(text).trim();
  if (s.length < 60) return false;
  return LETTER_DRAFT_HINT_RE.test(s);
}

function isJunkLetterVariant(s) {
  const t = String(s).trim();
  if (!t) return true;
  if (/верни\s+строго|строго\s+один\s+json/i.test(t)) return true;
  if (/текст\s+варианта\s*\d/i.test(t) && /полное\s+письмо/i.test(t)) return true;
  if (/^\s*\{\s*"variants"\s*:/i.test(t)) return true;
  if (/^эталон\s*[#№]?\s*\d/i.test(t) && t.length < 120) return true;
  if (/^вариант\s*[#№]?\s*\d\s*$/i.test(t)) return true;
  if (/^пример\s+(стиля|манеры)\s*\d/i.test(t) && t.length < 120) return true;
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

function keepSubstantialLetterVariants(arr, minLen = 100) {
  return arr.filter((t) => {
    const s = String(t).trim();
    if (s.length < minLen) return false;
    if (!/[.!?]/.test(s)) return false;
    const low = s.toLowerCase();
    if (
      !/(^|\s)(я|готов|готова|отклика|откликнуть|буду\s+рад|интересн|позици|ваканси|команд|опыт|могу|делал|делаю)/i.test(
        low
      )
    ) {
      return false;
    }
    if (
      /(бакалавр|магистр|университет|информационные\s+технологии|вычислительные\s+машины)/i.test(
        low
      ) &&
      !/(ваканси|позици|отклик|команд|devops|поддержк|инцидент)/i.test(low)
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
 * Обрезанный JSON: извлечь тексты из "variants":[ даже без закрывающих скобок.
 */
export function salvageTruncatedVariants(rawText) {
  const t = stripMarkdownJsonFence(stripLlmNoisePrefix(String(rawText)));
  const start = t.search(/"variants"\s*:\s*\[/i);
  if (start < 0) return [];
  const slice = t.slice(start);
  const fromLoose = extractVariantsArrayLoose(slice);
  if (fromLoose.length) return fromLoose;

  const minLen = Math.max(40, Number(process.env.COVER_LETTER_SALVAGE_MIN_CHARS) || 80);
  const re = /"((?:\\.|[^"\\]){40,})"/g;
  const out = [];
  let m;
  while ((m = re.exec(slice)) !== null && out.length < getCoverLetterVariantCount()) {
    try {
      const decoded = JSON.parse(`"${m[1]}"`);
      if (decoded && decoded.length >= minLen) out.push(decoded.trim());
    } catch {
      const plain = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
      if (plain.length >= minLen) out.push(plain);
    }
  }
  if (out.length) return out;

  const unclosed = /"variants"\s*:\s*\[\s*"([\s\S]+)/i.exec(t);
  if (unclosed) {
    let body = unclosed[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    body = body.replace(/"\s*,\s*"[\s\S]*$/, '').replace(/"\s*}\s*$/, '').trim();
    body = trimIncompleteSalvagedTail(body);
    if (body.length >= minLen) return [body];
  }
  return [];
}

/** Обрезанный JSON: убрать обрыв на полуслове в конце. */
function trimIncompleteSalvagedTail(text) {
  let s = String(text || '').trim();
  if (!s) return s;
  if (/[.!?…]$/.test(s)) return s;
  s = s.replace(/[,;:\s]+$/, '');
  s = s.replace(/\s+[\wа-яёА-ЯЁ+-]{1,12}$/iu, '').trim();
  if (s.length >= 40 && !/[.!?…]$/.test(s)) s += '.';
  return s;
}

function extractPlaintextVariants(rawText) {
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
  const timeoutMs = Math.max(30_000, Number(process.env.COVER_LETTER_FETCH_TIMEOUT_MS) || 240_000);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`LLM: таймаут запроса (${timeoutMs} мс)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

function messageTextFromChoice(data) {
  const msg = data?.choices?.[0]?.message || {};
  const parts = [];
  if (typeof msg.content === 'string') parts.push(msg.content);
  else if (Array.isArray(msg.content)) {
    for (const p of msg.content) {
      if (typeof p === 'string') parts.push(p);
      else if (p?.type === 'text' && p.text) parts.push(String(p.text));
    }
  }
  if (msg.reasoning) parts.push(String(msg.reasoning));
  if (msg.reasoning_content) parts.push(String(msg.reasoning_content));
  return parts.join('\n').trim();
}

function parseCoverLetterChatResponse(data, model) {
  const text = messageTextFromChoice(data);
  if (!text) {
    throw new Error('LLM: пустой ответ (content и reasoning пусты)');
  }
  if (isMetaOnlyLlmReply(text)) {
    throw new Error('LLM: meta-ответ вместо письма — повтор запроса');
  }
  const cleanedInput = stripLlmNoisePrefix(text);
  let coerced = [];
  let jsonErr = null;
  let usedSalvage = false;

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
  if (!coerced.length) {
    coerced = salvageTruncatedVariants(cleanedInput);
    if (coerced.length) usedSalvage = true;
  }
  if (!coerced.length) {
    coerced = salvageTruncatedVariants(text);
    if (coerced.length) usedSalvage = true;
  }

  let letters = sanitizeLetterVariants(coerced);
  if (usedSalvage) {
    letters = letters.filter((t) => looksLikeLetterDraft(t));
    letters = letters.map((t) => trimIncompleteSalvagedTail(t));
  } else {
    letters = keepSubstantialLetterVariants(letters, 100);
  }
  if (!letters.length && coerced.length) {
    letters = sanitizeLetterVariants(coerced).filter((t) => looksLikeLetterDraft(t));
  }
  if (!letters.length) {
    const hint = jsonErr ? ` (${jsonErr.message})` : '';
    throw new Error(
      `LLM: не удалось извлечь варианты писем${hint}. Начало ответа: ${cleanedInput.slice(0, 420)}`
    );
  }

  const variants = normalizeVariants(letters);
  const usedModel = data?.model || model;
  return { variants, providerModel: usedModel, usage: data?.usage || null, salvaged: usedSalvage };
}

export { parseCoverLetterChatResponse };

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

function buildVacancyCvBlob(record, desc, summary, risks, tags, cvText, contextTier = 'full') {
  const slim = contextTier === 'slim';
  const slimDescMax = Number(process.env.COVER_LETTER_SLIM_DESC_MAX);
  const descLimit = slim
    ? Number.isFinite(slimDescMax) && slimDescMax >= 800
      ? Math.floor(slimDescMax)
      : 2000
    : 9000;
  const cvLimit = slim ? 0 : 12_000;
  const summaryLine = slim && summary ? `Кратко: ${summary.slice(0, 280)}` : `Краткий разбор (модель-оценка): ${summary}`;
  const risksLine = slim && risks ? `Риски: ${risks.slice(0, 160)}` : `Риски: ${risks}`;
  const tagsLine = slim && tags ? `Теги: ${String(tags).slice(0, 120)}` : `Теги: ${tags}`;
  let blob = `ВАКАНСИЯ:
Заголовок: ${record.title || ''}
Компания: ${record.company || ''}
Зарплата: ${record.salaryRaw || ''}

Описание:
${desc.slice(0, descLimit)}

${summaryLine}
${risksLine}
${tagsLine}`;
  if (cvLimit > 0 && cvText) {
    blob += `

РЕЗЮМЕ КАНДИДАТА (факты для письма, не вставляй весь блок дословно как ответ):
${cvText.slice(0, cvLimit)}`;
  }
  return blob;
}

const EMIL_OR_DEVOPS_FACT_RE =
  /IT_One|7000\+|Softline|СБП|pet-практик|HH Ai|DevOps-контур|14\+\s*лет\s+в\s+эксплуатации/i;

function filterQaCvFacts(facts) {
  return (facts || []).filter((f) => {
    const s = String(f || '').trim();
    if (!s || EMIL_OR_DEVOPS_FACT_RE.test(s)) return false;
    if (/docker|grafana|ci\/cd/i.test(s) && !/тест|qa|api|postman|регресс/i.test(s)) return false;
    return true;
  });
}

function isSafeQaM0Phrase(phrase) {
  return phrase && !EMIL_OR_DEVOPS_FACT_RE.test(phrase) && !isQaLetterBannedPhrase(phrase);
}

function filterL2l3OpeningFacts(facts) {
  return (facts || []).filter((f) => {
    const s = String(f || '')
      .replace(/\*\*/g, '')
      .trim();
    if (!s) return false;
    if (/14\+\s*лет|7000\+|руковод[а-яё]+|команд[а-яё]+\s+(?:из\s+)?20|20\+\s*человек/i.test(s)) return false;
    if (/devops|sre|kubernetes|ci\/cd/i.test(s) && !/поддержк|l2|sla|инцидент/i.test(s)) return false;
    return true;
  });
}

/** Срывает шапку факта — иначе «задачи поддержки: По коммерческому опыту: …». */
export function stripLetterFactLead(text) {
  return String(text || '')
    .replace(
      /^(?:по\s+коммерческому\s+опыту|из\s+практики|из\s+релевантного\s+опыта|по\s+опыту)\s*:\s*/i,
      ''
    )
    .replace(/\.+$/, '')
    .trim();
}

function sameLetterFactStem(a, b) {
  const na = stripLetterFactLead(a).toLowerCase();
  const nb = stripLetterFactLead(b).toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 24 && nb.includes(na)) return true;
  if (nb.length >= 24 && na.includes(nb)) return true;
  const pa = na.slice(0, 48);
  const pb = nb.slice(0, 48);
  return pa.length >= 28 && pa === pb;
}

function buildQaDeterministicCoverLetters(record, cvText, variantCount, opts = {}) {
  const title = String(record.title || 'позицию').trim();
  const company = String(record.company || 'вашу команду').trim();
  const huntTrack = classifyVacancyHuntTrack(record);
  const leadLike = huntTrack === 'qa-lead';
  const seniorLike = huntTrack === 'senior-qa' || huntTrack === 'aqa-ai-assist';
  const m0Phrases = pickM0FallbackPhrases(record, opts.pack, 3);
  const highlights = extractCvHighlights(cvText, 6);
  const rawFacts = m0Phrases.length
    ? m0Phrases
    : highlights.length
      ? highlights
      : String(cvText || '')
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter((x) => x.length >= 20 && x.length <= 140)
          .slice(0, 6);
  const cvFacts = filterQaCvFacts(rawFacts);
  const fact1 =
    cvFacts[0] || '8+ лет в тестировании: банк и финтех, тест-дизайн и регресс';
  const fact2 = cvFacts[1] || 'Postman, SQL, Kafka, Jira — сквозные API-проверки';
  const fact3 =
    cvFacts[2] ||
    'На проекте крупного банка (NDA): контроль качества релизов, smoke/sanity и API-проверки до выкладки';

  const practiceLine = isSafeQaM0Phrase(m0Phrases[0])
    ? m0Phrases[0].endsWith('.')
      ? m0Phrases[0]
      : `${m0Phrases[0]}.`
    : `Из практики: ${fact2}.`;
  const m0Line2 = isSafeQaM0Phrase(m0Phrases[1])
    ? m0Phrases[1].endsWith('.')
      ? m0Phrases[1]
      : `${m0Phrases[1]}.`
    : null;

  const base = [
    `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
    `По опыту близки ваши задачи: ${fact1}.`,
    practiceLine,
    leadLike
      ? `Выстраиваю тест-дизайн и регрессионное покрытие, контролирую качество релизов и API/интеграции.`
      : `Фокус на функциональном и регрессионном тестировании, API-проверках и приёмке релизов с прозрачной фиксацией дефектов в Jira.`,
    `Готов коротко обсудить приоритеты команды и ваш тестовый контур.`,
  ].join(' ');
  const alt1 = [
    `Добрый день! Откликаюсь на вакансию «${title}».`,
    `Из опыта близко ваше направление: ${fact1}.`,
    m0Line2 ||
      `Особое внимание — тест-дизайн, регрессия и сквозные API-проверки; регулярно использую ${fact2}.`,
    `Готов обсудить задачи и приоритеты команды.`,
  ].join(' ');
  const alt2 = [
    `Здравствуйте! Рассматриваю роль «${title}» и хотел бы присоединиться к ${company}.`,
    leadLike
      ? `Мой профиль — QA Lead: тест-дизайн, координация регресса, API и качество релизов.`
      : seniorLike
        ? `Мой профиль — Senior QA: автоматизация и API-тесты, smoke и регресс перед релизом.`
        : `Мой профиль — тестирование: функциональные проверки, регресс и приёмка релизов.`,
    `Из релевантного опыта: ${fact3}.`,
    isSafeQaM0Phrase(m0Phrases[0]) && !m0Line2 ? practiceLine : null,
    `Готов обсудить ваши приоритеты и как опыт в QA может быть полезен именно в этой роли.`,
  ]
    .filter(Boolean)
    .join(' ');

  const variants = [base, alt1, alt2]
    .slice(0, variantCount)
    .map((v) => applyCandidateLetterGender(v));
  return normalizeVariants(variants);
}

function buildDeterministicCoverLetters(record, cvText, variantCount, opts = {}) {
  if (isQaProfileActive()) {
    return buildQaDeterministicCoverLetters(record, cvText, variantCount, opts);
  }
  const title = String(record.title || 'позицию').trim();
  const company = String(record.company || 'вашу команду').trim();
  const huntTrack = classifyVacancyHuntTrack(record);
  const devopsLike = huntTrack === 'devops' || huntTrack === 'infra';
  const l2l3Like = huntTrack === 'l2l3';
  const m0Phrases = pickM0FallbackPhrases(record, opts.pack, 3);
  const highlights = extractCvHighlights(cvText, 6);
  const rawFacts = m0Phrases.length
    ? m0Phrases
    : highlights.length
      ? highlights
      : String(cvText || '')
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter((x) => x.length >= 20 && x.length <= 140)
          .slice(0, 6);
  const cvFacts = l2l3Like ? filterL2l3OpeningFacts(rawFacts) : rawFacts;
  const fact1Raw =
    cvFacts[0] ||
    (l2l3Like
      ? 'L2 СБП (IT_One): инциденты, релизы, SLA/OLA; MTTR сократил примерно на 15%'
      : devopsLike
        ? '14+ лет в эксплуатации и DevOps-контурах (СБП, CI/CD, мониторинг)'
        : 'операционная поддержка highload-систем: инциденты, SLA, эскалации');
  const fact2Raw =
    cvFacts[1] ||
    (l2l3Like
      ? 'Linux, мониторинг (Grafana/Zabbix), сетевая диагностика, Windows Server/AD'
      : 'Docker, Grafana/Kibana, GitLab CI, bash-автоматизация');
  const fact3Raw =
    cvFacts[2] ||
    (l2l3Like
      ? 'В IT_One (СБП): сократил время реакции ~15%; эскалации в разработку по регламенту'
      : devopsLike
        ? 'В IT_One (СБП): 7000+ обращений и инцидентов; SLA/OLA и метрики'
        : 'SQL, мониторинг, Jira/Confluence, связка с разработкой');
  const fact1 = stripLetterFactLead(fact1Raw) || fact1Raw;
  const fact2 = stripLetterFactLead(fact2Raw) || fact2Raw;
  const fact3 = stripLetterFactLead(fact3Raw) || fact3Raw;

  const practiceLineRaw =
    l2l3Like && m0Phrases[0] && filterL2l3OpeningFacts([m0Phrases[0]]).length === 0
      ? `Из практики: ${fact2}.`
      : m0Phrases[0]
        ? (() => {
            const body = stripLetterFactLead(m0Phrases[0]) || m0Phrases[0];
            if (sameLetterFactStem(body, fact1)) {
              const alt = stripLetterFactLead(m0Phrases[1] || '') || fact2;
              return alt.endsWith('.') ? alt : `${alt}.`;
            }
            return body.endsWith('.') ? body : `${body}.`;
          })()
        : `Из практики: ${fact2}.`;
  // Не дублировать fact1 и practiceLine (баг 17.07: «По коммерческому опыту» ×2)
  let practiceLine = practiceLineRaw;
  if (sameLetterFactStem(practiceLine, fact1)) {
    const alt = stripLetterFactLead(m0Phrases[1] || '') || fact2;
    practiceLine = alt.endsWith('.') ? alt : `${alt}.`;
    if (sameLetterFactStem(practiceLine, fact1)) {
      practiceLine = `Из практики: ${fact2}.`;
    }
  }
  const m0Line2 = m0Phrases[1]
    ? (() => {
        const body = stripLetterFactLead(m0Phrases[1]) || m0Phrases[1];
        return body.endsWith('.') ? body : `${body}.`;
      })()
    : null;

  const base = devopsLike
    ? [
        `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
        `По опыту близки ваши задачи: ${fact1}.`,
        practiceLine,
        `Работал с Docker, Grafana и CI/CD в банковских контурах; привык доводить инциденты до корневой причины и держать прозрачные метрики.`,
        `Буду рад коротко обсудить стек и приоритеты команды.`,
      ].join(' ')
    : l2l3Like
      ? [
          `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
          `По опыту близки ваши задачи поддержки: ${fact1}.`,
          practiceLine,
          `Привык доводить инциденты до корневой причины, вести базу знаний и эскалировать по регламенту, а не только закрывать тикет.`,
          `Буду рад коротко обсудить ваш стек и формат смен.`,
        ].join(' ')
      : [
          `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
          `По опыту близки ваши задачи: ${fact1}.`,
          practiceLine,
          `Привык держать прозрачную коммуникацию по SLA и доводить инциденты до корневой причины, а не только «закрыть тикет».`,
          `Буду рад коротко обсудить стек и приоритеты команды.`,
        ].join(' ');
  const alt1 = devopsLike
    ? [
        `Добрый день! Откликаюсь на вакансию «${title}».`,
        `Из опыта близко ваше направление: ${fact1}.`,
        m0Line2 || `Особое внимание — автоматизация, мониторинг и сопровождение релизов; из инструментов регулярно использую ${fact2}.`,
        `Готов обсудить задачи и приоритеты команды.`,
      ].join(' ')
    : [
        `Добрый день! Откликаюсь на вакансию «${title}».`,
        `По опыту могу усилить ${company} в части операционной поддержки и сопровождения: ${fact1}.`,
        m0Line2 ||
          `Особое внимание уделяю диагностике причин, прозрачной коммуникации и стабильному SLA; из инструментов регулярно использую ${fact2}.`,
        `Умею работать в кросс-функциональной среде, аккуратно документировать решения и сопровождать изменения до продакшена.`,
        `Готов обсудить задачи и приоритеты команды.`,
      ].join(' ');
  const alt2 = devopsLike
    ? [
        `Здравствуйте! Рассматриваю роль «${title}» и хотел бы присоединиться к ${company}.`,
        `Мой профиль — эксплуатация и DevOps: контейнеры, пайплайны, observability и сопровождение релизов.`,
        `Из релевантного опыта: ${fact3}.`,
        m0Phrases[0] && !m0Line2 ? practiceLine : null,
        `Буду рад обсудить ваш стек, приоритеты и как мой опыт может быть полезен именно в этой роли.`,
      ]
        .filter(Boolean)
        .join(' ')
    : [
        `Здравствуйте! Рассматриваю роль «${title}» и хотел бы присоединиться к ${company}.`,
        `Мой профиль — поддержка прикладных систем и решение инцидентов второго уровня, а также сопровождение релизов.`,
        `Из релевантного опыта: ${fact3}.`,
        m0Phrases[0] && !m0Line2 ? practiceLine : null,
        `Технически уверен в SQL/логах/мониторинге и умею объяснять статус работ понятным языком для бизнеса и команды.`,
        `Буду рад обсудить ваш стек, приоритеты и как мой опыт может быть полезен именно в этой роли.`,
      ]
        .filter(Boolean)
        .join(' ');

  return normalizeVariants([base, alt1, alt2].slice(0, variantCount));
}

/** LLM-pass: переписать письмо живым тоном, сохранив факты (tier A two-pass). */
async function runLetterHumanizeLlmPass(
  text,
  record,
  hasOR,
  skipOpenRouter,
  allowCustomFallback,
  llmOpts = {}
) {
  const src = String(text || '').trim();
  if (!src || src.length < 40) return src;

  const title = String(record?.title || 'позицию').trim();
  const userPrompt = `Перепиши сопроводительное письмо на русском так, чтобы оно звучало как живой человек, а не шаблон ChatGPT.
Сохрани ВСЕ факты, цифры, технологии и название роли — не добавляй новых навыков и не выдумывай опыт.
Убери канцелярит («осуществлял», «в связи с вышеизложенным», «идеально подхожу»).
Длина: от 120 до 900 символов, 4–6 предложений.
Контекст вакансии: «${title}».

Исходник:
${src}

Формат: только JSON {"variants":["готовое письмо целиком"]} — одна строка.`;

  const payloadBase = {
    messages: [
      {
        role: 'system',
        content:
          'Ты редактор сопроводительных для hh.ru. Переписываешь сухой текст живым языком без новых фактов. Только JSON.',
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.52,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  };

  const result = await runCoverLetterLlmRound(
    payloadBase,
    hasOR,
    skipOpenRouter,
    allowCustomFallback,
    { ...llmOpts, task: 'letter_humanize' }
  );
  const out = (result.variants || []).map(String).find((v) => v.trim().length >= 80);
  return out ? out.trim() : src;
}

async function runCoverLetterLlmRound(payloadBase, hasOR, skipOpenRouter, allowCustomFallback, opts = {}) {
  const { provider = null, vacancyId = null } = opts;

  const trackUsage = (result, providerKey) => {
    if (!result) return result;
    const usage = result.usage || null;
    recordLlmUsage({
      task: 'letter',
      provider: providerKey,
      model: result.providerModel,
      usage,
      vacancyId,
    });
    if (providerKey === 'openrouter') spendOrBudget(1);
    if (providerKey === 'dslab') spendCoinsBudget(estimateCoinsFromUsage(usage));
    if (providerKey === 'dslab' || providerKey === 'openrouter') spendLlmBudget('A');
    return result;
  };

  const runOpenRouter = async () => {
    assertLetterProviderBudget('openrouter');
    const models = openRouterModelFallbackChain();
    let lastErr;
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      try {
        const data = await postChatCompletionsJson(
          OPENROUTER_URL,
          {
            Authorization: `Bearer ${getOpenRouterApiKey()}`,
            'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
            'X-Title': 'hh-ru-apply-cover-letter',
          },
          { ...payloadBase, model }
        );
        return trackUsage(parseCoverLetterChatResponse(data, model), 'openrouter');
      } catch (e) {
        lastErr = e;
        const canRetry =
          i < models.length - 1 &&
          (isOpenRouterModelUnavailableError(e) ||
            /пустой ответ|не удалось извлечь|meta-ответ|нет JSON-объекта/i.test(String(e.message)));
        if (canRetry) {
          console.warn(`[hh-ru-apply] OpenRouter ${model}: ${e.message.slice(0, 120)} → ${models[i + 1]}`);
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('LLM: нет доступных моделей OpenRouter');
  };

  const runCustom = async (providerKey = 'custom') => {
    if (providerKey === 'dslab') assertLetterProviderBudget('dslab');
    let base =
      providerKey === 'dslab' ? getDslabLlmBaseUrl() : getCustomLlmBaseUrl();
    let model =
      providerKey === 'dslab' ? getDslabLlmModel() : getCustomLlmModel();
    if (providerKey === 'ollama') {
      const ollamaRaw = String(process.env.OLLAMA_BASE_URL || '').trim().replace(/\/+$/, '');
      if (ollamaRaw) {
        base = /\/v1$/i.test(ollamaRaw) ? ollamaRaw : `${ollamaRaw}/v1`;
      }
      model = String(process.env.OLLAMA_MODEL || model || 'llama3.2').trim();
    }
    if (!base || !model) {
      throw new Error(`LLM: не настроен провайдер ${providerKey}`);
    }
    const headers = {};
    const key = providerKey === 'dslab' ? getDslabLlmApiKey() : getCustomLlmApiKey();
    if (key) headers.Authorization = `Bearer ${key}`;
    const attempt = async (body) => {
      const data = await postChatCompletionsJson(`${base}/chat/completions`, headers, {
        ...body,
        model,
      });
      return parseCoverLetterChatResponse(data, model);
    };

    try {
      const result = await attempt(payloadBase);
      return providerKey === 'dslab' ? trackUsage(result, 'dslab') : result;
    } catch (e) {
      const parseFail = /не удалось извлечь|нет JSON|пустой ответ|meta-ответ/i.test(
        String(e?.message || e)
      );
      const retryMessages = [
        {
          role: 'system',
          content:
            'Ты пишешь сопроводительные письма на русском для отклика на hh.ru. Не анализируй запрос и не упоминай JSON/формат/инструкцию. Верни только JSON {"variants":[...]}: каждый вариант 4-6 предложений, не длиннее 900 символов.',
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
      console.warn(
        '[hh-ru-apply] HH_CUSTOM_LLM_*: повтор генерации писем после невалидного первого ответа:',
        e.message
      );
      try {
        const result = await attempt(retryPayload);
        return providerKey === 'dslab' ? trackUsage(result, 'dslab') : result;
      } catch (e2) {
        if (!parseFail) throw e2;
        const compactPayload = {
          ...payloadBase,
          messages: [
            {
              role: 'system',
              content:
                'Сопроводительное письмо на hh.ru. Только JSON {"variants":["текст"]}. Одно письмо: 4-5 предложений, максимум 800 символов, без markdown.',
            },
            payloadBase.messages[payloadBase.messages.length - 1],
          ],
          temperature: 0.4,
          max_tokens: Math.min(payloadBase.max_tokens || 4096, 2048),
        };
        console.warn('[hh-ru-apply] HH_CUSTOM_LLM_*: компактный повтор после обрезки JSON:', e2.message);
        const result = await attempt(compactPayload);
        return providerKey === 'dslab' ? trackUsage(result, 'dslab') : result;
      }
    }
  };

  if (provider === 'openrouter') {
    return await runOpenRouter();
  }
  if (provider === 'ollama') {
    return await runCustom('ollama');
  }
  if (provider === 'dslab') {
    return await runCustom('dslab');
  }

  if (hasOR && !skipOpenRouter) {
    try {
      return await runOpenRouter();
    } catch (e) {
      if (allowCustomFallback) {
        notifyLlmProviderSwitch({
          from: 'openrouter',
          to: /dslab\.tech/i.test(getCustomLlmBaseUrl()) ? 'dslab' : 'custom',
          reason: 'error',
          task: 'letter',
          detail: String(e.message).slice(0, 200),
        });
        const key = /dslab\.tech/i.test(getCustomLlmBaseUrl()) ? 'dslab' : 'custom';
        return await runCustom(key);
      }
      throw e;
    }
  }
  try {
    const key = /dslab\.tech/i.test(getCustomLlmBaseUrl()) ? 'dslab' : 'custom';
    return await runCustom(key);
  } catch (e) {
    if (
      hasOR &&
      allowCustomFallback &&
      isCustomLlmOpenRouterFallbackEnabled() &&
      notifyIfCustomToOpenRouterFallback(e, { task: 'letter' })
    ) {
      return await runOpenRouter();
    }
    throw e;
  }
}

const antiAiRules = `
Жёстко избегай признаков «нейросетевого» текста:
- не начинай с «Уважаемые рекрутеры/меня зовут/я пишу вам, чтобы…» шаблонно;
- не используй цепочки прилагательных и пустые усилители («глубокие знания», «уникальный опыт», «идеально подхожу»);
- не перечисляй качества списком без привязки к фактам из резюме;
- не копируй блок «мой технический стек включает…» списком инструментов — вплетай 2–3 релевантных технологии в контекст задач;
- не добавляй контакты, телефон, email, telegram — их нет в эталонах;
- допускай разговорные короткие фразы, одно уместное «я» — как у живого человека;
- конкретика из вакансии и CV, не общие слова про «динамичную компанию».`;

/** Одна генерация `variantCount` вариантов (см. COVER_LETTER_VARIANT_COUNT). */
async function generateCoverLetterSinglePhase(
  record,
  cvBundle,
  variantCount,
  hasOR,
  skipOpenRouter,
  allowCustomFallback,
  context = {}
) {
  const desc =
    (record.descriptionForLlm && String(record.descriptionForLlm)) ||
    (record.descriptionPreview && String(record.descriptionPreview)) ||
    '';
  const summary = String(record.geminiSummary || '').trim();
  const risks = String(record.geminiRisks || '').trim();
  const tags = Array.isArray(record.geminiTags) ? record.geminiTags.join(', ') : '';

  const contextTier = context.contextTier || 'full';
  const slim = contextTier === 'slim';
  const styleMaxChars = slim
    ? Math.min(2000, Number(process.env.COVER_LETTER_STYLE_MAX_CHARS) || 2000)
    : Number(process.env.COVER_LETTER_STYLE_MAX_CHARS) || 8000;
  const styleMaxItems = slim
    ? Math.min(3, Number(process.env.COVER_LETTER_STYLE_QUEUE_ITEMS) || 3)
    : Number(process.env.COVER_LETTER_STYLE_QUEUE_ITEMS) || 6;

  const templateHint = loadCoverLetterTemplateHint();
  const templateSlice = slim
    ? Math.min(
        800,
        Number(process.env.COVER_LETTER_SLIM_TEMPLATE_CHARS) || 800
      )
    : 2000;
  const templateBlock = templateHint
    ? `\nПример структуры/тона (не копируй дословно, адаптируй):\n${templateHint.slice(0, slim ? templateSlice : 2000)}\n`
    : '';

  const styleBlockRaw = buildStyleContextBlock({
    maxChars: styleMaxChars,
    maxItemsFromQueue: styleMaxItems,
    record,
  });
  const styleBlock = styleBlockRaw
    ? `\nЭТАЛОНЫ СТИЛЯ (копируй ритм, длину, тон; не копируй факты и формулировки):\n\n${styleBlockRaw}\n`
    : '';
  const outcomeBlock = loadOutcomeFeedbackBlock({
    maxLines: slim
      ? Math.max(2, Number(process.env.COVER_LETTER_SLIM_OUTCOME_LINES) || 4)
      : 24,
  });
  const slimNoRag = slim && String(process.env.COVER_LETTER_SLIM_EMPLOYER_RAG || '') === '0';
  const employerRagBlock = slimNoRag
    ? ''
    : context.employerRagBlock ??
      loadEmployerRagBlockForRecord(record, {
        prefs: context.prefs,
        maxChars: slim ? 600 : undefined,
      });

  const vacancyFocus =
    context.vacancyFocusBlock || buildVacancyFocusBlock(record, desc);
  const cvFacts = context.cvFactsBlock || buildCvFactsBlock(cvBundle.text);
  const briefBlock = context.briefBlock || '';
  const antiPatternsBlock =
    context.antiPatternsBlock ||
    (context.knowledgePack ? buildAntiPatternsPromptBlock(context.knowledgePack) : '');
  const resumeRole = classifyVacancyResumeRole(record);
  const huntTrack = context.huntTrack || classifyVacancyHuntTrack(record);
  const letterStructureRules = getLetterStructureRules(resumeRole, record, huntTrack);
  const systemTail = getCoverLetterSystemTail(resumeRole, record, huntTrack);
  const huntTrackAntiFraming = getHuntTrackAntiFramingBlock(huntTrack);

  const userPrompt = `Напиши ${variantCount} РАЗНЫХ сопроводительных письма на русском для отклика на hh.ru.
Каждый вариант — другой угол (см. letterAngles в брифе): разные факты из резюме, разные акценты под требования вакансии.
Запрещено перефразировать один и тот же абзац. Без markdown, без нумерации «Вариант 1».
${letterStructureRules}
${huntTrackAntiFraming ? `\n${huntTrackAntiFraming}\n` : ''}
${antiAiRules}
${antiPatternsBlock ? `\n${antiPatternsBlock}\n` : ''}
${briefBlock ? `\nБРИФ (обязателен к использованию):\n${briefBlock}\n` : ''}
${vacancyFocus ? `\n${vacancyFocus}\n` : ''}
${cvFacts ? `\n${cvFacts}\n` : ''}
${styleBlock}
${outcomeBlock}
${employerRagBlock}
${templateBlock}
${buildVacancyCvBlob(record, desc, summary, risks, tags, cvBundle.text, contextTier)}

Самопроверка перед ответом: в каждом письме есть (а) в первой фразе — ТОЧНОЕ название роли из ПОЗИЦИЯ/заголовка вакансии (не generic DevOps при MLOps/Data/Platform в заголовке), (б) минимум 2 цифры/метрики из резюме (годы, объём — без «90%»), (в) минимум 1 формулировка из требований вакансии, (г) 1–2 термина из заголовка вакансии — не пиши универсальное «готов обсудить» без фактов.
${isQaProfileActive() ? `\n${buildQaLetterPhrasingPromptBlock()}\n` : ''}
${String(process.env.COVER_LETTER_RETRY_HINT || '').trim() ? `\nПОВТОР (исправь прошлую ошибку): ${String(process.env.COVER_LETTER_RETRY_HINT).trim()}\n` : ''}
${String(process.env.BASKET_LETTER_STRICT || '').trim() === '1' ? `\nРЕЖИМ КОРЗИНЫ: письмо будет отклонено, если в первых 2 предложениях есть «14+», «7000+», «руководил», lead/head. Пиши сразу без overqualified opening.\n` : ''}

Каждая строка в variants — готовое письмо целиком (не подпись «Эталон 1», не заголовок, не пересказ задания).

Длина: 4–6 предложений, не более 900 символов на письмо — длиннее обрежется парсером.

Формат: только JSON {"variants":["письмо1", ...]} — ровно ${variantCount} строк.`;

  const messages = [
    {
      role: 'system',
      content:
        `Ты опытный карьерный редактор: пишешь короткие сопроводительные для hh.ru от лица кандидата.
${systemTail} Письма не как шаблон ChatGPT.
Если даны эталоны — имитируй только стиль. Только JSON {"variants":[...]}, без текста до/после. Каждое письмо ≤900 символов.`,
    },
    { role: 'user', content: userPrompt },
  ];

  const maxTok = resolvePhaseMaxTokens(
    'COVER_LETTER_MAX_TOKENS',
    Math.min(32_000, Math.max(3000, 1400 + variantCount * 1400))
  );
  const payloadBase = {
    messages,
    temperature: Number(process.env.COVER_LETTER_TEMPERATURE) || 0.48,
    max_tokens: maxTok,
    response_format: { type: 'json_object' },
  };
  if (String(process.env.COVER_LETTER_RESPONSE_JSON || '').trim() === '0') {
    delete payloadBase.response_format;
  }
  let prefs = {};
  try {
    prefs = loadPreferences();
  } catch {
    prefs = {};
  }

  const forcedProvider = context.provider || null;
  const llmOpts = { provider: forcedProvider, vacancyId: record?.id || null };

  try {
    let result = await runCoverLetterLlmRound(
      payloadBase,
      hasOR,
      skipOpenRouter,
      allowCustomFallback,
      llmOpts
    );
    result.variants = rankLetterVariants(result.variants, record, desc, { resumeRole, prefs });
    const allowQualityRetry =
      !forcedProvider &&
      String(process.env.COVER_LETTER_QUALITY_RETRY ?? '1').trim() !== '0';
    if (
      allowQualityRetry &&
      !anyVariantPassesQuality(result.variants, record, resumeRole, prefs)
    ) {
      const retryUser = buildQualityRetryUserPrompt(record, desc, variantCount, resumeRole, huntTrack);
      const retryPayload = {
        ...payloadBase,
        messages: [messages[0], { role: 'user', content: retryUser }],
        temperature: 0.4,
      };
      try {
        const retryResult = await runCoverLetterLlmRound(
          retryPayload,
          hasOR,
          skipOpenRouter,
          allowCustomFallback,
          llmOpts
        );
        retryResult.variants = rankLetterVariants(retryResult.variants, record, desc, {
          resumeRole,
          prefs,
        });
        if (anyVariantPassesQuality(retryResult.variants, record, resumeRole, prefs)) {
          result = retryResult;
          appendLetterMetric('generate_quality_retry', {
            vacancyId: record.id,
            title: String(record.title || '').slice(0, 80),
          });
        }
      } catch (e) {
        console.warn('[hh-ru-apply] Повтор письма по качеству не удался:', e.message);
      }
    }
    if (shouldLetterHumanizeTwoPass(record, prefs)) {
      const llmHumanized = [];
      for (const v of result.variants || []) {
        try {
          const h = await runLetterHumanizeLlmPass(
            v,
            record,
            hasOR,
            skipOpenRouter,
            allowCustomFallback,
            llmOpts
          );
          llmHumanized.push(h || v);
        } catch (e) {
          console.warn(
            `[hh-ru-apply] humanize LLM-pass: ${String(e.message || e).slice(0, 140)}`
          );
          llmHumanized.push(v);
        }
      }
      result.variants = humanizeLetterVariantsRulePass(
        llmHumanized,
        record,
        resumeRole,
        prefs
      );
      let best = '';
      let bestScore = -1;
      for (const p of result.variants) {
        const q = evaluateLetterQuality(record, p, resumeRole, prefs);
        const score = (q.pass ? 100 : 0) + Math.min(20, Math.floor(String(p).length / 80));
        if (score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      if (best) {
        result.variants = [best, ...result.variants.filter((v) => v !== best)];
      }
      appendLetterMetric('letter_humanize_two_pass', {
        vacancyId: record.id,
        title: String(record.title || '').slice(0, 80),
        variantCount: result.variants.length,
      });
    } else {
      const best = pickBestPreparedVariant(result.variants, record, resumeRole, prefs);
      if (best) {
        result.variants = [best, ...result.variants.filter((v) => v !== best)];
      }
    }
    const qualityPass = anyVariantPassesQuality(result.variants, record, resumeRole, prefs);
    appendLetterMetric('generate', {
      vacancyId: record.id,
      title: String(record.title || '').slice(0, 80),
      role: resumeRole,
      variantCount: result.variants.length,
      model: result.providerModel || null,
      qualityPass,
      qualityPreparedPass: (result.variants || []).some(
        (v) => evaluateLetterQuality(record, v, resumeRole, prefs).pass
      ),
    });
    return result;
  } catch (e) {
  const inCascadeStep = Boolean(forcedProvider);
  const openRouterOnly = String(process.env.COVER_LETTER_OPENROUTER_ONLY || '').trim() === '1';
  const basketStrict = String(process.env.BASKET_LETTER_STRICT || '').trim() === '1';
  const allowTemplateFallback =
    !basketStrict &&
    !inCascadeStep &&
    !openRouterOnly &&
    (isCustomLlmRunnable() || process.env.COVER_LETTER_TEMPLATE_FALLBACK === '1');
    if (allowTemplateFallback) {
      const resumeRole = classifyVacancyResumeRole(record);
      const fallbackModel = `fallback-template:${getCustomLlmModel() || 'custom-llm'}`;
      const fallbackVariants = rankLetterVariants(
        buildDeterministicCoverLetters(record, cvBundle.text, variantCount, {
          pack: context.knowledgePack,
        }),
        record,
        desc,
        { resumeRole }
      );
      console.warn(
        '[hh-ru-apply] LLM не дал валидные письма, использую локальный шаблонный fallback:',
        String(e.message).slice(0, 220)
      );
      appendTierAFallbackMetric(record, fallbackModel, { source: 'single_phase' });
      return {
        variants: fallbackVariants,
        providerModel: fallbackModel,
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
function isLetterLlmAllowedForRecord(record) {
  const policy = String(process.env.HH_LLM_POLICY_LETTER || '').trim().toLowerCase();
  if (policy !== 'premium') return true;
  const tier =
    record?.sourceQualityTier ||
    scoreSource(record, { allRecords: loadQueue() }).sourceQualityTier;
  return tier === 'A';
}

/**
 * Каскад ollama → openrouter → dslab с автоэскалацией по quality-scan.
 */
async function runLetterCascade(record, cvBundle, variantCount, hasOR, skipOpenRouter, allowCustomFallback, context) {
  const desc =
    (record.descriptionForLlm && String(record.descriptionForLlm)) ||
    (record.descriptionPreview && String(record.descriptionPreview)) ||
    '';
  const resumeRole = classifyVacancyResumeRole(record);
  let prefs = {};
  try {
    prefs = loadPreferences();
  } catch {
    prefs = {};
  }

  const order = resolveLetterCascadeOrder();
  if (!order.length) {
    console.warn(
      '[hh-ru-apply] Каскад писем пуст (провайдеры не сконфигурированы или бюджет=0) → template'
    );
  }
  let lastErr = null;

  for (const provider of order) {
    const contextTier = resolveContextTierForProvider(provider);
    try {
      const result = await generateCoverLetterSinglePhase(
        record,
        cvBundle,
        variantCount,
        hasOR,
        skipOpenRouter,
        allowCustomFallback,
        { ...context, provider, contextTier }
      );
      const qualityPass = anyVariantPassesQuality(result.variants, record, resumeRole, prefs);
      const usedTemplate = /fallback-template|template:cascade/i.test(
        String(result.providerModel || '')
      );
      appendLetterMetric('generate', {
        vacancyId: record.id,
        title: String(record.title || '').slice(0, 80),
        role: resumeRole,
        variantCount: result.variants.length,
        model: result.providerModel || null,
        qualityPass,
        cascadeProvider: provider,
        contextTier,
      });
      if (qualityPass && !usedTemplate) {
        return { ...result, cascadeProvider: provider };
      }
      console.warn(
        `[hh-ru-apply] Письмо (${provider}/${contextTier}) не прошло quality-scan${usedTemplate ? ' (шаблон)' : ''} — эскалация`
      );
      lastErr = new Error(`quality fail on ${provider}`);
    } catch (e) {
      if (isProviderSkippableError(provider, e)) {
        console.warn(`[hh-ru-apply] Каскад ${provider}: ${String(e.message).slice(0, 160)}`);
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  const resumeRoleFinal = classifyVacancyResumeRole(record);
  const basketStrict = String(process.env.BASKET_LETTER_STRICT || '').trim() === '1';
  if (basketStrict) {
    throw lastErr || new Error('каскад LLM исчерпан — индивидуальное письмо не получено (basket strict)');
  }
  const fallbackModel = 'template:cascade-fallback';
  const huntTrackFb = classifyVacancyHuntTrack(record);
  let fallbackRaw = buildDeterministicCoverLetters(record, cvBundle.text, variantCount, {
    pack: context.knowledgePack,
  });
  if (huntTrackFb === 'devops' || huntTrackFb === 'infra') {
    try {
      const { composeDevopsFramedLetter } = await import('./letter-framing-router.mjs');
      const framed = composeDevopsFramedLetter(
        { ...record, huntTrack: huntTrackFb },
        { huntTrack: huntTrackFb }
      );
      if (String(framed || '').trim().length >= 280) {
        fallbackRaw = [framed, ...fallbackRaw].slice(0, Math.max(variantCount, 2));
      }
    } catch {
      /* keep deterministic */
    }
  }
  const fallbackVariants = rankLetterVariants(fallbackRaw, record, desc, {
    resumeRole: resumeRoleFinal,
  });
  console.warn(
    '[hh-ru-apply] Каскад исчерпан, шаблонный fallback:',
    lastErr ? String(lastErr.message).slice(0, 120) : 'quality'
  );
  appendTierAFallbackMetric(record, fallbackModel, { source: 'cascade' });
  return {
    variants: fallbackVariants,
    providerModel: fallbackModel,
    cascadeProvider: 'template',
  };
}

export { buildDeterministicCoverLetters };

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
  /** HH_OPENROUTER_MAX_CALLS_PER_RUN=0 → сначала HH_CUSTOM_LLM (DS Lab/Ollama), даже если ключ OR в резерве. */
  const skipOpenRouter =
    allowCustomFallback && (!hasOR || resolveMaxOpenRouterCallsPerRun() === 0);
  const variantCount = getCoverLetterVariantCount();

  const desc =
    (record.descriptionForLlm && String(record.descriptionForLlm)) ||
    (record.descriptionPreview && String(record.descriptionPreview)) ||
    '';

  const huntTrack = classifyVacancyHuntTrack(record);
  const knowledgePack = await buildCandidateKnowledgePack({
    cvText: cvBundle.text,
    vacancy: record,
    huntTrack,
  });
  const packInLetter = isLetterKnowledgePackEligible(record);

  const context = {
    huntTrack,
    vacancyFocusBlock: buildVacancyFocusBlock(record, desc),
    cvFactsBlock: buildCombinedCvFactsBlock(
      cvBundle.text,
      packInLetter ? knowledgePack : null,
      record
    ),
    knowledgePack: packInLetter ? knowledgePack : null,
    antiPatternsBlock: packInLetter ? buildAntiPatternsPromptBlock(knowledgePack) : '',
    briefBlock: '',
  };

  if (!isLetterLlmAllowedForRecord(record)) {
    const resumeRole = classifyVacancyResumeRole(record);
    const tier =
      record?.sourceQualityTier ||
      scoreSource(record, { allRecords: loadQueue() }).sourceQualityTier;
    console.warn(
      `[hh-ru-apply] HH_LLM_POLICY_LETTER=premium → без LLM (tier=${tier || '?'}, нужен A) → template:premium-policy`
    );
    const variants = rankLetterVariants(
      buildDeterministicCoverLetters(record, cvBundle.text, variantCount),
      record,
      desc,
      { resumeRole }
    );
    return { variants, providerModel: 'template:premium-policy' };
  }

  if (isCoverLetterTwoPhaseEnabled()) {
    let brief = getCachedMatchingBrief(record, desc);
    if (brief) {
      appendLetterMetric('brief_cache_hit', {
        vacancyId: record.id,
        title: String(record.title || '').slice(0, 80),
      });
    } else {
      try {
        brief = await generateMatchingBrief(record, cvBundle, desc, { hasOR, skipOpenRouter });
        if (brief && record?.id) {
          updateVacancyRecord(record.id, buildMatchingBriefPatch(record, desc, brief));
          appendLetterMetric('brief_cache_save', { vacancyId: record.id });
        }
      } catch (e) {
        console.warn('[hh-ru-apply] Бриф для письма не построен, генерация без фазы 1:', e.message);
      }
    }
    if (brief) context.briefBlock = formatBriefForPrompt(brief);
  }

  if (isLetterCascadeEnabled()) {
    return runLetterCascade(
      record,
      cvBundle,
      variantCount,
      hasOR,
      skipOpenRouter,
      allowCustomFallback,
      context
    );
  }

  return generateCoverLetterSinglePhase(
    record,
    cvBundle,
    variantCount,
    hasOR,
    skipOpenRouter,
    allowCustomFallback,
    context
  );
}
