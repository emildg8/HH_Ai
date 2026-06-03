/**
 * Логика модалки «Настройки»: вкладки, пресеты, сводка, dirty-state, deep link.
 */

import { writeTheme } from './ui-theme.mjs';
import { writeUiScale } from './ui-scale.mjs';
import { applyCardSizePreset } from './ui-card-tuning.mjs';
import {
  SETTINGS_LAYOUT_FOOTER_SUFFIX,
  SETTINGS_LAYOUT_PRESETS,
  applySettingsLayoutPreset,
  applySettingsOpenLayout,
  initSettingsDialogLayout,
  resetSettingsDialogSize,
  resetSettingsModalLayout,
  syncSettingsDialogLayoutOnOpen,
  syncSettingsLayoutPresetUi,
  focusSettingsLayoutBar,
  toggleSettingsModalFullscreen,
} from './settings-modal-layout.mjs';

export {
  SETTINGS_LAYOUT_PRESETS,
  applySettingsLayoutPreset,
  applySettingsOpenLayout,
  focusSettingsLayoutBar,
  resetSettingsDialogSize,
  resetSettingsModalLayout,
  syncSettingsDialogLayoutOnOpen,
  toggleSettingsModalFullscreen,
};

/** @typedef {'system' | 'targeting' | 'apply' | 'letters' | 'appearance'} SettingsTabId */

/**
 * Зависимости initSettingsModal (передаются из app.js).
 * @typedef {{
 *   api: (path: string, opts?: object) => Promise<unknown>,
 *   scheduleSaveSettings: () => void,
 *   flushSaveSettings?: () => void,
 *   setSettingsTab: (tabId: string) => void,
 *   openLetterQualityHubModal?: () => void,
 *   resetAppearanceSection?: (opts?: { includeLocalVisual?: boolean }) => void,
 *   setSettingsHint?: (text: string, variant?: string) => void,
 *   showToast?: (message: string, variant?: string) => void,
 *   onOpen?: (tabId: SettingsTabId) => void,
 *   openServiceFromSettings?: () => void,
 *   applyPreferencesResponse?: (res: {
 *     preferences?: object,
 *     ui?: object,
 *     applyRates?: object,
 *   }) => void,
 *   hasCompletedBatch?: () => boolean,
 * }} SettingsModalDeps
 */

/** @type {SettingsTabId[]} */
export const SETTINGS_TAB_ORDER = ['system', 'targeting', 'apply', 'letters', 'appearance'];

/** @type {Record<string, SettingsTabId>} */
const TAB_ALIASES = {
  system: 'system',
  profile: 'system',
  playwright: 'system',
  browser: 'system',
  service: 'system',
  targeting: 'targeting',
  eligibility: 'targeting',
  remote: 'targeting',
  salary: 'targeting',
  apply: 'apply',
  batch: 'apply',
  limits: 'apply',
  threshold: 'apply',
  letters: 'letters',
  letter: 'letters',
  quality: 'letters',
  fp: 'letters',
  appearance: 'appearance',
  list: 'appearance',
  ui: 'appearance',
};

/** @type {Record<string, string>} */
export const SETTINGS_FOCUS_ALIASES = {
  fp: 'batch-false-positive-max',
  'batch-fp': 'batch-false-positive-max',
  falsePositive: 'batch-false-positive-max',
  prepare: 'settings-letters-batch',
  metric: 'batch-letter-require-metric',
  approve: 'batch-auto-approve-letter',
  learning: 'learning-auto-apply',
  limits: 'settings-limits-hh',
  profile: 'settings-profile-card',
  threshold: 'score-threshold-input',
  batch: 'batch-limit',
  remote: 'settings-remote-card',
  'batch-remote': 'batch-require-remote',
  presets: 'settings-letters-presets',
  playwright: 'settings-playwright-mode',
  targeting: 'settings-targeting-salary',
  'require-remote': 'pref-require-remote',
  'min-monthly': 'pref-min-monthly-rub',
  'exclude-senior': 'pref-exclude-senior',
  'exclude-dev': 'pref-exclude-dev',
  'exclude-irrelevant': 'pref-exclude-irrelevant',
  insights: 'settings-targeting-insights',
  window: 'settings-modal-window-card',
  layout: 'settings-layout-bar',
};

/** Пресеты качества писем / батча (патч preferences). */
export const LETTER_QUALITY_PRESETS = {
  standard: {
    label: 'Стандарт',
    hint: 'Подготовка перед серией, FP ≤ 20 — рекомендуется для ежедневного батча',
    patch: {
      batchAutoPrepareLetters: true,
      batchLetterRequireMetric: false,
      batchAutoApproveBestLetter: false,
      batchFalsePositiveMax: 20,
      learningAutoApplyPatterns: false,
      learningAutoApplyMinCount: 3,
    },
  },
  strict: {
    label: 'Строгий батч',
    hint: 'Метрики + авто-утверждение + FP 15 — меньше слабых откликов',
    patch: {
      batchAutoPrepareLetters: true,
      batchLetterRequireMetric: true,
      batchAutoApproveBestLetter: true,
      batchFalsePositiveMax: 15,
      learningAutoApplyPatterns: false,
      learningAutoApplyMinCount: 3,
    },
  },
  soft: {
    label: 'Мягкий',
    hint: 'Подготовка без блокировок FP, обучение из reject',
    patch: {
      batchAutoPrepareLetters: true,
      batchLetterRequireMetric: false,
      batchAutoApproveBestLetter: false,
      batchFalsePositiveMax: 0,
      learningAutoApplyPatterns: true,
      learningAutoApplyMinCount: 3,
    },
  },
  manual: {
    label: 'Вручную',
    hint: 'Без автоподготовки — правка в letter-center и черновике',
    patch: {
      batchAutoPrepareLetters: false,
      batchLetterRequireMetric: false,
      batchAutoApproveBestLetter: false,
      batchFalsePositiveMax: 0,
      learningAutoApplyPatterns: false,
      learningAutoApplyMinCount: 3,
    },
  },
};

/** Сброс раздела к заводским значениям дашборда (серверные prefs). */
export const SETTINGS_SECTION_DEFAULTS = {
  system: {
    dashboardPlaywrightDisplayMode: 'hidden-captcha',
  },
  targeting: {
    requireRemote: false,
    allowHybrid: true,
    allowOfficeMoscow: true,
    hybridMoscowOnly: true,
    blockSpokenEnglishRequired: true,
    blockNightShiftOnly: true,
    allowUnknownSalary: true,
    excludeSeniorRoles: true,
    exclude1CRoles: true,
    excludeDeveloperRoles: true,
    excludeIrrelevantTitles: true,
    minMonthlyRub: 150000,
    targetMonthlyRub: 180000,
    maxMonthlyRubSearch: 300000,
  },
  apply: {
    dashboardMinScoreFilter: 50,
    dashboardBatchSize: 10,
    batchRequireRemote: false,
    hhApplyChatMaxPerHour: 50,
    hhApplyChatMaxPerDay: 1000,
    hhApplyChatMaxPerMonth: 5000,
  },
  letters: {
    batchAutoPrepareLetters: true,
    batchLetterRequireMetric: false,
    batchAutoApproveBestLetter: false,
    batchFalsePositiveMax: 20,
    learningAutoApplyPatterns: false,
    learningAutoApplyMinCount: 3,
  },
};

