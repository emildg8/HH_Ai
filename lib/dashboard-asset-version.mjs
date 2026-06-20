/**

 * Версии query-string для кэша статики дашборда.

 * При правках — обновите константу и тот же ?v= в dashboard/public/index.html.

 */

/** Версия дизайн-системы (DS-D5); менять при breaking UI */

export const DASHBOARD_STYLE_VERSION = '3.0.0';



export const DASHBOARD_APP_JS_VERSION = '20260618settings9';

export const DASHBOARD_V4_CSS_VERSION = '20260618settings9';

export const DASHBOARD_SETTINGS_CSS_VERSION = '20260618settings9';

export const DASHBOARD_SETTINGS_V5_LAYER_VERSION = '20260618settings9';

export const DASHBOARD_SETTINGS_V6_VERSION = '20260618settings9';

export const DASHBOARD_STYLE_CSS_VERSION = '20260618settings9';



/** Единый стиль + выравнивание (последний слой CSS) */

export const DASHBOARD_UNIFY_CSS_VERSION = '20260615seg1';

export const DASHBOARD_FOCUS_CSS_VERSION = '20260615breadcrumbs1';

export const DASHBOARD_CONTROLS_POLISH_CSS_VERSION = '20260615settings6';

export const DASHBOARD_DESIGN_FOUNDATION_VERSION = '20260615settings6';



/** @type {ReadonlyArray<{ file: string, version: string }>} */

export const DASHBOARD_CACHE_BUST_CHECKS = [

  { file: 'app.js', version: DASHBOARD_APP_JS_VERSION },

  { file: 'style.css', version: DASHBOARD_STYLE_CSS_VERSION },

  { file: 'dashboard-v4.css', version: DASHBOARD_V4_CSS_VERSION },

  { file: 'dashboard-settings.css', version: DASHBOARD_SETTINGS_CSS_VERSION },

  { file: 'dashboard-settings-v5-layer.css', version: DASHBOARD_SETTINGS_V5_LAYER_VERSION },

  { file: 'dashboard-settings-v6.css', version: DASHBOARD_SETTINGS_V6_VERSION },

  { file: 'dashboard-unify.css', version: DASHBOARD_UNIFY_CSS_VERSION },

  { file: 'design-tokens.css', version: DASHBOARD_UNIFY_CSS_VERSION },

  { file: 'design-foundation.css', version: DASHBOARD_DESIGN_FOUNDATION_VERSION },

  { file: 'dashboard-focus.css', version: DASHBOARD_FOCUS_CSS_VERSION },

  { file: 'dashboard-controls-polish.css', version: DASHBOARD_CONTROLS_POLISH_CSS_VERSION },

];

