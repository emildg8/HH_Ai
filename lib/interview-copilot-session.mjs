/**
 * Сессия Live / Replay copilot (in-memory).
 */

import { clearCopilotMode, setCopilotMode } from './interview-copilot-mode.mjs';
import { processInjectedQuestion, processLiveChunk } from './interview-copilot-qa.mjs';

/** @type {Map<string, object>} */
const sessions = new Map();

let liveSessionId = null;

function newId() {
  return `copilot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {object} opts
 */
export function createCopilotSession(opts = {}) {
  const id = newId();
  const session = {
    id,
    mode: opts.mode || 'live',
    title: opts.title || '',
    company: opts.company || '',
    vacancyId: opts.vacancyId || null,
    recordId: opts.recordId || null,
    interviewStage: opts.interviewStage || 'tech',
    prepContext: opts.prepContext || '',
    focus: opts.focus || [],
    contextBundle: opts.contextBundle || null,
    transcriptBuffer: '',
    lastQuestion: '',
    lastQuestionKey: '',
    lastAnswer: null,
    lastAnswerAt: 0,
    generationId: 0,
    guardFlags: [],
    spokenTurns: [],
    answerDebounceMs:
      opts.answerDebounceMs ?? (opts.mode === 'replay' ? 500 : 4000),
    segments: opts.segments || [],
    replayIndex: 0,
    replayPlan: opts.replayPlan || null,
    sourceId: opts.sourceId || null,
    lastPromptId: '',
    lastPromptPushAt: 0,
    scriptOnlyOverlay: opts.scriptOnlyOverlay ?? false,
    liveBarMaxLines: opts.liveBarMaxLines ?? 2,
    liveFontSize: opts.liveFontSize ?? 26,
    answerFormat: opts.answerFormat || 'scaffold',
    running: opts.mode === 'live',
    createdAt: new Date().toISOString(),
  };
  sessions.set(id, session);
  if (opts.mode === 'live') {
    liveSessionId = id;
    setCopilotMode('live', id);
  }
  return session;
}

/**
 * @param {string} [id]
 * @param {{ strict?: boolean }} [opts]
 */
export function getCopilotSession(id, opts = {}) {
  if (!id) return liveSessionId ? sessions.get(liveSessionId) : null;
  const s = sessions.get(id);
  if (!s && opts.strict) return null;
  if (!s && !opts.strict && liveSessionId) return sessions.get(liveSessionId);
  return s || null;
}

export function getLiveSessionId() {
  return liveSessionId;
}

export function stopCopilotSession(id) {
  const sid = id || liveSessionId;
  if (!sid) return null;
  const s = sessions.get(sid);
  if (s) {
    s.running = false;
    if (s.mode === 'live') clearCopilotMode(sid);
  }
  if (liveSessionId === sid) liveSessionId = null;
  sessions.delete(sid);
  return s;
}

/**
 * @param {string} sessionId
 * @param {string} chunk
 */
export async function appendTranscriptChunk(sessionId, chunk) {
  const s = getCopilotSession(sessionId, { strict: true });
  if (!s) return { session: null, updated: false, error: 'session_not_found' };
  if (!s.running) return { session: s, updated: false, error: 'session_not_running' };
  if (!chunk?.trim()) return { session: s, updated: false };

  return processLiveChunk(s, chunk.trim());
}

export async function injectQuestion(sessionId, question) {
  const s = getCopilotSession(sessionId, { strict: true });
  if (!s) return { session: null, updated: false, error: 'session_not_found' };
  return processInjectedQuestion(s, question);
}

export function getCopilotSessionSnapshot(id) {
  const s = getCopilotSession(id, { strict: Boolean(id) });
  if (!s) return null;
  const plan = s.replayPlan;
  return {
    id: s.id,
    mode: s.mode,
    title: s.title,
    company: s.company,
    running: s.running,
    interviewStage: s.interviewStage,
    recordId: s.recordId,
    contextHash: s.contextBundle?.hash || null,
    lastQuestion: s.lastQuestion,
    lastPromptId: s.lastPromptId,
    lastAnswerTier: s.lastAnswerTier ?? null,
    tier1At: s.tier1At ?? null,
    tier2At: s.tier2At ?? null,
    guardFlags: s.guardFlags || [],
    spokenCount: (s.spokenTurns || []).length,
    bufferTail: s.transcriptBuffer.slice(-400),
    segmentsTotal: s.segments.length,
    replayIndex: s.replayIndex,
    sourceId: s.sourceId,
    promptTotal: plan?.prompts?.length ?? 0,
    pregenDone: plan?.pregen?.done ?? 0,
    timingConfidence: plan?.timingConfidence ?? null,
    transcriptEndSec: plan?.transcriptEndSec ?? null,
  };
}
