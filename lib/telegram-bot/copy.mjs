/**
 * Тексты и брендинг Telegram-бота HH Ai.
 */

export const BRAND = {
  name: 'HH Ai',
  tagline: 'Пульт управления откликами на hh.ru',
  footer: 'Дашборд на ПК · npm run dashboard',
};

export const PLACEHOLDER = 'Выберите кнопку или /help';

export function welcomeHint() {
  return `<i>Ниже — кнопки быстрого доступа. Поиск, серия откликов и отправка в чат — с подтверждением.</i>`;
}

export function helpTextHtml() {
  return [
    `<b>${BRAND.name}</b> — ${BRAND.tagline}`,
    '',
    sectionHelp('Обзор', [
      '📊 Статус — поиск, серия откликов, браузер',
      '📋 Очередь — вакансии по статусам',
      '💬 Чаты — inbox, переписка, ответы',
      '📈 Сводка / 📉 Воронка — статистика',
    ]),
    '',
    sectionHelp('Запуск (▶️ Действия)', [
      '🔍 Поиск — сбор вакансий (3/7/14 дн.)',
      '🚀 Серия — scope, балл и лимит в мастере',
      '🌅 Утро — sync откликов и чатов',
      '🔄 Синхр. чаты — обновить переписку',
    ]),
    '',
    sectionHelp('Чаты', [
      '💬 → выберите чат по номеру',
      '✍️ Черновик LLM или ✏️ свой текст',
      '📤 Отправка откроет Chromium на ПК',
    ]),
    '',
    sectionHelp('Команды', [
      '/apply · /apply_stop · /apply_pause · /apply_resume',
      '/harvest 7 · /sync_chats · /cancel',
    ]),
  ].join('\n');
}

/** @param {string} title @param {string[]} lines */
function sectionHelp(title, lines) {
  return `<b>${title}</b>\n${lines.map((l) => `  ${l}`).join('\n')}`;
}

/** @param {string} action */
export function confirmText(action) {
  const map = {
    routine: 'Запустить <b>утренний цикл</b>?\n\nСинхронизация откликов и чатов hh.ru. Браузер должен быть свободен.',
    routine_harvest: 'Запустить утро <b>с поиском</b> вакансий?\n\nДольше обычного цикла, займёт браузер.',
    sync_chats: 'Запустить <b>синхронизацию чатов</b> hh.ru?\n\nОткроется Chromium.',
  };
  if (action.startsWith('harvest:')) {
    const days = action.split(':')[1];
    const period = days === '0' ? 'за всё время' : `за ${days} дн.`;
    return `Запустить <b>поиск вакансий</b> ${period}?\n\nОткроется Chromium, как в дашборде.`;
  }
  if (action.startsWith('apply:') || action.startsWith('ap:')) {
    const body = action.replace(/^apply:/, '').replace(/^ap:/, '');
    if (body.includes('/')) {
      const [sc, min, lim] = body.split('/');
      const labels = { nQ: 'Без анкет', qu: 'Анкета', q: 'Очередь', hi: 'Скрытые' };
      const scope = labels[sc] || sc;
      const score = min === 'any' ? 'любой балл' : `≥${min}`;
      return `Запустить <b>серию автооткликов</b>?\n\n${scope} · ${score} · до ${lim} шт.\n\nОткроется Chromium на ПК.`;
    }
    return `Запустить <b>серию автооткликов</b> (до ${body} вакансий)?\n\nБез анкет, ≥50 баллов.`;
  }
  return map[action] || 'Подтвердите действие:';
}

/** @param {boolean} ok @param {string} [detail] */
export function actionResultText(ok, detail) {
  return ok ? `✅ ${detail || 'Готово'}` : `❌ ${detail || 'Не удалось'}`;
}

export function unknownCommandText() {
  return 'Не понял команду. Нажмите 🏠 <b>Главная</b> или ❓ <b>Справка</b>.';
}

export function cancelledText() {
  return 'Действие отменено.';
}

export function digestLoadingText() {
  return '⏳ Обновляю дайджест…';
}
