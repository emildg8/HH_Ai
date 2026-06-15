/**
 * Шаги ежедневной рутины (поиск → отклики → follow-up).
 */

export const DAILY_ROUTINE_STEPS = [
  {
    id: 'sync-responses',
    label: 'Синхронизация откликов с hh.ru',
    detail: 'Приглашения, отказы, просмотры → кэш и воронка',
    kind: 'browser',
  },
  {
    id: 'apply-cache',
    label: 'Статусы в очереди',
    detail: 'Применить кэш к карточкам (без браузера)',
    kind: 'local',
  },
  {
    id: 'sync-chats',
    label: 'Синхронизация чатов',
    detail: 'Вопросы работодателя и черновики ответов',
    kind: 'browser',
  },
  {
    id: 'harvest-external',
    label: 'Внешние источники',
    detail: 'Habr + Telegram + ATS (опц. --with-habr-harvest)',
    kind: 'local',
    optional: true,
  },
  {
    id: 'harvest',
    label: 'Сбор новых вакансий',
    detail: 'Опционально: harvest за 7 дней',
    kind: 'browser',
    optional: true,
  },
  {
    id: 'review',
    label: 'Проверка очереди',
    detail: 'Раздел «Без анкет» → отбор и батч',
    kind: 'ui',
  },
  {
    id: 'batch',
    label: 'Батч откликов',
    detail: 'Авто-отклик по разделу «Без анкет»',
    kind: 'browser',
    optional: true,
  },
];