const TAB_FOOTER_NOTES = {
  system: 'Профиль, готовность и окно браузера',
  targeting: 'Какие вакансии попадают в очередь и серию откликов',
  apply: 'Порог «Авто», размер серии и лимиты hh.ru',
  letters: 'Письма и проверка перед батчем',
  appearance: 'Вид списка, панелей и размер окна настроек',
};

/** Быстрые сценарии из шапки модалки. */
export const SETTINGS_QUICK_PATHS = {
  batch: { tab: 'letters', focus: 'settings-letters-presets', layout: 'wide' },
  'off-target': { tab: 'targeting', focus: 'settings-targeting-insights', layout: 'wide' },
  limits: { tab: 'apply', focus: 'settings-limits-hh', layout: 'compact' },
  profile: { tab: 'system', focus: 'settings-profile-card' },
};

const PLAYWRIGHT_MODE_LABELS = {
  'hidden-captcha': 'скрытый',
  visible: 'видимый',
  headless: 'headless',
};

/** Пресеты таргетинга (patch preferences). */
export const TARGETING_PRESETS = {
  balanced: {
    label: 'Сбалансированный',
    hint: 'Гибрид и офис Москва разрешены, senior/1С/dev исключаются',
    patch: {
      ...SETTINGS_SECTION_DEFAULTS.targeting,
      batchRequireRemote: false,
    },
  },
  conservative: {
    label: 'Консервативный',
    hint: 'Только remote, без гибрида и офиса, строгий батч',
    patch: {
      requireRemote: true,
      allowHybrid: false,
      allowOfficeMoscow: false,
      hybridMoscowOnly: true,
      batchRequireRemote: true,
      blockSpokenEnglishRequired: true,
      blockNightShiftOnly: true,
      allowUnknownSalary: false,
      excludeSeniorRoles: true,
      exclude1CRoles: true,
      excludeDeveloperRoles: true,
      excludeIrrelevantTitles: true,
    },
  },
  wide: {
    label: 'Широкий',
    hint: 'Без глобальной remote, мягче исключения ролей',
    patch: {
      requireRemote: false,
      allowHybrid: true,
      allowOfficeMoscow: true,
      hybridMoscowOnly: false,
      batchRequireRemote: false,
      blockSpokenEnglishRequired: false,
      blockNightShiftOnly: true,
      allowUnknownSalary: true,
      excludeSeniorRoles: false,
      exclude1CRoles: true,
      excludeDeveloperRoles: false,
      excludeIrrelevantTitles: true,
    },
  },
};

/** Мета вкладок: горячие клавиши Alt+1…5. */
export const SETTINGS_TAB_META = {
  system: { label: 'Система', hotkey: '1' },
  targeting: { label: 'Таргетинг', hotkey: '2' },
  apply: { label: 'Отклики', hotkey: '3' },
  letters: { label: 'Письма', hotkey: '4' },
  appearance: { label: 'Интерфейс', hotkey: '5' },
};

/** Подсказки под полями. */
export const SETTINGS_FIELD_TIPS = {
  'batch-false-positive-max':
    'Если в «Неподходит» много подходящих вакансий — перед серией покажет предупреждение.',
  'score-threshold-input': 'Вкладки «Рекомендуемые» и «Ниже порога» в очереди зависят от этого числа.',
  'batch-limit': 'Лимит на один запуск серии; счётчики hh.ru — в блоке ниже.',
};

/** @type {{ dirty: boolean, saving: number, dirtyTabs: Set<string> }} */
const saveState = { dirty: false, saving: 0, dirtyTabs: new Set() };

/** @type {Map<string, Record<string, unknown>>} */
const tabBaselines = new Map();

/** @type {(() => boolean) | null} */
let hasCompletedBatchFn = null;

/**
 * @param {string | Event | Element | null} [tabOrTarget]
 * @returns {SettingsTabId}
 */
function resolveDirtyTab(tabOrTarget) {
  if (typeof tabOrTarget === 'string') return normalizeSettingsTab(tabOrTarget);
  const el =
    tabOrTarget && typeof tabOrTarget === 'object' && 'target' in tabOrTarget
      ? /** @type {Event} */ (tabOrTarget).target
      : tabOrTarget;
  if (el && typeof el === 'object' && 'nodeType' in el && /** @type {Element} */ (el).nodeType === 1) {
    const panel = /** @type {Element} */ (el).closest?.('[id^="settings-panel-"]');
    if (panel?.id?.startsWith('settings-panel-')) {
      return normalizeSettingsTab(panel.id.slice('settings-panel-'.length));
    }
  }
  const active = document.querySelector('.settings-tabs__btn.active');
  return normalizeSettingsTab(active?.dataset?.settingsTab || 'system');
}

/** @type {((text: string, variant?: string) => void) | null} */
let setHintFn = null;

/** @param {string} tabId */
export function normalizeSettingsTab(tabId) {
  const t = String(tabId || 'system').trim().toLowerCase();
  return TAB_ALIASES[t] || 'system';
}

/** @param {string} focus */
export function resolveFocusElementId(focus) {
  const f = String(focus || '').trim();
  if (!f) return '';
  if (document.getElementById(f)) return f;
  const alias = SETTINGS_FOCUS_ALIASES[f];
  if (alias && document.getElementById(alias)) return alias;
  const boolEl = document.querySelector(`[data-pref-bool="${f}"]`);
  if (boolEl?.id) return boolEl.id;
  return f;
}

/**
 * @param {Location} [loc]
 * @returns {{ tab: SettingsTabId, focus: string } | null}
 */
export function parseSettingsFromLocation(loc = window.location) {
  const url = new URL(loc.href);
  const tabRaw = url.searchParams.get('settings') || url.searchParams.get('openSettings');
  if (!tabRaw) return null;
  const layoutRaw = url.searchParams.get('settingsLayout') || url.searchParams.get('layout') || '';
  const layout =
    layoutRaw && SETTINGS_LAYOUT_PRESETS[layoutRaw] ? layoutRaw : '';
  return {
    tab: normalizeSettingsTab(tabRaw),
    focus: url.searchParams.get('focus') || url.searchParams.get('settingsFocus') || '',
    layout,
  };
}

/** @param {Location} [loc] */
export function clearSettingsLocationParams(loc = window.location) {
  const url = new URL(loc.href);
  let changed = false;
  for (const key of ['settings', 'openSettings', 'focus', 'settingsFocus', 'settingsLayout', 'layout']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const qs = url.searchParams.toString();
    window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : '') + url.hash);
  }
}

/** @param {string | Event | Element | null} [tabOrTarget] */
export function markSettingsDirty(tabOrTarget) {
  saveState.dirtyTabs.add(resolveDirtyTab(tabOrTarget));
  saveState.dirty = true;
  syncSettingsSaveUi();
}

export function markSettingsSaving() {
  saveState.saving += 1;
  syncSettingsSaveUi();
}

