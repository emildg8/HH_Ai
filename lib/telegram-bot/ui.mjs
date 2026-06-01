/**
 * Меню, клавиатуры и оформление Telegram-бота HH Ai.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../paths.mjs';
import { BRAND, PLACEHOLDER } from './copy.mjs';
import {
  setBotCommands,
  setBotDescription,
  setBotMenuButton,
  setBotName,
  setBotProfilePhoto,
  setBotShortDescription,
} from './api.mjs';

export const BOT_DISPLAY_NAME = BRAND.name;
export const BOT_SHORT_DESCRIPTION = 'Пульт HH Ai: очередь, чаты, поиск и дайджест hh.ru';
export const BOT_DESCRIPTION =
  'Управляйте HH Ai с телефона: статус задач, очередь вакансий, inbox чатов hh.ru, воронка, дайджест и запуск поиска. Дашборд работает на вашем ПК.';

/** @type {{ command: string, description: string }[]} */
export const BOT_COMMANDS = [
  { command: 'start', description: '🏠 Главный экран' },
  { command: 'status', description: '📊 Задачи и браузер' },
  { command: 'stats', description: '📈 Сводка за сегодня' },
  { command: 'queue', description: '📋 Очередь вакансий' },
  { command: 'chats', description: '💬 Inbox чатов' },
  { command: 'funnel', description: '📉 Воронка откликов' },
  { command: 'digest', description: '📰 Дайджест' },
  { command: 'batch', description: '📦 Последняя серия' },
  { command: 'routine', description: '🌅 Утренний цикл' },
  { command: 'harvest', description: '🔍 Поиск вакансий' },
  { command: 'harvest_stop', description: '⏹ Стоп поиска' },
  { command: 'dashboard', description: '🖥 Дашборд' },
  { command: 'help', description: '❓ Справка' },
];

/** Текст кнопок нижнего меню → команда или nav */
export const REPLY_BUTTONS = {
  '🏠 Главная': 'home',
  '📊 Статус': 'status',
  '📋 Очередь': 'queue',
  '💬 Чаты': 'chats',
  '📈 Сводка': 'stats',
  '📰 Дайджест': 'digest',
  '▶️ Действия': 'nav:actions',
  '❓ Справка': 'help',
};

/** @returns {import('./api.mjs').ReplyKeyboardMarkup} */
export function mainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '🏠 Главная' }, { text: '📊 Статус' }],
      [{ text: '📋 Очередь' }, { text: '💬 Чаты' }],
      [{ text: '📈 Сводка' }, { text: '📰 Дайджест' }],
      [{ text: '▶️ Действия' }, { text: '❓ Справка' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: PLACEHOLDER,
  };
}

/** @returns {import('./api.mjs').InlineKeyboardMarkup} */
export function homeInlineKeyboard(cfg = {}) {
  return { inline_keyboard: buildQuickRows(cfg) };
}

/** @returns {import('./api.mjs').InlineKeyboardMarkup} */
export function actionsInlineKeyboard(cfg = {}) {
  const rows = [];
  if (cfg.enableRoutine !== false) {
    rows.push([{ text: '🌅 Утренний цикл', callback_data: 'cmd:routine' }]);
  }
  if (cfg.enableHarvest !== false) {
    rows.push([
      { text: '🔍 3 дня', callback_data: 'cmd:harvest:3' },
      { text: '🔍 7 дней', callback_data: 'cmd:harvest:7' },
      { text: '🔍 14 дней', callback_data: 'cmd:harvest:14' },
    ]);
    rows.push([{ text: '⏹ Остановить поиск', callback_data: 'cmd:harvest_stop' }]);
  }
  rows.push([{ text: '📦 Отчёт серии', callback_data: 'cmd:batch' }]);
  rows.push([{ text: '🏠 На главную', callback_data: 'nav:home' }]);
  return { inline_keyboard: rows };
}

/** @param {object} cfg */
function buildQuickRows(cfg) {
  const rows = [
    [
      { text: '📊 Статус', callback_data: 'cmd:status' },
      { text: '📋 Очередь', callback_data: 'cmd:queue' },
    ],
    [
      { text: '💬 Чаты', callback_data: 'cmd:chats' },
      { text: '📉 Воронка', callback_data: 'cmd:funnel:7' },
    ],
    [
      { text: '📰 Дайджест', callback_data: 'cmd:digest' },
      { text: '🖥 Дашборд', callback_data: 'cmd:dashboard' },
    ],
  ];
  if (cfg.enableHarvest !== false || cfg.enableRoutine !== false) {
    rows.push([{ text: '▶️ Запуск задач', callback_data: 'nav:actions' }]);
  }
  return rows;
}

