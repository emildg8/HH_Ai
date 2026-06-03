/**
 * Планировщик follow-up по чатам (напоминания, sync).
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DATA_DIR } from './paths.mjs';
import { getZonedParts, slotKey } from './resume-raise-schedule.mjs';

export const CHAT_FOLLOW_UP_STATE_FILE = path.join(DATA_DIR, 'chat-follow-up-state.json');

const CONFIG_CANDIDATES = [
  path.join(ROOT, 'config', 'chat-follow-up-schedule.json'),
  path.join(ROOT, 'config', 'chat-follow-up-schedule.example.json'),
];

/** @type {object | null} */
let cachedConfig = null;

const DEFAULT_CONFIG = {
  enabled: true,
  timezone: 'Europe/Moscow',
  slots: [10, 18],
  windowMinutes: 45,
  inviteNudgeAfterDays: 2,
  autoSyncChats: true,
  autoDraftNudges: true,
  telegramNotify: true,
};

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function loadChatFollowUpScheduleConfig() {
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

export function saveChatFollowUpScheduleConfig(patch) {
  const target = CONFIG_CANDIDATES[0];
  const cur = loadChatFollowUpScheduleConfig();
  const next = { ...cur, ...patch };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  cachedConfig = next;
  return next;
}

export function loadChatFollowUpState() {
  const raw = readJson(CHAT_FOLLOW_UP_STATE_FILE);
  if (!raw || typeof raw !== 'object') {
    return { completedSlots: [], runs: [], lastRunAt: null };
  }
  return {
    completedSlots: Array.isArray(raw.completedSlots) ? raw.completedSlots : [],
    runs: Array.isArray(raw.runs) ? raw.runs : [],
    lastRunAt: raw.lastRunAt || null,
    lastResult: raw.lastResult || null,
    lastTelegramSlot: raw.lastTelegramSlot || null,
    lastTelegramAt: raw.lastTelegramAt || null,
  };
}

export function saveChatFollowUpState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CHAT_FOLLOW_UP_STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * @param {Date} [now]
 * @returns {{ run: boolean, slotKey?: string, reason?: string }}
 */
export function shouldRunChatFollowUpSchedule(now = new Date()) {
  const cfg = loadChatFollowUpScheduleConfig();
  if (!cfg.enabled) return { run: false, reason: 'disabled' };

  const { dateKey, hour, minute } = getZonedParts(now, cfg.timezone);
  const win = cfg.windowMinutes ?? 45;
  if (!cfg.slots.includes(hour)) return { run: false, reason: 'not-slot-hour' };
  if (minute >= win) return { run: false, reason: 'past-window' };

  const key = slotKey(dateKey, hour);
  const state = loadChatFollowUpState();
  if (state.completedSlots.includes(key)) {
    return { run: false, reason: 'already-done', slotKey: key };
  }
  return { run: true, slotKey: key, hour };
}

/**
 * @param {string} slotKey
 * @param {object} result
 */
export function markChatFollowUpSlotDone(slotKey, result = {}) {
  const state = loadChatFollowUpState();
  if (!state.completedSlots.includes(slotKey)) state.completedSlots.push(slotKey);
  if (state.completedSlots.length > 60) state.completedSlots = state.completedSlots.slice(-60);
  state.lastRunAt = new Date().toISOString();
  state.lastResult = result;
  state.runs = [{ slotKey, at: state.lastRunAt, ...result }, ...(state.runs || []).slice(0, 29)];
  saveChatFollowUpState(state);
}

/**
 * @param {Date} [now]
 */
export function getChatFollowUpScheduleStatus(now = new Date()) {
  const cfg = loadChatFollowUpScheduleConfig();
  const state = loadChatFollowUpState();
  const { dateKey, hour, minute } = getZonedParts(now, cfg.timezone);
  const pending = cfg.slots
    .map((h) => ({ hour: h, key: slotKey(dateKey, h), done: state.completedSlots.includes(slotKey(dateKey, h)) }))
    .filter((s) => !s.done);
  const check = shouldRunChatFollowUpSchedule(now);
  return {
    enabled: cfg.enabled,
    timezone: cfg.timezone,
    slots: cfg.slots,
    windowMinutes: cfg.windowMinutes,
    inviteNudgeAfterDays: cfg.inviteNudgeAfterDays,
    autoSyncChats: cfg.autoSyncChats,
    autoDraftNudges: cfg.autoDraftNudges,
    telegramNotify: cfg.telegramNotify,
    nowLocal: { dateKey, hour, minute },
    shouldRunNow: check.run,
    pendingToday: pending,
    lastRunAt: state.lastRunAt,
    lastResult: state.lastResult,
  };
}
