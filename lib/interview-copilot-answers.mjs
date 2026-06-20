/**
 * Генерация ответов и сценария речи для суфлёра (по CV и заметкам).
 */

import { loadCvBundle } from './cv-load.mjs';
import { loadInterviewNotes, interviewPrepInsights } from './interview-notes.mjs';
import { normalizeInterviewLines } from './interview-text-lines.mjs';
import { classifyInterviewQuestion } from './interview-copilot-question-detect.mjs';
import {
  getOpenRouterApiKey,
  resolveOpenRouterModelForRequest,
  isCustomLlmRunnable,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
  extractJsonObject,
} from './openrouter-score.mjs';

/**
 * @param {string} question
 * @param {object} context
 * @returns {Promise<{ question: string, bullets: string[], script: string }>}
 */
export async function buildAnswerScript(question, context = {}) {
  const q = String(question || '').trim();
  if (!q) {
    return { question: '', bullets: [], script: '' };
  }

  const kind = classifyInterviewQuestion(q) || 'technical';
  const quick = buildQuickAnswer(q, kind, context);
  if (quick) return quick;

  const cvBundle = context.cvText
    ? { text: context.cvText }
    : await loadCvBundle();
  const notes = context.notes || loadInterviewNotes();
  const insights = interviewPrepInsights();
  const prepBlock = String(context.prepContext || '').trim().slice(0, 3500);
  const noteExcerpt = (notes.topics || [])
    .slice(0, 4)
    .map((t) => `• ${t.title}: ${(t.excerpt || '').slice(0, 200)}`)
    .join('\n');

  const llm = await callAnswerLlm(q, {
    kind,
    title: context.title || '',
    company: context.company || '',
    focus: (context.focus || []).join(', '),
    cvText: cvBundle.text.slice(0, 6000),
    notes: noteExcerpt,
    prepContext: prepBlock,
    lessons: insights.lessons.slice(0, 4).join('; '),
  });

  if (llm && isValidAnswerScript(llm.script, q)) {
    return {
      question: q,
      bullets: normalizeInterviewLines(llm.bullets).slice(0, 5),
      script: String(llm.script || '').trim(),
    };
  }

  return buildFallbackAnswer(q, cvBundle.text, { ...context, kind });
}

function isValidAnswerScript(script, question) {
  const s = String(script || '').trim();
  if (s.length < 8) return false;
  if (s === question) return false;
  // LLM иногда возвращает встречный вопрос вместо ответа
  if (/\?\s*$/.test(s) && s.length < question.length + 40) return false;
  return true;
}

/**
 * @param {string} question
 * @param {'small_talk'|'hr'|'technical'} kind
 * @param {object} context
 */
export function buildQuickAnswer(question, kind, context) {
  const q = question.toLowerCase();
  if (kind === 'small_talk') {
    if (/(на ты|на вы|удобно)/.test(q)) {
      return {
        question,
        bullets: ['Коротко и дружелюбно', 'Не уходи в технику на ледоколе'],
        script: 'Да, конечно, на «ты» удобно, спасибо.',
      };
    }
    if (/(не волну|настроение)/.test(q)) {
      return {
        question,
        bullets: ['Спокойный тон', 'Короткий ответ'],
        script: 'Спасибо, всё хорошо, настроение рабочее — готов обсуждать роль.',
      };
    }
    if (/(рад познакомиться|пришл)/.test(q)) {
      return {
        question,
        bullets: ['Поблагодари', 'Покажи заинтересованность'],
        script: 'Взаимно, рад знакомству — интересно обсудить позицию и ваши ожидания.',
      };
    }
    return {
      question,
      bullets: ['Коротко', 'Без техники'],
      script: 'Да, конечно, удобно.',
    };
  }

  if (kind === 'hr' && /(о себе|расскажите)/.test(q)) {
    const title = context.title || 'роль';
    return {
      question,
      bullets: [
        '30 сек: кто ты сейчас',
        '1 кейс с цифрой',
        `Почему ${title}`,
      ],
      script:
        'Коротко: сейчас в поддержке/DevOps, ближе к инцидентам и автоматизации. Есть опыт L2/L3, мониторинг, CI/CD. На эту роль откликаюсь, потому что хочу больше клиентской/продуктовой ответственности и рост в сторону TAM.',
    };
  }

  return null;
}

