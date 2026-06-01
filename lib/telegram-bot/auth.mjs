/**
 * Авторизация: только разрешённые chat_id / user_id.
 */

/**
 * @param {{ allowedChatIds?: string[], allowedUserIds?: string[] }} cfg
 * @param {{ chat?: { id?: number }, from?: { id?: number } }} ctx
 */
export function isTelegramUpdateAllowed(cfg, ctx) {
  const chatId = ctx.chat?.id != null ? String(ctx.chat.id) : '';
  const userId = ctx.from?.id != null ? String(ctx.from.id) : '';

  const chats = (cfg.allowedChatIds || []).map(String);
  const users = (cfg.allowedUserIds || []).map(String);

  if (!chats.length && !users.length) return false;

  if (chatId && chats.includes(chatId)) return true;
  if (userId && users.includes(userId)) return true;
  return false;
}

/**
 * @param {{ allowedChatIds?: string[], allowedUserIds?: string[] }} cfg
 */
export function authSetupHint(cfg) {
  if ((cfg.allowedChatIds || []).length || (cfg.allowedUserIds || []).length) {
    return 'Доступ запрещён. Добавьте chat_id в TELEGRAM_ALLOWED_CHAT_IDS или config/telegram-bot.json';
  }
  return 'Бот не настроен: задайте TELEGRAM_ALLOWED_CHAT_IDS или TELEGRAM_CHAT_ID в .env';
}