export function markSettingsSaved() {
  saveState.saving = Math.max(0, saveState.saving - 1);
  saveState.dirty = false;
  saveState.dirtyTabs.clear();
  refreshSettingsTabBaselines();
  syncSettingsSaveUi();
}

/** Откат полей активной вкладки к последнему сохранённому снимку. */
export function revertActiveSettingsTab() {
  const active = document.querySelector('.settings-tabs__btn.active');
  const tab = normalizeSettingsTab(active?.dataset?.settingsTab || 'system');
  if (tab === 'appearance') return false;
  const baseline = tabBaselines.get(tab);
  if (!baseline) return false;
  applyPreferencePatchToUI(baseline, { silent: true });
  saveState.dirtyTabs.delete(tab);
  saveState.dirty = saveState.dirtyTabs.size > 0;
  syncSettingsDerivedState();
  syncSettingsSaveUi();
  return true;
}

export function markSettingsSaveFailed() {
  saveState.saving = Math.max(0, saveState.saving - 1);
  saveState.dirty = true;
  syncSettingsSaveUi();
}

export function isSettingsSaveInFlight() {
  return saveState.saving > 0;
}

export function isSettingsDirty() {
  return saveState.dirty;
}

function getSystemPrefsFromUI() {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const sel = document.querySelector('[data-pref-select="dashboardPlaywrightDisplayMode"]');
  if (sel instanceof HTMLSelectElement) patch.dashboardPlaywrightDisplayMode = sel.value;
  return patch;
}

function getApplyPrefsFromUI() {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const keys = [
    'dashboardMinScoreFilter',
    'dashboardBatchSize',
    'batchRequireRemote',
    'hhApplyChatMaxPerHour',
    'hhApplyChatMaxPerDay',
    'hhApplyChatMaxPerMonth',
  ];
  for (const key of keys) {
    const boolEl = document.querySelector(`[data-pref-bool="${key}"]`);
    if (boolEl instanceof HTMLInputElement) {
      patch[key] = boolEl.checked;
      continue;
    }
    const numEl = document.querySelector(`[data-pref="${key}"]`);
    if (numEl instanceof HTMLInputElement) {
      const n = Number(numEl.value);
      if (Number.isFinite(n)) patch[key] = n;
    }
  }
  return patch;
}

/** @param {SettingsTabId} tabId */
function captureTabBaseline(tabId) {
  if (tabId === 'appearance') return;
  const getter =
    tabId === 'system'
      ? getSystemPrefsFromUI
      : tabId === 'targeting'
        ? getTargetingPrefsFromUI
        : tabId === 'apply'
          ? getApplyPrefsFromUI
          : tabId === 'letters'
            ? getLetterPrefsFromUI
            : null;
  if (!getter) return;
  tabBaselines.set(tabId, structuredClone(getter()));
}

export function refreshSettingsTabBaselines() {
  for (const id of SETTINGS_TAB_ORDER) captureTabBaseline(id);
}

/** @param {SettingsTabId} tabId */
function onSettingsTabActivated(tabId) {
  if (!saveState.dirtyTabs.has(tabId)) captureTabBaseline(tabId);
}

function syncSettingsTabDirtyIndicator() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.querySelectorAll('.settings-tabs__btn').forEach((btn) => {
    const tab = normalizeSettingsTab(btn.dataset.settingsTab || '');
    btn.classList.toggle('settings-tabs__btn--dirty', saveState.dirtyTabs.has(tab));
  });
  const active = modal.querySelector('.settings-tabs__btn.active');
  const activeTab = normalizeSettingsTab(active?.dataset?.settingsTab || 'system');
  const revertBtn = document.getElementById('btn-settings-revert-tab');
  if (revertBtn instanceof HTMLButtonElement) {
    const canRevert = saveState.dirtyTabs.has(activeTab) && activeTab !== 'appearance';
    revertBtn.hidden = !canRevert;
    revertBtn.disabled = saveState.saving > 0;
  }
}

function syncSettingsSaveUi() {
  const modal = document.getElementById('settings-modal');
  modal?.classList.toggle('settings-dialog--dirty', saveState.dirty);
  modal?.classList.toggle('settings-dialog--saving', saveState.saving > 0);
  syncSettingsTabDirtyIndicator();
  const saveNow = document.getElementById('btn-settings-save-now');
  if (saveNow instanceof HTMLButtonElement) {
    saveNow.disabled = saveState.saving > 0;
  }
  if (!setHintFn) return;
  if (saveState.saving > 0) {
    setHintFn('Сохранение…', 'pending');
    return;
  }
  if (saveState.dirty) {
    setHintFn('Есть несохранённые изменения — закроется через автосохранение', 'pending');
    return;
  }
  const hintEl = document.getElementById('settings-save-hint');
  if (hintEl?.classList.contains('settings-hint--saved')) return;
  if (hintEl?.textContent && !hintEl.hidden) return;
}

/**
 * @returns {boolean} true — можно закрыть
 */
export function tryCloseSettingsModal() {
  if (saveState.saving > 0) {
    setHintFn?.('Дождитесь окончания сохранения', 'pending');
    return false;
  }
  if (saveState.dirty) {
    return window.confirm(
      'Закрыть настройки? Несохранённые изменения будут потеряны (или нажмите «Сохранить сейчас»).'
    );
  }
  return true;
}

export function invalidateLettersSnapshot() {
  lettersSnapshotAt = 0;
  lettersSnapshotHtml = '';
}

/** Синхронизация пресетов, предупреждений и сводки после загрузки prefs. */
export function syncSettingsDerivedState() {
  syncLearningMinVisibility();
  updateSettingsLetterWarnings();
  updateSettingsRemoteWarnings();
  updateSettingsPresetHint();
  highlightActiveLetterPreset();
  highlightActiveTargetingPreset();
  updateSettingsSummaryFromUI();
}

/**
 * @param {Record<string, unknown>} patch
 * @param {{ silent?: boolean }} [opts]
 */