/** @returns {import('./api.mjs').InlineKeyboardMarkup} */
export function confirmKeyboard(action) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Запустить', callback_data: `ok:${action}` },
        { text: '✖️ Отмена', callback_data: 'cancel' },
      ],
      [{ text: '🏠 Главная', callback_data: 'nav:home' }],
    ],
  };
}

/** @returns {import('./api.mjs').InlineKeyboardMarkup} */
export function backHomeKeyboard() {
  return {
    inline_keyboard: [[{ text: '🏠 Главная', callback_data: 'nav:home' }]],
  };
}

/**
 * @param {string} text
 * @returns {{ cmd: string, args: string[], nav?: string } | null}
 */
export function parseReplyButton(text) {
  const raw = String(text || '').trim();
  const mapped = REPLY_BUTTONS[raw];
  if (!mapped) return null;
  if (mapped.startsWith('nav:')) return { cmd: '', args: [], nav: mapped.slice(4) };
  if (mapped === 'home') return { cmd: 'start', args: [] };
  return { cmd: mapped, args: [] };
}

/**
 * @param {string} data
 * @returns {{ cmd: string, args: string[], nav?: string } | null}
 */
export function parseInlineCommand(data) {
  const raw = String(data || '');
  if (raw.startsWith('nav:')) return { cmd: '', args: [], nav: raw.slice(4) };
  if (!raw.startsWith('cmd:')) return null;
  const parts = raw.slice(4).split(':');
  const cmd = parts[0];
  if (!cmd) return null;
  return { cmd, args: parts.slice(1) };
}

function ensureAvatarJpeg() {
  const jpg = path.join(ROOT, 'assets', 'telegram-bot-avatar.jpg');
  if (fs.existsSync(jpg)) return jpg;
  const ps1 = path.join(ROOT, 'scripts', 'make-telegram-avatar.ps1');
  if (process.platform === 'win32' && fs.existsSync(ps1)) {
    try {
      execFileSync(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1],
        { stdio: 'ignore' }
      );
    } catch {
      /* fallback to png */
    }
  }
  return fs.existsSync(jpg) ? jpg : null;
}

function resolveAvatarPath() {
  return ensureAvatarJpeg() || resolveAvatarFallback();
}

function resolveAvatarFallback() {
  const candidates = [
    path.join(ROOT, 'assets', 'telegram-bot-avatar.jpg'),
    path.join(ROOT, 'assets', 'telegram-bot-avatar.png'),
    path.join(ROOT, 'desktop', 'hh-ai-desktop', 'src-tauri', 'icons', '128x128.png'),
    path.join(ROOT, 'desktop', 'hh-ai-desktop', 'app-icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * @param {string} botToken
 * @param {{ skipPhoto?: boolean }} [opts]
 */
export async function setupBotUi(botToken, opts = {}) {
  const results = [];
  try {
    await setBotName(botToken, BOT_DISPLAY_NAME);
    results.push('name');
  } catch (e) {
    results.push(`name: ${e.message || e}`);
  }
  try {
    await setBotShortDescription(botToken, BOT_SHORT_DESCRIPTION);
    results.push('short_description');
  } catch (e) {
    results.push(`short_description: ${e.message || e}`);
  }
  try {
    await setBotDescription(botToken, BOT_DESCRIPTION);
    results.push('description');
  } catch (e) {
    results.push(`description: ${e.message || e}`);
  }
  try {
    await setBotCommands(botToken, BOT_COMMANDS);
    results.push('commands');
  } catch (e) {
    results.push(`commands: ${e.message || e}`);
  }
  try {
    await setBotMenuButton(botToken, { type: 'commands' });
    results.push('menu_button');
  } catch (e) {
    results.push(`menu_button: ${e.message || e}`);
  }
  if (!opts.skipPhoto) {
    const avatar = resolveAvatarPath();
    if (avatar) {
      try {
        await setBotProfilePhoto(botToken, avatar);
        results.push('avatar');
      } catch (e) {
        results.push(`avatar: ${e.message || e} (или @BotFather → /setuserpic)`);
      }
    } else {
      results.push('avatar: файл не найден');
    }
  }
  return results;
}
