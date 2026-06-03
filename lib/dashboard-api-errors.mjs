/**
 * Человекочитаемые подписи к кодам/фразам ошибок API дашборда.
 */

/** @type {Readonly<Record<string, string>>} */
export const DASHBOARD_API_ERROR_LABELS = {
  ENOENT: 'Файл не найден на диске',
  EACCES: 'Нет доступа к файлу',
  EBUSY: 'Файл занят другим процессом',
  EPERM: 'Операция запрещена',
  'batch already running': 'Серия откликов уже выполняется',
  'browser lock': 'Браузер занят — дождитесь завершения или закройте окно автоматизации hh',
  'not logged in': 'Сессия hh.ru не активна — выполните npm run login',
  'preferences invalid': 'Настройки повреждены — откройте «Настройки» и сохраните заново',
  'queue empty': 'Очередь пуста — сначала соберите вакансии',
  'harvest running': 'Поиск вакансий уже идёт',
  timeout: 'Превышено время ожидания — повторите позже',
};

/**
 * @param {unknown} err
 * @returns {string}
 */
export function humanDashboardApiError(err) {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String(/** @type {{ message?: unknown }} */ (err).message)
        : String(err ?? 'Неизвестная ошибка');
  const key = raw.trim();
  for (const [pattern, label] of Object.entries(DASHBOARD_API_ERROR_LABELS)) {
    if (key.toLowerCase().includes(pattern.toLowerCase())) return label;
  }
  if (key.length > 120) return `${key.slice(0, 117)}…`;
  return key;
}
