/**
 * Отложить вакансию до даты (не попадает в батч и основные вкладки).
 */

import { updateVacancyRecord, getVacancyRecord } from './store.mjs';

/**
 * @param {object} rec
 * @param {number} [nowMs]
 */
export function isVacancyDeferred(rec, nowMs = Date.now()) {
  const until = Date.parse(String(rec?.deferUntil || ''));
  return Number.isFinite(until) && until > nowMs;
}

/** @param {object} rec */
export function deferUntilLabel(rec) {
  const until = Date.parse(String(rec?.deferUntil || ''));
  if (!Number.isFinite(until)) return '';
  return new Date(until).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @param {string} recordId
 * @param {string|Date} untilIso
 */
export function setVacancyDeferUntil(recordId, untilIso) {
  const until = new Date(untilIso);
  if (!Number.isFinite(until.getTime())) {
    throw new Error('Некорректная дата deferUntil');
  }
  return updateVacancyRecord(recordId, { deferUntil: until.toISOString() });
}

/**
 * @param {string} recordId
 * @param {number} days
 */
export function deferVacancyForDays(recordId, days = 1) {
  const d = Math.max(1, Math.min(90, Number(days) || 1));
  const until = new Date();
  until.setDate(until.getDate() + d);
  until.setHours(9, 0, 0, 0);
  return setVacancyDeferUntil(recordId, until);
}

/** @param {string} recordId */
export function clearVacancyDefer(recordId) {
  return updateVacancyRecord(recordId, { deferUntil: null });
}

/** @param {string} recordId */
export function getVacancyDeferState(recordId) {
  const rec = getVacancyRecord(recordId);
  if (!rec) return { deferred: false };
  const deferred = isVacancyDeferred(rec);
  return {
    deferred,
    deferUntil: rec.deferUntil || null,
    label: deferred ? deferUntilLabel(rec) : '',
  };
}
