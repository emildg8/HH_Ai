/**
 * Фаза 1: структурированный бриф «вакансия ↔ резюме» перед генерацией писем.
 */

import {
  getOpenRouterApiKey,
  extractJsonObject,
  resolveOpenRouterModelForRequest,
  getCustomLlmBaseUrl,
  getCustomLlmModel,
  getCustomLlmApiKey,
  isCustomLlmRunnable,
  stripMarkdownJsonFence,
} from './openrouter-score.mjs';
import { buildCvFactsBlock } from './cover-letter-cv-facts.mjs';
import { buildVacancyFocusBlock } from './cover-letter-vacancy-focus.mjs';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * @param {object} brief
 */
export function formatBriefForPrompt(brief) {
  if (!brief || typeof brief !== 'object') return '';
  const lines = [];
  if (brief.companyHook) lines.push(`Крючок под компанию/роль: ${brief.companyHook}`);
  if (Array.isArray(brief.topRequirements) && brief.topRequirements.length) {
    lines.push('Главное из вакансии:');
    brief.topRequirements.slice(0, 6).forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  if (Array.isArray(brief.cvProofs) && brief.cvProofs.length) {
    lines.push('Доказательства из резюме (вплети в письма):');
    for (const p of brief.cvProofs.slice(0, 6)) {
      if (typeof p === 'string') lines.push(`  · ${p}`);
      else if (p && typeof p === 'object') {
        lines.push(`  · ${p.point || p.fact || ''}${p.mapsTo ? ` → ${p.mapsTo}` : ''}`);
      }
    }
  }
  if (brief.riskNote) lines.push(`Как обыграть риски: ${brief.riskNote}`);
  if (Array.isArray(brief.letterAngles) && brief.letterAngles.length) {
    lines.push(`Углы для разных вариантов: ${brief.letterAngles.join(' · ')}`);
  }
  return lines.join('\n');
}

function parseBriefResponse(data) {
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('brief: пустой ответ LLM');
  const parsed = extractJsonObject(stripMarkdownJsonFence(String(text)));
  return {
    companyHook: String(parsed.companyHook || parsed.hook || '').trim(),
    topRequirements: (parsed.topRequirements || parsed.requirements || [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 8),
    cvProofs: (parsed.cvProofs || parsed.proofs || []).slice(0, 8),
    riskNote: String(parsed.riskNote || parsed.risks || '').trim(),
    letterAngles: (parsed.letterAngles || parsed.angles || [])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 5),
  };
}

async function postBrief(url, headers, body) {
  const timeoutMs = Math.max(15_000, Number(process.env.COVER_LETTER_BRIEF_TIMEOUT_MS) || 90_000);
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
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  if (!res.ok) throw new Error(`brief LLM ${res.status}: ${raw.slice(0, 400)}`);
  return JSON.parse(raw);
}

/**
 * @param {object} record
 * @param {{ text: string }} cvBundle
 * @param {string} desc
 * @param {{ hasOR: boolean, skipOpenRouter: boolean }} opts
 */
export async function generateMatchingBrief(record, cvBundle, desc, opts) {
  const focus = buildVacancyFocusBlock(record, desc);
  const cvFacts = buildCvFactsBlock(cvBundle.text);
  const userPrompt = `Составь бриф для сопроводительных писем (отклик на hh.ru).

${focus}

${cvFacts}

ОПИСАНИЕ ВАКАНСИИ (фрагмент):
${desc.slice(0, 6000)}

Верни только JSON:
{
  "companyHook": "одна конкретная фраза — почему именно эта роль/задача (из вакансии, не общие слова)",
  "topRequirements": ["до 5 формулировок того, что ждут от кандидата"],
  "cvProofs": [{"point": "факт из резюме с цифрой если есть", "mapsTo": "какое требование закрывает"}],
  "riskNote": "что может насторожить и как мягко обыграть одной фразой",
  "letterAngles": ["3 разных угла для вариантов письма, например: техника / процессы / коммуникация"]
}`;

  const body = {
    messages: [
      {
        role: 'system',
        content:
          'Ты карьерный редактор. Анализируешь вакансию и резюме для сильного отклика. Только JSON, без markdown и комментариев.',
      },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.32,
    max_tokens: Math.min(2500, Number(process.env.COVER_LETTER_BRIEF_MAX_TOKENS) || 1800),
    response_format: { type: 'json_object' },
  };

  const { hasOR, skipOpenRouter } = opts;

  if (hasOR && !skipOpenRouter) {
    const model = resolveOpenRouterModelForRequest();
    const data = await postBrief(
      OPENROUTER_URL,
      {
        Authorization: `Bearer ${getOpenRouterApiKey()}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost',
        'X-Title': 'hh-ru-apply-cover-brief',
      },
      { ...body, model }
    );
    return parseBriefResponse(data);
  }

  if (!isCustomLlmRunnable()) throw new Error('brief: нет LLM');
  const base = getCustomLlmBaseUrl();
  const model = getCustomLlmModel();
  const headers = {};
  const key = getCustomLlmApiKey();
  if (key) headers.Authorization = `Bearer ${key}`;
  const data = await postBrief(`${base}/chat/completions`, headers, { ...body, model });
  return parseBriefResponse(data);
}

export function isCoverLetterTwoPhaseEnabled() {
  const v = String(process.env.COVER_LETTER_TWO_PHASE ?? '1').trim();
  return v !== '0' && v.toLowerCase() !== 'false';
}
