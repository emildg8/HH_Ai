/**
 * Меню, клавиатуры и оформление Telegram-бота HH Ai.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../paths.mjs';
import { BRAND, PLACEHOLDER } from './copy.mjs';
import { getDashboardBatchSizeCap } from '../dashboard-preferences.mjs';
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
  'Управляйте HH Ai с телефона: поиск вакансий, серия автооткликов, inbox чатов hh.ru с ответами, статистика и дайджест. Дашборд на вашем ПК.';

/** @type {{ command: string, description: string }[]} */
export const BOT_COMMANDS = [
  { command: 'start', description: '🏠 Главный экран' },
  { command: 'status', description: '📊 Задачи и браузер' },
  { command: 'stats', description: '📈 Сводка за сегодня' },
  { command: 'queue', description: '📋 Очередь вакансий' },
  { command: 'chats', description: '💬 Inbox чатов' },
  { command: 'funnel', description: '📉 Воронка откликов' },
  { command: 'digest', description: '📰 Дайджест' },
  { command: 'harvest', description: '🔍 Поиск вакансий' },
  { command: 'apply', description: '🚀 Серия откликов' },
  { command: 'batch', description: '📦 Последняя серия' },
  { command: 'sync_chats', description: '🔄 Синхр. чаты' },
  { command: 'routine', description: '🌅 Утренний цикл' },
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
  if (cfg.enableBatchControl !== false) {
    rows.push([
      { text: '🚀 Серия откликов', callback_data: 'cmd:apply' },
      { text: '📦 Отчёт серии', callback_data: 'cmd:batch' },
    ]);
    rows.push([
      { text: '⏸ Пауза серии', callback_data: 'cmd:apply_pause' },
      { text: '▶️ Продолжить', callback_data: 'cmd:apply_resume' },
      { text: '⏹ Стоп', callback_data: 'cmd:apply_stop' },
    ]);
  }
  rows.push([{ text: '🔄 Синхр. чаты', callback_data: 'cmd:sync_chats' }]);
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

/** @param {{ scope?: string, minScore?: number, limit?: number }} draft */
export function applyWizardKeyboard(draft) {
  const scope = String(draft.scope || 'noQuestionnaire');
  const minScore = draft.minScore != null ? Number(draft.minScore) : 50;
  const cap = getDashboardBatchSizeCap();
  const limit = Math.min(cap, Math.max(1, Number(draft.limit) || cap));

  const scopeBtn = (code, label, value) => ({
    text: scope === value ? `• ${label}` : label,
    callback_data: `ba:s:${code}`,
  });

  const scoreBtn = (val, label) => ({
    text: (val === 0 ? minScore === 0 : minScore === val) ? `• ${label}` : label,
    callback_data: val === 0 ? 'ba:m:any' : `ba:m:${val}`,
  });

  const limitBtn = (val, label) => ({
    text: limit === val ? `• ${label}` : label,
    callback_data: val >= cap ? 'ba:l:max' : `ba:l:${val}`,
  });

  return {
    inline_keyboard: [
      [
        scopeBtn('nQ', 'Без анкет', 'noQuestionnaire'),
        scopeBtn('qu', 'Анкета', 'questionnaire'),
      ],
      [
        scopeBtn('q', 'Очередь', 'queue'),
        scopeBtn('hi', 'Скрытые', 'hidden'),
      ],
      [
        scoreBtn(0, 'Любой'),
        scoreBtn(50, '≥50'),
        scoreBtn(60, '≥60'),
        scoreBtn(70, '≥70'),
      ],
      [
        limitBtn(5, '5'),
        limitBtn(10, '10'),
        limitBtn(Math.min(15, cap), '15'),
        limitBtn(cap, 'Макс.'),
      ],
      [
        { text: '✅ Запустить', callback_data: 'ba:confirm' },
        { text: '✖️', callback_data: 'cancel' },
      ],
      [{ text: '🏠 Главная', callback_data: 'nav:home' }],
    ],
  };
}

/** @param {'needs_reply' | 'all'} filter @param {{ needs_reply: number, all: number }} counts */
export function chatInboxKeyboard(filter, counts) {
  return {
    inline_keyboard: [
      [
        { text: `❗ Нужен ответ (${counts.needs_reply || 0})`, callback_data: 'cf:needs_reply' },
        { text: `📋 Все (${counts.all || 0})`, callback_data: 'cf:all' },
      ],
      [{ text: '🔄 Синхронизировать чаты', callback_data: 'cs:sync' }],
      [{ text: '🏠 Главная', callback_data: 'nav:home' }],
    ],
  };
}

/** @param {number} page @param {number} totalPages @param {number} itemCount */
export function chatListKeyboard(page, totalPages, itemCount) {
  const rows = [];
  if (itemCount > 0) {
    const numRow = [];
    for (let i = 0; i < itemCount; i++) {
      numRow.push({ text: String(i + 1), callback_data: `ct:${i}` });
    }
    rows.push(numRow);
  }
  const nav = [];
  if (page > 0) nav.push({ text: '◀️', callback_data: `cp:${page - 1}` });
  nav.push({ text: `${page + 1}/${totalPages}`, callback_data: 'cb:inbox' });
  if (page < totalPages - 1) nav.push({ text: '▶️', callback_data: `cp:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: '🔄 Синхр.', callback_data: 'cs:sync' }, { text: '🏠', callback_data: 'nav:home' }]);
  return { inline_keyboard: rows };
}

/** @param {number} index @param {boolean} hasDraft */
export function chatThreadKeyboard(index, hasDraft) {
  const rows = [
    [{ text: '✍️ Черновик LLM', callback_data: `cd:${index}` }],
  ];
  if (hasDraft) {
    rows.push([{ text: '📤 Отправить черновик', callback_data: `cx:${index}` }]);
  }
  rows.push(
    [{ text: '✏️ Свой текст', callback_data: `cw:${index}` }],
    [{ text: '◀️ К списку', callback_data: `cl:${index}` }]
  );
  return { inline_keyboard: rows };
}

/** @param {number} index */
export function confirmSendKeyboard(index) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Отправить', callback_data: `cx:${index}` },
        { text: '✖️ Отмена', callback_data: `cl:${index}` },
      ],
    ],
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