export function applyPreferencePatchToUI(patch, opts = {}) {
  for (const [key, value] of Object.entries(patch)) {
    const numEl = document.querySelector(`[data-pref="${key}"]`);
    if (numEl instanceof HTMLInputElement && typeof value === 'number') {
      numEl.value = String(value);
      if (!opts.silent) numEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const boolEl = document.querySelector(`[data-pref-bool="${key}"]`);
    if (boolEl instanceof HTMLInputElement && typeof value === 'boolean') {
      boolEl.checked = value;
      if (!opts.silent) boolEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const selEl = document.querySelector(`[data-pref-select="${key}"]`);
    if (selEl instanceof HTMLSelectElement && value != null) {
      selEl.value = String(value);
      if (!opts.silent) selEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  syncLearningMinVisibility();
  updateSettingsLetterWarnings();
  updateSettingsRemoteWarnings();
  updateSettingsPresetHint();
  updateSettingsSummaryFromUI();
  highlightActiveLetterPreset();
  highlightActiveTargetingPreset();
  if (!opts.silent) markSettingsDirty();
}

function syncLearningMinVisibility() {
  const on = document.getElementById('learning-auto-apply')?.checked === true;
  const wrap = document.getElementById('settings-learning-min-wrap');
  if (wrap) wrap.hidden = !on;
}

export function updateSettingsPresetHint() {
  const el = document.getElementById('settings-preset-hint');
  if (!el) return;
  const patch = getLetterPrefsFromUI();
  let active = '';
  for (const [id, preset] of Object.entries(LETTER_QUALITY_PRESETS)) {
    if (presetMatches(patch, preset.patch)) active = id;
  }
  const preset = active && LETTER_QUALITY_PRESETS[active];
  el.textContent = preset?.hint || 'Выберите пресет или настройте поля вручную';
}

/**
 * @param {Record<string, unknown>} prefs
 * @param {{ profileLabel?: string }} [opts]
 * @returns {Array<{ label: string, tone?: string }>}
 */
function buildSummaryChipParts(prefs, opts = {}) {
  const p = prefs || {};
  const threshold = Number(p.dashboardMinScoreFilter);
  const batch = Number(p.dashboardBatchSize);
  /** @type {Array<{ label: string, tone?: string }>} */
  const parts = [];
  if (Number.isFinite(threshold)) parts.push({ label: `порог ≥${threshold}` });
  if (Number.isFinite(batch)) parts.push({ label: `серия ${batch}` });
  if (p.batchAutoPrepareLetters !== false) {
    parts.push({ label: 'письма: подготовка', tone: 'good' });
  } else {
    parts.push({ label: 'письма: вручную', tone: 'muted' });
  }
  if (p.batchLetterRequireMetric) parts.push({ label: 'метрики', tone: 'accent' });
  if (p.batchAutoApproveBestLetter) parts.push({ label: 'авто-утверждение', tone: 'accent' });
  const fp = Number(p.batchFalsePositiveMax);
  if (Number.isFinite(fp) && fp > 0) parts.push({ label: `«Неподходит» ≤${fp}` });
  else if (fp === 0) parts.push({ label: 'фильтр «Неподходит» выкл', tone: 'muted' });
  const profile = String(opts.profileLabel || '').trim();
  if (profile) parts.push({ label: profile.replace(/^профиль:\s*/i, ''), tone: 'profile' });
  const pw = PLAYWRIGHT_MODE_LABELS[String(p.dashboardPlaywrightDisplayMode || '')];
  if (pw) parts.push({ label: `браузер: ${pw}`, tone: 'muted' });
  if (p.requireRemote === true) parts.push({ label: 'remote глоб.', tone: 'accent' });
  if (p.batchRequireRemote === true) parts.push({ label: 'remote батч', tone: 'accent' });
  const minRub = Number(p.minMonthlyRub);
  if (Number.isFinite(minRub) && minRub > 0) {
    parts.push({ label: `от ${Math.round(minRub / 1000)}k ₽`, tone: 'muted' });
  }
  return parts;
}

function renderSummaryChips(parts) {
  const el = document.getElementById('settings-dialog-summary');
  if (!el) return;
  if (!parts.length) {
    el.replaceChildren();
    const chip = document.createElement('span');
    chip.className = 'settings-chip settings-chip--muted';
    chip.textContent = '—';
    el.appendChild(chip);
    return;
  }
  const max = 7;
  const visible = parts.slice(0, max);
  const extra = parts.length - visible.length;
  el.replaceChildren(
    ...visible.map(({ label, tone }) => {
      const chip = document.createElement('span');
      chip.className = tone ? `settings-chip settings-chip--${tone}` : 'settings-chip';
      chip.textContent = label;
      return chip;
    })
  );
  if (extra > 0) {
    const more = document.createElement('span');
    more.className = 'settings-chip settings-chip--muted';
    more.textContent = `+${extra}`;
    more.title = 'Откройте вкладки для полной картины';
    el.appendChild(more);
  }
}

/**
 * @param {Record<string, unknown>} prefs
 * @param {{ profileLabel?: string }} [opts]
 */
export function updateSettingsSummaryFromPrefs(prefs, opts = {}) {
  renderSummaryChips(buildSummaryChipParts(prefs, opts));
}

export function updateSettingsSummaryFromUI() {
  /** @type {Record<string, unknown>} */
  const prefs = {};
  for (const el of document.querySelectorAll('#settings-modal [data-pref]')) {
    const key = el.dataset.pref;
    if (!key) continue;
    const n = Number(el.value);
    if (Number.isFinite(n)) prefs[key] = n;
  }
  for (const el of document.querySelectorAll('#settings-modal [data-pref-bool]')) {
    const key = el.dataset.prefBool;
    if (!key) continue;
    prefs[key] = Boolean(el.checked);
  }
  for (const el of document.querySelectorAll('#settings-modal [data-pref-select]')) {
    const key = el.dataset.prefSelect;
    if (!key) continue;
    prefs[key] = el.value;
  }
  const profileSel = document.getElementById('settings-profile-select');
  const profileLabel =
    profileSel instanceof HTMLSelectElement && profileSel.selectedOptions[0]
      ? profileSel.selectedOptions[0].textContent?.trim()
      : '';
  updateSettingsSummaryFromPrefs(prefs, {
    profileLabel: profileLabel ? `профиль: ${profileLabel}` : '',
  });
}

/**
 * @param {{ items?: Array<{ id: string, label: string, tone?: string }> }} status
 */
const HEALTH_JUMP = {
  llm: { tab: 'system', focus: 'settings-system-health' },
  telegram: { tab: 'system', focus: 'settings-system-health' },
  session: { tab: 'system', focus: 'settings-system-health' },
  chromium: { tab: 'system', focus: 'settings-playwright-mode' },
  cv: { tab: 'system', focus: 'settings-profile-card' },
};

export function renderSystemHealthList(status) {
  const list = document.getElementById('settings-system-health-list');
  if (!list) return;
  const items = status?.items || [];
  if (!items.length) {
    list.innerHTML = '<li class="settings-health-item settings-health-item--muted">Нет данных</li>';
    return;
  }
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      li.className = `settings-health-item settings-health-item--${item.tone || 'muted'}`;
      li.textContent = item.label;
      if (item.tone === 'warn' && item.id && HEALTH_JUMP[item.id]) {
        li.classList.add('settings-health-item--action');
        li.title = 'Нажмите — подсказка в разделе «Система»';
        li.dataset.healthJump = item.id;
      }
      return li;
    })
  );
}

export function updateSettingsRemoteWarnings() {
  const box = document.getElementById('settings-remote-warnings');
  if (!box) return;
  const globalRemote = document.getElementById('pref-require-remote')?.checked === true;
  const batchRemote = document.getElementById('batch-require-remote')?.checked === true;
  const warnings = [];
  if (batchRemote && !globalRemote) {
    warnings.push({
      level: 'info',
      text: 'Батч строже очереди: вакансия может быть в списке, но серия её пропустит без явной удалёнки.',
    });
  }
  if (globalRemote && !batchRemote) {
    warnings.push({
      level: 'info',
      text: 'Глобальный remote уже отсекает офис/гибрид при harvest; батч может брать всё из очереди.',
    });
  }
  if (!globalRemote && !batchRemote) {
    warnings.push({
      level: 'warn',
      text: 'Удалёнка не ограничена — в очередь попадут офис и гибрид, если разрешены ниже.',
    });
  }
  if (!warnings.length) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  box.hidden = false;
  box.replaceChildren(
    ...warnings.map((w) => {
      const p = document.createElement('p');
      p.className = `settings-warn settings-warn--${w.level}`;
      p.textContent = w.text;
      return p;
    })
  );
}

function getTargetingPrefsFromUI() {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const keys = [
    'requireRemote',
    'batchRequireRemote',
    'allowHybrid',
    'allowOfficeMoscow',
    'hybridMoscowOnly',
    'blockSpokenEnglishRequired',
    'blockNightShiftOnly',
    'allowUnknownSalary',
    'excludeSeniorRoles',
    'exclude1CRoles',
    'excludeDeveloperRoles',
    'excludeIrrelevantTitles',
    'minMonthlyRub',
    'targetMonthlyRub',
    'maxMonthlyRubSearch',
  ];
  for (const key of keys) {
    const boolEl = document.querySelector(`[data-pref-bool="${key}"]`);
    if (boolEl instanceof HTMLInputElement) {
      patch[key] = boolEl.checked;
      continue;
    }
    const numEl = document.querySelector(`[data-pref="${key}"]`);
    if (numEl instanceof HTMLInputElement) {
      const n = Number(numEl.value);
      if (Number.isFinite(n)) patch[key] = n;
    }
  }
  return patch;
}

function highlightActiveTargetingPreset() {
  const patch = getTargetingPrefsFromUI();
  let active = '';
  for (const [id, preset] of Object.entries(TARGETING_PRESETS)) {
    if (presetMatches(patch, preset.patch)) active = id;
  }
  document.querySelectorAll('[data-targeting-preset]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const on = btn.dataset.targetingPreset === active;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const hint = document.getElementById('settings-targeting-preset-hint');
  const preset = active && TARGETING_PRESETS[active];
  if (hint) hint.textContent = preset?.hint || 'Настройте поля вручную';
}

export function updateSettingsLetterWarnings() {
  const box = document.getElementById('settings-letters-warnings');
  if (!box) return;
  const autoPrepare = document.getElementById('batch-auto-prepare-letters')?.checked !== false;
  const requireMetric = document.getElementById('batch-letter-require-metric')?.checked === true;
  const autoApprove = document.getElementById('batch-auto-approve-letter')?.checked === true;
  const learning = document.getElementById('learning-auto-apply')?.checked === true;
  const fpMax = Number(document.getElementById('batch-false-positive-max')?.value);
  const warnings = [];

  if ((requireMetric || autoApprove) && !autoPrepare) {
    warnings.push({
      level: 'warn',
      text: 'Метрики и авто-утверждение работают надёжнее вместе с автоподготовкой писем.',
    });
  }
  if (autoApprove && requireMetric && autoPrepare) {
    warnings.push({
      level: 'info',
      text: 'Строгий режим: батч пропустит слабые письма и может утвердить лучший вариант после генерации.',
    });
  }
  if (learning && (!Number.isFinite(fpMax) || fpMax <= 0)) {
    warnings.push({
      level: 'info',
      text: 'Правила из ошибочных «Неподходит» применяются при загрузке; порог 0 — предупреждение перед серией не показывается.',
    });
  }
  if (!autoPrepare && (Number.isFinite(fpMax) ? fpMax : 0) > 0) {
    warnings.push({
      level: 'info',
      text: 'При ручной подготовке писем порог «Неподходит» всё равно учитывается в проверке перед серией.',
    });
  }
  if (!warnings.length) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  box.hidden = false;
  box.replaceChildren(
    ...warnings.map((w) => {
      const p = document.createElement('p');
      p.className = `settings-warn settings-warn--${w.level}`;
      p.textContent = w.text;
      return p;
    })
  );
}

function syncOnboardingBanner() {
  const box = document.getElementById('settings-letters-onboarding');
  if (!box) return;
  if (hasCompletedBatchFn?.()) {
    box.hidden = true;
    return;
  }
  try {
    if (localStorage.getItem('hh-settings-letters-onboarding-dismissed') === '1') {
      box.hidden = true;
      return;
    }
  } catch {
    /* ignore */
  }
  box.hidden = false;
}

function syncHubGuideBanner() {
  const box = document.getElementById('settings-hub-guide');
  if (!box) return;
  try {
    if (localStorage.getItem('hh-settings-hub-dismissed') === '1') {
      box.hidden = true;
      return;
    }
  } catch {
    /* ignore */
  }
  box.hidden = false;
}

function highlightActiveLetterPreset() {
  const patch = getLetterPrefsFromUI();
  let active = '';
  for (const [id, preset] of Object.entries(LETTER_QUALITY_PRESETS)) {
    if (presetMatches(patch, preset.patch)) active = id;
  }
  document.querySelectorAll('[data-letter-preset]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const on = btn.dataset.letterPreset === active;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  updateSettingsPresetHint();
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 */
function presetMatches(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (k.endsWith('MinCount')) continue;
    if (a[k] !== v) return false;
  }
  return true;
}

/**
 * @param {object | null | undefined} stats
 */
let insightsDelegationBound = false;

function bindInsightsDelegation() {
  if (insightsDelegationBound) return;
  const host = document.getElementById('settings-targeting-insights');
  if (!host) return;
  host.addEventListener('click', (e) => {
    const catBtn = e.target.closest('[data-open-settings-category]');
    if (catBtn) {
      e.preventDefault();
      const cat = catBtn.getAttribute('data-open-settings-category');
      import('./settings-targeting-nav.mjs').then((m) => m.dispatchOpenSettingsForCategory(cat || ''));
      return;
    }
    if (e.target.closest('[data-insights-open-fp]')) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('hh-open-settings', { detail: { tab: 'letters', focus: 'fp' } })
      );
    }
  });
  insightsDelegationBound = true;
}

/**
 * @param {object | null | undefined} stats
 */
export function renderTargetingInsights(stats) {
  const box = document.getElementById('settings-targeting-insights-body');
  if (!box) return;
  bindInsightsDelegation();
  const summary = stats?.totalIneligible
    ? `<p class="settings-insights__meta">Вне профиля в очереди: <strong>${stats.totalIneligible}</strong> · reject: ${stats.totalRejected ?? 0}</p>`
    : '';
  if (!stats?.topCategories?.length) {
    box.innerHTML = `${summary}<p class="settings-snapshot__muted">Мало отсечений — статистика появится после harvest</p>`;
    return;
  }
  const fp = stats.falsePositives;
  const fpLine =
    fp?.total > 0
      ? `<p class="settings-insights__fp">В «Неподходит» есть ${fp.total} подходящих (${fp.rate}% от всех отклонённых) — <button type="button" class="btn btn-ghost btn-sm" data-insights-open-fp">настроить порог</button></p>`
      : '';
  const rows = stats.topCategories
    .map((row) => {
      const samples = (row.samples || [])
        .map((s) => `<span class="settings-insights__sample">${escapeHtml(s.title)}</span>`)
        .join('');
      return `<li class="settings-insights__row">
        <div class="settings-insights__head">
          <span class="settings-insights__label">${escapeHtml(row.label)}</span>
          <span class="settings-insights__count">${row.count}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-open-settings-category="${escapeHtml(row.category)}">Настроить</button>
        </div>
        ${samples ? `<div class="settings-insights__samples">${samples}</div>` : ''}
      </li>`;
    })
    .join('');
  box.innerHTML = `${summary}${fpLine}<ul class="settings-insights__list">${rows}</ul>`;
}

/**
 * @param {object | null | undefined} preview
 */
export function renderApplyThresholdPreview(preview) {
  const el = document.getElementById('settings-apply-preview');
  if (!el) return;
  if (!preview || preview.totalPending == null) {
    el.textContent = '—';
    return;
  }
  const t = preview.threshold ?? '—';
  if (!preview.totalPending) {
    el.textContent = `Порог ${t}: в очереди пока нет вакансий для серии`;
    return;
  }
  if (!preview.recommended) {
    el.textContent = `Порог ${t}: ни одна вакансия не попадёт в «Авто» — снизьте порог или дождитесь оценки`;
    return;
  }
  el.textContent = `Порог ${t}: в «Авто» попадёт ~${preview.recommended} из ${preview.totalPending} (ещё ${preview.belowThreshold} ниже порога)`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {Record<string, unknown>} patch */
export function getDashboardPrefsExportJson(patch) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      patch,
    },
    null,
    2
  );
}

