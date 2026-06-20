/**
 * Склейка воронки: hooks + emit в conversion-events.jsonl (no-op под kill switch).
 */

import { emitObsEvent } from './observability.mjs';
import { isConversionGlueEnabled } from './apply-intelligence-prefs.mjs';

/** Фазы glue (порядок фиксирован; полный список — docs/CONVERSION-GLUE.md). */
export const GLUE_PHASES = [
  'vacancy.ingested',
  'gate.preview',
  'gate.decided',
  'letter.prepared',
  'resume.tailored',
  'apply.started',
  'apply.finished',
  'negotiation.synced',
  'outcome.classified',
  'knowledge.written',
  'invite.detected',
  'prep.triggered',
  'interview.debrief',
  'pattern.learned',
  'contact.extracted',
  'contact.linked',
  'hitl.queued',
  'hitl.resolved',
];

/** @type {Map<string, Array<(ctx: object) => void | Promise<void>>>} */
const hooksByPhase = new Map();

export { isConversionGlueEnabled };

/**
 * @param {string} phase
 * @param {(ctx: object) => void | Promise<void>} fn
 */
export function registerConversionHook(phase, fn) {
  const key = String(phase);
  if (!hooksByPhase.has(key)) hooksByPhase.set(key, []);
  hooksByPhase.get(key).push(fn);
}

/** Сброс hooks (тесты). */
export function clearConversionHooks() {
  hooksByPhase.clear();
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @param {object} [opts]
 */
export function emitConversionEvent(type, payload = {}, opts = {}) {
  if (!isConversionGlueEnabled()) {
    return { skipped: true, reason: 'glue_disabled' };
  }
  return emitObsEvent(type, payload, { ...opts, route: 'conversion' });
}

/**
 * @param {string} phase
 * @param {object} [ctx]
 */
export async function runConversionHooks(phase, ctx = {}) {
  if (!isConversionGlueEnabled()) {
    return { skipped: true, ran: 0 };
  }
  const fns = hooksByPhase.get(String(phase)) || [];
  let ran = 0;
  for (const fn of fns) {
    try {
      await fn(ctx);
      ran++;
    } catch (e) {
      emitConversionEvent('glue.hook.error', {
        phase: String(phase),
        error: String(e?.message || e),
      });
    }
  }
  return { ran };
}
