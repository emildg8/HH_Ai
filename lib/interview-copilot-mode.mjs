/**
 * Режим copilot: live | replay | simulate — защита от гонки overlay.
 */

/** @type {'live'|'replay'|'simulate'|null} */
let activeMode = null;

/** @type {string|null} */
let activeSessionId = null;

export function setCopilotMode(mode, sessionId = null) {
  activeMode = mode || null;
  activeSessionId = sessionId || null;
}

export function getCopilotMode() {
  return { mode: activeMode, sessionId: activeSessionId };
}

export function clearCopilotMode(sessionId) {
  if (!sessionId || activeSessionId === sessionId) {
    activeMode = null;
    activeSessionId = null;
  }
}

/**
 * @param {'live'|'replay'|'prep'} channel
 */
export function canPushPromptChannel(channel) {
  if (!activeMode) return true;
  if (activeMode === 'live') return channel === 'live';
  if (activeMode === 'replay') return channel === 'live' || channel === 'replay';
  if (activeMode === 'simulate') return channel === 'live';
  return true;
}