export function getLetterPrefsFromUI() {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const keys = [
    'batchAutoPrepareLetters',
    'batchLetterRequireMetric',
    'batchAutoApproveBestLetter',
    'batchFalsePositiveMax',
    'learningAutoApplyPatterns',
    'learningAutoApplyMinCount',
  ];
  for (const key of keys) {
    const boolEl = document.querySelector(`[data-pref-bool="${key}"]`);
    if (boolEl instanceof HTMLInputElement) {
      patch[key] = boolEl.checked;
      continue;
    }
    const numEl = document.querySelector(`[data-pref="${key}"]`);
    if (numEl instanceof HTMLInputElement) {
      const n = Number(numEl.value);
      if (Number.isFinite(n)) patch[key] = n;
    }
  }
  return patch;
}

function setSettingsFooterNote(tabId) {
  const note = document.getElementById('settings-footer-tab-note');
  if (!note) return;
  const id = normalizeSettingsTab(tabId);
  const hotkey = SETTINGS_TAB_META[id]?.hotkey;
  const base = TAB_FOOTER_NOTES[id] || TAB_FOOTER_NOTES.apply;
  const layoutPart = window.matchMedia('(max-width: 640px)').matches
    ? ' · Esc — закрыть'
    : SETTINGS_LAYOUT_FOOTER_SUFFIX;
  note.textContent = `${base}${layoutPart}`;
}

