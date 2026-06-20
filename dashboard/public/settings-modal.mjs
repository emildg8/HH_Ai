/**
 * Логика модалки «Настройки»: вкладки, пресеты, сводка, dirty-state, deep link.
 */

import { writeTheme } from './ui-theme.mjs';
import { writeUiScale } from './ui-scale.mjs';
import { applyCardSizePreset } from './ui-card-tuning.mjs';
import {
  SETTINGS_SECTION_LEADS,
  PLAYWRIGHT_MODE_LABELS,
  localizeHealthLabel,
} from './dashboard-settings-copy-ru.mjs';
import {
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
  runWithSuppressedSettingsSizePersist,
  runWithStableSettingsDialogLayout,
  lockBodyScrollForSettings,
  unlockBodyScrollForSettings,
  getSettingsDialogEl,
} from './settings-modal-layout.mjs';
import {
  dispatchOpenSettingsForCategory,
  settingsNavForRejectCategory,
} from './settings-targeting-nav.mjs';
import {
  readSettingsPatchFromHub,
  filterSettingsSearch,
  fillCopilotDeviceSelects,
  hydrateSettingsHub,
  expandDotPatch,
} from './settings-hub.mjs';

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

/** @typedef {'system'|'harvest'|'targeting'|'apply'|'letters'|'teleprompter'|'appearance'|'services'|'expert'} SettingsTabId */

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
 *   onScoreThresholdChange?: (value: number) => void,
 * }} SettingsModalDeps
 */

/** @type {SettingsTabId[]} */
export const SETTINGS_TAB_ORDER = [
  'system',
  'harvest',
  'targeting',
  'apply',
  'letters',
  'teleprompter',
  'appearance',
  'services',
  'expert',
];

/** @type {Record<string, SettingsTabId>} */
const TAB_ALIASES = {
  system: 'system',
  profile: 'system',
  playwright: 'system',
  browser: 'system',
  harvest: 'harvest',
  ingest: 'harvest',
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
  teleprompter: 'teleprompter',
  copilot: 'teleprompter',
  суфлер: 'teleprompter',
  appearance: 'appearance',
  list: 'appearance',
  ui: 'appearance',
  services: 'services',
  telegram: 'services',
  service: 'services',
  expert: 'expert',
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
  presets: 'settings-letters-group',
  playwright: 'settings-playwright-mode',
  targeting: 'settings-targeting-salary',
  'require-remote': 'pref-require-remote',
  'min-monthly': 'pref-min-monthly-rub',
  'exclude-senior': 'pref-exclude-senior',
  'exclude-dev': 'pref-exclude-dev',
  'exclude-irrelevant': 'pref-exclude-irrelevant',
  insights: 'settings-targeting-insights',
  window: 'settings-layout-presets-group',
  copilot: 'settings-copilot-group',
  mic: 'settings-copilot-mic',
  wasapi: 'settings-copilot-wasapi',
};

/** Пресеты качества писем / батча (патч preferences). */
export const LETTER_QUALITY_PRESETS = {
  standard: {
    label: 'Стандарт',
    hint: 'Подготовка писем перед серией, контроль ложных отказов до 20',
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
    label: 'Строгий',
    hint: 'Цифры в письме обязательны, авто-утверждение — меньше слабых откликов',
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
    hint: 'Подготовка без жёстких ограничений, обучение из «Неподходит»',
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
    hint: 'Без автоподготовки — правка писем вручную',
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

/** Пресеты конверсии (подгружаются из GET /api/settings). */
/** @type {Record<string, { label?: string, hint?: string, patch: Record<string, unknown> }>} */
let conversionPresetsById = {};

export function setConversionPresetsFromApi(presets) {
  conversionPresetsById = {};
  for (const p of presets || []) {
    if (p?.id) conversionPresetsById[p.id] = p;
  }
  highlightActiveConversionPreset();
  updateConversionPresetHint();
}

function getConversionPatchFromUI() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return {};
  const hub = readSettingsPatchFromHub(modal);
  return {
    ...hub,
    dashboardMinScoreFilter: Number(document.querySelector('[data-pref="dashboardMinScoreFilter"]')?.value),
    batchLetterMinScore10: Number(document.querySelector('[data-setting="batchLetterMinScore10"]')?.value),
    minKeywordGapScore: Number(document.querySelector('[data-setting="minKeywordGapScore"]')?.value),
  };
}

function conversionPresetMatches(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (k.includes('.')) {
      const parts = k.split('.');
      let cur = a;
      for (const p of parts) cur = cur?.[p];
      if (cur !== v) return false;
    } else if (a[k] !== v) return false;
  }
  return true;
}

