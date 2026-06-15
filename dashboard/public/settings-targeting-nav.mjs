/**
 * Навигация из карточек / статистики reject → вкладка и поле настроек.
 */

/** @typedef {{ tab: string, focus: string, hint?: string, actionLabel?: string, layout?: string, noFocus?: boolean }} SettingsNavTarget */

/** @type {Record<string, SettingsNavTarget>} */
export const REJECT_CATEGORY_NAV = {
  'work-format': {
    tab: 'targeting',
    focus: 'settings-remote-card',
    hint: 'Удалёнка и формат',
    actionLabel: '→ Удалёнка',
    layout: 'wide',
  },
  'off-target-overqualified': {
    tab: 'targeting',
    focus: 'pref-exclude-senior',
    hint: 'Руководители',
    actionLabel: '→ Руководители',
  },
  senior: {
    tab: 'targeting',
    focus: 'pref-exclude-senior',
    hint: 'Руководители',
    actionLabel: '→ Руководители',
  },
  'off-target-dev-outside-profile': {
    tab: 'targeting',
    focus: 'pref-exclude-dev',
    hint: 'Разработчики',
    actionLabel: '→ Разработчики',
  },
  'off-target-irrelevant-title': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  irrelevant: {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'off-target-no-it-profile': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'no-it-profile': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'off-target-l1': {
    tab: 'targeting',
    focus: 'settings-targeting-format',
    hint: 'Формат работы',
    actionLabel: '→ Формат работы',
  },
  'off-target-sales': {
    tab: 'targeting',
    focus: 'settings-targeting-roles',
    hint: 'Исключения по ролям',
    actionLabel: '→ Исключения',
  },
  'off-target-network': {
    tab: 'targeting',
    focus: 'settings-targeting-roles',
    hint: 'Исключения по ролям',
    actionLabel: '→ Исключения',
  },
  'off-target-industrial': {
    tab: 'targeting',
    focus: 'settings-targeting-roles',
    hint: 'Исключения по ролям',
    actionLabel: '→ Исключения',
  },
  'off-target-blue-collar': {
    tab: 'targeting',
    focus: 'settings-targeting-roles',
    hint: 'Исключения по ролям',
    actionLabel: '→ Исключения',
  },
  'off-target': {
    tab: 'targeting',
    focus: 'settings-targeting-roles',
    hint: 'Исключения по ролям',
    actionLabel: '→ Исключения',
  },
  'off-target-qa': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'off-target-analyst': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'off-target-architect': {
    tab: 'targeting',
    focus: 'pref-exclude-senior',
    hint: 'Руководители',
    actionLabel: '→ Руководители',
  },
  'off-target-security': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'off-target-crypto': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Нерелевантные заголовки',
    actionLabel: '→ Нерелевантные',
  },
  'off-target-product': {
    tab: 'targeting',
    focus: 'pref-exclude-senior',
    hint: 'Руководители',
    actionLabel: '→ Руководители',
  },
  'off-target-region': {
    tab: 'targeting',
    focus: 'settings-targeting-format',
    hint: 'Формат работы',
    actionLabel: '→ Формат работы',
  },
  'off-target-hh-state': {
    tab: 'targeting',
    focus: 'settings-targeting-insights',
    hint: 'Уже отклик на hh.ru',
    actionLabel: 'Нет переключателя',
    noFocus: true,
  },
  'off-target-promo': {
    tab: 'targeting',
    focus: 'settings-targeting-insights',
    hint: 'Промо-вакансии',
    actionLabel: 'Нет переключателя',
    noFocus: true,
  },
  manual: {
    tab: 'targeting',
    focus: 'settings-targeting-insights',
    hint: 'Статистика',
    actionLabel: 'Обновить список',
    layout: 'wide',
  },
};

const FALLBACK_NAV = {
  tab: 'targeting',
  focus: 'settings-targeting-roles',
  hint: 'Исключения по ролям',
  actionLabel: '→ Исключения',
  layout: 'wide',
};

/** @param {string} [category] @returns {SettingsNavTarget} */
export function settingsNavForRejectCategory(category) {
  const c = String(category || '').trim();
  return REJECT_CATEGORY_NAV[c] || { ...FALLBACK_NAV };
}

/** @param {string} [category] */
export function dispatchOpenSettingsForCategory(category) {
  const nav = settingsNavForRejectCategory(category);
  if (nav.noFocus) return;
  window.dispatchEvent(
    new CustomEvent('hh-open-settings', {
      detail: {
        tab: nav.tab,
        focus: nav.focus,
        layout: nav.layout || (nav.tab === 'targeting' ? 'wide' : undefined),
        focusToast: nav.hint ? `Открыто: ${nav.hint}` : '',
      },
    })
  );
}
