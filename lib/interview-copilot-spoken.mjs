/**
 * Память живых ответов кандидата в рамках сессии.
 */

/**
 * @param {object} session
 */
export function getSpokenTurns(session) {
  return session?.spokenTurns || [];
}

/**
 * @param {object} session
 * @param {object} turn
 */
export function appendSpokenTurn(session, turn) {
  if (!session) return;
  if (!session.spokenTurns) session.spokenTurns = [];
  session.spokenTurns.push({
    at: new Date().toISOString(),
    ...turn,
  });
  if (session.spokenTurns.length > 40) session.spokenTurns.shift();
}

/**
 * @param {object} session
 */
export function spokenSnippetForPrompt(session) {
  const turns = getSpokenTurns(session);
  if (!turns.length) return '';
  return turns
    .slice(-6)
    .map((t) => `- Q: ${t.questionText || '—'}\n  A: ${t.spokenText || '—'}`)
    .join('\n');
}

/**
 * @param {object} session
 * @param {{ questionText?: string, suggestedScript?: string, spokenText: string, source?: string }} payload
 */
export function recordSpokenAnswer(session, payload) {
  appendSpokenTurn(session, {
    questionId: `spoken-${Date.now()}`,
    questionText: payload.questionText || session.lastQuestion || '',
    suggestedScript: payload.suggestedScript || session.lastAnswer?.script || '',
    spokenText: String(payload.spokenText || '').trim(),
    source: payload.source || 'manual',
    usedScript: payload.usedScript || 'none',
  });
}