function highlightActiveConversionPreset() {
  const patch = getConversionPatchFromUI();
  let active = '';
  for (const [id, preset] of Object.entries(conversionPresetsById)) {
    if (conversionPresetMatches(patch, preset.patch)) active = id;
  }
  document.querySelectorAll('[data-conversion-preset]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const on = btn.dataset.conversionPreset === active;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  updateConversionPresetHint();
}

function updateConversionPresetHint() {
  const el = document.getElementById('settings-conversion-preset-hint');
  if (!el) return;
  const patch = getConversionPatchFromUI();
  let active = '';
  for (const [id, preset] of Object.entries(conversionPresetsById)) {
    if (conversionPresetMatches(patch, preset.patch)) active = id;
  }
  const preset = active && conversionPresetsById[active];
  el.textContent = preset?.hint || 'Настройте gate вручную или выберите пресет';
}

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
    batchLetterMinScore10: 7,
    batchLetterMaxAiScore: 35,
    letterHumanizeTwoPass: true,
  },
  harvest: {
    ingestMaxTierCPerDay: 80,
    marketSkillsEnabled: false,
  },
  teleprompter: {
    interviewCopilot: {
      eyeContact: 'on',
      eyeContactRemind: true,
      dockPreset: 'above-meeting',
      liveBarMaxLines: 2,
      liveFontSize: 26,
      scriptOnlyOverlay: true,
      listenMic: true,
      learnFromSpoken: true,
      interviewStage: 'tech',
      wasapiDevice: 'default',
      micDevice: '',
      answerFormat: 'scaffold',
    },
  },
  expert: {
    remotePositivePatterns: [],
    hybridPatterns: [],
    officeOnlyPatterns: [],
    excludeSeniorRolePatterns: [],
    exclude1CRolePatterns: [],
    excludeDeveloperRolePatterns: [],
    excludeIrrelevantTitlePatterns: [],
  },
};

/** Быстрые сценарии (deep link / палитра). */
export const SETTINGS_QUICK_PATHS = {
  batch: { tab: 'letters', focus: 'settings-letters-group', layout: 'wide' },
  'off-target': { tab: 'targeting', focus: 'settings-targeting-insights', layout: 'wide' },
  limits: { tab: 'apply', focus: 'settings-limits-hh', layout: 'compact' },
  profile: { tab: 'system', focus: 'settings-profile-card' },
  copilot: { tab: 'teleprompter', focus: 'settings-copilot-group', layout: 'wide' },
  'interview-prep': { tab: 'teleprompter', focus: 'settings-copilot-presets-banner', layout: 'wide' },
};

/** Пресеты суфлёра перед собеседованием. */
export const COPILOT_SESSION_PRESETS = {
  screening: {
    label: 'HR-скрининг',
    patch: {
      'interviewCopilot.interviewStage': 'screening',
      'interviewCopilot.answerFormat': 'scaffold',
      'interviewCopilot.eyeContact': 'on',
      'interviewCopilot.scriptOnlyOverlay': true,
    },
  },
  hr: {
    label: 'Собеседование с HR',
    patch: {
      'interviewCopilot.interviewStage': 'hr',
      'interviewCopilot.answerFormat': 'scaffold',
      'interviewCopilot.eyeContact': 'on',
    },
  },
  tech: {
    label: 'Техничка',
    patch: {
      'interviewCopilot.interviewStage': 'tech',
      'interviewCopilot.answerFormat': 'scaffold',
      'interviewCopilot.scriptOnlyOverlay': true,
      'interviewCopilot.liveBarMaxLines': 2,
    },
  },
  negotiation: {
    label: 'Переговоры',
    patch: {
      'interviewCopilot.interviewStage': 'negotiation',
      'interviewCopilot.answerFormat': 'full',
      'interviewCopilot.scriptOnlyOverlay': false,
    },
  },
  final: {
    label: 'Финал',
    patch: {
      'interviewCopilot.interviewStage': 'final',
      'interviewCopilot.answerFormat': 'scaffold',
      'interviewCopilot.liveBarMaxLines': 2,
    },
  },
};

const PLAYWRIGHT_MODE_LABELS_UI = PLAYWRIGHT_MODE_LABELS;

