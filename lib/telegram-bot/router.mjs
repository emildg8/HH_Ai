/**
 * Маршрутизация команд Telegram-бота.
 */

import { sendBotMessage, answerCallbackQuery } from './api.mjs';
import { isTelegramUpdateAllowed, authSetupHint } from './auth.mjs';
import {
  actionResultText,
  cancelledText,
  confirmText,
  digestLoadingText,
  helpTextHtml,
  unknownCommandText,
  welcomeHint,
} from './copy.mjs';
import {
  actionsInlineKeyboard,
  backHomeKeyboard,
  confirmKeyboard,
  homeInlineKeyboard,
  mainReplyKeyboard,
  parseInlineCommand,
  parseReplyButton,
} from './ui.mjs';
import {
  formatBatchReportText,
  formatFunnelText,
  formatHomeDashboard,
  formatJobStatusText,
  formatLastDigestText,
  formatQueueText,
  formatStatsText,
} from './stats.mjs';
import {
  launchDailyRoutine,
  launchHarvest,
  controlApplyBatch,
  launchSyncChats,
  refreshDigest,
  stopHarvestJob,
} from './jobs.mjs';
import { showChatInbox, handleChatCallback, handlePendingTextInput } from './chats.mjs';
import { showApplyWizard, handleApplyWizardCallback, launchApplyFromWizard } from './apply-wizard.mjs';
import { clearPending } from './session.mjs';

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

