import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';

const FILE = path.join(DATA_DIR, 'hh-apply-launches.json');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
/** Верхняя граница для hhApplyChatMaxPerDay в config/preferences.json */
const MAX_APPLY_PER_DAY_CAP = 1000;
const MAX_APPLY_PER_MONTH_CAP = 10000;

function readState() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const j = JSON.parse(raw);
    return Array.isArray(j.timestamps) ? j : { timestamps: [] };
  } catch {
    return { timestamps: [] };
  }
}

function pruneHour(now, timestamps) {
  return timestamps.filter((t) => typeof t === 'number' && now - t < HOUR_MS);
}

function pruneDay(now, timestamps) {
  return timestamps.filter((t) => typeof t === 'number' && now - t < DAY_MS);
}

function pruneMonth(now, timestamps) {
  return timestamps.filter((t) => typeof t === 'number' && now - t < MONTH_MS);
}

export function getMaxApplyChatPerHour() {
  try {
    const p = loadPreferences();
    const n = Number(p.hhApplyChatMaxPerHour);
    if (Number.isFinite(n) && n >= 1) return Math.min(100, Math.floor(n));
  } catch {
    /* ignore */
  }
  return 8;
}

export function getMaxApplyChatPerDay() {
  try {
    const p = loadPreferences();
    const n = Number(p.hhApplyChatMaxPerDay);
    if (Number.isFinite(n) && n >= 1) return Math.min(MAX_APPLY_PER_DAY_CAP, Math.floor(n));
  } catch {
    /* ignore */
  }
  return getMaxApplyChatPerHour();
}

export function getMaxApplyChatPerMonth() {
  try {
    const p = loadPreferences();
    const n = Number(p.hhApplyChatMaxPerMonth);
    if (Number.isFinite(n) && n >= 1) return Math.min(MAX_APPLY_PER_MONTH_CAP, Math.floor(n));
  } catch {
    /* ignore */
  }
  return Math.max(getMaxApplyChatPerDay(), 500);
}

export function countApplyLaunchesLastMonth() {
  const now = Date.now();
  const { timestamps } = readState();
  return pruneMonth(now, timestamps).length;
}

export function countApplyLaunchesLastHour() {
  const now = Date.now();
  const { timestamps } = readState();
  return pruneHour(now, timestamps).length;
}

export function countApplyLaunchesLastDay() {
  const now = Date.now();
  const { timestamps } = readState();
  return pruneDay(now, timestamps).length;
}

export function recordApplyLaunch() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const now = Date.now();
  const { timestamps } = readState();
  const next = [...pruneDay(now, timestamps), now];
  fs.writeFileSync(FILE, JSON.stringify({ timestamps: next }, null, 0), 'utf8');
}

export function applyRateLimitsSnapshot() {
  return {
    lastHour: countApplyLaunchesLastHour(),
    lastDay: countApplyLaunchesLastDay(),
    lastMonth: countApplyLaunchesLastMonth(),
    maxPerHour: getMaxApplyChatPerHour(),
    maxPerDay: getMaxApplyChatPerDay(),
    maxPerMonth: getMaxApplyChatPerMonth(),
  };
}
