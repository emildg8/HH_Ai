/**
 * Версии query-string для кэша статики дашборда.
 * При правках — обновите константу и тот же ?v= в dashboard/public/index.html.
 *
 * app.js — логика (settings-modal, app.js).
 * dashboard-v4.css — стили модалки настроек и v4 chrome.
 */
/** Версия дизайн-системы (DS-D5); менять при breaking UI */
export const DASHBOARD_STYLE_VERSION = '3.0.0';

export const DASHBOARD_APP_JS_VERSION = '20260603final2';

/** Критичный CSS для модалки «Настройки» и v4 shell */
export const DASHBOARD_V4_CSS_VERSION = '20260603final2';

/** Единый стиль + выравнивание (последний слой CSS) */
export const DASHBOARD_UNIFY_CSS_VERSION = '20260603final2';

/** @type {ReadonlyArray<{ file: string, version: string }>} */
export const DASHBOARD_CACHE_BUST_CHECKS = [
  { file: 'app.js', version: DASHBOARD_APP_JS_VERSION },
  { file: 'dashboard-v4.css', version: DASHBOARD_V4_CSS_VERSION },
  { file: 'dashboard-unify.css', version: DASHBOARD_UNIFY_CSS_VERSION },
  { file: 'design-tokens.css', version: DASHBOARD_UNIFY_CSS_VERSION },
];