/** Пресеты таргетинга (patch preferences). */
export const TARGETING_PRESETS = {
  balanced: {
    label: 'Сбалансированный',
    hint: 'Гибрид и офис Москва разрешены, руководители/1С/разработчики исключаются',
    patch: {
      ...SETTINGS_SECTION_DEFAULTS.targeting,
      batchRequireRemote: false,
    },
  },
  conservative: {
    label: 'Консервативный',
    hint: 'Только удалёнка, без гибрида и офиса, строгая серия',
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
    hint: 'Без глобальной удалёнки, мягче исключения ролей',
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

/** Мета вкладок: горячие клавиши Alt+1…9. */
export const SETTINGS_TAB_META = {
  system: { label: 'Профиль и система', hotkey: '1' },
  harvest: { label: 'Поиск вакансий', hotkey: '2' },
  targeting: { label: 'Кого берём', hotkey: '3' },
  apply: { label: 'Серия откликов', hotkey: '4' },
  letters: { label: 'Письма', hotkey: '5' },
  teleprompter: { label: 'На собеседовании', hotkey: '6' },
  appearance: { label: 'Внешний вид', hotkey: '7' },
  services: { label: 'Сервисы и ИИ', hotkey: '8' },
  expert: { label: 'Тонкая настройка', hotkey: '9' },
};

/** Подсказки под полями. */
export const SETTINGS_FIELD_TIPS = {
  'batch-limit': 'Сколько вакансий за один запуск серии',
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
  const active = document.querySelector('.settings-nav__btn.active');
  return normalizeSettingsTab(active?.dataset?.settingsTab || 'system');
}

/** @type {((text: string, variant?: string) => void) | null} */
let setHintFn = null;

/** @type {((msg: string, kind?: string) => void) | null} */
let showToastFn = null;

/** @param {string} tabId */
export function normalizeSettingsTab(tabId) {
  const t = String(tabId || 'system').trim().toLowerCase();
  if (TAB_ALIASES[t]) return TAB_ALIASES[t];
  if (SETTINGS_TAB_ORDER.includes(/** @type {SettingsTabId} */ (t))) return /** @type {SettingsTabId} */ (t);
  return 'system';
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
  const active = document.querySelector('.settings-nav__btn.active');
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
  return readSettingsPatchFromHub(document.getElementById('settings-panel-system') || document);
}

function getHarvestPrefsFromUI() {
  return readSettingsPatchFromHub(document.getElementById('settings-panel-harvest') || document);
}

function getTeleprompterPrefsFromUI() {
  return readSettingsPatchFromHub(document.getElementById('settings-panel-teleprompter') || document);
}

function getExpertPrefsFromUI() {
  return readSettingsPatchFromHub(document.getElementById('settings-panel-expert') || document);
}

function getApplyPrefsFromUI() {
  return readSettingsPatchFromHub(document.getElementById('settings-panel-apply') || document);
}

/** @param {SettingsTabId} tabId */
function captureTabBaseline(tabId) {
  if (tabId === 'appearance') return;
  if (tabId === 'apply') {
    tabBaselines.set('apply', structuredClone(getApplyPrefsFromUI()));
    return;
  }
  if (tabId === 'letters') {
    tabBaselines.set('letters', structuredClone(getLetterPrefsFromUI()));
    return;
  }
  const getter =
    tabId === 'system'
      ? getSystemPrefsFromUI
      : tabId === 'harvest'
        ? getHarvestPrefsFromUI
        : tabId === 'targeting'
          ? getTargetingPrefsFromUI
          : tabId === 'teleprompter'
            ? getTeleprompterPrefsFromUI
            : tabId === 'expert'
              ? getExpertPrefsFromUI
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
  modal.querySelectorAll('.settings-nav__btn').forEach((btn) => {
    const tab = normalizeSettingsTab(btn.dataset.settingsTab || '');
    btn.classList.toggle('settings-nav__btn--dirty', saveState.dirtyTabs.has(tab));
  });
  const active = modal.querySelector('.settings-nav__btn.active');
  const activeTab = normalizeSettingsTab(active?.dataset?.settingsTab || 'system');
  const revertBtn = document.getElementById('btn-settings-revert-tab');
  if (revertBtn instanceof HTMLButtonElement) {
    const canRevert = saveState.dirtyTabs.has(activeTab) && activeTab !== 'appearance';
    revertBtn.hidden = !canRevert;
    revertBtn.disabled = saveState.saving > 0;
  }
}

function syncSettingsSaveUi() {
  const dlg = getSettingsDialogEl();
  dlg?.classList.toggle('settings-dialog--dirty', saveState.dirty);
  dlg?.classList.toggle('settings-dialog--saving', saveState.saving > 0);
  syncSettingsTabDirtyIndicator();
  const saveNow = document.getElementById('btn-settings-save-now');
  if (saveNow instanceof HTMLButtonElement) {
    saveNow.disabled = saveState.saving > 0;
    saveNow.hidden = !saveState.dirty;
  }
  if (!setHintFn) return;
  if (saveState.saving > 0) {
    setHintFn('Сохранение…', 'pending');
    return;
  }
  if (saveState.dirty) {
    setHintFn('Есть несохранённые изменения', 'pending');
    return;
  }
  const hintEl = document.getElementById('settings-save-hint');
  if (hintEl?.classList.contains('settings-hint--saved')) return;
  setHintFn('Изменения сохраняются автоматически');
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
  highlightActiveCopilotPreset();
  highlightActiveConversionPreset();
  updateSettingsSummaryFromUI();
}

/**
 * @param {Record<string, unknown>} patch
 * @param {{ silent?: boolean }} [opts]
 */
export function applyPreferencePatchToUI(patch, opts = {}) {
  const modal = document.getElementById('settings-modal');
  const hasDot = Object.keys(patch).some((k) => k.includes('.'));
  const nested = hasDot ? expandDotPatch(patch) : { ...patch };
  hydrateSettingsHub(modal || document, nested);
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('.')) continue;
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
  if (opts.skipDerived) {
    highlightActiveConversionPreset();
    return;
  }
  updateSettingsLetterWarnings();
  updateSettingsRemoteWarnings();
  updateSettingsPresetHint();
  updateSettingsSummaryFromUI();
  highlightActiveLetterPreset();
  highlightActiveTargetingPreset();
  highlightActiveCopilotPreset();
  highlightActiveConversionPreset();
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
  const pw = PLAYWRIGHT_MODE_LABELS_UI[String(p.dashboardPlaywrightDisplayMode || '')];
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
export function updateSettingsSectionLead(tabId) {
  const id = normalizeSettingsTab(tabId);
  const lead = SETTINGS_SECTION_LEADS[id] || SETTINGS_SECTION_LEADS.system;
  const el = document.getElementById(`settings-section-lead-${id}`);
  if (el) el.textContent = lead;
}

export function updateSettingsSummaryFromPrefs() {
  /* chips убраны в v5 */
}

export function updateSettingsSummaryFromUI() {
  const active = document.querySelector('.settings-nav__btn.active');
  const tab = normalizeSettingsTab(active?.dataset?.settingsTab || 'system');
  updateSettingsSectionLead(tab);
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
  const simple = document.querySelector('.workspace-shell')?.dataset.uiMode !== 'expert';
  if (!items.length) {
    list.innerHTML = '<li class="settings-health-pill settings-health-pill--muted">Нет данных</li>';
    return;
  }
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      const tone = item.tone || 'muted';
      li.className = `settings-health-pill settings-health-pill--${tone}`;
      const label = localizeHealthLabel(item.label, { simple });
      li.textContent = label;
      li.title = item.label !== label ? item.label : '';
      if (tone === 'warn' && item.id && HEALTH_JUMP[item.id]) {
        li.classList.add('settings-health-pill--warn');
        li.title = li.title || 'Нажмите — подсказка в разделе «Профиль»';
        li.dataset.healthJump = item.id;
      }
      return li;
    })
  );
}

