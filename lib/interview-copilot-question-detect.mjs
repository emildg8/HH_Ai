/**
 * Детектор вопросов интервьюера в транскрипте.
 */

const QUESTION_STARTERS =
  /^(расскаж|опиш|как вы|как ты|что такое|чем отлича|почему|зачем|какие|какой|какая|можете|расскажите|explain|what is|how do|why|tell me)/i;

const SMALL_TALK_RE =
  /(на ты|на вы|удобно|как дела|как настроение|не волну|рад познакомиться|спасибо что пришл|как доехали|слышно ли|видно ли|можно на ты)/i;

const HR_QUESTION_RE =
  /(расскажите о себе|почему уход|почему вы|мотивац|зарплат|оффер|сильные сторон|слабые сторон|чего хотите|планируете|где видите себя)/i;

/**
 * @param {string} text
 */
export function isSmallTalkQuestion(text) {
  const t = String(text || '').trim();
  return t.length >= 8 && t.length < 140 && SMALL_TALK_RE.test(t);
}

function matchesInterviewQuestion(text) {
  const t = String(text || '').trim();
  if (t.length < 12) return false;
  if (isSmallTalkQuestion(t)) return false;
  if (t.includes('?') && t.length >= 15) return true;
  if (QUESTION_STARTERS.test(t)) return true;
  if (/(опыт|приведите пример|был ли|использовали ли)/i.test(t) && t.length > 25) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {'small_talk'|'hr'|'technical'|null}
 */
export function classifyInterviewQuestion(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 8) return null;
  if (isSmallTalkQuestion(t)) return 'small_talk';
  if (HR_QUESTION_RE.test(t)) return 'hr';
  if (matchesInterviewQuestion(t)) return 'technical';
  return null;
}

/**
 * @param {string} text
 */
export function looksLikeInterviewQuestion(text) {
  return classifyInterviewQuestion(text) !== null;
}

/**
 * Извлечь последний вопрос из буфера речи.
 * @param {string} buffer
 */
export function extractLatestQuestion(buffer) {
  const t = String(buffer || '').trim();
  if (!t) return null;

  const parts = t
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i--) {
    if (looksLikeInterviewQuestion(parts[i])) return parts[i];
  }

  const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (looksLikeInterviewQuestion(lines[i])) return lines[i];
  }

  if (looksLikeInterviewQuestion(t)) return t;
  return null;
}
