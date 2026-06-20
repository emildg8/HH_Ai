/**
 * Русские подписи модалки «Настройки» (без англицизмов в simple).
 */

/** @type {Record<string, string>} */
export const SETTINGS_NAV_LABELS = {
  system: 'Система',
  harvest: 'Сбор',
  targeting: 'Отбор',
  apply: 'Отклики',
  letters: 'Письма',
  teleprompter: 'Суфлёр',
  appearance: 'Интерфейс',
  services: 'Сервисы',
  expert: 'Для опытных',
};

/** @type {Record<string, string>} */
export const SETTINGS_SECTION_LEADS = {
  system: 'Профиль поиска, готовность и окно браузера при автоматизации',
  harvest: 'Сбор вакансий, лимиты нейросети и очередь',
  targeting: 'Формат работы, зарплата и исключения по ролям',
  apply: 'Порог «Авто», размер серии и лимиты hh.ru',
  letters: 'Качество писем, автоподготовка и ложные отказы',
  teleprompter: 'Звук, подсказки на собеседовании и готовность суфлёра',
  appearance: 'Режим интерфейса, тема, список и боковые панели',
  services: 'Бот Telegram, расписания и утренний цикл',
  expert: 'Паттерны отбора, веса нейросети и полный экспорт',
};

/** @type {Record<string, string>} */
export const SETTINGS_FOOTER_NOTES = {
  system: 'Профиль и готовность',
  harvest: 'Сбор и оценка вакансий',
  targeting: 'Правила отбора',
  apply: 'Серия откликов',
  letters: 'Письма и качество',
  teleprompter: 'Суфлёр на собеседовании',
  appearance: 'Внешний вид',
  services: 'Фоновые сервисы',
  expert: 'Расширенные настройки',
};

/** @type {Record<string, string>} */
export const HEALTH_LABELS = {
  harvest: 'Сбор вакансий',
  llm: 'Нейросеть',
  session: 'Сессия hh.ru',
  telegram: 'Бот Telegram',
  chromium: 'Браузер',
  cv: 'Резюме',
};

/** @type {Record<string, string>} */
export const PLAYWRIGHT_MODE_LABELS = {
  'hidden-captcha': 'скрытый',
  visible: 'видимый',
  headless: 'без окна',
};

/** Перевод технической метки health в пользовательскую. */
export function localizeHealthLabel(raw, { simple = false } = {}) {
  let s = String(raw || '');
  if (/нейросеть:\s*настроена\s*\(openrouter\)/i.test(s) && simple) {
    return 'Нейросеть: настроена';
  }
  if (/нейросеть:\s*локальная/i.test(s) && simple) {
    return 'Нейросеть: локальная';
  }
  for (const [key, ru] of Object.entries(HEALTH_LABELS)) {
    if (s.toLowerCase().includes(key)) s = s.replace(new RegExp(key, 'gi'), ru);
  }
  return s
    .replace(/\bLLM\b/gi, 'нейросеть')
    .replace(/\bTelegram\b/gi, 'бот Telegram')
    .replace(/\bChromium\b/gi, 'браузер')
    .replace(/\bPlaywright\b/gi, '')
    .replace(/\bCV\/:/gi, 'Файлы резюме:')
    .replace(/\bharvest\b/gi, 'сбор')
    .replace(/\bheadless\b/gi, 'без окна')
    .replace(/\bremote\b/gi, 'удалёнка')
    .replace(/\bbatch\b/gi, 'серия')
    .replace(/\bFP\b/g, 'ложные пропуски')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
