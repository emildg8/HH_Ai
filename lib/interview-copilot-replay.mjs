/**
 * Репетиция copilot по транскрипту / таймкодам.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { createCopilotSession, getCopilotSession } from './interview-copilot-session.mjs';
import { setCopilotMode } from './interview-copilot-mode.mjs';
import { findPrepContextForTranscriptBase } from './interview-prep-context.mjs';
import { ingestFromSegments, computeSourceId, hashContent } from './interview-ingest.mjs';
import {
  ensureReplayPlan,
  findPlanByTranscriptBase,
  loadReplayPlan,
  pushReplayScript,
  resolveActivePrompt,
  saveReplayPlan,
} from './interview-replay-plan.mjs';
import { activePromptIndexAt } from './interview-question-timeline.mjs';

const TRANSCRIPT_DIR = path.join(DATA_DIR, 'interview-transcripts');

function timecodeToSec(tc) {
  const raw = String(tc).replace(',', '.');
  const [hh, mm, ssMsec] = raw.split(':');
  if (hh == null || mm == null || ssMsec == null) return 0;
  const [ss, msec] = ssMsec.split('.');
  const H = Number(hh);
  const M = Number(mm);
  const S = Number(ss);
  const MS = Number(msec || 0);
  if (![H, M, S, MS].every(Number.isFinite)) return 0;
  return H * 3600 + M * 60 + S + MS / 1000;
}

/**
 * Парсинг таймкод-линий формата:
 * - [00:00:00,000 -> 00:00:03,600] Текст...
 * - или SRT: 00:00:00,000 --> 00:00:03,600
 * @param {string} text
 * @returns {{startSec:number,endSec:number,text:string}[]}
 */
export function parseTimestampedLines(text) {
  const raw = String(text || '');
  const out = [];

  const brRe = /^\s*\[(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})]\s*(.+?)\s*$/;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(brRe);
    if (!m) continue;
    const startSec = timecodeToSec(m[1]);
    const endSec = timecodeToSec(m[2]);
    const t = String(m[3] || '').trim();
    if (!t) continue;
    out.push({ startSec, endSec, text: t });
  }
  if (out.length) return out;

  const timeLineRe = /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})$/;
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) break;

    if (/^\d+$/.test(lines[i].trim())) i++;
    if (i >= lines.length) break;

    const tl = lines[i].trim();
    const m = tl.match(timeLineRe);
    if (!m) {
      i++;
      continue;
    }

    const startSec = timecodeToSec(m[1]);
    const endSec = timecodeToSec(m[2]);
    i++;

    const buf = [];
    while (i < lines.length && lines[i].trim()) {
      buf.push(lines[i].trim());
      i++;
    }
    const t = buf.join(' ').trim();
    if (t) out.push({ startSec, endSec, text: t });
  }

  return out;
}

/**
 * @param {string} text
 * @param {number} secPerLine
 */
export function parseTranscriptToSegments(text, secPerLine = 5) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8);

  let t = 0;
  return lines.map((line) => {
    const seg = { startSec: t, endSec: t + secPerLine, text: line };
    t += secPerLine;
    return seg;
  });
}

/**
 * @param {string} filePath
 */
export function loadTranscriptSegments(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    try {
      const data = JSON.parse(raw);
      const segs = data.segments || data.transcription?.segments;
      if (Array.isArray(segs) && segs.length) {
        return segs.map((s) => ({
          startSec: s.start ?? s.startSec ?? 0,
          endSec: s.end ?? s.endSec ?? (s.start ?? 0) + 3,
          text: String(s.text || '').trim(),
        }));
      }
    } catch {
      /* fallback txt */
    }
  }
  const tsSegments = parseTimestampedLines(raw);
  if (tsSegments.length) return tsSegments;
  return parseTranscriptToSegments(raw);
}

/**
 * @param {object} opts
 */
