/**
 * План репетиции: сборка, сохранение, валидация, предгенерация ответов.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { DATA_DIR } from './paths.mjs';
import { hashContent } from './interview-ingest.mjs';
import {
  buildQuestionTimeline,
  findActivePrompt,
  activePromptIndexAt,
} from './interview-question-timeline.mjs';
import { buildAnswerScript, formatReplayScript } from './interview-copilot-answers.mjs';
import { canPushPromptChannel } from './interview-copilot-mode.mjs';
import { pushPromptState } from './interview-prompt-bridge.mjs';

export const PLAN_VERSION = 3;
export const PLAN_DIR = path.join(DATA_DIR, 'interview-replay-plans');
const PREGEN_MAX = Number(process.env.HH_REPLAY_PREGEN_MAX) || 80;

/**
 * @param {string} videoPath
 */
export function probeVideoDurationSec(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) return null;
  return new Promise((resolve) => {
    const p = spawn(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        videoPath,
      ],
      { shell: false }
    );
    let out = '';
    p.stdout?.on('data', (c) => {
      out += c;
    });
    p.on('error', () => resolve(null));
    p.on('close', () => {
      const n = Number(out.trim());
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

/**
 * @param {string} sourceId
 */
export function planPathForSource(sourceId) {
  return path.join(PLAN_DIR, `${sourceId}.json`);
}

/**
 * @param {string} sourceId
 */
export function loadReplayPlan(sourceId) {
  const fp = planPathForSource(sourceId);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {object} plan
 */
export function saveReplayPlan(plan) {
  fs.mkdirSync(PLAN_DIR, { recursive: true });
  const fp = planPathForSource(plan.sourceId);
  fs.writeFileSync(fp, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return fp;
}

/**
 * @param {object} normalized — из interview-ingest
 * @param {object} [opts]
 */
export async function buildReplayPlan(normalized, opts = {}) {
  const prompts = buildQuestionTimeline(normalized.segments, {
    timingConfidence: normalized.timingConfidence,
  });

  const prepContextHash = hashContent(normalized.prepContext || '');
  let videoDurationSec = normalized.videoDurationSec;
  if (!videoDurationSec && normalized.videoPath) {
    videoDurationSec = await probeVideoDurationSec(normalized.videoPath);
  }

  const plan = {
    version: PLAN_VERSION,
    sourceKind: normalized.sourceKind,
    sourceId: normalized.sourceId,
    transcriptBase: normalized.transcriptBase,
    transcriptHash: normalized.transcriptHash,
    prepContextHash,
    timingConfidence: normalized.timingConfidence,
    videoDurationSec: videoDurationSec ?? null,
    transcriptEndSec: normalized.transcriptEndSec,
    timelineOffsetSec: opts.timelineOffsetSec ?? 0,
    leadTimeSec: opts.leadTimeSec ?? 0.6,
    holdMinSec: opts.holdMinSec ?? 2.5,
    title: normalized.meta?.title || '',
    company: normalized.meta?.company || '',
    vacancyId: normalized.meta?.vacancyId ?? null,
    prepContext: normalized.prepContext || '',
    prompts,
    pregen: { done: 0, total: prompts.length, at: null },
    builtAt: new Date().toISOString(),
  };

  await fillQuickScripts(plan);
  saveReplayPlan(plan);
  return plan;
}

/**
 * @param {object} plan
 */
export async function fillQuickScripts(plan) {
  const ctx = {
    title: plan.title,
    company: plan.company,
    prepContext: plan.prepContext,
    focus: ['ITIL', 'инциденты', 'VMware', 'клиентский сервис'],
  };
  let done = 0;
  for (const p of plan.prompts) {
    const ans = await buildAnswerScript(p.text, ctx);
    p.script = ans.script || '';
    p.scriptSource = p.script ? 'quick' : '';
    if (p.script) done += 1;
  }
  plan.pregen = { done, total: plan.prompts.length, at: new Date().toISOString() };
}

/**
 * @param {object} plan
 * @param {object} [opts]
 */
export async function enrichPlanWithLlm(plan, opts = {}) {
  const max = opts.max ?? PREGEN_MAX;
  const ctx = {
    title: plan.title,
    company: plan.company,
    prepContext: plan.prepContext,
    focus: ['ITIL', 'инциденты', 'VMware', 'клиентский сервис'],
  };
  let enriched = 0;
  for (const p of plan.prompts) {
    if (enriched >= max) break;
    if (p.intent === 'ack' && p.script) continue;
    if (p.kind === 'small_talk' && p.script) continue;
    const ans = await buildAnswerScript(p.text, ctx);
    if (ans.script) {
      p.script = ans.script;
      p.scriptSource = 'llm';
      enriched += 1;
    }
  }
  plan.pregen = {
    done: plan.prompts.filter((x) => x.script).length,
    total: plan.prompts.length,
    at: new Date().toISOString(),
  };
  saveReplayPlan(plan);
  return plan;
}

/**
 * @param {object} plan
 */
export function validateReplayPlan(plan) {
  const issues = [];
  const warnings = [];
  if (!plan?.prompts?.length) issues.push('Нет точек ответа в плане');
  if (plan.prompts?.length < 5 && (plan.transcriptEndSec || 0) > 600) {
    warnings.push('Мало точек ответа для длинной записи');
  }
  if (plan.videoDurationSec && plan.transcriptEndSec) {
    const drift = Math.abs(plan.videoDurationSec - plan.transcriptEndSec);
    if (drift > 15) warnings.push(`Дрейф видео и транскрипта: ${Math.round(drift)} с`);
  }
  if (plan.timingConfidence === 'low') {
    warnings.push('Таймкоды приблизительные — возможен сдвиг суфлёра');
  }
  const idx26 = activePromptIndexAt(plan.prompts || [], 26);
  if (idx26 < 1) {
    warnings.push('К 26 с ожидается ≥2 точки — проверьте транскрипт');
  }
  for (let i = 1; i < (plan.prompts || []).length; i++) {
    const gap = plan.prompts[i].startSec - plan.prompts[i - 1].startSec;
    if (
      gap < 1.5 &&
      plan.prompts[i].intent === 'respond' &&
      plan.prompts[i - 1].intent === 'respond'
    ) {
      warnings.push(`Две реплики respond ближе 1.5 с: ${plan.prompts[i].id}`);
    }
  }
  return {
    ok: !issues.length,
    issues,
    warnings,
    promptCount: plan.prompts?.length || 0,
    activeAt26s: idx26,
  };
}

/**
 * @param {object} plan
 * @param {number} currentTimeSec
 * @param {object} sessionState
 */
export function resolveActivePrompt(plan, currentTimeSec, sessionState = {}) {
  const offset = plan.timelineOffsetSec ?? 0;
  const lead = plan.leadTimeSec ?? 0.6;
  const tEff = currentTimeSec + offset + lead;
  const active = findActivePrompt(plan.prompts, tEff);
  if (!active) return { active: null, changed: false };

  const now = Date.now();
  const holdMs = (plan.holdMinSec ?? 2.5) * 1000;
  if (
    active.id === sessionState.lastPromptId &&
    now - (sessionState.lastPromptPushAt || 0) < holdMs
  ) {
    return { active, changed: false };
  }
  const changed = active.id !== sessionState.lastPromptId;
  return { active, changed };
}

/**
 * @param {object} plan
 * @param {object} active
 * @param {object} session
 */
export function pushReplayScript(plan, active, session) {
  if (!canPushPromptChannel('live')) return;
  const script = active?.script || '';
  const text = script ? formatReplayScript(script) : '';
  const idx = activePromptIndexAt(plan.prompts, active?.startSec ?? 0);
  pushPromptState({
    at: new Date().toISOString(),
    preset: 'replay',
    presetLabel: 'Репетиция',
    source: 'replay',
    sourceLabel: 'Запись',
    mode: 'replay',
    title: plan.title || session.title || '',
    company: plan.company || '',
    vacancyId: plan.vacancyId ?? null,
    text,
    scrollSpeed: 0,
    fontSize: 24,
    opacity: 0.9,
    mirror: false,
    autoScroll: false,
    replayMeta: {
      promptId: active?.id,
      promptIndex: idx,
      promptTotal: plan.prompts.length,
      timeSec: active?.startSec,
    },
  }, 'live');
}

/**
 * @param {string} transcriptBase
 */
export function findPlanByTranscriptBase(transcriptBase) {
  if (!fs.existsSync(PLAN_DIR)) return null;
  for (const name of fs.readdirSync(PLAN_DIR)) {
    if (!name.endsWith('.json')) continue;
    try {
      const plan = JSON.parse(fs.readFileSync(path.join(PLAN_DIR, name), 'utf8'));
      if (plan.transcriptBase === transcriptBase) return plan;
    } catch {
      /* */
    }
  }
  return null;
}

/**
 * @param {object} normalized
 * @param {object} [opts]
 */
export async function ensureReplayPlan(normalized, opts = {}) {
  const existing = loadReplayPlan(normalized.sourceId);
  const prepHash = hashContent(normalized.prepContext || '');
  if (
    existing &&
    existing.version === PLAN_VERSION &&
    existing.transcriptHash === normalized.transcriptHash &&
    existing.prepContextHash === prepHash &&
    !opts.force
  ) {
    return existing;
  }
  return buildReplayPlan(normalized, opts);
}