/**
 * @param {(path: string, opts?: object) => Promise<unknown>} api
 */
export async function refreshCopilotHealthPills(api) {
  const list = document.getElementById('settings-copilot-health');
  if (!list) return;
  /** @type {Array<{ label: string, tone: string }>} */
  const pills = [];
  /** @type {{ ffmpeg?: boolean, wasapi?: Array<{id:string,label:string}>, mic?: Array<{id:string,label:string}> }} */
  let data = {
    ffmpeg: false,
    wasapi: [{ id: 'default', label: 'По умолчанию (системный звук)' }],
    mic: [],
  };
  try {
    data = await api('/api/copilot/audio-devices');
  } catch {
    pills.push({
      label: 'Список устройств недоступен — укажите вручную или npm run devops:copilot-devices',
      tone: 'warn',
    });
  }
  fillCopilotDeviceSelects(data);
  pills.push({
    label: data.ffmpeg ? 'Захват звука: готов' : 'Нужен ffmpeg в PATH',
    tone: data.ffmpeg ? 'ok' : 'warn',
  });
  const micEl = document.getElementById('settings-mic-select');
  const micManual = document.getElementById('settings-mic-manual');
  const mic =
    micManual instanceof HTMLInputElement && !micManual.hidden && micManual.value
      ? String(micManual.value).trim()
      : micEl instanceof HTMLSelectElement
        ? String(micEl.value || '').trim()
        : '';
  pills.push({
    label: mic ? 'Микрофон выбран' : 'Укажите микрофон или отключите прослушивание',
    tone: mic ? 'ok' : 'warn',
  });
  pills.push({ label: 'Desktop — для подсказки поверх созвона', tone: 'muted' });
  list.replaceChildren(
    ...pills.map((p) => {
      const li = document.createElement('li');
      li.className = `settings-health-pill settings-health-pill--${p.tone}`;
      li.textContent = p.label;
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
      text: 'Серия строже очереди: вакансия может быть в списке, но серия её пропустит без явной удалёнки.',
    });
  }
  if (globalRemote && !batchRemote) {
    warnings.push({
      level: 'info',
      text: 'Глобальная удалёнка уже отсекает офис и гибрид при сборе; серия может брать всё из очереди.',
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
      text: 'Строгий режим: серия пропустит слабые письма и может утвердить лучший вариант после генерации.',
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

function syncProfileTipBanner() {
  const box = document.getElementById('settings-profile-tip');
  if (!box) return;
  try {
    if (localStorage.getItem('hh-settings-profile-tip-dismissed') === '1') {
      box.hidden = true;
      return;
    }
  } catch {
    /* ignore */
  }
  box.hidden = false;
}

function highlightActiveCopilotPreset() {
  const full = readSettingsPatchFromHub(document.getElementById('settings-panel-teleprompter') || document);
  const ic = full.interviewCopilot || {};
  let active = '';
  for (const [id, preset] of Object.entries(COPILOT_SESSION_PRESETS)) {
    const nested = expandDotPatch(preset.patch);
    const want = nested.interviewCopilot || {};
    let ok = Object.keys(want).length > 0;
    for (const [k, v] of Object.entries(want)) {
      if (ic[k] !== v) {
        ok = false;
        break;
      }
    }
    if (ok) active = id;
  }
  document.querySelectorAll('[data-copilot-preset]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const on = btn.dataset.copilotPreset === active;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
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
      const cat = catBtn.getAttribute('data-open-settings-category') || '';
      const nav = settingsNavForRejectCategory(cat);
      if (nav.noFocus) {
        showToastFn?.(nav.hint || 'Для этой категории нет отдельного переключателя', 'neutral');
        return;
      }
      dispatchOpenSettingsForCategory(cat);
      return;
    }
    if (e.target.closest('[data-insights-open-fp]')) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('hh-open-settings', {
          detail: {
            tab: 'apply',
            focus: 'fp',
            focusToast: 'Открыто: порог ложных отказов',
          },
        })
      );
    }
  });
  insightsDelegationBound = true;
}

