/**
 * Конфиг Telegram-бота управления HH Ai.
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../paths.mjs';

export const BOT_CONFIG_FILE = path.join(ROOT, 'config', 'telegram-bot.json');
export const BOT_OFFSET_FILE = path.join(ROOT, 'data', 'telegram-bot-offset.json');

const DEFAULTS = {
  allowedChatIds: [],
  allowedUserIds: [],
  dashboardUrl: 'http://127.0.0.1:3849',
  pollIntervalMs: 1500,
  enableHarvest: true,
  enableRoutine: true,
  enableBatchControl: false,
};

function parseIdList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^-?\d+$/.test(x));
}

/** @returns {typeof DEFAULTS & { botToken: string, allowedChatIds: (string|number)[], allowedUserIds: (string|number)[] }} */
export function loadTelegramBotConfig() {
  let fileCfg = {};
  try {
    if (fs.existsSync(BOT_CONFIG_FILE)) {
      fileCfg = JSON.parse(fs.readFileSync(BOT_CONFIG_FILE, 'utf8'));
    }
  } catch {
    /* ignore broken json */
  }

  const envChatIds = parseIdList(process.env.TELEGRAM_ALLOWED_CHAT_IDS);
  const envUserIds = parseIdList(process.env.TELEGRAM_ALLOWED_USER_IDS);
  const fallbackChat = process.env.TELEGRAM_CHAT_ID ? [String(process.env.TELEGRAM_CHAT_ID).trim()] : [];

  const allowedChatIds = [
    ...new Set(
      [...(fileCfg.allowedChatIds || []), ...envChatIds, ...fallbackChat].map(String).filter(Boolean)
    ),
  ];
  const allowedUserIds = [
    ...new Set([...(fileCfg.allowedUserIds || []), ...envUserIds].map(String).filter(Boolean)),
  ];

  return {
    ...DEFAULTS,
    ...fileCfg,
    botToken: String(process.env.TELEGRAM_BOT_TOKEN || fileCfg.botToken || '').trim(),
    allowedChatIds,
    allowedUserIds,
    dashboardUrl: String(
      process.env.HH_DASHBOARD_URL || fileCfg.dashboardUrl || DEFAULTS.dashboardUrl
    ).trim(),
    pollIntervalMs: Number(fileCfg.pollIntervalMs || process.env.TELEGRAM_BOT_POLL_MS || 1500) || 1500,
    enableHarvest: fileCfg.enableHarvest !== false,
    enableRoutine: fileCfg.enableRoutine !== false,
    enableBatchControl: fileCfg.enableBatchControl === true,
  };
}

export function readBotOffset() {
  try {
    const n = Number(JSON.parse(fs.readFileSync(BOT_OFFSET_FILE, 'utf8')).offset);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** @param {number} offset */
export function writeBotOffset(offset) {
  fs.mkdirSync(path.dirname(BOT_OFFSET_FILE), { recursive: true });
  fs.writeFileSync(BOT_OFFSET_FILE, `${JSON.stringify({ offset, at: new Date().toISOString() })}\n`, 'utf8');
}
