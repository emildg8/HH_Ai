/**
 * Маршрутизация команд Telegram-бота.
 */

import { sendBotMessage, answerCallbackQuery } from './api.mjs';
import { isTelegramUpdateAllowed, authSetupHint } from './auth.mjs';
import {
  formatBatchReportText,
  formatChatInboxText,
  formatFunnelText,
  formatJobStatusText,
  formatLastDigestText,
  formatQueueText,
  formatStatsText,
} from './stats.mjs';
import { launchDailyRoutine, launchHarvest, refreshDigest, stopHarvestJob } from './jobs.mjs';

const HELP_TEXT = `🤖 HH Ai — бот управления

Команды:
/status — задачи (поиск, серия, браузер)
/stats — сводка за сегодня
/queue — очередь по статусам
/chats — inbox чатов hh.ru
/funnel [дней] — воронка откликов
/digest — обновить и показать дайджест
/batch — отчёт последней серии
/routine — утренний цикл
/harvest [дней] — поиск вакансий
/harvest_stop — остановить поиск
/dashboard — ссылка на дашборд
/help — эта справка

Опасные команды требуют подтверждения кнопкой.`;

/**
 * @param {string} text
 * @returns {{ cmd: string, args: string[] }}
 */
export function parseBotCommand(text) {
  const raw = String(text || '').trim();
  if (!raw.startsWith('/')) return { cmd: '', args: [] };
  const first = raw.split(/\s+/)[0];
  const cmd = first.replace(/^\/+/, '').split('@')[0].toLowerCase();
  const args = raw.slice(first.length).trim().split(/\s+/).filter(Boolean);
  return { cmd, args };
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 */
async function executeCommand(cmd, args, cfg) {
  switch (cmd) {
    case 'start':
    case 'help':
      return HELP_TEXT;
    case 'status':
      return formatJobStatusText();
    case 'stats':
      return formatStatsText({ periodDays: 1 });
    case 'queue':
      return formatQueueText();
    case 'chats':
      return formatChatInboxText();
    case 'funnel': {
      const days = Math.min(90, Math.max(1, Number(args[0]) || 7));
      return formatFunnelText(days);
    }
    case 'digest': {
      const saved = await refreshDigest({ periodDays: 1 });
      return saved.text;
    }
    case 'digest_last': {
      return formatLastDigestText() || 'Сохранённый дайджест не найден. Отправьте /digest';
    }
    case 'batch':
      return formatBatchReportText();
    case 'dashboard':
      return `🖥 Дашборд: ${cfg.dashboardUrl}`;
    case 'routine':
      if (!cfg.enableRoutine) return 'Команда /routine отключена в config/telegram-bot.json';
      return { confirm: 'routine', text: 'Запустить утренний цикл (синхронизация откликов и чатов)?' };
    case 'routine_harvest':
      return { confirm: 'routine_harvest', text: 'Запустить утренний цикл с поиском вакансий?' };
    case 'harvest': {
      if (!cfg.enableHarvest) return 'Команда /harvest отключена в config/telegram-bot.json';
      const days = parseHarvestPeriodArg(args[0]);
      return {
        confirm: `harvest:${days}`,
        text: `Запустить поиск вакансий за ${days === 0 ? 'весь период' : `${days} дн.`}?`,
      };
    }
    case 'harvest_stop':
      return stopHarvestJob().message;
    default:
      return 'Неизвестная команда. /help — список команд';
  }
}

function parseHarvestPeriodArg(raw) {
  const n = Number(raw);
  if (raw == null || raw === '') return 7;
  if (!Number.isFinite(n) || n < 0) return 7;
  return Math.min(30, Math.max(0, Math.round(n)));
}

function confirmKeyboard(action) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Да', callback_data: `ok:${action}` },
        { text: 'Отмена', callback_data: 'cancel' },
      ],
    ],
  };
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {object} update
 */
export async function handleTelegramUpdate(cfg, update) {
  const botToken = cfg.botToken;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN не задан');

  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const from = cq.from;
    if (!chatId) return;
    if (!isTelegramUpdateAllowed(cfg, { chat: { id: chatId }, from })) {
      await answerCallbackQuery(botToken, cq.id, authSetupHint(cfg));
      return;
    }
    const data = String(cq.data || '');
    if (data === 'cancel') {
      await answerCallbackQuery(botToken, cq.id, 'Отменено');
      await sendBotMessage(botToken, chatId, 'Отменено.');
      return;
    }
    if (data.startsWith('ok:')) {
      const action = data.slice(3);
      let result;
      if (action === 'routine') result = launchDailyRoutine({ withHarvest: false });
      else if (action === 'routine_harvest') result = launchDailyRoutine({ withHarvest: true });
      else if (action.startsWith('harvest:')) {
        const days = Number(action.split(':')[1]) || 7;
        result = launchHarvest(days);
      } else {
        await answerCallbackQuery(botToken, cq.id, 'Неизвестное действие');
        return;
      }
      await answerCallbackQuery(botToken, cq.id, result.ok ? 'Запущено' : 'Ошибка');
      await sendBotMessage(botToken, chatId, result.ok ? result.message : `❌ ${result.error}`);
      return;
    }
    await answerCallbackQuery(botToken, cq.id);
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const from = msg.from;
  if (!isTelegramUpdateAllowed(cfg, { chat: msg.chat, from })) {
    await sendBotMessage(botToken, chatId, authSetupHint(cfg));
    return;
  }

  const { cmd, args } = parseBotCommand(msg.text);
  if (!cmd) return;

  const result = await executeCommand(cmd, args, cfg);
  if (result && typeof result === 'object' && result.confirm) {
    await sendBotMessage(botToken, chatId, result.text, {
      replyMarkup: confirmKeyboard(result.confirm),
    });
    return;
  }
  await sendBotMessage(botToken, chatId, String(result));
}

/**
 * @param {string} botToken
 * @param {string|number} chatId
 */
export async function sendWelcome(botToken, chatId) {
  await sendBotMessage(botToken, chatId, HELP_TEXT);
}
