/**
 * Навигация из карточек / статистики reject → вкладка и поле настроек.
 */

/** @typedef {{ tab: string, focus: string, hint?: string, layout?: string }} SettingsNavTarget */

/** @type {Record<string, SettingsNavTarget>} */
const REJECT_CATEGORY_NAV = {
  'work-format': {
    tab: 'targeting',
    focus: 'settings-remote-card',
    hint: 'Удалёнка и формат',
    layout: 'wide',
  },
  'off-target-overqualified': {
    tab: 'targeting',
    focus: 'pref-exclude-senior',
    hint: 'Senior / lead',
  },
  'off-target-dev-outside-profile': {
    tab: 'targeting',
    focus: 'pref-exclude-dev',
    hint: 'Разработчики',
  },
  'off-target-irrelevant-title': {
    tab: 'targeting',
    focus: 'pref-exclude-irrelevant',
    hint: 'Заголовки',
  },
  'off-target-l1': { tab: 'targeting', focus: 'settings-targeting-format', hint: 'L1' },
  'off-target-sales': { tab: 'targeting', focus: 'settings-targeting-roles', hint: 'Sales' },
  'off-target-network': { tab: 'targeting', focus: 'settings-targeting-roles', hint: 'Сети' },
  'off-target-industrial': { tab: 'targeting', focus: 'settings-targeting-roles', hint: 'Пром.' },
  'off-target-blue-collar': { tab: 'targeting', focus: 'settings-targeting-roles', hint: 'Рабочие' },
  manual: { tab: 'targeting', focus: 'settings-targeting-insights', hint: 'Статистика', layout: 'wide' },
};

/** @param {string} [category] @returns {SettingsNavTarget} */
export function settingsNavForRejectCategory(category) {
  const c = String(category || '').trim();
  return (
    REJECT_CATEGORY_NAV[c] || {
      tab: 'targeting',
      focus: 'settings-targeting-insights',
      hint: 'Таргетинг',
      layout: 'wide',
    }
  );
}

/** @param {string} [category] */
export function dispatchOpenSettingsForCategory(category) {
  const nav = settingsNavForRejectCategory(category);
  window.dispatchEvent(
    new CustomEvent('hh-open-settings', {
      detail: {
        tab: nav.tab,
        focus: nav.focus,
        layout: nav.layout || (nav.tab === 'targeting' ? 'wide' : undefined),
      },
    })
  );
}
