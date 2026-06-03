/**
 * Сводка готовности системы для дашборда (без секретов).
 */

import fs from 'fs';
import path from 'path';
import { ROOT, CV_DIR, sessionProfilePath } from './paths.mjs';
import { loadTelegramBotConfig, BOT_CONFIG_FILE } from './telegram-bot/config.mjs';
import { playwrightChromiumInstalled } from './playwright-launch.mjs';

function readEnvBlob() {
  const parts = [];
  for (const rel of ['.env', 'config/secrets.local.env']) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) parts.push(fs.readFileSync(p, 'utf8'));
  }
  return parts.join('\n');
}

function hasOpenRouterKey() {
  return /(?:OpenRouter_API_KEY|OPENROUTER_API_KEY)\s*=\s*sk-or-v1-/i.test(readEnvBlob());
}

function hasCustomLlm() {
  const blob = readEnvBlob();
  return (
    /HH_CUSTOM_LLM_BASE_URL\s*=\s*https?:\/\//i.test(blob) || /OLLAMA_BASE_URL\s*=/i.test(blob)
  );
}

function readActiveProfileEnv() {
  const id = String(process.env.HH_PROFILE || 'devops').trim();
  for (const rel of [`config/profiles/${id}.env`, `config/${id}.env`]) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  return '';
}

/** @returns {{ mode: string, label: string, tone: 'good' | 'warn' | 'muted' }} */
export function getLlmStatusSummary() {
  const prof = readActiveProfileEnv();
  const llmMax = Number(
    process.env.HH_LLM_MAX_PER_RUN ?? prof.match(/HH_LLM_MAX_PER_RUN\s*=\s*(\d+)/)?.[1] ?? NaN
  );
  if (hasOpenRouterKey()) {
    return { mode: 'openrouter', label: 'LLM: OpenRouter', tone: 'good' };
  }
  if (hasCustomLlm()) {
    return { mode: 'custom', label: 'LLM: локальный (Ollama / custom)', tone: 'good' };
  }
  if (llmMax === 0) {
    return { mode: 'local-only', label: 'LLM: выкл · локальная оценка', tone: 'muted' };
  }
  return {
    mode: 'missing',
    label: 'LLM: не настроен — см. CONFIG-GUIDE',
    tone: 'warn',
  };
}

/** @returns {{ configured: boolean, label: string, tone: 'good' | 'warn' | 'muted' }} */
export function getTelegramStatusSummary() {
  let fileExists = false;
  try {
    fileExists = fs.existsSync(BOT_CONFIG_FILE);
  } catch {
    /* ignore */
  }
  const cfg = loadTelegramBotConfig();
  const hasToken = Boolean(cfg.botToken);
  const hasChats = cfg.allowedChatIds.length > 0 || cfg.allowedUserIds.length > 0;
  if (hasToken && hasChats) {
    return { configured: true, label: 'Telegram: бот и доступ настроены', tone: 'good' };
  }
  if (hasToken) {
    return {
      configured: false,
      label: 'Telegram: токен есть · укажите chat_id',
      tone: 'warn',
    };
  }
  if (fileExists) {
    return { configured: false, label: 'Telegram: config есть · нужен TELEGRAM_BOT_TOKEN', tone: 'warn' };
  }
  return { configured: false, label: 'Telegram: не настроен (опционально)', tone: 'muted' };
}

/** @returns {{ items: Array<{ id: string, label: string, tone: 'good' | 'warn' | 'muted' }> }} */
export function getSystemSetupStatus() {
  const llm = getLlmStatusSummary();
  const telegram = getTelegramStatusSummary();
  const sessionDir = sessionProfilePath();
  const hasSession = fs.existsSync(sessionDir);
  const chromium = playwrightChromiumInstalled();

  const cvCount = fs.existsSync(CV_DIR)
    ? fs.readdirSync(CV_DIR).filter((n) => /\.(md|txt|pdf)$/i.test(n)).length
    : 0;

  /** @type {Array<{ id: string, label: string, tone: 'good' | 'warn' | 'muted' }>} */
  const items = [
    { id: 'llm', label: llm.label, tone: llm.tone },
    { id: 'telegram', label: telegram.label, tone: telegram.tone },
    {
      id: 'session',
      label: hasSession ? 'Сессия hh.ru: профиль Chromium есть' : 'Сессия: npm run login',
      tone: hasSession ? 'good' : 'warn',
    },
    {
      id: 'chromium',
      label: chromium ? 'Playwright Chromium установлен' : 'Chromium: npx playwright install chromium',
      tone: chromium ? 'good' : 'warn',
    },
    {
      id: 'cv',
      label: cvCount ? `CV/: ${cvCount} файл(ов)` : 'CV/: пусто — для писем LLM желательно',
      tone: cvCount ? 'good' : 'muted',
    },
  ];

  return { llm, telegram, items };
}