/** Сброс темы, масштаба и пресета карточек в браузере. */
export function resetLocalAppearanceVisuals() {
  writeTheme('dark');
  writeUiScale(1);
  applyCardSizePreset('medium');
}

function isEditableSettingsTarget(t) {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return t.isContentEditable;
}

let lettersSnapshotAt = 0;
let lettersSnapshotHtml = '';

/**
 * @param {(path: string) => Promise<unknown>} api
 */
/**
 * @param {(path: string) => Promise<unknown>} api
 */
async function refreshTargetingInsights(api) {
  try {
    const data = await api('/api/targeting/reject-stats');
    renderTargetingInsights(data);
  } catch {
    renderTargetingInsights(null);
  }
  void refreshTargetingPreview(api);
}

/**
 * @param {(path: string) => Promise<unknown>} api
 */
async function refreshTargetingPreview(api) {
  const el = document.getElementById('settings-targeting-preview');
  if (!el) return;
  try {
    const data = await api('/api/settings/targeting-preview');
    if (!data?.ok || data.total == null) {
      el.textContent = '—';
      return;
    }
    if (data.total === 0) {
      el.textContent = 'Очередь пуста — превью появится после harvest или загрузки демо';
      return;
    }
    el.textContent = `Видно ${data.visible} из ${data.total} в очереди; ${data.hiddenByRole} скрыто правилами роли`;
  } catch {
    el.textContent = '—';
  }
}

let applyPreviewTimer = null;
let targetingPreviewTimer = null;

/**
 * @param {(path: string) => Promise<unknown>} api
 */
function scheduleTargetingPreviewRefresh(api) {
  if (targetingPreviewTimer) clearTimeout(targetingPreviewTimer);
  targetingPreviewTimer = setTimeout(() => {
    targetingPreviewTimer = null;
    void refreshTargetingPreview(api);
  }, 350);
}

/**
 * @param {(path: string) => Promise<unknown>} api
 */
function scheduleApplyPreviewRefresh(api) {
  if (applyPreviewTimer) clearTimeout(applyPreviewTimer);
  applyPreviewTimer = setTimeout(() => {
    applyPreviewTimer = null;
    void refreshApplyPreview(api);
  }, 350);
}

/**
 * @param {(path: string) => Promise<unknown>} api
 */
async function refreshApplyPreview(api) {
  const input = document.getElementById('score-threshold-input');
  const n = Number(input?.value);
  const q = Number.isFinite(n) ? `?threshold=${encodeURIComponent(String(n))}` : '';
  try {
    const data = await api(`/api/settings/apply-preview${q}`);
    renderApplyThresholdPreview(data);
  } catch {
    renderApplyThresholdPreview(null);
  }
}

/**
 * @param {(path: string) => Promise<unknown>} api
 */
async function refreshSystemHealth(api) {
  try {
    const data = await api('/api/system-status');
    renderSystemHealthList(data);
  } catch {
    try {
      const data = await api('/api/preferences');
      renderSystemHealthList(data.systemStatus);
    } catch {
      renderSystemHealthList(null);
    }
  }
}

/**
 * @param {(path: string) => Promise<unknown>} api
 * @param {SettingsTabId} tabId
 */
async function refreshLettersSnapshot(api, tabId) {
  if (tabId !== 'letters') return;
  const box = document.getElementById('settings-letters-snapshot');
  if (!box) return;
  const now = Date.now();
  if (lettersSnapshotHtml && now - lettersSnapshotAt < 30_000) {
    box.innerHTML = lettersSnapshotHtml;
    return;
  }
  box.innerHTML = '<p class="settings-snapshot__loading">Загрузка сводки…</p>';
  try {
    const data = await api('/api/cover-letter/quality-hub');
    const gen = data?.metrics?.generate;
    const bl = data?.baseline;
    const gl = data?.golden?.letters;
    const gt = data?.golden?.targeting;
    const parts = [];
    if (gen?.qualityPassRate != null && gen.total > 0) {
      parts.push(`LLM ok ${gen.qualityPassRate}%`);
    }
    if (bl?.letterBatchReadyRate != null) {
      parts.push(`готовность батча ${bl.letterBatchReadyRate}%`);
    }
    if (bl?.falsePositiveRate != null && (bl.falsePositives || 0) > 0) {
      parts.push(`FP ${bl.falsePositiveRate}%`);
    }
    if (gl?.total) {
      parts.push(`golden L ${gl.passed}/${gl.total}${gl.ok === false ? ' ⚠' : ''}`);
    }
    if (gt?.total) {
      parts.push(`T ${gt.passed}/${gt.total}${gt.ok === false ? ' ⚠' : ''}`);
    }
    lettersSnapshotHtml = `<p class="settings-snapshot__line">${
      parts.length ? parts.join(' · ') : 'Сводка по метрикам и golden — данных пока мало'
    }</p>`;
    lettersSnapshotAt = now;
    box.innerHTML = lettersSnapshotHtml;
  } catch {
    box.innerHTML =
      '<p class="settings-snapshot__line settings-snapshot__muted">Сводка недоступна — откройте «Подробнее» в блоке писем</p>';
  }
}