async function callAnswerLlm(question, ctx) {
  const apiKey = getOpenRouterApiKey();
  let url = 'https://openrouter.ai/api/v1/chat/completions';
  let model = resolveOpenRouterModelForRequest();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  else if (isCustomLlmRunnable()) {
    url = `${getCustomLlmBaseUrl()}/chat/completions`;
    model = getCustomLlmModel();
    const k = getCustomLlmApiKey();
    if (k) headers.Authorization = `Bearer ${k}`;
  } else {
    return null;
  }

  const kindHint =
    ctx.kind === 'small_talk'
      ? 'Это ледокол/бытовой вопрос — script: 1 короткое предложение, без техники и без встречных вопросов.'
      : ctx.kind === 'hr'
        ? 'HR/мотивация — script: 20–40 сек, структура «опыт → кейс → почему эта роль».'
        : 'Технический вопрос — script: 30–45 сек, факты из резюме, 1 пример, цифра если есть.';

  const stageHint = ctx.stageHint || ctx.interviewStage
    ? `Этап собеседования: ${ctx.interviewStage || 'tech'}. ${ctx.stageHint || ''}`
    : '';

  const spokenBlock = ctx.spokenSnippet
    ? `\nУже сказано кандидатом на этом собеседовании (не противоречь):\n${ctx.spokenSnippet}\n`
    : '';

  const user = `Вакансия: ${ctx.title}
Компания: ${ctx.company}
Фокус: ${ctx.focus || '—'}
Тип вопроса: ${ctx.kind || 'technical'}
${kindHint}
${stageHint}
${spokenBlock}
Резюме кандидата:
${ctx.cvText}

Контекст по этому собесу (если есть):
${ctx.prepContext || '—'}

Заметки с прошлых собесов:
${ctx.notes || '—'}

Уроки: ${ctx.lessons || '—'}

Вопрос интервьюера: ${question}

JSON: { "bullets": ["2-4 коротких тезиса на русском"], "script": "что сказать вслух от первого лица — это ОТВЕТ кандидата, не новый вопрос" }
Только факты из резюме/контекста; если опыта нет — честно и коротко. По-русски.`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Коуч по собеседованиям DevOps. Только JSON.' },
          { role: 'user', content: user },
        ],
        temperature: 0.35,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    });
    const raw = await res.text();
    if (!res.ok) return null;
    const data = JSON.parse(raw);
    return extractJsonObject(data?.choices?.[0]?.message?.content || '{}');
  } catch {
    return null;
  }
}

function buildFallbackAnswer(question, cvText, context) {
  const kind = context.kind || classifyInterviewQuestion(question) || 'technical';
  const quick = buildQuickAnswer(question, kind, context);
  if (quick) return quick;

  const spoken = String(context.spokenSnippet || '');
  const lastSpoken = spoken.match(/A:\s*(.+)$/m)?.[1]?.trim();
  if (lastSpoken) {
    return {
      question,
      bullets: ['Опирайся на уже сказанное'],
      script: `Как уже отметил: ${lastSpoken.slice(0, 200)}`,
    };
  }

  const cvSnippet = cvText.slice(0, 400).replace(/\s+/g, ' ').trim();
  const focus = (context.focus || []).slice(0, 3).join(', ');
  const prep = String(context.prepContext || '').slice(0, 200);
  return {
    question,
    bullets: [
      focus ? `Стек: ${focus}` : 'Опирайся на релевантный опыт из резюме',
      prep ? 'Смотри контекст собеса выше' : 'Приведи 1 конкретный кейс',
      'Заверши цифрой или метрикой (время, %, SLA)',
    ],
    script: cvSnippet
      ? `По сути вопроса: у меня был похожий опыт — ${cvSnippet.slice(0, 160)}…`
      : 'Коротко опиши свой релевантный опыт и один конкретный пример из практики.',
  };
}

/**
 * @param {object} pack — prompt pack с questions
 * @param {{ maxQuestions?: number }} [opts]
 */
export async function enrichPackWithScripts(pack, opts = {}) {
  const max = opts.maxQuestions ?? 6;
  const questions = normalizeInterviewLines(pack.questions).slice(0, max);
  const answerScripts = [];
  for (const q of questions) {
    answerScripts.push(
      await buildAnswerScript(q, {
        title: pack.title,
        company: pack.company,
        focus: pack.focus,
      })
    );
  }
  return { ...pack, answerScripts };
}

/**
 * Только текст для произнесения (режим репетиции / живой overlay).
 * @param {string} script
 */
export function formatReplayScript(script) {
  return String(script || '').trim();
}

/**
 * STAR-scaffold: буллеты вместо абзаца (Interview Lift-паттерн).
 * @param {{ script?: string, bullets?: string[] }} answer
 */
export function formatScaffoldScript(answer) {
  const bullets = answer?.bullets || [];
  if (bullets.length) {
    return bullets.map((b) => `• ${String(b).trim()}`).join('\n');
  }
  const parts = String(answer?.script || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 4);
  if (!parts.length) return formatReplayScript(answer?.script);
  return parts.map((p) => `• ${p}`).join('\n');
}

/**
 * @param {object} pack — с answerScripts
 * @param {{ replayOnly?: boolean }} [opts]
 */
export function formatScriptPromptText(pack, opts = {}) {
  const scripts = pack.answerScripts || [];
  if (!scripts.length) return 'Нет сценария — сначала загрузите вопросы.';

  if (opts.replayOnly || pack.mode === 'replay') {
    const s = scripts.find((x) => x.script) || scripts[0];
    return formatReplayScript(s?.script || '');
  }

  const parts = [];
  const pitch = (pack.pitch || pack.llm?.pitch || '').trim();
  if (pitch) parts.push(`О себе (30 сек):\n${pitch.slice(0, 280)}`);

  for (const s of scripts) {
    if (!s.question) continue;
    const bullets = (s.bullets || []).map((b) => `• ${b}`).join('\n');
    parts.push(
      `Вопрос: ${s.question}\n→ Скажи: ${s.script || '—'}${bullets ? `\n${bullets}` : ''}`
    );
  }
  return parts.join('\n\n');
}
