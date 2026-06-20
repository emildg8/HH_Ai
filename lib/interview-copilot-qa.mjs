/**
 * Единый Q→A пайплайн для live, simulate и inject.
 */

import crypto from 'crypto';
import { bundleToAnswerContext } from './candidate-context-bundle.mjs';
import { canPushPromptChannel } from './interview-copilot-mode.mjs';
import {
  buildAnswerScript,
  buildQuickAnswer,
  formatReplayScript,
  formatScaffoldScript,
} from './interview-copilot-answers.mjs';
import { classifyInterviewQuestion, extractLatestQuestion } from './interview-copilot-question-detect.mjs';
import { applyOfferGuard, isEmployerQuestionPrompt } from './interview-copilot-offer-guard.mjs';
import { spokenSnippetForPrompt } from './interview-copilot-spoken.mjs';
import { pushPromptState } from './interview-prompt-bridge.mjs';
import { buildPromptState } from './interview-prompt.mjs';

/** @type {Map<string, Promise<void>>} */
const llmLocks = new Map();

function normalizeQuestionKey(q) {
  return crypto
    .createHash('sha1')
    .update(String(q || '').toLowerCase().replace(/\s+/g, ' ').trim())
    .digest('hex');
}

export function stageLengthHint(stage) {
  switch (stage) {
    case 'screening':
      return 'Максимум 1–2 короткие фразы.';
    case 'hr':
      return 'STAR, 20–35 сек.';
    case 'negotiation':
      return 'Осторожно по зарплате, без первой цифры без вилки.';
    case 'final':
      return 'Коротко + вопрос работодателю при уместности.';
    default:
      return '2 строки, факты и 1 кейс.';
  }
}

function tryEmployerQuestionAnswer(session, question) {
  if (!isEmployerQuestionPrompt(question)) return null;
  const employerQs =
    session.contextBundle?.prepPack?.llm?.questionsToEmployer ||
    session.contextBundle?.prepPack?.questionsToEmployer ||
    [];
  const first = Array.isArray(employerQs) ? employerQs[0] : '';
  if (!first) return null;
  return {
    question,
    bullets: [],
    script: String(first),
    scriptSource: 'employer-prep',
    tier: 1,
    kind: 'hr',
  };
}

/**
 * @param {object} session
 * @param {string} question
 */
export async function answerForQuestion(session, question) {
  const bundle = session.contextBundle;
  const spokenSnippet = spokenSnippetForPrompt(session);
  if (bundle) bundle.spokenSnippet = spokenSnippet;

  const ctx = bundle
    ? bundleToAnswerContext(bundle, question)
    : {
        title: session.title,
        company: session.company,
        focus: session.focus,
        prepContext: session.prepContext,
        interviewStage: session.interviewStage || 'tech',
        spokenSnippet,
      };

  ctx.stageHint = stageLengthHint(ctx.interviewStage || session.interviewStage);

  const kind = classifyInterviewQuestion(question) || 'technical';
  const quick = buildQuickAnswer(question, kind, ctx);
  if (quick) {
    return { ...quick, scriptSource: 'quick', tier: 1, kind };
  }

  const answer = await buildAnswerScript(question, ctx);
  const guarded = applyOfferGuard(answer.script, {
    question,
    cvText: ctx.cvText || bundle?.cvText || '',
    spokenSnippet,
    kind,
    interviewStage: ctx.interviewStage,
  });
  return {
    question,
    bullets: answer.bullets,
    script: guarded.script,
    scriptSource: guarded.regenerated ? 'llm-guarded' : 'llm',
    tier: 2,
    kind,
    guardFlags: guarded.flags,
  };
}

/**
 * @param {object} session
 * @param {object} answer
 * @param {string} question
 */