/** @param {SettingsModalDeps} deps */
export function initSettingsModal(deps) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  initSettingsDialogLayout({ showToast: deps.showToast });

  setHintFn = deps.setSettingsHint || null;
  hasCompletedBatchFn = deps.hasCompletedBatch || null;

  const onSettingsKeydown = (e) => {
    if (modal.hidden) return;
    if (isEditableSettingsTarget(e.target)) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      toggleSettingsModalFullscreen();
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tab = SETTINGS_TAB_ORDER.find((id) => SETTINGS_TAB_META[id]?.hotkey === e.key);
    if (!tab) return;
    e.preventDefault();
    deps.setSettingsTab(tab);
  };
  document.addEventListener('keydown', onSettingsKeydown);

  document.querySelectorAll('[data-targeting-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.targetingPreset;
      const preset = id && TARGETING_PRESETS[id];
      if (!preset) return;
      applyPreferencePatchToUI(preset.patch, { silent: true });
      markSettingsDirty();
      deps.scheduleSaveSettings();
      scheduleTargetingPreviewRefresh(deps.api);
    });
  });

  document.getElementById('btn-settings-refresh-health')?.addEventListener('click', () => {
    void refreshSystemHealth(deps.api);
  });

  document.getElementById('btn-settings-refresh-insights')?.addEventListener('click', () => {
    void refreshTargetingInsights(deps.api);
  });

  document.getElementById('btn-settings-export-prefs')?.addEventListener('click', async () => {
    try {
      const data = await deps.api('/api/preferences/export');
      const text = getDashboardPrefsExportJson(data?.patch || {});
      await navigator.clipboard.writeText(text);
      deps.showToast?.('Настройки дашборда скопированы в буфер', 'good');
    } catch (e) {
      deps.showToast?.(e?.message || 'Не удалось экспортировать', 'bad');
    }
  });

  document.getElementById('btn-settings-import-prefs')?.addEventListener('click', async () => {
    let raw = '';
    try {
      raw =
        window.prompt('Вставьте JSON: объект настроек или { "patch": { ... } }', '') || '';
    } catch {
      return;
    }
    if (!raw.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      deps.showToast?.('Некорректный JSON', 'bad');
      return;
    }
    if (!window.confirm('Применить импортированные настройки? Текущие значения по ключам будут перезаписаны.')) {
      return;
    }
    try {
      const res = await deps.api('/api/preferences/import', {
        method: 'POST',
        body: JSON.stringify(parsed?.patch ? parsed : { patch: parsed }),
      });
      deps.applyPreferencesResponse?.(res);
      markSettingsSaved();
      const backup = res?.backupPath ? ` · бэкап: ${res.backupPath}` : '';
      deps.showToast?.(`Импорт применён${backup}`, 'good');
      void refreshTargetingInsights(deps.api);
    } catch (e) {
      deps.showToast?.(e?.message || 'Ошибка импорта', 'bad');
    }
  });

  document.querySelectorAll('[data-letter-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.letterPreset;
      const preset = id && LETTER_QUALITY_PRESETS[id];
      if (!preset) return;
      applyPreferencePatchToUI(preset.patch, { silent: true });
      markSettingsDirty();
      deps.scheduleSaveSettings();
      invalidateLettersSnapshot();
    });
  });

  document.getElementById('btn-settings-revert-tab')?.addEventListener('click', () => {
    if (revertActiveSettingsTab()) {
      deps.showToast?.('Изменения на вкладке отменены', 'neutral');
    }
  });

  document.getElementById('btn-settings-reset-section')?.addEventListener('click', () => {
    const activeBtn = modal.querySelector('.settings-tabs__btn.active');
    const tab = normalizeSettingsTab(activeBtn?.dataset.settingsTab || 'apply');
    if (tab === 'appearance') {
      deps.resetAppearanceSection?.();
      return;
    }
    const defaults = SETTINGS_SECTION_DEFAULTS[tab];
    if (!defaults) return;
    applyPreferencePatchToUI(defaults, { silent: true });
    markSettingsDirty();
    deps.scheduleSaveSettings();
    invalidateLettersSnapshot();
  });

  document.getElementById('btn-settings-save-now')?.addEventListener('click', () => {
    deps.flushSaveSettings?.();
  });

  document.getElementById('btn-settings-open-letter-hub')?.addEventListener('click', () => {
    deps.openLetterQualityHubModal?.();
  });

  document.getElementById('btn-settings-refresh-snapshot')?.addEventListener('click', () => {
    invalidateLettersSnapshot();
    void refreshLettersSnapshot(deps.api, 'letters');
  });

  document.getElementById('btn-settings-copy-letter-prefs')?.addEventListener('click', async () => {
    const text = JSON.stringify(getLetterPrefsFromUI(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      deps.showToast?.('Параметры писем скопированы в буфер', 'good');
    } catch {
      deps.showToast?.('Не удалось скопировать — выделите вручную', 'bad');
    }
  });

  document.getElementById('btn-settings-import-letter-prefs')?.addEventListener('click', async () => {
    let raw = '';
    try {
      raw = window.prompt('Вставьте JSON параметров писем (ключи batch*/learning*)', '') || '';
    } catch {
      return;
    }
    if (!raw.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      deps.showToast?.('Некорректный JSON', 'bad');
      return;
    }
    const patch = parsed?.patch && typeof parsed.patch === 'object' ? parsed.patch : parsed;
    if (!patch || typeof patch !== 'object') {
      deps.showToast?.('Ожидается объект настроек', 'bad');
      return;
    }
    applyPreferencePatchToUI(patch, { silent: true });
    markSettingsDirty('letters');
    deps.scheduleSaveSettings();
    invalidateLettersSnapshot();
    deps.showToast?.('Параметры писем применены — сохраните настройки', 'good');
  });

  document.getElementById('btn-settings-reset-appearance-full')?.addEventListener('click', () => {
    deps.resetAppearanceSection?.({ includeLocalVisual: true });
  });

  document.getElementById('btn-settings-reset-visual')?.addEventListener('click', () => {
    if (
      !window.confirm(
        'Сбросить тему (тёмная), масштаб 100% и пресет карточек «Средний» в этом браузере?'
      )
    ) {
      return;
    }
    resetLocalAppearanceVisuals();
    deps.showToast?.('Тема и масштаб сброшены', 'good');
  });

  modal.querySelectorAll('[data-settings-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-settings-jump');
      if (!target) return;
      const tab =
        target.includes('letters') || target.includes('batch-false') || target.includes('prepare')
          ? 'letters'
          : target.includes('layout') || target.includes('filter')
            ? 'appearance'
            : target.includes('playwright') || target.includes('profile')
              ? 'system'
              : target.includes('targeting') ||
                  target.includes('remote-card') ||
                  target.includes('require-remote') ||
                  target.includes('min-monthly')
                ? 'targeting'
                : 'apply';
      deps.setSettingsTab(tab);
      focusSettingsField(target);
    });
  });

  document.getElementById('btn-settings-open-service')?.addEventListener('click', () => {
    deps.openServiceFromSettings?.();
  });

  function runSettingsQuickPath(pathId) {
    const path = pathId && SETTINGS_QUICK_PATHS[pathId];
    if (!path) return;
    deps.setSettingsTab(path.tab);
    if (path.layout) applySettingsLayoutPreset(path.layout, { toast: false });
    focusSettingsField(path.focus);
  }

  document.getElementById('btn-settings-focus-layout-bar')?.addEventListener('click', () => {
    focusSettingsLayoutBar();
  });

  modal.querySelectorAll('[data-settings-path]').forEach((btn) => {
    btn.addEventListener('click', () => runSettingsQuickPath(btn.getAttribute('data-settings-path')));
  });

  document.getElementById('btn-settings-dismiss-hub')?.addEventListener('click', () => {
    try {
      localStorage.setItem('hh-settings-hub-dismissed', '1');
    } catch {
      /* ignore */
    }
    const box = document.getElementById('settings-hub-guide');
    if (box) box.hidden = true;
  });

  document.getElementById('settings-system-health-list')?.addEventListener('click', (e) => {
    const li = e.target.closest('[data-health-jump]');
    if (!li) return;
    const jump = HEALTH_JUMP[li.dataset.healthJump || ''];
    if (!jump) return;
    deps.setSettingsTab(jump.tab);
    focusSettingsField(jump.focus);
    if (li.dataset.healthJump === 'llm') {
      deps.showToast?.('Ключ LLM: config/secrets.local.env — см. CONFIG-GUIDE', 'neutral');
    }
    if (li.dataset.healthJump === 'session') {
      deps.showToast?.('В терминале: npm run login', 'neutral');
    }
  });

  document.getElementById('btn-settings-dismiss-onboarding')?.addEventListener('click', () => {
    try {
      localStorage.setItem('hh-settings-letters-onboarding-dismissed', '1');
    } catch {
      /* ignore */
    }
    const box = document.getElementById('settings-letters-onboarding');
    if (box) box.hidden = true;
  });

  document.getElementById('learning-auto-apply')?.addEventListener('change', () => {
    syncLearningMinVisibility();
    updateSettingsLetterWarnings();
    markSettingsDirty();
  });

  for (const el of modal.querySelectorAll('[data-pref], [data-pref-bool], [data-pref-select]')) {
    el.addEventListener('input', () => {
      markSettingsDirty(el);
      updateSettingsSummaryFromUI();
      updateSettingsLetterWarnings();
      updateSettingsRemoteWarnings();
      highlightActiveLetterPreset();
      highlightActiveTargetingPreset();
    });
    el.addEventListener('change', () => {
      markSettingsDirty(el);
      updateSettingsSummaryFromUI();
      updateSettingsLetterWarnings();
      updateSettingsRemoteWarnings();
      highlightActiveLetterPreset();
      highlightActiveTargetingPreset();
    });
  }

  const tablist = modal.querySelector('.settings-tabs');
  tablist?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...modal.querySelectorAll('[data-settings-tab]')];
    const idx = tabs.findIndex((b) => b.classList.contains('active'));
    if (idx < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    const id = tabs[next]?.dataset.settingsTab;
    if (id) deps.setSettingsTab(id);
  });

  const profileSel = document.getElementById('settings-profile-select');
  profileSel?.addEventListener('change', () => updateSettingsSummaryFromUI());

  for (const [fieldId, tip] of Object.entries(SETTINGS_FIELD_TIPS)) {
    const field = document.getElementById(fieldId);
    const host = field?.closest('.settings-field');
    if (!host || host.querySelector('.settings-field-tip')) continue;
    const p = document.createElement('p');
    p.className = 'settings-field-tip';
    p.textContent = tip;
    host.appendChild(p);
  }

  syncLearningMinVisibility();
  syncOnboardingBanner();
  syncHubGuideBanner();
  highlightActiveLetterPreset();
  highlightActiveTargetingPreset();
  updateSettingsRemoteWarnings();

  return {
    onTabChange(tabId) {
      const id = normalizeSettingsTab(tabId);
      onSettingsTabActivated(id);
      setSettingsFooterNote(id);
      syncSettingsTabDirtyIndicator();
      if (id === 'system') void refreshSystemHealth(deps.api);
      if (id === 'targeting') void refreshTargetingInsights(deps.api);
      if (id === 'apply') void refreshApplyPreview(deps.api);
      void refreshLettersSnapshot(deps.api, id);
    },
    onOpen(tabId) {
      const id = normalizeSettingsTab(tabId);
      syncSettingsDialogLayoutOnOpen();
      syncSettingsLayoutPresetUi();
      setSettingsFooterNote(id);
      updateSettingsSummaryFromUI();
      updateSettingsLetterWarnings();
      updateSettingsRemoteWarnings();
      highlightActiveLetterPreset();
      highlightActiveTargetingPreset();
      syncOnboardingBanner();
      syncHubGuideBanner();
      if (id === 'system') void refreshSystemHealth(deps.api);
      if (id === 'targeting') void refreshTargetingInsights(deps.api);
      if (id === 'apply') void refreshApplyPreview(deps.api);
      void refreshLettersSnapshot(deps.api, id);
      deps.onOpen?.(id);
    },
    renderSystemHealth(status) {
      renderSystemHealthList(status);
    },
    syncDerivedState: syncSettingsDerivedState,
    afterPreferencesLoaded() {
      saveState.dirty = false;
      saveState.dirtyTabs.clear();
      saveState.saving = 0;
      refreshSettingsTabBaselines();
      syncSettingsSaveUi();
      syncSettingsDerivedState();
    },
  };

  const thresholdInput = document.getElementById('score-threshold-input');
  thresholdInput?.addEventListener('input', () => scheduleApplyPreviewRefresh(deps.api));
  thresholdInput?.addEventListener('change', () => scheduleApplyPreviewRefresh(deps.api));
}

/**
 * @param {string} focusId
 */
export function focusSettingsField(focusId) {
  const raw = String(focusId || '').trim();
  if (raw === 'settings-layout-bar') {
    focusSettingsLayoutBar();
    return;
  }
  const id = resolveFocusElementId(focusId);
  if (!id) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const input = el?.querySelector?.('input, select, textarea, button');
    if (input instanceof HTMLElement && typeof input.focus === 'function') {
      input.focus({ preventScroll: true });
    }
  });
}
