/**
 * Таймлайн вопросов: реплики → намерения → точки ответа для суфлёра.
 */

import { classifyInterviewQuestion } from './interview-copilot-question-detect.mjs';

const CANDIDATE_START_RE =
  /^(да|нет|конечно|спасибо|хорошо|отлично|взаимно|понятно|окей|ok)[\s,.!]/i;

/**
 * @param {{startSec:number,endSec:number,text:string}[]} segments
 */
export function segmentsToTurns(segments) {
  const turns = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const dur = (seg.endSec ?? seg.startSec + 3) - seg.startSec;
    const text = String(seg.text || '').trim();
    const short = text.length < 85 && dur < 4.8;
    const prev = segments[i - 1];
    const afterQuestion = prev && /\?/.test(prev.text);
    let speaker = 'interviewer';
    if (short && (CANDIDATE_START_RE.test(text) || (afterQuestion && text.length < 50))) {
      speaker = 'candidate';
    }
    turns.push({
      startSec: seg.startSec,
      endSec: seg.endSec ?? seg.startSec + dur,
      text,
      speaker,
    });
  }
  return turns;
}

/**
 * @param {object} turn
 */
export function splitTurnToClauses(turn) {
  const text = String(turn.text || '').trim();
  if (!text) return [];
  const parts = text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  if (parts.length <= 1) {
    return [{ startSec: turn.startSec, endSec: turn.endSec, text }];
  }
  const totalLen = parts.reduce((a, p) => a + p.length, 0) || 1;
  const dur = Math.max(0.3, turn.endSec - turn.startSec);
  let t = turn.startSec;
  return parts.map((p) => {
    const frac = p.length / totalLen;
    const end = t + dur * frac;
    const clause = { startSec: t, endSec: end, text: p };
    t = end;
    return clause;
  });
}

/**
 * @param {string} text
 * @param {'high'|'medium'|'low'} timingConfidence
 */
export function classifyIntent(text, timingConfidence = 'medium') {
  const t = String(text || '').trim();
  if (t.length < 8) return 'listen';
  if (/\?\s*$/.test(t)) return 'respond';
  if (/(удобно|верно|согласны|не волнуешься|слышно|видно)\??/i.test(t)) return 'respond';
  if (
    /^(расскаж|опиш|как вы|как ты|что такое|чем отлича|почему|зачем|можете|explain)/i.test(t)
  ) {
    return 'respond';
  }
  if (t.length > 150 && !/\?/.test(t)) return 'listen';
  if (/давай|представл|обсудим|рекомендован/i.test(t) && t.length < 90) {
    return 'ack';
  }
  if (timingConfidence === 'low' && !/\?/.test(t)) return 'listen';
  if (t.length > 90) return 'listen';
  return 'ack';
}

/**
 * @param {object[]} prompts
 */
export function mergeNearbyPrompts(prompts) {
  if (!prompts.length) return [];
  const out = [prompts[0]];
  for (let i = 1; i < prompts.length; i++) {
    const prev = out[out.length - 1];
    const cur = prompts[i];
    const gap = cur.startSec - prev.startSec;
    if (gap < 1.5 && prev.intent === 'ack' && cur.intent === 'ack') {
      prev.text = `${prev.text} ${cur.text}`.trim();
      prev.endSec = cur.endSec;
      continue;
    }
    out.push(cur);
  }
  return out;
}

/**
 * @param {object[]} prompts
 */
export function sparseAckPrompts(prompts) {
  const respond = prompts.filter((p) => p.intent === 'respond');
  const ack = prompts.filter((p) => p.intent === 'ack');
  const sparseAck = [];
  let lastAck = -99;
  for (const p of ack) {
    if (p.startSec - lastAck >= 10) {
      sparseAck.push(p);
      lastAck = p.startSec;
    }
  }
  return [...respond, ...sparseAck].sort((a, b) => a.startSec - b.startSec);
}

/**
 * @param {object[]} prompts
 * @param {number} [max]
 */
export function capPromptList(prompts, max = Number(process.env.HH_REPLAY_PLAN_MAX_PROMPTS) || 120) {
  const sorted = sparseAckPrompts(prompts);
  if (sorted.length <= max) return sorted;
  const respond = sorted.filter((p) => p.intent === 'respond');
  const ack = sorted.filter((p) => p.intent === 'ack');
  const room = Math.max(0, max - respond.length);
  return [...respond, ...ack.slice(0, room)].sort((a, b) => a.startSec - b.startSec);
}

/**
 * @param {{startSec:number,endSec:number,text:string}[]} segments
 * @param {{ timingConfidence?: string, maxPrompts?: number }} [opts]
 */
export function buildQuestionTimeline(segments, opts = {}) {
  const timingConfidence = opts.timingConfidence || 'medium';
  const turns = segmentsToTurns(segments);
  const prompts = [];
  let n = 0;
  let lastRespondAt = -99;

  for (const turn of turns) {
    if (turn.speaker === 'candidate') continue;
    const clauses = splitTurnToClauses(turn);
    for (const clause of clauses) {
      const intent = classifyIntent(clause.text, timingConfidence);
      if (intent === 'listen') continue;
      if (intent === 'respond' && clause.startSec - lastRespondAt < 4) continue;
      if (intent === 'respond') lastRespondAt = clause.startSec;
      n += 1;
      prompts.push({
        id: `p${String(n).padStart(3, '0')}`,
        startSec: clause.startSec,
        endSec: clause.endSec,
        text: clause.text,
        speaker: 'interviewer',
        intent,
        kind: classifyInterviewQuestion(clause.text) || (intent === 'ack' ? 'small_talk' : 'technical'),
        confidence: intent === 'respond' ? 0.92 : 0.75,
        script: '',
        scriptSource: '',
      });
    }
  }

  return capPromptList(mergeNearbyPrompts(prompts), opts.maxPrompts);
}

/**
 * @param {object[]} prompts
 * @param {number} timeSec
 */
export function findActivePrompt(prompts, timeSec) {
  if (!prompts?.length) return null;
  let active = null;
  for (const p of prompts) {
    if (p.startSec <= timeSec) active = p;
    else break;
  }
  return active;
}

/**
 * @param {object[]} prompts
 * @param {number} timeSec
 */
export function activePromptIndexAt(prompts, timeSec) {
  let idx = -1;
  for (let i = 0; i < prompts.length; i++) {
    if (prompts[i].startSec <= timeSec) idx = i;
    else break;
  }
  return idx;
}
