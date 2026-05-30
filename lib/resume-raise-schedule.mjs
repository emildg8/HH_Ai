/**
 * Расписание авто-подъёма резюме (по умолчанию 8, 12, 16, 20 — Europe/Moscow).
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DATA_DIR } from './paths.mjs';

export const RESUME_RAISE_STATE_FILE = path.join(DATA_DIR, 'resume-raise-state.json');

const CONFIG_CANDIDATES = [
  path.join(ROOT, 'config', 'resume-raise-schedule.json'),
  path.join(ROOT, 'config', 'resume-raise-schedule.example.json'),
];

/** @type {typeof DEFAULT_CONFIG | null} */
let cachedConfig = null;

const DEFAULT_CONFIG = {
  enabled: true,
  timezone: 'Europe/Moscow',
  /** Часы локального времени (0–23) */
  slots: [8, 12, 16, 20],
  /** Запускать в течение N минут после начала слота */
  windowMinutes: 40,
  /** При авто-запуске поднимать все резюме одной кнопкой, если доступно */
  raiseAll: true,
};

function readJson(pathname) {
  try {
    return JSON.parse(fs.readFileSync(pathname, 'utf8'));
  } catch {
    return null;
  }
}

export function loadResumeRaiseScheduleConfig() {
  if (cachedConfig) return cachedConfig;
  let data = null;
  for (const p of CONFIG_CANDIDATES) {
    data = readJson(p);
    if (data) break;
  }
  cachedConfig = { ...DEFAULT_CONFIG, ...(data || {}) };
  if (!Array.isArray(cachedConfig.slots) || !cachedConfig.slots.length) {
    cachedConfig.slots = [...DEFAULT_CONFIG.slots];
  }
  return cachedConfig;
}

export function saveResumeRaiseScheduleConfig(patch) {
  const target = CONFIG_CANDIDATES[0];
  const cur = loadResumeRaiseScheduleConfig();
  const next = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  cachedConfig = next;
  return next;
}

export function loadResumeRaiseState() {
  const raw = readJson(RESUME_RAISE_STATE_FILE);
  if (!raw || typeof raw !== 'object') {
    return { completedSlots: [], runs: [] };
  }
  return {
    completedSlots: Array.isArray(raw.completedSlots) ? raw.completedSlots : [],
    runs: Array.isArray(raw.runs) ? raw.runs : [],
    lastRunAt: raw.lastRunAt || null,
    lastResult: raw.lastResult || null,
  };
}

export function saveResumeRaiseState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RESUME_RAISE_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
export function getZonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
  };
}

/**
 * @param {number} hour
 * @param {string} dateKey
 */
export function slotKey(dateKey, hour) {
  return `${dateKey}-${String(hour).padStart(2, '0')}`;
}

/**
 * @param {Date} [now]
 * @returns {{ run: boolean, slotKey?: string, hour?: number, reason?: string }}
 */
export function shouldRunScheduledRaise(now = new Date()) {
  const cfg = loadResumeRaiseScheduleConfig();
  if (!cfg.enabled) return { run: false, reason: 'disabled' };

  const { dateKey, hour, minute } = getZonedParts(now, cfg.timezone);
  const win = cfg.windowMinutes ?? 40;

  if (!cfg.slots.includes(hour)) {
    return { run: false, reason: 'not-slot-hour', hour, dateKey };
  }
  if (minute >= win) {
    return { run: false, reason: 'past-window', hour, dateKey };
  }

  const key = slotKey(dateKey, hour);
  const state = loadResumeRaiseState();
  if (state.completedSlots.includes(key)) {
    return { run: false, reason: 'already-done', slotKey: key, hour };
  }

  return { run: true, slotKey: key, hour, dateKey };
}

/**
 * @param {string} slotKey
 * @param {object} result
 */
export function markScheduledSlotDone(slotKey, result) {
  const state = loadResumeRaiseState();
  if (!state.completedSlots.includes(slotKey)) state.completedSlots.push(slotKey);
  if (state.completedSlots.length > 60) state.completedSlots = state.completedSlots.slice(-60);
  state.lastRunAt = new Date().toISOString();
  state.lastResult = result;
  state.runs = [
    { slotKey, at: state.lastRunAt, ...result },
    ...(state.runs || []).slice(0, 29),
  ];
  saveResumeRaiseState(state);
}

/**
 * Статус для дашборда.
 * @param {Date} [now]
 */
export function getResumeRaiseScheduleStatus(now = new Date()) {
  const cfg = loadResumeRaiseScheduleConfig();
  const state = loadResumeRaiseState();
  const { dateKey, hour, minute } = getZonedParts(now, cfg.timezone);
  const pending = cfg.slots
    .map((h) => ({ hour: h, key: slotKey(dateKey, h), done: state.completedSlots.includes(slotKey(dateKey, h)) }))
    .filter((s) => !s.done);
  const nextSlot = cfg.slots.find((h) => h > hour) ?? cfg.slots[0];
  const check = shouldRunScheduledRaise(now);
  return {
    enabled: cfg.enabled,
    timezone: cfg.timezone,
    slots: cfg.slots,
    windowMinutes: cfg.windowMinutes,
    raiseAll: cfg.raiseAll,
    nowLocal: { dateKey, hour, minute },
    shouldRunNow: check.run,
    pendingToday: pending,
    lastRunAt: state.lastRunAt,
    lastResult: state.lastResult,
    nextSlotHour: hour < nextSlot ? nextSlot : cfg.slots[0],
  };
}