export async function startReplaySession(opts = {}) {
  let segments = opts.segments || [];
  let transcriptPath = opts.transcriptPath || null;

  if (opts.transcriptPath && fs.existsSync(opts.transcriptPath)) {
    segments = loadTranscriptSegments(opts.transcriptPath);
  } else if (opts.transcriptBase) {
    const txt = path.join(TRANSCRIPT_DIR, `${opts.transcriptBase}.txt`);
    const json = path.join(TRANSCRIPT_DIR, `${opts.transcriptBase}.json`);
    if (fs.existsSync(txt)) {
      transcriptPath = txt;
      segments = loadTranscriptSegments(txt);
    } else if (fs.existsSync(json)) {
      transcriptPath = json;
      segments = loadTranscriptSegments(json);
    }
  }

  const prepContext =
    opts.prepContext || findPrepContextForTranscriptBase(opts.transcriptBase) || '';
  const title = opts.title || (prepContext ? 'TAM / SSC' : 'Репетиция');

  let replayPlan = opts.replayPlan || null;
  let sourceId = opts.sourceId || null;

  if (!replayPlan && opts.transcriptBase) {
    replayPlan = findPlanByTranscriptBase(opts.transcriptBase);
    if (replayPlan) sourceId = replayPlan.sourceId;
  }

  if (!replayPlan && segments.length) {
    const normalized = ingestFromSegments(
      { segments, transcriptBase: opts.transcriptBase || 'inline' },
      {
        sourceId:
          sourceId ||
          computeSourceId([
            opts.transcriptBase || transcriptPath || 'inline',
            hashContent(JSON.stringify(segments.slice(0, 20))),
          ]),
        prepContext,
        title,
        company: opts.company,
        vacancyId: opts.vacancyId,
        videoPath: opts.videoPath,
        videoDurationSec: opts.videoDurationSec,
        hasVideo: Boolean(opts.videoPath),
      }
    );
    normalized.meta = { title, company: opts.company || '', vacancyId: opts.vacancyId };
    replayPlan = await ensureReplayPlan(normalized);
    sourceId = replayPlan.sourceId;
  }

  const session = createCopilotSession({
    mode: 'replay',
    title: replayPlan?.title || title,
    company: opts.company || replayPlan?.company || '',
    vacancyId: opts.vacancyId ?? replayPlan?.vacancyId ?? null,
    prepContext: replayPlan?.prepContext || prepContext,
    focus: opts.focus || [],
    segments,
    replayPlan,
    sourceId,
    answerDebounceMs: 500,
    running: true,
  });

  setCopilotMode('replay', session.id);

  return session;
}

/**
 * @param {string} sessionId
 * @param {number} currentTimeSec
 */
export async function tickReplaySession(sessionId, currentTimeSec) {
  const s = getCopilotSession(sessionId);
  if (!s || s.mode !== 'replay') return { session: s, events: [] };

  const plan = s.replayPlan;
  if (!plan?.prompts?.length) {
    return { session: s, events: [], warning: 'План репетиции пуст' };
  }

  const { active, changed } = resolveActivePrompt(plan, currentTimeSec, {
    lastPromptId: s.lastPromptId,
    lastPromptPushAt: s.lastPromptPushAt,
  });

  const events = [];
  if (active && changed) {
    s.lastPromptId = active.id;
    s.lastPromptPushAt = Date.now();
    s.lastQuestion = active.text;
    pushReplayScript(plan, active, s);
    events.push({ question: active.text, atSec: active.startSec, promptId: active.id });
  }

  const promptIndex = active ? activePromptIndexAt(plan.prompts, active.startSec) : -1;
  return {
    session: s,
    events,
    activePrompt: active
      ? {
          id: active.id,
          startSec: active.startSec,
          script: active.script,
          index: promptIndex,
          total: plan.prompts.length,
        }
      : null,
  };
}

/**
 * @param {string} sourceId
 * @param {number} offsetSec
 */
export function updatePlanTimelineOffset(sourceId, offsetSec) {
  const plan = loadReplayPlan(sourceId);
  if (!plan) return null;
  plan.timelineOffsetSec = Number(offsetSec) || 0;
  saveReplayPlan(plan);
  return plan;
}

/**
 * Список доступных транскриптов.
 */
export function listReplayTranscripts() {
  if (!fs.existsSync(TRANSCRIPT_DIR)) return [];
  return fs
    .readdirSync(TRANSCRIPT_DIR)
    .filter((f) => /\.(txt|json)$/i.test(f))
    .map((f) => ({ name: f, base: f.replace(/\.(txt|json)$/i, '') }));
}
