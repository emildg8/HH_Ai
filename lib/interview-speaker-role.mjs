/**
 * Классификация роли спикера: interviewer | candidate | unknown.
 */

const CANDIDATE_START_RE =
  /^(да|нет|конечно|спасибо|хорошо|отлично|взаимно|понятно|окей|ok|у меня|я работал|я сдавал|мы в банке|мы использовали|я использовал)/i;

const INTERVIEWER_START_RE =
  /^(у нас|мы видим|давай|расскажите|расскажи|вы рекомендован|представьтесь|хотел бы|можете|скажите)/i;

/**
 * @param {string} text
 * @param {{ prevRole?: string, prevHadQuestion?: boolean, durationSec?: number }} [context]
 * @returns {'interviewer'|'candidate'|'unknown'}
 */
export function classifySegmentRole(text, context = {}) {
  const t = String(text || '').trim();
  if (!t) return 'unknown';

  const dur = context.durationSec ?? estimateDurationSec(t);
  const short = t.length < 90 && dur < 5.5;
  const prev = context.prevRole || 'interviewer';
  const afterQ = Boolean(context.prevHadQuestion);

  if (short && CANDIDATE_START_RE.test(t)) return 'candidate';
  if (short && afterQ && prev === 'interviewer' && t.length < 55) return 'candidate';
  if (INTERVIEWER_START_RE.test(t) || /\?\s*$/.test(t)) return 'interviewer';

  if (t.length > 120 && /(у меня|я работал|мы внедрили|я настраивал|сдавал экзамен|в моей практике)/i.test(t)) {
    return 'candidate';
  }

  if (prev === 'candidate' && short) return 'candidate';
  if (prev === 'interviewer' && t.length > 40 && !CANDIDATE_START_RE.test(t)) return 'interviewer';

  return prev === 'candidate' ? 'candidate' : 'interviewer';
}

function estimateDurationSec(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return words / 2.8;
}

/**
 * @param {{startSec:number,endSec:number,text:string}[]} segments
 */
export function classifySegmentRoles(segments) {
  const out = [];
  let prevRole = 'interviewer';
  let prevHadQuestion = false;
  for (const seg of segments) {
    const text = String(seg.text || '').trim();
    const dur = (seg.endSec ?? seg.startSec + 3) - seg.startSec;
    const role = classifySegmentRole(text, {
      prevRole,
      prevHadQuestion,
      durationSec: dur,
    });
    out.push({ ...seg, role });
    prevHadQuestion = /\?/.test(text);
    prevRole = role;
  }
  return out;
}
