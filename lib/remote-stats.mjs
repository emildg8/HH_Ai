/**
 * Сбор snapshot статистики для VPS (Telegram webhook без постоянного дашборда).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { buildDailyDigest } from './daily-digest.mjs';
import { computeDashboardStats } from './offers-stats.mjs';
import { countByFilter } from './chat-inbox.mjs';

export const REMOTE_STATS_LOCAL_FILE = path.join(DATA_DIR, 'remote-stats-snapshot.json');

/**
 * @param {{ includeJobStatus?: object }} [opts]
 */
export function buildRemoteStatsPayload(opts = {}) {
  const stats = computeDashboardStats({ periodDays: 1 });
  const digest = buildDailyDigest({ sendTelegram: false, periodDays: 1 });
  return {
    at: new Date().toISOString(),
    version: 1,
    digest_text: digest.text,
    stats,
    chatInbox: countByFilter(),
    jobStatus: opts.includeJobStatus || null,
  };
}

/**
 * @param {object} [opts]
 */
export function writeRemoteStatsSnapshot(opts = {}) {
  const payload = buildRemoteStatsPayload(opts);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REMOTE_STATS_LOCAL_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

/**
 * @returns {{ host: string, user: string, appDir: string, keyPath: string | null }}
 */
export function loadVdsinaSshConfig() {
  const host = String(process.env.VDSINA_HOST || process.env.VDS_SSH_HOST || '').trim();
  const user = String(process.env.VDSINA_SSH_USER || process.env.VDS_SSH_USER || 'root').trim();
  const appDir = String(process.env.VDSINA_APP_DIR || '/opt/hh-ai-webhook').trim();
  const keyPath = String(process.env.VDSINA_SSH_KEY_PATH || process.env.VDS_SSH_KEY_PATH || '').trim() || null;
  return { host, user, appDir, keyPath };
}

/** @returns {{ statsUrl: string, apiToken: string }} */
export function loadRemoteHttpPushConfig() {
  const statsUrl = String(process.env.HH_REMOTE_STATS_URL || process.env.WISPBYTE_STATS_URL || '').trim();
  const apiToken = String(process.env.HH_REMOTE_API_TOKEN || '').trim();
  return { statsUrl, apiToken };
}

export function isRemotePushConfigured() {
  const { statsUrl } = loadRemoteHttpPushConfig();
  if (statsUrl) return true;
  const { host } = loadVdsinaSshConfig();
  return Boolean(host);
}

/** @deprecated use isRemotePushConfigured */
export function isVdsinaPushConfigured() {
  return isRemotePushConfigured();
}