function parseHarvestPeriodArg(raw) {
  const n = Number(raw);
  if (raw == null || raw === '') return 7;
  if (!Number.isFinite(n) || n < 0) return 7;
  return Math.min(30, Math.max(0, Math.round(n)));
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 */
async function executeCommand(cmd, args, cfg) {
  switch (cmd) {
    case 'start':
    case 'home':
      return { home: true };
    case 'help':
      return { html: helpTextHtml(), keyboard: 'home' };
    case 'status':
      return { html: formatJobStatusText(), keyboard: 'back' };
    case 'stats':
      return { html: escPlain(formatStatsText({ periodDays: 1 })), keyboard: 'back', plain: true };
    case 'queue':
      return { html: formatQueueText(), keyboard: 'back' };
    case 'chats':
      return { chatsInbox: true };
    case 'funnel': {
      const days = Math.min(90, Math.max(1, Number(args[0]) || 7));
      return { html: formatFunnelText(days), keyboard: 'back' };
    }
    case 'digest': {
      return { digest: true };
    }
    case 'digest_last': {
      const t = formatLastDigestText();
      return t
        ? { html: t, keyboard: 'back' }
        : { html: 'Сохранённый дайджест не найден. Нажмите 📰 <b>Дайджест</b>.', keyboard: 'back' };
    }
    case 'batch':
      return { html: formatBatchReportText(), keyboard: 'back' };
    case 'dashboard':
      return {
        html: `🖥 <b>Дашборд HH Ai</b>\n\n<a href="${cfg.dashboardUrl}">${cfg.dashboardUrl}</a>\n\n<i>Запустите на ПК: npm run dashboard</i>`,
        keyboard: 'back',
      };
    case 'routine':
      if (!cfg.enableRoutine) return { html: 'Утренний цикл отключён в config/telegram-bot.json', keyboard: 'back' };
      return { confirm: 'routine', html: confirmText('routine') };
    case 'routine_harvest':
      return { confirm: 'routine_harvest', html: confirmText('routine_harvest') };
    case 'harvest': {
      if (!cfg.enableHarvest) return { html: 'Поиск отключён в config/telegram-bot.json', keyboard: 'back' };
      const days = parseHarvestPeriodArg(args[0]);
      return { confirm: `harvest:${days}`, html: confirmText(`harvest:${days}`) };
    }
    case 'harvest_stop': {
      const r = stopHarvestJob();
      return { html: actionResultText(r.ok, r.message), keyboard: 'back' };
    }
    case 'apply': {
      if (cfg.enableBatchControl === false) {
        return { html: 'Серия откликов отключена в config/telegram-bot.json', keyboard: 'back' };
      }
      return { applyWizard: true };
    }
    case 'apply_stop': {
      if (cfg.enableBatchControl === false) {
        return { html: 'Серия откликов отключена', keyboard: 'back' };
      }
      const r = controlApplyBatch('stop');
      return { html: actionResultText(r.ok, r.ok ? r.message : r.error), keyboard: 'back' };
    }
    case 'apply_pause': {
      if (cfg.enableBatchControl === false) {
        return { html: 'Серия откликов отключена', keyboard: 'back' };
      }
      const r = controlApplyBatch('pause');
      return { html: actionResultText(r.ok, r.ok ? r.message : r.error), keyboard: 'back' };
    }
    case 'apply_resume': {
      if (cfg.enableBatchControl === false) {
        return { html: 'Серия откликов отключена', keyboard: 'back' };
      }
      const r = controlApplyBatch('resume');
      return { html: actionResultText(r.ok, r.ok ? r.message : r.error), keyboard: 'back' };
    }
    case 'sync_chats':
      return { confirm: 'sync_chats', html: confirmText('sync_chats') };
    case 'cancel':
      return { cancel: true };
    default:
      return { html: unknownCommandText(), keyboard: 'home' };
  }
}

/** Plain text from digest may contain < — use as plain message */
function escPlain(text) {
  return String(text || '');
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 */
async function sendHome(cfg, chatId) {
  const botToken = cfg.botToken;
  const html = `${formatHomeDashboard(cfg)}\n\n${welcomeHint()}`;
  await sendBotMessage(botToken, chatId, html, {
    replyMarkup: mainReplyKeyboard(),
    parseMode: 'HTML',
  });
  await sendBotMessage(botToken, chatId, '⚡ Быстрые действия:', {
    replyMarkup: homeInlineKeyboard(cfg),
    parseMode: 'HTML',
  });
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {unknown} result
 */
async function deliverCommandResult(cfg, chatId, result) {
  const botToken = cfg.botToken;

  if (result && typeof result === 'object' && result.home) {
    await sendHome(cfg, chatId);
    return;
  }

  if (result && typeof result === 'object' && result.applyWizard) {
    await showApplyWizard(cfg, chatId);
    return;
  }

  if (result && typeof result === 'object' && result.chatsInbox) {
    await showChatInbox(cfg, chatId);
    return;
  }

  if (result && typeof result === 'object' && result.cancel) {
    clearPending(chatId);
    await sendBotMessage(botToken, chatId, cancelledText(), {
      replyMarkup: mainReplyKeyboard(),
      parseMode: 'HTML',
    });
    return;
  }

  if (result && typeof result === 'object' && result.digest) {
    await sendBotMessage(botToken, chatId, digestLoadingText(), {
      replyMarkup: mainReplyKeyboard(),
      parseMode: 'HTML',
    });
    const saved = await refreshDigest({ periodDays: 1 });
    await sendBotMessage(botToken, chatId, saved.text, {
      replyMarkup: backHomeKeyboard(),
    });
    return;
  }

  if (result && typeof result === 'object' && result.confirm) {
    await sendBotMessage(botToken, chatId, result.html, {
      replyMarkup: confirmKeyboard(result.confirm),
      parseMode: 'HTML',
    });
    return;
  }

  if (result && typeof result === 'object' && result.html) {
    const markup =
      result.keyboard === 'back'
        ? backHomeKeyboard()
        : result.keyboard === 'home'
          ? homeInlineKeyboard(cfg)
          : mainReplyKeyboard();
    await sendBotMessage(botToken, chatId, result.html, {
      replyMarkup: markup,
      parseMode: result.plain ? undefined : 'HTML',
    });
    return;
  }

  await sendBotMessage(botToken, chatId, String(result), { replyMarkup: mainReplyKeyboard() });
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {{ cmd?: string, args?: string[], nav?: string }} parsed
 */
async function dispatchParsed(cfg, chatId, parsed) {
  if (parsed.nav === 'home') {
    await sendHome(cfg, chatId);
    return;
  }
  if (parsed.nav === 'actions') {
    await sendBotMessage(cfg.botToken, chatId, '<b>▶️ Запуск задач</b>\n\nВыберите действие:', {
      replyMarkup: actionsInlineKeyboard(cfg),
      parseMode: 'HTML',
    });
    return;
  }
  const result = await executeCommand(parsed.cmd, parsed.args || [], cfg);
  await deliverCommandResult(cfg, chatId, result);
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
      clearPending(chatId);
      await answerCallbackQuery(botToken, cq.id, 'Отменено');
      await sendBotMessage(botToken, chatId, cancelledText(), {
        replyMarkup: mainReplyKeyboard(),
        parseMode: 'HTML',
      });
      return;
    }

    if (
      data.startsWith('ba:') ||
      data.startsWith('cf:') ||
      data.startsWith('ct:') ||
      data.startsWith('cd:') ||
      data.startsWith('cx:') ||
      data.startsWith('cw:') ||
      data.startsWith('cp:') ||
      data.startsWith('cs:') ||
      data.startsWith('cb:') ||
      data.startsWith('cl:')
    ) {
      if (data.startsWith('ba:')) {
        await handleApplyWizardCallback(cfg, chatId, data, cq.id);
        return;
      }
      await handleChatCallback(cfg, chatId, data, cq.id);
      return;
    }

    if (data.startsWith('nav:') || data.startsWith('cmd:')) {
      const parsed = parseInlineCommand(data);
      if (!parsed) {
        await answerCallbackQuery(botToken, cq.id, 'Неизвестная команда');
        return;
      }
      await answerCallbackQuery(botToken, cq.id);
      await dispatchParsed(cfg, chatId, parsed);
      return;
    }

    if (data.startsWith('ok:')) {
      const action = data.slice(3);
      let result;
      if (action === 'routine') result = launchDailyRoutine({ withHarvest: false });
      else if (action === 'routine_harvest') result = launchDailyRoutine({ withHarvest: true });
      else if (action === 'sync_chats') result = launchSyncChats();
      else if (action.startsWith('harvest:')) {
        const days = Number(action.split(':')[1]) || 7;
        result = launchHarvest(days);
      } else if (action.startsWith('ap:') || action.startsWith('apply:')) {
        await answerCallbackQuery(botToken, cq.id);
        await launchApplyFromWizard(cfg, chatId, action);
        return;
      } else {
        await answerCallbackQuery(botToken, cq.id, 'Неизвестное действие');
        return;
      }
      await answerCallbackQuery(botToken, cq.id, result.ok ? 'Запущено' : 'Ошибка');
      await sendBotMessage(
        botToken,
        chatId,
        actionResultText(result.ok, result.ok ? result.message : result.error),
        { replyMarkup: backHomeKeyboard(), parseMode: 'HTML' }
      );
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

  const cmdInfo = parseBotCommand(msg.text);
  if (cmdInfo.cmd === 'cancel') {
    clearPending(chatId);
    await sendBotMessage(botToken, chatId, cancelledText(), {
      replyMarkup: mainReplyKeyboard(),
      parseMode: 'HTML',
    });
    return;
  }

  if (await handlePendingTextInput(cfg, chatId, msg.text)) return;

  let parsed = parseReplyButton(msg.text);
  if (!parsed) {
    if (!cmdInfo.cmd) return;
    parsed = cmdInfo;
  }

  if (parsed.nav) {
    await dispatchParsed(cfg, chatId, parsed);
    return;
  }

  await dispatchParsed(cfg, chatId, parsed);
}

/** @param {string} botToken @param {string|number} chatId */
export async function sendWelcome(botToken, chatId) {
  await sendBotMessage(botToken, chatId, helpTextHtml(), {
    replyMarkup: mainReplyKeyboard(),
    parseMode: 'HTML',
  });
}
