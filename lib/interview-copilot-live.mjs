/**
 * Live copilot: STT chunk → вопрос → ответ → push в суфлёр.
 */

import { buildCandidateContext } from './candidate-context-bundle.mjs';
import { loadPreferences } from './preferences.mjs';
import { resolveVacancyRecord } from './vacancy-record-resolve.mjs';
import {
  createCopilotSession,
  getCopilotSessionSnapshot,
  getLiveSessionId,
  stopCopilotSession,
} from './interview-copilot-session.mjs';
import { transcribePcmChunk, transcribeTextDirect } from './interview-copilot-stt.mjs';
import { clearPromptState, pushPromptState } from './interview-prompt-bridge.mjs';
import { buildPromptState } from './interview-prompt.mjs';
import { clearCopilotMode, setCopilotMode } from './interview-copilot-mode.mjs';

/**
 * @param {object} opts
 */
export async function startLiveCopilot(opts = {}) {
  const existingId = opts.resumeSessionId || process.env.COPILOT_SESSION_ID;
  if (existingId) {
    const { getCopilotSession } = await import('./interview-copilot-session.mjs');
    const existing = getCopilotSession(existingId, { strict: true });
    if (existing?.running) return existing;
  }

  stopCopilotSession();

  const copilotPrefs = loadPreferences()?.interviewCopilot || {};
  const rec = resolveVacancyRecord(opts.recordId || opts.vacancyId);
  const prepPack = opts.prepPack || rec?.interviewPrep || null;

  const contextBundle = await buildCandidateContext({
    title: opts.title || rec?.title,
    company: opts.company || rec?.company,
    vacancyId: opts.vacancyId || rec?.vacancyId,
    recordId: opts.recordId || rec?.id,
    prepContext: opts.prepContext,
    vacancyText: opts.vacancyText || opts.description || rec?.descriptionForLlm || rec?.descriptionPreview,
    interviewStage: opts.interviewStage || copilotPrefs.interviewStage,
    prepPack,
    focus: opts.focus,
    force: Boolean(opts.forceContext),
  });

  const session = createCopilotSession({
    mode: 'live',
    title: opts.title || contextBundle.title || rec?.title || 'Собеседование',
    company: opts.company || contextBundle.company || rec?.company || '',
    vacancyId: opts.vacancyId || contextBundle.vacancyId || rec?.vacancyId,
    recordId: opts.recordId || rec?.id || contextBundle.recordId,
    interviewStage: opts.interviewStage || contextBundle.interviewStage || copilotPrefs.interviewStage || 'tech',
    prepContext: opts.prepContext || contextBundle.prepSummary || '',
    focus: opts.focus || contextBundle.focus || [],
    contextBundle,
    scriptOnlyOverlay: opts.scriptOnlyOverlay !== false,
    liveBarMaxLines: copilotPrefs.liveBarMaxLines ?? 2,
    liveFontSize: copilotPrefs.liveFontSize ?? 26,
    answerFormat: opts.answerFormat || copilotPrefs.answerFormat || 'scaffold',
  });

  setCopilotMode('live', session.id);

  const state = buildPromptState(
    {
      source: 'live',
      mode: 'live',
      title: session.title,
      company: session.company,
      questions: [],
      answerScripts: [],
    },
    'live'
  );
  state.text = 'Слушаю…';
  pushPromptState(state, 'live');

  return session;
}

/**
 * @param {object} payload
 */
export async function ingestLiveCopilotChunk(payload = {}) {
  const sessionId = payload.sessionId || getLiveSessionId();
  let text = '';

  if (payload.text) {
    text = transcribeTextDirect(payload.text);
  } else if (payload.pcmBase64) {
    const buf = Buffer.from(payload.pcmBase64, 'base64');
    text = await transcribePcmChunk(buf, payload.sampleRate || 16000);
  }

  if (!text) return { ok: true, transcribed: '', updated: false };

  const { appendTranscriptChunk } = await import('./interview-copilot-session.mjs');
  const result = await appendTranscriptChunk(sessionId, text);
  return {
    ok: true,
    transcribed: text,
    updated: result.updated,
    question: result.question || null,
    error: result.error || null,
    session: getCopilotSessionSnapshot(sessionId),
  };
}

export function stopLiveCopilot(sessionId) {
  const s = stopCopilotSession(sessionId);
  clearPromptState('live');
  clearCopilotMode(sessionId);
  return s;
}