/** @type {Record<string, string>} */
const INSIGHT_CATEGORY_LABELS = {
  'off-target-l1': 'Поддержка L1',
  'off-target-sales': 'Продажи и presale',
  'off-target-network': 'Сетевой инженер',
  'off-target-industrial': 'Промышленная автоматика',
  'off-target-blue-collar': 'Рабочие специальности',
  'off-target-analyst': 'Аналитик вне профиля',
  'off-target-qa': 'Тестирование вне профиля',
  'off-target-dev': 'Разработчик вне профиля',
  'no-it-profile': 'Нет IT-профиля',
  senior: 'Senior / lead',
  irrelevant: 'Нецелевая роль',
};

function insightCategoryLabel(row) {
  const cat = String(row?.category || '').trim();
  const raw = String(row?.label || '').trim();
  if (INSIGHT_CATEGORY_LABELS[cat]) return INSIGHT_CATEGORY_LABELS[cat];
  if (/^off-target/i.test(raw) || /^off-target/i.test(cat)) {
    return raw.replace(/^off-target[-\s]*/i, '').replace(/-/g, ' ') || 'Вне профиля';
  }
  return raw || cat || 'Другое';
}

function truncateInsightTitle(title, max = 72) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * @param {object | null | undefined} stats
 */
export function renderTargetingInsights(stats) {
  const box = document.getElementById('settings-targeting-insights-body');
  if (!box) return;
  bindInsightsDelegation();
  const summary = stats?.totalIneligible
    ? `<p class="settings-insights__meta">Вне профиля в очереди: <strong>${stats.totalIneligible}</strong> · отклонено: ${stats.totalRejected ?? 0}</p>`
    : '';
  if (!stats?.topCategories?.length) {
    box.innerHTML = `${summary}<p class="settings-snapshot__muted">Мало отсечений — статистика появится после сбора вакансий</p>`;
    return;
  }
  const fp = stats.falsePositives;
  const fpLine =
    fp?.total > 0
      ? `<p class="settings-insights__fp">В «Неподходит» есть ${fp.total} подходящих (${fp.rate}% от всех отклонённых) — <button type="button" class="settings-insights__action" data-insights-open-fp">Перейти к порогу ложных отказов</button></p>`
      : '';
  const rows = stats.topCategories
    .map((row) => {
      const samplesText = (row.samples || [])
        .slice(0, 2)
        .map((s) => truncateInsightTitle(s.title))
        .join(' · ');
      const label = insightCategoryLabel(row);
      const nav = settingsNavForRejectCategory(row.category);
      const actionLabel = nav.actionLabel || nav.hint || '→ Исключения';
      const actionBtn = nav.noFocus
        ? ''
        : `<button type="button" class="settings-insights__action" data-open-settings-category="${escapeHtml(row.category)}">${escapeHtml(actionLabel)}</button>`;
      return `<li class="settings-insights__row">
        <div class="settings-insights__head">
          <span class="settings-insights__label">${escapeHtml(label)}</span>
          <span class="settings-insights__count">${row.count}</span>
          ${actionBtn}
        </div>
        ${samplesText ? `<p class="settings-insights__samples">${escapeHtml(samplesText)}</p>` : ''}
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
  return readSettingsPatchFromHub(document.getElementById('settings-panel-letters') || document);
}

function onSettingsSectionActivated(tabId) {
  updateSettingsSectionLead(tabId);
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
      el.textContent = 'Очередь пуста — превью появится после сбора или загрузки демо';
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
  if (normalizeSettingsTab(tabId) !== 'letters') return;
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
      parts.push({ label: 'ИИ', value: `${gen.qualityPassRate}% ок` });
    }
    if (bl?.letterBatchReadyRate != null) {
      parts.push({ label: 'Готовность', value: `${bl.letterBatchReadyRate}%` });
    }
    if (bl?.falsePositiveRate != null && (bl.falsePositives || 0) > 0) {
      parts.push({ label: 'Ложные отказы', value: `${bl.falsePositiveRate}%` });
    }
    if (gl?.total) {
      parts.push({
        label: 'Эталон писем',
        value: `${gl.passed}/${gl.total}${gl.ok === false ? ' ⚠' : ''}`,
      });
    }
    if (gt?.total) {
      parts.push({
        label: 'Эталон отбора',
        value: `${gt.passed}/${gt.total}${gt.ok === false ? ' ⚠' : ''}`,
      });
    }
    lettersSnapshotHtml =
      parts.length > 0
        ? `<div class="settings-kpi-mini">${parts
            .map(
              (p) =>
                `<div class="settings-kpi-mini__item"><span class="settings-kpi-mini__label">${escapeHtml(p.label)}</span><span class="settings-kpi-mini__value">${escapeHtml(p.value)}</span></div>`
            )
            .join('')}</div>`
        : '<p class="settings-snapshot__muted">Данных пока мало — запустите серию с письмами</p>';
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
  showToastFn = deps.showToast || null;
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

  document.getElementById('btn-settings-import-prefs')?.addEventListener('click', () => {
    const panel = document.getElementById('settings-import-panel');
    const textarea = document.getElementById('settings-import-textarea');
    if (panel) panel.hidden = false;
    if (textarea instanceof HTMLTextAreaElement) textarea.focus();
  });

  document.getElementById('btn-settings-import-cancel')?.addEventListener('click', () => {
    const panel = document.getElementById('settings-import-panel');
    const textarea = document.getElementById('settings-import-textarea');
    if (panel) panel.hidden = true;
    if (textarea instanceof HTMLTextAreaElement) textarea.value = '';
  });

  document.getElementById('btn-settings-import-apply')?.addEventListener('click', async () => {
    const textarea = document.getElementById('settings-import-textarea');
    const raw = textarea instanceof HTMLTextAreaElement ? textarea.value.trim() : '';
    if (!raw) {
      deps.showToast?.('Вставьте JSON настроек', 'bad');
      return;
    }
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
      document.getElementById('settings-import-panel')?.setAttribute('hidden', '');
      if (textarea instanceof HTMLTextAreaElement) textarea.value = '';
      const backup = res?.backupPath ? ` · Резервная копия: ${res.backupPath}` : '';
      deps.showToast?.(`Импорт применён${backup}`, 'good');
      void refreshTargetingInsights(deps.api);
    } catch (e) {
      deps.showToast?.(e?.message || 'Ошибка импорта', 'bad');
    }
  });

  document.querySelectorAll('[data-copilot-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.copilotPreset;
      const preset = id && COPILOT_SESSION_PRESETS[id];
      if (!preset) return;
      if (saveState.dirty && !window.confirm('Применить сценарий? Несохранённые изменения на вкладке останутся в полях.')) {
        return;
      }
      applyPreferencePatchToUI(preset.patch, { silent: true });
      document.querySelectorAll('[data-copilot-preset]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      markSettingsDirty('teleprompter');
      deps.scheduleSaveSettings();
    });
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

  document.querySelectorAll('[data-conversion-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.conversionPreset;
      const preset = id && conversionPresetsById[id];
      if (!preset?.patch) return;
      runWithStableSettingsDialogLayout(() => {
        applyPreferencePatchToUI(preset.patch, { silent: true, skipDerived: true });
      });
      markSettingsDirty('apply');
      deps.scheduleSaveSettings();
    });
  });

  document.getElementById('btn-settings-revert-tab')?.addEventListener('click', () => {
    if (revertActiveSettingsTab()) {
      deps.showToast?.('Изменения на вкладке отменены', 'neutral');
    }
  });

  document.getElementById('btn-settings-reset-section')?.addEventListener('click', () => {
    const activeBtn = modal.querySelector('.settings-nav__btn.active');
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
    void refreshLettersSnapshot(deps.api, 'apply');
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

  document.getElementById('btn-settings-import-letter-prefs')?.addEventListener('click', () => {
    const panel = document.getElementById('settings-letters-import-panel');
    const textarea = document.getElementById('settings-letters-import-textarea');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden && textarea instanceof HTMLTextAreaElement) {
      textarea.focus();
    }
  });

  document.getElementById('btn-settings-letters-import-cancel')?.addEventListener('click', () => {
    const panel = document.getElementById('settings-letters-import-panel');
    const textarea = document.getElementById('settings-letters-import-textarea');
    if (panel) panel.hidden = true;
    if (textarea instanceof HTMLTextAreaElement) textarea.value = '';
  });

  document.getElementById('btn-settings-letters-import-apply')?.addEventListener('click', () => {
    const textarea = document.getElementById('settings-letters-import-textarea');
    const raw = textarea instanceof HTMLTextAreaElement ? textarea.value : '';
    if (!raw.trim()) {
      deps.showToast?.('Вставьте JSON в поле', 'neutral');
      return;
    }
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
    markSettingsDirty('apply');
    deps.scheduleSaveSettings();
    invalidateLettersSnapshot();
    document.getElementById('settings-letters-import-panel')?.setAttribute('hidden', '');
    if (textarea instanceof HTMLTextAreaElement) textarea.value = '';
    deps.showToast?.('Параметры писем применены', 'good');
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
          ? 'apply'
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

  document.getElementById('btn-settings-open-service-from-tab')?.addEventListener('click', () => {
    deps.openServiceFromSettings?.();
  });

  document.getElementById('settings-search')?.addEventListener('input', (e) => {
    const q = e.target instanceof HTMLInputElement ? e.target.value : '';
    filterSettingsSearch(modal, q);
  });

  document.getElementById('settings-mic-manual')?.addEventListener('input', () => {
    markSettingsDirty();
    deps.scheduleSaveSettings();
  });

  document.getElementById('btn-settings-refresh-copilot-health')?.addEventListener('click', () => {
    void refreshCopilotHealthPills(deps.api);
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

  document.getElementById('btn-settings-dismiss-profile-tip')?.addEventListener('click', () => {
    try {
      localStorage.setItem('hh-settings-profile-tip-dismissed', '1');
    } catch {
      /* ignore */
    }
    const box = document.getElementById('settings-profile-tip');
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
      deps.showToast?.('Ключ нейросети: config/secrets.local.env', 'neutral');
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
    markSettingsDirty('letters');
    deps.scheduleSaveSettings();
  });

  for (const el of modal.querySelectorAll('[data-pref], [data-pref-bool], [data-pref-select], [data-setting], [data-copilot-pref]')) {
    const onFieldChange = () => {
      if (el.id === 'score-threshold-input') {
        const n = Number(/** @type {HTMLInputElement} */ (el).value);
        deps.onScoreThresholdChange?.(n);
      }
      markSettingsDirty(el);
      deps.scheduleSaveSettings();
      updateSettingsSummaryFromUI();
      updateSettingsLetterWarnings();
      updateSettingsRemoteWarnings();
      highlightActiveLetterPreset();
      highlightActiveTargetingPreset();
      highlightActiveCopilotPreset();
    };
    el.addEventListener('input', onFieldChange);
    el.addEventListener('change', onFieldChange);
  }

  const tablist = modal.querySelector('.settings-nav');
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
    if (host.querySelector('.settings-apply-preview')) continue;
    const p = document.createElement('p');
    p.className = 'settings-field-tip';
    p.textContent = tip;
    host.appendChild(p);
  }

  syncLearningMinVisibility();
  syncOnboardingBanner();
  syncProfileTipBanner();
  highlightActiveLetterPreset();
  highlightActiveTargetingPreset();
  highlightActiveCopilotPreset();
  updateSettingsRemoteWarnings();

  const thresholdInput = document.getElementById('score-threshold-input');
  const thresholdRange = document.getElementById('score-threshold-range');
  const syncThresholdRangeFromInput = () => {
    if (!thresholdInput || !thresholdRange) return;
    const n = Number(thresholdInput.value);
    if (Number.isFinite(n)) thresholdRange.value = String(Math.min(100, Math.max(0, n)));
  };
  thresholdRange?.addEventListener('input', () => {
    if (!thresholdInput || !thresholdRange) return;
    thresholdInput.value = thresholdRange.value;
    thresholdInput.dispatchEvent(new Event('input', { bubbles: true }));
    thresholdInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  thresholdInput?.addEventListener('input', syncThresholdRangeFromInput);
  thresholdInput?.addEventListener('change', syncThresholdRangeFromInput);
  syncThresholdRangeFromInput();
  thresholdInput?.addEventListener('input', () => scheduleApplyPreviewRefresh(deps.api));
  thresholdInput?.addEventListener('change', () => scheduleApplyPreviewRefresh(deps.api));

  return {
    onTabChange(tabId) {
      const id = normalizeSettingsTab(tabId);
      onSettingsTabActivated(id);
      onSettingsSectionActivated(id);
      syncSettingsTabDirtyIndicator();
      if (id === 'system') void refreshSystemHealth(deps.api);
      if (id === 'targeting') void refreshTargetingInsights(deps.api);
      if (id === 'apply') void refreshApplyPreview(deps.api);
      if (id === 'teleprompter') void refreshCopilotHealthPills(deps.api);
      void refreshLettersSnapshot(deps.api, id);
    },
    onOpen(tabId) {
      const id = normalizeSettingsTab(tabId);
      syncSettingsDialogLayoutOnOpen();
      syncSettingsLayoutPresetUi();
      onSettingsSectionActivated(id);
      updateSettingsSummaryFromUI();
      updateSettingsLetterWarnings();
      updateSettingsRemoteWarnings();
      highlightActiveLetterPreset();
      highlightActiveTargetingPreset();
      highlightActiveConversionPreset();
      syncOnboardingBanner();
      syncProfileTipBanner();
      syncSettingsSaveUi();
      if (id === 'system') void refreshSystemHealth(deps.api);
      if (id === 'targeting') void refreshTargetingInsights(deps.api);
      if (id === 'apply') void refreshApplyPreview(deps.api);
      if (id === 'teleprompter') void refreshCopilotHealthPills(deps.api);
      void refreshLettersSnapshot(deps.api, id);
      deps.onOpenTab?.(id);
    },
    renderSystemHealth(status) {
      renderSystemHealthList(status);
    },
    syncDerivedState: syncSettingsDerivedState,
    setConversionPresetsFromApi,
    afterPreferencesLoaded() {
      saveState.dirty = false;
      saveState.dirtyTabs.clear();
      saveState.saving = 0;
      refreshSettingsTabBaselines();
      syncSettingsSaveUi();
      syncSettingsDerivedState();
    },
  };
}

/**
 * @param {string} focusId
 * @param {{ toast?: string }} [opts]
 */
export function focusSettingsField(focusId, opts = {}) {
  const raw = String(focusId || '').trim();
  if (raw === 'settings-layout-bar') {
    focusSettingsLayoutBar();
    return;
  }
  const id = resolveFocusElementId(focusId);
  if (!id) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    revealSettingsFocusAncestors(el);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    pulseSettingsFocusEl(el);
    const input = el?.querySelector?.('input, select, textarea, button');
    if (input instanceof HTMLElement && typeof input.focus === 'function') {
      input.focus({ preventScroll: true });
    }
    if (opts.toast && showToastFn) showToastFn(opts.toast, 'neutral');
  });
}

/** @param {Element | null} el */
function revealSettingsFocusAncestors(el) {
  let node = el;
  while (node && node !== document.body) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    if (node instanceof HTMLElement && node.hidden) node.hidden = false;
    node = node.parentElement;
  }
}

/** @param {Element | null} el */
function pulseSettingsFocusEl(el) {
  if (!el) return;
  const fieldset = el.closest('fieldset.settings-group');
  const check = el.closest('label.settings-check');
  const target = fieldset || check || el;
  if (!(target instanceof HTMLElement)) return;
  target.classList.remove('settings-focus-pulse');
  void target.offsetWidth;
  target.classList.add('settings-focus-pulse');
  window.setTimeout(() => target.classList.remove('settings-focus-pulse'), 2000);
}
