/**
 * Логика кликабельности и типов блока «Прогресс задачи».
 */

import { COPY } from './dashboard-ux.mjs';

export const JOB_PROGRESS_LOG_PHASES = new Set([
  'running',
  'paused',
  'done',
  'error',
  'starting',
  'collecting',
  'scoring',
]);

/** @param {{ title?: string } | null | undefined} p */
export function jobProgressKind(p) {
  if (!p?.title) return null;
  if (p.title === COPY.batch || p.title === COPY.batchShort) return 'batch';
  if (p.title === COPY.harvest) return 'harvest';
  if (p.title === 'Отклик в браузере') return 'apply';
  return null;
}

/**
 * @param {{ title?: string, phase?: string } | null | undefined} p
 * @param {Record<string, unknown> | null | undefined} st
 */
export function isJobProgressClickable(p, st) {
  const kind = jobProgressKind(p);
  if (!kind || !JOB_PROGRESS_LOG_PHASES.has(String(p.phase || ''))) return false;
  if (kind === 'batch') {
    const batchActive = Boolean(st?.batchActive ?? st?.batch?.running ?? st?.batchControl?.batchRunning);
    const canResume = Boolean(st?.batchControl?.canResume);
    return batchActive || canResume || ['done', 'error', 'paused', 'running'].includes(String(p.phase));
  }
  return true;
}

/** @param {{ title?: string } | null | undefined} p */
export function logSourceForJobProgress(p) {
  return jobProgressKind(p) === 'harvest' ? 'harvest' : 'apply';
}
