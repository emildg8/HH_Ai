/**
 * Мост dashboard ↔ overlay: состояние по каналам (live / prep / replay).
 */

/** @type {Record<string, object|null>} */
const statesByChannel = {
  live: null,
  prep: null,
  replay: null,
};

/** @deprecated совместимость */
let legacyState = null;

/**
 * @param {object} state
 * @param {'live'|'prep'|'replay'} [channel]
 */
export function pushPromptState(state, channel = 'live') {
  const ch = channel || state.channel || 'live';
  const next = {
    ...state,
    channel: ch,
    at: new Date().toISOString(),
    revision: Date.now(),
  };
  statesByChannel[ch] = next;
  if (ch === 'live') legacyState = next;
  return next;
}

/**
 * @param {'live'|'prep'|'replay'} [channel]
 */
export function getPromptState(channel = 'live') {
  if (channel && statesByChannel[channel]) return statesByChannel[channel];
  return statesByChannel.live ?? legacyState;
}

/**
 * @param {'live'|'prep'|'replay'|'all'} [channel]
 */
export function clearPromptState(channel = 'live') {
  if (channel === 'all') {
    for (const k of Object.keys(statesByChannel)) statesByChannel[k] = null;
    legacyState = null;
    return;
  }
  statesByChannel[channel] = null;
  if (channel === 'live') legacyState = null;
}

export function pushPrepPromptState(state) {
  return pushPromptState(state, 'prep');
}

export function getPrepPromptState() {
  return getPromptState('prep');
}