export function pushLiveScript(session, answer, question) {
  if (!canPushPromptChannel('live')) return null;

  const scriptOnly = session.scriptOnlyOverlay !== false;
  const useScaffold = session.answerFormat === 'scaffold' || session.interviewStage === 'hr';
  const raw = scriptOnly ? answer.script : answer.script;
  const text = useScaffold ? formatScaffoldScript(answer) : scriptOnly ? formatReplayScript(raw) : raw;
  const pack = {
    source: 'live',
    mode: scriptOnly ? 'replay' : 'live',
    title: session.title,
    company: session.company,
    vacancyId: session.vacancyId,
    questions: [question],
    answerScripts: [answer],
  };
  const preset = scriptOnly ? 'replay' : 'live';
  const state = buildPromptState({ ...pack, answerScripts: [answer] }, preset);
  state.text = text;
  state.lastQuestion = question;
  state.autoScroll = false;
  state.tier = answer.tier;
  state.scriptSource = answer.scriptSource;
  state.liveBarMaxLines = session.liveBarMaxLines ?? 2;
  state.liveFontSize = session.liveFontSize ?? 26;
  state.compact = scriptOnly;
  if (scriptOnly) {
    state.mode = 'replay';
    state.preset = 'replay';
    state.presetLabel = 'Живой суфлёр';
  }
  pushPromptState(state, 'live');
  session.lastPromptId = normalizeQuestionKey(question);
  session.lastPromptPushAt = Date.now();
  session.lastAnswerTier = answer.tier ?? null;
  session.tier1At = answer.tier === 1 ? Date.now() : session.tier1At;
  session.tier2At = answer.tier === 2 ? Date.now() : session.tier2At;
  return state;
}

/**
 * @param {object} session
 * @param {string} chunk
 */
export async function processLiveChunk(session, chunk) {
  if (!session?.running) {
    return { updated: false, error: 'session_not_running' };
  }

  session.transcriptBuffer = `${session.transcriptBuffer} ${chunk}`.trim().slice(-8000);
  const question = extractLatestQuestion(session.transcriptBuffer);
  if (!question) return { updated: false, session };

  const qKey = normalizeQuestionKey(question);
  const now = Date.now();
  if (
    qKey === session.lastQuestionKey &&
    now - session.lastAnswerAt < session.answerDebounceMs
  ) {
    return { updated: false, duplicate: true, session };
  }

  session.lastQuestion = question;
  session.lastQuestionKey = qKey;
  session.lastAnswerAt = now;
  session.generationId = (session.generationId || 0) + 1;
  const genId = session.generationId;

  if (isEmployerQuestionPrompt(question)) {
    const ans = tryEmployerQuestionAnswer(session, question);
    if (ans) {
      pushLiveScript(session, ans, question);
      session.lastAnswer = ans;
      return { updated: true, question, answer: ans, session };
    }
  }

  const kind = classifyInterviewQuestion(question) || 'technical';
  const quickCtx = session.contextBundle
    ? bundleToAnswerContext(session.contextBundle, question)
    : { title: session.title, company: session.company, interviewStage: session.interviewStage };
  const quick = buildQuickAnswer(question, kind, quickCtx);
  if (quick) {
    pushLiveScript(session, { ...quick, scriptSource: 'quick', tier: 1, kind }, question);
  }

  const sid = session.id;
  const prev = llmLocks.get(sid) || Promise.resolve();
  const job = prev
    .then(async () => {
      if (!session.running || session.generationId !== genId) return;
      const answer = await answerForQuestion(session, question);
      if (!session.running || session.generationId !== genId) return;
      if (answer.guardFlags?.length) {
        session.guardFlags = [...(session.guardFlags || []), ...answer.guardFlags];
      }
      pushLiveScript(session, answer, question);
      session.lastAnswer = answer;
    })
    .catch(() => {});
  llmLocks.set(sid, job);
  await job;

  return {
    updated: true,
    question,
    answer: session.lastAnswer,
    session,
  };
}

/**
 * Прямой inject вопроса (без STT).
 */
export async function processInjectedQuestion(session, question) {
  if (!session?.running) return { updated: false, error: 'session_not_running' };
  const q = String(question || '').trim();
  if (!q) return { updated: false };

  const employerAns = tryEmployerQuestionAnswer(session, q);
  if (employerAns) {
    pushLiveScript(session, employerAns, q);
    session.lastQuestion = q;
    session.lastQuestionKey = normalizeQuestionKey(q);
    session.lastAnswerAt = Date.now();
    session.lastAnswer = employerAns;
    return { updated: true, question: q, answer: employerAns, session };
  }

  session.generationId = (session.generationId || 0) + 1;
  const kind = classifyInterviewQuestion(q) || 'technical';
  const quickCtx = session.contextBundle
    ? bundleToAnswerContext(session.contextBundle, q)
    : { title: session.title, company: session.company };
  const quick = buildQuickAnswer(q, kind, quickCtx);
  if (quick) pushLiveScript(session, { ...quick, scriptSource: 'quick', tier: 1, kind }, q);

  const answer = await answerForQuestion(session, q);
  pushLiveScript(session, answer, q);
  session.lastQuestion = q;
  session.lastQuestionKey = normalizeQuestionKey(q);
  session.lastAnswerAt = Date.now();
  session.lastAnswer = answer;
  return { updated: true, question: q, answer, session };
}
