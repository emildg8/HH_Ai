/**
 * Мастер запуска серии откликов: scope, мин. балл, лимит.
 */

import { loadQueue } from '../store.mjs';
import { loadPreferences } from '../preferences.mjs';
import { filterForBatchScope, batchScopeUiLabel, normalizeBatchScope } from '../batch-scope.mjs';
import { getDashboardBatchSizeCap } from '../dashboard-preferences.mjs';
import { launchApplyBatch } from './jobs.mjs';
import { sendBotMessage, answerCallbackQuery } from './api.mjs';
import { applyWizardKeyboard } from './ui.mjs';
import { actionResultText, confirmText } from './copy.mjs';
import { confirmKeyboard, backHomeKeyboard } from './ui.mjs';
import { getSession, patchSession } from './session.mjs';
import { esc } from './format.mjs';

/** @type {Record<string, string>} */
export const SCOPE_CODES = {
  nQ: 'noQuestionnaire',
  qu: 'questionnaire',
  q: 'queue',
  hi: 'hidden',
};

/** @type {Record<string, string>} */
const CODE_BY_SCOPE = Object.fromEntries(Object.entries(SCOPE_CODES).map(([k, v]) => [v, k]));

function defaultMinScore() {
  try {
    const n = Number(loadPreferences().dashboardMinScoreFilter);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  } catch {
    /* ignore */
  }
  return 50;
}

/** @param {string} scope @param {number} minScore */
export function countApplyCandidates(scope, minScore) {
  const prefs = loadPreferences();
  let items = filterForBatchScope(loadQueue(), normalizeBatchScope(scope), prefs);
  const min = Math.max(0, Number(minScore) || 0);
  if (min > 0) {
    items = items.filter((x) => {
      const s = Number(x.scoreOverall ?? x.geminiScore ?? 0) || 0;
      return s >= min;
    });
  }
  return items.length;
}

