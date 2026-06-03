/**
 * Лимит отправок сообщений в чат hh.ru (отдельно от откликов).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';

const FILE = path.join(DATA_DIR, 'chat-send-launches.json');
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MAX_PER_HOUR = 10;

function readState() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.timestamps) ? j : { timestamps: [] };
  } catch {
    return { timestamps: [] };
  }
}

function writeState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function getMaxChatSendPerHour() {
  const n = Number(process.env.HH_CHAT_SEND_MAX_PER_HOUR);
  if (Number.isFinite(n) && n >= 1) return Math.min(30, Math.floor(n));
  return DEFAULT_MAX_PER_HOUR;
}

export function countChatSendLastHour(now = Date.now()) {
  const ts = readState().timestamps.filter((t) => typeof t === 'number' && now - t < HOUR_MS);
  return ts.length;
}

export function recordChatSendLaunch(now = Date.now()) {
  const state = readState();
  const timestamps = state.timestamps.filter((t) => typeof t === 'number' && now - t < HOUR_MS);
  timestamps.push(now);
  writeState({ timestamps });
}

/** @returns {string|null} */
export function checkChatSendRateLimit(now = Date.now()) {
  const max = getMaxChatSendPerHour();
  const n = countChatSendLastHour(now);
  if (n >= max) {
    return `Лимит отправок в чат: ${max} в час (сейчас ${n}). Подождите или отправьте вручную на hh.ru.`;
  }
  return null;
}