/** @param {{ scope?: string, minScore?: number, limit?: number }} draft */
export function formatApplyWizardHtml(draft) {
  const scope = normalizeBatchScope(draft.scope || 'noQuestionnaire');
  const minScore = draft.minScore != null ? Number(draft.minScore) : defaultMinScore();
  const cap = getDashboardBatchSizeCap();
  const limit = Math.min(cap, Math.max(1, Number(draft.limit) || cap));
  const available = countApplyCandidates(scope, minScore);

  return [
    '<b>🚀 Серия автооткликов</b>',
    '',
    `📂 Область: <b>${esc(batchScopeUiLabel(scope))}</b>`,
    `📊 Мин. балл: <b>${minScore > 0 ? `≥${minScore}` : 'любой'}</b>`,
    `🔢 Лимит: <b>${limit}</b> (макс. ${cap})`,
    '',
    `${available ? '✅' : '⚠️'} В очереди подходит: <b>${available}</b> вакансий`,
    '',
    '<i>Настройте параметры кнопками, затем «Запустить».</i>',
  ].join('\n');
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 */
export async function showApplyWizard(cfg, chatId) {
  const cap = getDashboardBatchSizeCap();
  const draft = {
    scope: 'noQuestionnaire',
    minScore: defaultMinScore(),
    limit: cap,
  };
  patchSession(chatId, { applyDraft: draft });
  await sendBotMessage(cfg.botToken, chatId, formatApplyWizardHtml(draft), {
    replyMarkup: applyWizardKeyboard(draft),
    parseMode: 'HTML',
  });
}

/**
 * @param {string} action ok:ap:nQ/70/10
 */
export function parseApplyLaunchAction(action) {
  const raw = action.startsWith('ap:') ? action.slice(3) : action.startsWith('apply:') ? action.slice(6) : '';
  if (!raw) return null;
  if (!raw.includes('/')) {
    const limit = Number(raw);
    if (!Number.isFinite(limit)) return null;
    return {
      batchScope: 'noQuestionnaire',
      minScore: defaultMinScore(),
      limit,
    };
  }
  const [scopeCode, minRaw, limitRaw] = raw.split('/');
  const batchScope = SCOPE_CODES[scopeCode] || 'noQuestionnaire';
  const minScore = minRaw === 'any' ? 0 : Math.max(0, Number(minRaw) || 0);
  const limit = Math.max(1, Number(limitRaw) || getDashboardBatchSizeCap());
  return { batchScope, minScore, limit };
}

/** @param {{ scope?: string, minScore?: number, limit?: number }} draft */
export function applyLaunchToken(draft) {
  const scope = CODE_BY_SCOPE[normalizeBatchScope(draft.scope)] || 'nQ';
  const min = draft.minScore > 0 ? String(draft.minScore) : 'any';
  const limit = Math.min(getDashboardBatchSizeCap(), Math.max(1, Number(draft.limit) || getDashboardBatchSizeCap()));
  return `ap:${scope}/${min}/${limit}`;
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {string} data
 * @param {string} callbackQueryId
 */
export async function handleApplyWizardCallback(cfg, chatId, data, callbackQueryId) {
  const botToken = cfg.botToken;
  const session = getSession(chatId);
  const draft = {
    scope: session.applyDraft?.scope || 'noQuestionnaire',
    minScore: session.applyDraft?.minScore ?? defaultMinScore(),
    limit: session.applyDraft?.limit ?? getDashboardBatchSizeCap(),
  };

  if (data.startsWith('ba:s:')) {
    const code = data.slice(5);
    if (SCOPE_CODES[code]) draft.scope = SCOPE_CODES[code];
    patchSession(chatId, { applyDraft: draft });
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendBotMessage(botToken, chatId, formatApplyWizardHtml(draft), {
      replyMarkup: applyWizardKeyboard(draft),
      parseMode: 'HTML',
    });
    return true;
  }

  if (data.startsWith('ba:m:')) {
    const raw = data.slice(5);
    draft.minScore = raw === 'any' ? 0 : Math.max(0, Number(raw) || 0);
    patchSession(chatId, { applyDraft: draft });
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendBotMessage(botToken, chatId, formatApplyWizardHtml(draft), {
      replyMarkup: applyWizardKeyboard(draft),
      parseMode: 'HTML',
    });
    return true;
  }

  if (data.startsWith('ba:l:')) {
    const raw = data.slice(5);
    const cap = getDashboardBatchSizeCap();
    draft.limit = raw === 'max' ? cap : Math.min(cap, Math.max(1, Number(raw) || cap));
    patchSession(chatId, { applyDraft: draft });
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendBotMessage(botToken, chatId, formatApplyWizardHtml(draft), {
      replyMarkup: applyWizardKeyboard(draft),
      parseMode: 'HTML',
    });
    return true;
  }

  if (data === 'ba:confirm') {
    const token = applyLaunchToken(draft);
    const available = countApplyCandidates(draft.scope, draft.minScore);
    await answerCallbackQuery(botToken, callbackQueryId);
    await sendBotMessage(
      botToken,
      chatId,
      `${confirmText(token)}\n\nВ очереди: <b>${available}</b> вакансий.`,
      {
        replyMarkup: confirmKeyboard(token),
        parseMode: 'HTML',
      }
    );
    return true;
  }

  return false;
}

/**
 * @param {ReturnType<import('./config.mjs').loadTelegramBotConfig>} cfg
 * @param {string|number} chatId
 * @param {string} action
 */
export async function launchApplyFromWizard(cfg, chatId, action) {
  const parsed = parseApplyLaunchAction(action);
  if (!parsed) {
    await sendBotMessage(cfg.botToken, chatId, actionResultText(false, 'Неверные параметры серии'), {
      replyMarkup: backHomeKeyboard(),
      parseMode: 'HTML',
    });
    return;
  }
  const available = countApplyCandidates(parsed.batchScope, parsed.minScore);
  if (!available && !action.includes('resume')) {
    await sendBotMessage(
      cfg.botToken,
      chatId,
      actionResultText(false, 'Нет подходящих вакансий — измените scope или балл'),
      { replyMarkup: backHomeKeyboard(), parseMode: 'HTML' }
    );
    return;
  }
  const result = launchApplyBatch(parsed);
  await sendBotMessage(
    cfg.botToken,
    chatId,
    actionResultText(result.ok, result.ok ? result.message : result.error),
    { replyMarkup: backHomeKeyboard(), parseMode: 'HTML' }
  );
}
