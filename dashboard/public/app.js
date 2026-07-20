import { vacancyMatchesSearch } from './vacancy-search.mjs';
import { bucketTimelineForDisplay, renderFunnelTimelineHtml } from './funnel-timeline.mjs';
import { initFloatingTooltips } from './tooltips.mjs';
import {
  initModalLayer,
  openModalEl,
  closeModalEl,
  installModalFocusTrap,
  MODAL_ROOT_IDS,
} from './modal-layout.mjs';
import { openBatchPrecheckModal, updateBatchPrecheckModal } from './batch-precheck-modal.mjs';
import {
  pickBestVariantIndex,
  formatLetterQualityBanner,
  letterScore10Class,
  renderLetterScaleLegendHtml,
  renderSparklineHtml,
} from './letter-quality-ui.mjs';
import { initUiScaleControls } from './ui-scale.mjs';
import { initThemeControls } from './ui-theme.mjs';
import { initCardTuningControls, normalizeCardLayout, applyCardSizePreset } from './ui-card-tuning.mjs';
import { applyLocalDashboardDefaults } from './load-local-defaults.mjs';
import {
  meaningfulQuestions,
  itemHasMeaningfulQuestionnaire,
  itemQuestionnaireNeedsProbe,
  itemQuestionnaireShouldAutoProbe,
  recordNeedsQuestionnaireWork,
  recordLooksLikeCaptchaQuestionnaire,
  questionsLookLikeCaptchaMisdetect,
} from './questionnaire-labels.mjs';
import {
  isChoiceQuestion,
  matchAnswerToOption,
  normalizeChoiceOptionLabel,
} from './questionnaire-choice.mjs';
import { buildQuestionnaireAnswersMap } from './questionnaire-merge.mjs';
import {
  COPY,
  UI_MODES,
  SIDEBAR_PANELS,
  SIDEBAR_PANEL_ORDER_DEFAULT,
  LAYOUT_PRESET_KEYS,
  LAYOUT_PRESETS,
  detectLayoutPreset,
  batchScopeLabel,
  batchReportScopeLabel,
  defaultPanelsForMode,
  defaultPanelSides,
  normalizePanelSides,
  panelSideFor,
  glossaryLabel,
  UI_TRIM_HINT_LS_KEY,
} from './dashboard-ux.mjs';
import { initSidebarBuilder, renderSidebarBuilder } from './ui-sidebar-builder.mjs';
import { applySidebarLayout } from './sidebar-layout.mjs';
import { scrollToPanel, withPanelVisible } from './features-access.mjs';
import { initMobileShell, isMobileViewport } from './ui-mobile.mjs';
import {
  initWorkspaceDocks,
  loadDockState,
  applyDockState,
  syncDockMiniActiveView,
} from './workspace-docks.mjs';
import { autoRejectDoneReasonPrefix } from './reject-source.mjs';
import { humanApiError, isAbortLikeApiError } from './api-errors.mjs';
import { renderCardTile, currentBrowseMode } from './card-tiles.mjs';
import { configureCardPrimaryCta } from './card-primary-cta.mjs';
import {
  buildLlmScoreBreakdownHtml,
  buildScoreTooltipHtml,
  formatScoreLineAriaLabel,
  formatScoreLineDisplay,
} from './score-tooltip.mjs';
import { renderDailySparklineHtml } from './daily-sparkline.mjs';
import { copyVacancyMarkdown, downloadVacancyMarkdown } from './vacancy-export.mjs';
import {
  registerCommandPaletteActions,
  openCommandPalette,
  closeCommandPalette,
} from './command-palette.mjs';
import { initKeyboardShortcuts } from './keyboard-shortcuts.mjs';
import { buildListBreadcrumbItems, mountListBreadcrumbs } from './list-breadcrumbs.mjs';
import { filteredHiddenListMessage } from './list-empty-state.mjs';
import {
  renderInterviewHubHtml,
  renderMockOutputHtml,
  resolveDemoInstrumentForHub,
  renderInterviewHubDetailHtml,
  refreshCopilotLivePrepBanner,
  loadInterviewHubStaleWhileRevalidate,
  clearInterviewHubCacheFromStorage,
  renderInterviewHubSkeletonHtml,
  writeInterviewHubCacheToStorage,
  INTERVIEW_PREP_CHECKLIST_STORAGE_KEY,
} from './interview-hub-ui.mjs';
import { listInterviewHubPaletteTargets, interviewHubPaletteLabel } from './interview-hub-palette.mjs';
import { renderCopilotPanelHtml, initCopilotPanel } from './interview-copilot-ui.mjs';
import {
  initInterviewPrompt,
  openInterviewPromptModal,
  openInterviewPromptLoading,
  loadInterviewPromptPack,
  closeInterviewPromptModal,
  openLastInterviewPrompt,
  normalizeToPromptPack,
} from './interview-prompt.mjs';
import { initListKeyboardNav } from './list-keyboard-nav.mjs';
import { renderStatusChips } from './card-status.mjs';
import { mountJourneyStrip, hubOfferToClientRecord } from './journey-drawer.mjs';
import { applyCopyToDom, syncFullscreenIcon } from './apply-copy-dom.mjs';
import { itemPassesToApplyFilter } from './queue-to-apply-filter.mjs';
import { initWorkflowNav } from './ui-workflow.mjs';
import { initChatInboxUi, openChatInboxModal } from './chat-inbox-ui.mjs';
import { buildSourceBadgeFragment, formatSourceOpenLabel } from './source-badges.mjs';
import {
  tierClassLabel,
  hhSiteStateSourceLabel,
  applySkipReasonRuLabel,
  LETTER_SERIES_READY_LABEL,
  LETTER_SERIES_READY_HINT,
  inviteKindChipLabel,
  INVITE_KIND_LABELS,
  formatInstanceBadge,
  INTERVIEW_PREP_CHECKLIST_COPY,
  PREP_FOUNDATION_HUB_COPY,
  interviewPrepChecklistProgressLabel,
  interviewPrepCaptureHealthLabel,
} from './dashboard-copy-ru.mjs';
import { openConfirmActionModal } from './confirm-action-modal.mjs';
import { initSourcesPanel, refreshTopTierList } from './sources-panel.mjs';
import {
  initIngestUrlModal,
  openIngestUrlModal,
  closeIngestUrlModal,
} from './ingest-url-modal.mjs';
import {
  initIntelligencePanel,
  refreshIntelligencePanel,
  openIntelligenceDigestModal,
} from './intelligence-panel.mjs';
import { initMarketSkillsPanel, refreshMarketSkillsPanel } from './market-skills-panel.mjs';
import { buildScoreHumanHint } from './score-human-hint.mjs';
import {
  closeVacancyDetail,
  configureVacancyDetailNav,
  initVacancyDetailModal,
} from './vacancy-detail.mjs';
import {
  normalizeSettingsTab,
  initSettingsModal,
  updateSettingsSummaryFromPrefs,
  parseSettingsFromLocation,
  clearSettingsLocationParams,
  focusSettingsField,
  tryCloseSettingsModal,
  markSettingsDirty,
  markSettingsSaving,
  markSettingsSaved,
  markSettingsSaveFailed,
  invalidateLettersSnapshot,
  toggleSettingsModalFullscreen,
  applySettingsOpenLayout,
} from './settings-modal.mjs';
import {
  lockBodyScrollForSettings,
  unlockBodyScrollForSettings,
  isSettingsDialogLayoutSyncSuppressed,
} from './settings-modal-layout.mjs';
import {
  readSettingsPatchFromHub,
  hydrateSettingsHub,
  setSettingsRegistryMeta,
  filterSettingsSearch,
  fillCopilotDeviceSelects,
} from './settings-hub.mjs';
import { coerceInterviewLine } from './interview-text-lines.mjs';

const listEl = document.getElementById('list');
const tpl = document.getElementById('card-tpl');

const vacancyTabsEl = document.querySelector('.vacancy-tabs');
const applyViewTabsEl = document.querySelector('.apply-view-tabs');
const filterSearchEl = document.getElementById('filter-search');
const filterLetterQualityBtnEl = document.getElementById('btn-filter-letter-quality');
const filterLetterWeakBtnEl = document.getElementById('btn-filter-letter-weak');
const letterToolbarChipEl = document.getElementById('letter-toolbar-chip');
const btnBulkImproveLettersEl = document.getElementById('btn-bulk-improve-letters');
const filterMinScoreEl = document.getElementById('filter-min-score');
const filterSortEl = document.getElementById('filter-sort');
const sidebarFilterSourceEl = document.getElementById('sidebar-filter-source');
const sidebarFilterTierEl = document.getElementById('sidebar-filter-tier');
const filterSourceEl = sidebarFilterSourceEl;
const filterTierEl = sidebarFilterTierEl;
const instanceBadgeEl = document.getElementById('instance-badge');

const FILTER_PRESET_LS_KEY = 'hh-dashboard-filter-preset-v1';
const INSTANCE_TOAST_SESSION_KEY = 'hh-instance-toast-shown';
/** @type {{ onlyManual?: boolean, onlyFresh?: boolean }} */
let filterPresetExtras = { onlyManual: false, onlyFresh: false };
const filterSalaryEl = document.getElementById('filter-salary');
const scoreThresholdInputEl = document.getElementById('score-threshold-input');
const batchLimitEl = document.getElementById('batch-limit');
const batchRequireRemoteEl = document.getElementById('batch-require-remote');
const batchAutoPrepareLettersEl = document.getElementById('batch-auto-prepare-letters');
const batchLetterRequireMetricEl = document.getElementById('batch-letter-require-metric');
const batchAutoApproveLetterEl = document.getElementById('batch-auto-approve-letter');
const batchFalsePositiveMaxEl = document.getElementById('batch-false-positive-max');
const learningAutoApplyEl = document.getElementById('learning-auto-apply');
const learningAutoApplyMinEl = document.getElementById('learning-auto-apply-min');
const btnLetterCenterRegenEl = document.getElementById('btn-letter-center-regen');
const btnLetterCenterGenerateEl = document.getElementById('btn-letter-center-generate');
const letterStatsBodyEl = document.getElementById('letter-stats-body');
const letterCenterListEl = document.getElementById('letter-center-list');
const btnLetterCenterPrepareEl = document.getElementById('btn-letter-center-prepare');
const btnStatusLettersIssuesEl = document.getElementById('btn-status-letters-issues');
const btnLetterCenterFilterEl = document.getElementById('btn-letter-center-filter');
const btnLetterCenterFixableEl = document.getElementById('btn-letter-center-fixable');
const btnLetterCenterFailEl = document.getElementById('btn-letter-center-fail');
const btnLetterCenterMissingEl = document.getElementById('btn-letter-center-missing');
const btnLetterCenterMoreEl = document.getElementById('btn-letter-center-more');
const letterCenterMetaEl = document.getElementById('letter-center-meta');
const prefMaxHourEl = document.getElementById('pref-max-hour');
const prefMaxDayEl = document.getElementById('pref-max-day');
const prefMaxMonthEl = document.getElementById('pref-max-month');
const settingsProfileSelectEl = document.getElementById('settings-profile-select');
const settingsProfileQueueHintEl = document.getElementById('settings-profile-queue-hint');
const settingsSaveHintEl = document.getElementById('settings-save-hint');
const applyRateMetersEl = document.getElementById('apply-rate-meters');

/** @type {((tabId: string) => void) | null} */
let settingsTabSetter = null;
/** @type {ReturnType<typeof initSettingsModal> | null} */
let settingsModalHooks = null;

let pendingSettingsDashboardRefresh = false;
let pendingSettingsScoreBandLabelsRefresh = false;
/** @type {{ preferences: Record<string, unknown>, ui?: object } | null} */
let pendingSettingsUiRefresh = null;
/** @type {unknown} */
let pendingSettingsApplyRates = null;
let pendingSettingsDerivedStateRefresh = false;
/** На десктопе — не пересчитывать shell при смене контента внутри модалки. */
let settingsShellLayoutFrozen = false;

function isSettingsModalOpen() {
  const m = document.getElementById('settings-modal');
  return !!(m && !m.hidden);
}

function queueDashboardRefreshAfterSettings() {
  pendingSettingsDashboardRefresh = true;
}

function queueSettingsScoreBandLabelsRefresh() {
  pendingSettingsScoreBandLabelsRefresh = true;
}

function queueSettingsUiRefreshAfterSettings(preferences, ui) {
  pendingSettingsUiRefresh = { preferences, ui };
}

function queueSettingsApplyRatesRefresh(rates) {
  pendingSettingsApplyRates = rates;
}

function queueSettingsDerivedStateRefresh() {
  pendingSettingsDerivedStateRefresh = true;
}

async function flushDashboardRefreshAfterSettings() {
  const hadWork =
    pendingSettingsDashboardRefresh ||
    pendingSettingsScoreBandLabelsRefresh ||
    pendingSettingsUiRefresh ||
    pendingSettingsApplyRates != null ||
    pendingSettingsDerivedStateRefresh;
  if (!hadWork) return;

  const needDerived = pendingSettingsDerivedStateRefresh;
  pendingSettingsDerivedStateRefresh = false;
  if (needDerived) settingsModalHooks?.syncDerivedState?.();

  const needLabels = pendingSettingsScoreBandLabelsRefresh;
  pendingSettingsScoreBandLabelsRefresh = false;
  if (needLabels) updateScoreBandTabLabels();

  const uiPending = pendingSettingsUiRefresh;
  pendingSettingsUiRefresh = null;
  if (uiPending) {
    applyDashboardUiFromPreferences(uiPending.preferences, uiPending.ui);
  }

  const rates = pendingSettingsApplyRates;
  pendingSettingsApplyRates = null;
  if (rates) renderApplyRateMeters(rates);

  if (!pendingSettingsDashboardRefresh) return;
  pendingSettingsDashboardRefresh = false;
  invalidateLetterStatsCache();
  invalidateLettersSnapshot();
  void refreshLetterStatsSidebar(true);
  await load({ preserveScroll: true });
}

let currentStatus = 'pending';
let currentApplyView = 'queue';
/** @type {'toApply'|'all'} режим списка на вкладке очереди (pain-wave1) */
let currentQueueListMode = 'toApply';
let currentScoreBand = 'high';
let currentAppliedFunnel = 'all';
let chatTemplatesCache = null;
let scoreThreshold = 50;
let batchSizeCap = 1000;
/** @type {Record<string, { min: number, max: number }>} */
let prefBounds = {};
let settingsHydrated = false;
let profileOptionsLoaded = false;
/** @type {string | null} */
let lastBatchPauseReason = null;
let batchCaptchaToastShown = false;
/** @type {string | null} */
let lastFocusedVacancyId = null;
let preferencesSaveAvailable = null;
/** @type {Record<string, unknown>} */
let dashboardPreferences = {};
/** @type {{ uiMode: string, sidebarMode: string, panels: Record<string, boolean>, panelOrder: string[], panelSides: Record<string, string> }} */
let dashboardUi = {
  uiMode: UI_MODES.simple,
  sidebarMode: 'compact',
  panels: defaultPanelsForMode(UI_MODES.simple),
  panelOrder: [...SIDEBAR_PANEL_ORDER_DEFAULT],
  panelSides: defaultPanelSides(),
};
let layoutSettingsHydrated = false;
/** @type {(() => void) | null} */
let settingsFocusTrapCleanup = null;

const DASHBOARD_LAYOUT_LS_KEY = 'hh-dashboard-sidebar-layout-v1';
let batchHuntTrackIds = ['devops', 'infra', 'l2l3', 'tam'];
const BATCH_HUNT_TRACKS_SESSION_KEY = 'hh-batch-hunt-tracks';
let defaultBatchHuntTracks = ['devops', 'infra'];

function readDashboardLayoutLocal() {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function writeDashboardLayoutLocal(ui) {
  if (!ui) return;
  try {
    localStorage.setItem(
      DASHBOARD_LAYOUT_LS_KEY,
      JSON.stringify({
        panelOrder: ui.panelOrder,
        panelSides: ui.panelSides,
        panels: ui.panels,
      })
    );
  } catch {
    /* ignore */
  }
}

function enableSidebarPanel(panelId, { toast = true } = {}) {
  dashboardUi = withPanelVisible(dashboardUi, panelId, true);
  writeDashboardLayoutLocal(dashboardUi);
  applySidebarLayout(dashboardUi);
  scrollToPanel(dashboardUi, panelId);
  if (toast) {
    const label = SIDEBAR_PANELS[panelId]?.label || panelId;
    showToast(`Панель «${label}» открыта`, 'neutral');
  }
}

function switchUiMode(mode) {
  const next = mode === UI_MODES.expert ? UI_MODES.expert : UI_MODES.simple;
  dashboardUi.uiMode = next;
  if (next === UI_MODES.simple) {
    dashboardUi.panels = { ...dashboardUi.panels, ...defaultPanelsForMode(UI_MODES.simple) };
  }
  applyDashboardUiFromPreferences(
    { dashboardUiMode: next, dashboardSidebarPanels: dashboardUi.panels },
    dashboardUi
  );
  if (layoutSettingsHydrated) scheduleSaveLayoutSettings();
  showToast(next === UI_MODES.expert ? 'Расширенный интерфейс' : 'Простой интерфейс', 'neutral');
}

function initAllFeaturesButton() {
  document.getElementById('btn-all-features')?.addEventListener('click', () => openCommandPalette());
}
let lastHarvestTickSeq = 0;
let applyLogPollTimer = null;
let applyChatWasRunning = false;
let harvestWasRunning = false;
let batchWasRunning = false;
let syncResponsesWasRunning = false;
let syncResponsesStartedAt = 0;
let resumeRaiseWasRunning = false;
let syncChatsWasRunning = false;
let dailyRoutineWasRunning = false;
let cachedRawItems = [];
let cachedCounts = null;
/** @type {{ empty?: boolean, demoAvailable?: boolean, demoCount?: number } | null} */
let cachedQueueMeta = null;
let demoEmptyToastShown = false;
let topFalsePositivesCache = null;
let topFalsePositivesTs = 0;
let topFalsePositivesInFlight = null;
let learningSuggestionsCache = [];
let learningHistoryCache = [];
/** Открыть первую анкету после перехода на вкладку «Анкета». */
let openQuestionnaireOnNextLoad = false;
const AUTO_REPROBE_COOLDOWN_MS = 30 * 60 * 1000;
const AUTO_REPROBE_LS_KEY = 'hh-dashboard-auto-reprobe-ts';
let autoReprobeInFlight = false;
let questionnaireReprobeCandidateCount = 0;
const LIST_RENDER_INITIAL = 80;
const LIST_RENDER_STEP = 80;
const LIST_RENDER_CHUNK = 24;
let listRenderLimit = LIST_RENDER_INITIAL;
let listRenderGeneration = 0;
let harvestReloadTimer = null;
const HARVEST_RELOAD_DEBOUNCE_MS = 8000;

function resetListRenderLimit() {
  listRenderLimit = LIST_RENDER_INITIAL;
}

function appendListLoadMoreButton(shown, total) {
  const wrap = document.createElement('div');
  wrap.className = 'list-load-more';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-ghost';
  btn.textContent = `Показать ещё (${shown} из ${total})`;
  btn.addEventListener('click', () => {
    listRenderLimit += LIST_RENDER_STEP;
    renderListFromCache(null);
  });
  wrap.appendChild(btn);
  listEl.appendChild(wrap);
}

function appendVacancyCardsChunked(items, browseMode, scrollState, generation, onDone) {
  let idx = 0;
  function step() {
    if (generation !== listRenderGeneration) return;
    const frag = document.createDocumentFragment();
    const chunkEnd = Math.min(idx + LIST_RENDER_CHUNK, items.length);
    for (; idx < chunkEnd; idx++) {
      const it = items[idx];
      frag.appendChild(
        browseMode
          ? renderCardTile(it, scoreThreshold, renderCard, bindDismiss, bindCardDecision)
          : renderCard(it)
      );
    }
    if (frag.childNodes.length) listEl.appendChild(frag);
    if (idx < items.length) {
      requestAnimationFrame(step);
      return;
    }
    listEl.querySelectorAll('.card, .card-tile').forEach((el) => {
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    });
    restoreListScroll(scrollState);
    onDone?.();
  }
  requestAnimationFrame(step);
}

function scheduleHarvestListReload() {
  if (harvestReloadTimer) return;
  harvestReloadTimer = setTimeout(() => {
    harvestReloadTimer = null;
    void load({ preserveScroll: true });
  }, HARVEST_RELOAD_DEBOUNCE_MS);
}

function debounce(fn, ms) {
  let t;
  /** @param {...unknown} args */
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
      fn();
    }
  };
  wrapped.cancel = () => {
    clearTimeout(t);
    t = null;
  };
  return wrapped;
}

function readFiltersFromUI() {
  return {
    search: (filterSearchEl?.value || '').trim(),
    company: '',
    onlyLetterIssues: (letterToolbarChipEl || filterLetterQualityBtnEl)?.getAttribute('aria-pressed') === 'true',
    onlyLetterWeak: filterLetterWeakBtnEl?.getAttribute('aria-pressed') === 'true',
    minScore: filterMinScoreEl?.value?.trim() ?? '',
    sort: filterSortEl?.value || 'score-desc',
    source: filterSourceEl?.value || sidebarFilterSourceEl?.value || 'all',
    tier: filterTierEl?.value || sidebarFilterTierEl?.value || 'all',
    onlySalary: Boolean(filterSalaryEl?.checked),
    onlyManual: Boolean(filterPresetExtras.onlyManual),
    onlyFresh: Boolean(filterPresetExtras.onlyFresh),
  };
}

function hasActiveListFilters(filters = readFiltersFromUI()) {
  return Boolean(
    filters.search ||
    filters.company ||
    (Number(filters.minScore) > 0) ||
    filters.onlySalary ||
    filters.onlyManual ||
    filters.onlyFresh ||
    filters.onlyLetterIssues ||
    filters.onlyLetterWeak ||
    (filters.source && filters.source !== 'all') ||
    (filters.tier && filters.tier !== 'all')
  );
}

function countForApplyViewTab(view = currentApplyView) {
  if (!cachedCounts) return null;
  const map = {
    queue: cachedCounts.queue,
    noQuestionnaire: cachedCounts.noQuestionnaire,
    questionnaire: cachedCounts.questionnaire,
    applied: cachedCounts.applied,
    hidden: cachedCounts.hiddenByRole,
    deferred: cachedCounts.deferred,
  };
  const n = map[view];
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function switchScoreBandToAll() {
  currentScoreBand = 'all';
  syncScoreBandTabs();
  updateScoreBandTabLabels();
  load();
}

function resetListFiltersToDefault() {
  if (filterSearchEl) filterSearchEl.value = '';
  if (filterMinScoreEl) filterMinScoreEl.value = '';
  if (filterSalaryEl) filterSalaryEl.checked = false;
  filterPresetExtras = { onlyManual: false, onlyFresh: false };
  syncFilterControlsFrom('all', 'all');
  if (filterLetterQualityBtnEl) {
    filterLetterQualityBtnEl.classList.remove('active');
    filterLetterQualityBtnEl.setAttribute('aria-pressed', 'false');
  }
  if (letterToolbarChipEl) {
    letterToolbarChipEl.classList.remove('active');
    letterToolbarChipEl.setAttribute('aria-pressed', 'false');
  }
  if (filterLetterWeakBtnEl) {
    filterLetterWeakBtnEl.classList.remove('active');
    filterLetterWeakBtnEl.setAttribute('aria-pressed', 'false');
  }
  if (currentScoreBand !== 'all') {
    switchScoreBandToAll();
    return;
  }
  renderListFromCache(null);
}

function syncFilterControlsFrom(src, tier) {
  const srcVal = typeof src === 'string' ? src : src?.value || 'all';
  const tierVal = typeof tier === 'string' ? tier : tier?.value || 'all';
  if (filterSourceEl) filterSourceEl.value = srcVal;
  if (sidebarFilterSourceEl) sidebarFilterSourceEl.value = srcVal;
  if (filterTierEl) filterTierEl.value = tierVal;
  if (sidebarFilterTierEl) sidebarFilterTierEl.value = tierVal;
}

function setTierFilter(tier) {
  syncFilterControlsFrom(filterSourceEl?.value || 'all', tier);
  if (filterSortEl && tier !== 'all') filterSortEl.value = 'tier-first';
  renderListFromCache(null);
}

/** @param {'tierAFresh'|'manualApply'|'allSources'} preset */
function applyFilterPreset(preset) {
  try {
    localStorage.setItem(FILTER_PRESET_LS_KEY, preset);
  } catch {
    /* ignore */
  }
  filterPresetExtras = { onlyManual: false, onlyFresh: false };
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-preset') === preset);
  });
  if (preset === 'tierAFresh') {
    if (filterTierEl) filterTierEl.value = 'A';
    if (sidebarFilterTierEl) sidebarFilterTierEl.value = 'A';
    if (filterSourceEl) filterSourceEl.value = 'all';
    if (sidebarFilterSourceEl) sidebarFilterSourceEl.value = 'all';
    if (filterSortEl) filterSortEl.value = 'tier-first';
    filterPresetExtras.onlyFresh = true;
  } else if (preset === 'manualApply') {
    if (filterTierEl) filterTierEl.value = 'all';
    if (sidebarFilterTierEl) sidebarFilterTierEl.value = 'all';
    if (filterSourceEl) filterSourceEl.value = 'all';
    if (sidebarFilterSourceEl) sidebarFilterSourceEl.value = 'all';
    filterPresetExtras.onlyManual = true;
  } else {
    if (filterTierEl) filterTierEl.value = 'all';
    if (sidebarFilterTierEl) sidebarFilterTierEl.value = 'all';
    if (filterSourceEl) filterSourceEl.value = 'all';
    if (sidebarFilterSourceEl) sidebarFilterSourceEl.value = 'all';
  }
  renderListFromCache(null);
}

function restoreFilterPresetFromStorage() {
  let preset = 'allSources';
  try {
    preset = localStorage.getItem(FILTER_PRESET_LS_KEY) || 'allSources';
  } catch {
    /* ignore */
  }
  if (preset !== 'allSources') applyFilterPreset(/** @type {'tierAFresh'|'manualApply'|'allSources'} */ (preset));
}

function hasLetterQualityIssue(item) {
  const q = item?.letterQuality;
  if (!q) return false;
  if (q.fixable) return true;
  return q.pass === false;
}

function letterQualitySortKey(item) {
  const q = item?.letterQuality;
  if (!q) return 500;
  const kind = q.fixable ? 0 : q.pass === false ? 1 : 2;
  const score10 = Number(q.letterScore10);
  return kind * 100 + (Number.isFinite(score10) ? score10 : 5);
}

function vacancyHhSiteBlocked(item) {
  const s = item?.hhApply?.hhSiteState;
  return (
    s === 'already_applied' ||
    s === 'invited' ||
    s === 'declined' ||
    s === 'archived' ||
    s === 'unavailable'
  );
}

function vacancyShownInAppliedTab(item) {
  if (vacancyHasHhApply(item)) return true;
  const s = item?.hhApply?.hhSiteState;
  return s === 'already_applied' || s === 'invited' || s === 'declined' || s === 'viewed' || s === 'awaiting';
}

function hhSiteStateBadgeText(item) {
  const h = item?.hhApply;
  const st = h?.hhSiteState;
  if (!st || st === 'none') return '';
  const ik = String(h?.inviteKind || '').trim();
  if (ik && ik !== 'none') {
    const ikLabel = INVITE_KIND_LABELS[ik] || inviteKindChipLabel(ik);
    if (ikLabel) {
      const when = h.inviteKindAt
        ? new Date(h.inviteKindAt).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : h.hhSiteStateAt
          ? new Date(h.hhSiteStateAt).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
      return when ? `${ikLabel} · ${when}` : ikLabel;
    }
  }
  const labels = {
    invited: 'Приглашение на hh.ru',
    declined: 'Отказ на hh.ru',
    already_applied: 'Отклик уже на hh.ru',
    viewed: 'Резюме просмотрели',
    awaiting: 'Ждём ответа',
    archived: 'Вакансия в архиве',
    unavailable: 'Отклик недоступен',
  };
  let label = h.hhSiteStateLabel || labels[st] || st;
  if (h.hhDetectedOnly && st === 'already_applied') {
    label = 'Отклик на hh.ru (не через дашборд)';
  }
  const when = h.hhSiteStateAt
    ? new Date(h.hhSiteStateAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const srcRu = h.hhSiteStateSource ? hhSiteStateSourceLabel(h.hhSiteStateSource) : '';
  const src = srcRu ? ` · источник: ${srcRu}` : '';
  const base = when ? `${label} · ${when}` : label;
  return `${base}${src}`;
}

function hhSiteStateBadgeTitle(item) {
  const h = item?.hhApply;
  if (!h?.hhSiteState || h.hhSiteState === 'none') return '';
  const ik = String(h?.inviteKind || '').trim();
  if (ik && ik !== 'none') {
    const ikLabel = INVITE_KIND_LABELS[ik] || inviteKindChipLabel(ik);
    if (ikLabel) {
      const parts = [ikLabel];
      const whenRaw = h.inviteKindAt || h.hhSiteStateAt;
      if (whenRaw) {
        parts.push(
          new Date(whenRaw).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      }
      if (h.inviteKindSource) parts.push(`Источник: ${h.inviteKindSource}`);
      return parts.filter(Boolean).join('\n');
    }
  }
  const st = h.hhSiteState;
  const labels = {
    invited: 'Приглашение на hh.ru',
    declined: 'Отказ на hh.ru',
    already_applied: 'Отклик уже на hh.ru',
    viewed: 'Резюме просмотрели',
    awaiting: 'Ждём ответа',
    archived: 'Вакансия в архиве',
    unavailable: 'Отклик недоступен',
  };
  let label = h.hhSiteStateLabel || labels[st] || st;
  if (h.hhDetectedOnly && st === 'already_applied') {
    label = 'Отклик на hh.ru (не через дашборд)';
  }
  const parts = [label];
  if (h.hhSiteStateAt) {
    parts.push(
      new Date(h.hhSiteStateAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  }
  if (h.hhDetectedOnly) {
    parts.push('Обнаружено на сайте hh.ru — отклик не отправлялся через дашборд в этой сессии.');
  }
  if (h.hhSiteStateSource) {
    parts.push(
      `Источник детектора: ${hhSiteStateSourceLabel(h.hhSiteStateSource, { expert: true }) || h.hhSiteStateSource}`
    );
  }
  return parts.filter(Boolean).join('\n');
}

async function setHhSiteStateManual(item, state) {
  await api('/api/hh-site-state', {
    method: 'POST',
    body: JSON.stringify({ id: item.id, state }),
  });
  showToast(
    state === 'invited'
      ? 'Приглашение сохранено — карточка убрана из серии откликов'
      : state === 'declined'
        ? 'Отказ сохранён — учтётся в следующих письмах'
        : 'Статус hh.ru сброшен',
    'good'
  );
  await load();
}

/** Показать кнопки «Пригласили» / «Отказ» для обратной связи LLM. */
function canMarkHhOutcome(item) {
  const st = item.hhApply?.hhSiteState || 'none';
  if (st === 'invited' || st === 'declined') return false;
  if (vacancyHasHhApply(item) || item.status === 'responded') return true;
  if (item.status === 'pending' && !vacancyHasHhApply(item)) return true;
  return false;
}

function filterItemsForApplyView(items, view = currentApplyView) {
  const active = items.filter((x) => x.status !== 'responded');
  if (view === 'applied') {
    return items.filter((x) => vacancyShownInAppliedTab(x));
  }
  if (view === 'deferred') {
    return active.filter((x) => isVacancyDeferredClient(x));
  }
  if (view === 'noQuestionnaire') {
    return active.filter(
      (x) =>
        !isVacancyDeferredClient(x) &&
        !vacancyHasHhApply(x) &&
        !vacancyHhSiteBlocked(x) &&
        !recordNeedsQuestionnaireWork(x)
    );
  }
  if (view === 'questionnaire') {
    return active.filter(
      (x) =>
        !isVacancyDeferredClient(x) &&
        !vacancyHasHhApply(x) &&
        !vacancyHhSiteBlocked(x) &&
        recordNeedsQuestionnaireWork(x)
    );
  }
  if (view === 'hidden') {
    return active.filter((x) => !isVacancyDeferredClient(x) && !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x));
  }
  return active.filter(
    (x) => !isVacancyDeferredClient(x) && !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x)
  );
}

function isVacancyDeferredClient(rec, nowMs = Date.now()) {
  const until = Date.parse(String(rec?.deferUntil || ''));
  return Number.isFinite(until) && until > nowMs;
}

function daysSinceApplyClient(item) {
  const raw = item?.hhApply?.lastAt || item?.createdAt;
  const t = Date.parse(String(raw || ''));
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function isStaleFollowUpClient(item) {
  const st = item?.hhApply?.hhSiteState;
  if (st === 'invited' || st === 'declined' || st === 'viewed') return false;
  if (!item?.hhApply?.responseSubmitted && st !== 'already_applied') return false;
  const days = daysSinceApplyClient(item);
  return days != null && days >= 7;
}

function syncQueueListModeTabs() {
  document.querySelectorAll('[data-queue-list-mode]').forEach((btn) => {
    const mode = btn.getAttribute('data-queue-list-mode');
    btn.classList.toggle('active', mode === currentQueueListMode);
  });
}

function applyClientFilters(items, filters) {
  let out = filterItemsForApplyView([...items]);
  if (
    (currentApplyView === 'queue' || currentApplyView === 'noQuestionnaire') &&
    currentQueueListMode === 'toApply'
  ) {
    out = out.filter((it) => itemPassesToApplyFilter(it));
  }
  const q = filters.search.toLowerCase();
  if (q) {
    out = out.filter((it) => vacancyMatchesSearch(it, q));
  }
  const comp = filters.company.toLowerCase();
  if (comp) {
    out = out.filter((it) => (it.company || '').toLowerCase().includes(comp));
  }
  const min = Number(filters.minScore);
  if (Number.isFinite(min) && min > 0) {
    out = out.filter((it) => scoreOf(it) >= min);
  }
  if (currentApplyView === 'queue' || currentApplyView === 'noQuestionnaire') {
    const huntTracks = getSelectedHuntTracks();
    if (huntTracks.length) {
      out = out.filter((it) => {
        const tid = it.huntTrack?.id;
        return tid && huntTracks.includes(tid);
      });
    }
  }
  if (filters.onlySalary) {
    out = out.filter((it) => it.salaryEstimate?.ok);
  }
  if (filters.source && filters.source !== 'all') {
    out = out.filter((it) => String(it.source || 'hh').toLowerCase() === filters.source);
  }
  if (filters.tier && filters.tier !== 'all') {
    out = out.filter((it) => String(it.sourceQualityTier || '').toUpperCase() === filters.tier.toUpperCase());
  }
  if (filters.onlyManual) {
    out = out.filter((it) => it.applyMode && it.applyMode !== 'hh_auto');
  }
  if (filters.onlyFresh) {
    out = out.filter((it) => {
      const h = Number(it.freshnessHours);
      return Number.isFinite(h) && h < 72;
    });
  }
  if (filters.onlyLetterIssues) {
    out = out.filter((it) => hasLetterQualityIssue(it));
    out.sort((a, b) => letterQualitySortKey(a) - letterQualitySortKey(b));
  }
  if (filters.onlyLetterWeak) {
    out = out.filter((it) => {
      const l10 = it.letterQuality?.letterScore10 ?? it.readiness?.letterScore10;
      return Number.isFinite(Number(l10)) && Number(l10) < 6;
    });
  }
  if (currentApplyView === 'applied' && currentAppliedFunnel !== 'all') {
    out = out.filter((it) => {
      const st = it?.hhApply?.hhSiteState;
      if (currentAppliedFunnel === 'invited') return st === 'invited';
      if (currentAppliedFunnel === 'viewed') return st === 'viewed';
      if (currentAppliedFunnel === 'awaiting') return st === 'awaiting';
      if (currentAppliedFunnel === 'declined') return st === 'declined';
      if (currentAppliedFunnel === 'stale') return isStaleFollowUpClient(it);
      return true;
    });
  }
  switch (filters.sort) {
    case 'tier-first': {
      const tierOrder = { A: 0, B: 1, C: 2, D: 3 };
      out.sort((a, b) => {
        const ta = tierOrder[a.sourceQualityTier] ?? 9;
        const tb = tierOrder[b.sourceQualityTier] ?? 9;
        if (ta !== tb) return ta - tb;
        const fa = a.freshnessHours ?? 9999;
        const fb = b.freshnessHours ?? 9999;
        if (fa !== fb) return fa - fb;
        return scoreOf(b) - scoreOf(a);
      });
      break;
    }
    case 'score-asc':
      out.sort((a, b) => scoreOf(a) - scoreOf(b));
      break;
    case 'date-desc':
      out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'title-asc':
      out.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
      break;
    default:
      out.sort((a, b) => scoreOf(b) - scoreOf(a));
  }
  return out;
}

function renderApplyRateMeters(rates) {
  if (!applyRateMetersEl || !rates) return;
  const simple = dashboardUi.uiMode !== UI_MODES.expert;
  const rows = [
    { key: 'hour', label: simple ? 'час' : 'ч', used: rates.lastHour, max: rates.maxPerHour },
    { key: 'day', label: simple ? 'сутки' : 'сут', used: rates.lastDay, max: rates.maxPerDay },
    { key: 'month', label: simple ? '30 дней' : '30д', used: rates.lastMonth, max: rates.maxPerMonth },
  ];
  applyRateMetersEl.innerHTML = rows
    .map(({ label, used, max }) => {
      const u = Number(used) || 0;
      const m = Math.max(1, Number(max) || 1);
      const pct = Math.min(100, Math.round((u / m) * 100));
      const barClass =
        pct >= 100 ? 'rate-meter__bar--full' : pct >= 85 ? 'rate-meter__bar--warn' : '';
      return `<div class="rate-meter" title="${label}: ${u} из ${m}">
        <span class="rate-meter__label">${label}</span>
        <span class="rate-meter__track"><span class="rate-meter__bar ${barClass}" style="width:${pct}%"></span></span>
        <span class="rate-meter__nums">${u}/${m}</span>
      </div>`;
    })
    .join('');
}

function applyPreferencesToSettingsUI(preferences, bounds) {
  if (bounds && typeof bounds === 'object') prefBounds = bounds;
  const p = preferences || {};
  dashboardPreferences = p;
  applyJourneyPresetToDom(p?.hiringJourney?.preset || 'apply');
  dispatchPrefsUpdated(p);
  const setNum = (el, key, fallback) => {
    if (!el) return;
    const b = prefBounds[key];
    if (b) {
      el.min = String(b.min);
      el.max = String(b.max);
    }
    const n = Number(p[key]);
    el.value = String(Number.isFinite(n) ? n : fallback);
  };
  setNum(scoreThresholdInputEl, 'dashboardMinScoreFilter', 50);
  const thRange = document.getElementById('score-threshold-range');
  if (thRange && scoreThresholdInputEl) {
    const n = Number(scoreThresholdInputEl.value);
    if (Number.isFinite(n)) thRange.value = String(Math.min(100, Math.max(0, n)));
  }
  setNum(batchLimitEl, 'dashboardBatchSize', 10);
  setNum(prefMaxHourEl, 'hhApplyChatMaxPerHour', 50);
  setNum(prefMaxDayEl, 'hhApplyChatMaxPerDay', 1000);
  setNum(prefMaxMonthEl, 'hhApplyChatMaxPerMonth', 5000);
  if (batchRequireRemoteEl) {
    batchRequireRemoteEl.checked = p.batchRequireRemote === true;
  }
  if (batchAutoPrepareLettersEl) {
    batchAutoPrepareLettersEl.checked = p.batchAutoPrepareLetters !== false;
  }
  if (batchLetterRequireMetricEl) {
    batchLetterRequireMetricEl.checked = p.batchLetterRequireMetric === true;
  }
  if (batchAutoApproveLetterEl) {
    batchAutoApproveLetterEl.checked = p.batchAutoApproveBestLetter === true;
  }
  setNum(batchFalsePositiveMaxEl, 'batchFalsePositiveMax', 20);
  if (learningAutoApplyEl) {
    learningAutoApplyEl.checked = p.learningAutoApplyPatterns === true;
  }
  setNum(learningAutoApplyMinEl, 'learningAutoApplyMinCount', 3);
  setNum(document.getElementById('pref-min-monthly-rub'), 'minMonthlyRub', 150000);
  setNum(document.getElementById('pref-target-monthly-rub'), 'targetMonthlyRub', 180000);
  setNum(document.getElementById('pref-max-monthly-search'), 'maxMonthlyRubSearch', 300000);
  const pwEl = document.getElementById('settings-playwright-mode');
  if (pwEl instanceof HTMLSelectElement) {
    const mode = String(p.dashboardPlaywrightDisplayMode || 'hidden-captcha');
    pwEl.value = ['hidden-captcha', 'visible', 'headless'].includes(mode) ? mode : 'hidden-captcha';
  }
  const cop = p.interviewCopilot || {};
  for (const el of document.querySelectorAll('[data-copilot-pref]')) {
    const key = el.dataset.copilotPref;
    if (!key || !(key in cop)) continue;
    const v = cop[key];
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v !== false;
    else if (el instanceof HTMLInputElement && el.type === 'range') el.value = String(v ?? el.value);
    else if (el instanceof HTMLSelectElement) el.value = String(v);
    else if (el instanceof HTMLInputElement) el.value = String(v ?? '');
  }
  hydrateSettingsHub(document.getElementById('settings-modal') || document, p);
  const targetingTrueDefault = new Set([
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
  ]);
  for (const el of document.querySelectorAll('#settings-panel-targeting [data-pref-bool]')) {
    const key = el.dataset.prefBool;
    if (!key || !(el instanceof HTMLInputElement)) continue;
    if (key in p) {
      el.checked = targetingTrueDefault.has(key) ? p[key] !== false : p[key] === true;
    } else {
      el.checked = targetingTrueDefault.has(key);
    }
  }
  const profileName = settingsProfileSelectEl?.selectedOptions?.[0]?.textContent?.trim();
  updateSettingsSummaryFromPrefs(p, {
    profileLabel: profileName ? `профиль: ${profileName}` : '',
  });
  const defMin = Number(p.dashboardMinScoreFilter);
  if (Number.isFinite(defMin) && defMin >= 0) scoreThreshold = defMin;
  const batchN = Number(p.dashboardBatchSize);
  batchSizeCap = Number.isFinite(batchN) && batchN >= 1 ? Math.min(1000, batchN) : 1000;
  if (batchLimitEl && prefBounds.dashboardBatchSize) {
    batchLimitEl.max = String(prefBounds.dashboardBatchSize.max);
  }
  if (isSettingsModalOpen()) {
    queueSettingsScoreBandLabelsRefresh();
  } else {
    updateScoreBandTabLabels();
  }
  settingsHydrated = true;
  if (isSettingsModalOpen()) {
    queueSettingsDerivedStateRefresh();
  } else {
    settingsModalHooks?.syncDerivedState?.();
  }
}

function setProfileSelectPlaceholder(text, { disabled = true } = {}) {
  if (!settingsProfileSelectEl) return;
  settingsProfileSelectEl.replaceChildren();
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = text;
  opt.disabled = disabled;
  opt.selected = true;
  settingsProfileSelectEl.append(opt);
}

function applyProfileOptionsToSettingsUI(data) {
  if (!settingsProfileSelectEl) return;
  const profiles = Array.isArray(data?.profiles) ? [...data.profiles] : [];
  const active = String(data?.activeProfile || '').trim();

  if (!profiles.length && !active) {
    setProfileSelectPlaceholder('Нет профилей — добавьте config/profiles/<id>.env');
    profileOptionsLoaded = false;
    if (settingsProfileQueueHintEl) settingsProfileQueueHintEl.textContent = '—';
    return;
  }

  if (active && !profiles.some((p) => p.id === active)) {
    profiles.unshift({
      id: active,
      label: `${active} (файл не найден)`,
      envPath: null,
    });
  }

  settingsProfileSelectEl.replaceChildren(
    ...profiles.map((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label || p.id;
      if (p.id === active) opt.selected = true;
      return opt;
    })
  );
  if (active && !settingsProfileSelectEl.value) {
    settingsProfileSelectEl.value = active;
  }
  if (settingsProfileQueueHintEl) {
    settingsProfileQueueHintEl.textContent = data.queuePath
      ? `Очередь: ${data.queuePath}`
      : 'Очередь по умолчанию';
  }
  profileOptionsLoaded = profiles.length > 0;
}

async function refreshProfileSelect() {
  if (!settingsProfileSelectEl) return null;
  const hadOptions = settingsProfileSelectEl.options.length > 0 && settingsProfileSelectEl.value;
  if (!hadOptions) setProfileSelectPlaceholder('Загрузка…');
  try {
    const data = await api('/api/profiles');
    applyProfileOptionsToSettingsUI(data);
    return data;
  } catch {
    if (!hadOptions) setProfileSelectPlaceholder('Не удалось загрузить профили');
    return null;
  }
}

async function changeActiveProfile(profileId) {
  const res = await api('/api/profile/select', {
    method: 'POST',
    body: JSON.stringify({ id: profileId }),
  });
  if (settingsProfileQueueHintEl && res.queuePath) {
    settingsProfileQueueHintEl.textContent = `Очередь: ${res.queuePath}`;
  }
  showToast(`Профиль «${res.activeProfile}» — список перезагружен`, 'good');
  await load();
  return res;
}

function normalizeUiFromApi(ui, preferences) {
  const p = preferences || {};
  const uiMode =
    ui?.uiMode === UI_MODES.expert || p.dashboardUiMode === UI_MODES.expert
      ? UI_MODES.expert
      : UI_MODES.simple;
  const sidebarMode =
    ui?.sidebarMode === 'full' || p.dashboardSidebarLayout === 'full' ? 'full' : 'compact';
  const panels = { ...defaultPanelsForMode(uiMode) };
  const src = ui?.panels || p.dashboardSidebarPanels;
  if (src && typeof src === 'object') {
    for (const id of Object.keys(SIDEBAR_PANELS)) {
      if (typeof src[id] === 'boolean') panels[id] = src[id];
    }
  }
  const localLayout = readDashboardLayoutLocal();
  const order = Array.isArray(ui?.panelOrder)
    ? ui.panelOrder.filter((id) => SIDEBAR_PANELS[id])
    : Array.isArray(p.dashboardSidebarPanelOrder)
      ? p.dashboardSidebarPanelOrder.filter((id) => SIDEBAR_PANELS[id])
      : Array.isArray(localLayout?.panelOrder)
        ? localLayout.panelOrder.filter((id) => SIDEBAR_PANELS[id])
        : [...SIDEBAR_PANEL_ORDER_DEFAULT];
  const seen = new Set(order);
  for (const id of SIDEBAR_PANEL_ORDER_DEFAULT) {
    if (!seen.has(id)) order.push(id);
  }
  const panelSides = normalizePanelSides(
    ui?.panelSides ?? p.dashboardSidebarPanelSides ?? localLayout?.panelSides
  );
  if (localLayout?.panels && typeof localLayout.panels === 'object') {
    for (const id of Object.keys(SIDEBAR_PANELS)) {
      if (typeof localLayout.panels[id] === 'boolean' && p.dashboardSidebarPanels?.[id] === undefined) {
        panels[id] = localLayout.panels[id];
      }
    }
  }
  return { uiMode, sidebarMode, panels, panelOrder: order, panelSides };
}

function applyDashboardUiFromPreferences(preferences, uiFromApi) {
  dashboardUi = normalizeUiFromApi(uiFromApi, preferences);
  writeDashboardLayoutLocal(dashboardUi);
  const shell = document.getElementById('app-shell');
  if (shell) {
    shell.dataset.uiMode = dashboardUi.uiMode;
    shell.dataset.sidebarMode = dashboardUi.sidebarMode;
  }
  try {
    localStorage.setItem('hh-sidebar-mode', dashboardUi.sidebarMode);
  } catch {
    /* ignore */
  }
  document.querySelectorAll('[data-sidebar-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.sidebarMode === dashboardUi.sidebarMode);
  });
  document.querySelectorAll('[data-ui-mode-preset]').forEach((b) => {
    b.classList.toggle('active', b.dataset.uiModePreset === dashboardUi.uiMode);
  });
  applySidebarLayout(dashboardUi);
  renderSidebarBuilder();
  syncLayoutPresetButtons();
  if (dashboardUi.uiMode === UI_MODES.simple) {
    applyCardSizePreset('compact');
  }
}

function syncLayoutPresetButtons() {
  const active = detectLayoutPreset(dashboardUi);
  document.querySelectorAll('[data-layout-preset]').forEach((b) => {
    b.classList.toggle('active', Boolean(active && b.dataset.layoutPreset === active));
  });
  const hintEl = document.getElementById('layout-preset-hint');
  if (hintEl) {
    hintEl.textContent = active
      ? LAYOUT_PRESETS[active]?.hint || ''
      : 'Своя конфигурация — перетащите блоки или выберите пресет';
  }
}

function initSidebarBuilderHooks() {
  initSidebarBuilder({
    getUi: () => dashboardUi,
    patchUi: (partial, opts = {}) => {
      dashboardUi = { ...dashboardUi, ...partial };
      if (partial.panels || partial.panelOrder || partial.panelSides || opts.reorder) {
        applySidebarLayout(dashboardUi);
      }
      if (partial.panelOrder || partial.panelSides) renderSidebarBuilder();
      syncLayoutPresetButtons();
      writeDashboardLayoutLocal(dashboardUi);
    },
    onPersist: () => {
      writeDashboardLayoutLocal(dashboardUi);
      if (layoutSettingsHydrated) scheduleSaveLayoutSettings();
    },
  });
}

function applyLayoutPreset(name) {
  const preset = LAYOUT_PRESETS[name];
  if (!preset) return;
  dashboardUi = {
    ...dashboardUi,
    uiMode: preset.uiMode,
    sidebarMode: preset.sidebarMode,
    panels: { ...preset.panels },
    panelOrder: [...preset.panelOrder],
    panelSides: { ...defaultPanelSides(), ...(preset.panelSides || {}) },
  };
  applyDashboardUiFromPreferences(
    {
      dashboardUiMode: preset.uiMode,
      dashboardSidebarLayout: preset.sidebarMode,
      dashboardSidebarPanels: preset.panels,
      dashboardSidebarPanelOrder: preset.panelOrder,
      dashboardSidebarPanelSides: dashboardUi.panelSides,
    },
    dashboardUi
  );
  const shell = document.getElementById('app-shell');
  if (shell) shell.dataset.sidebarMode = preset.sidebarMode;
  document.querySelectorAll('[data-sidebar-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.sidebarMode === preset.sidebarMode);
  });
  document.querySelectorAll('[data-ui-mode-preset]').forEach((b) => {
    b.classList.toggle('active', b.dataset.uiModePreset === preset.uiMode);
  });
  syncLayoutPresetButtons();
  if (layoutSettingsHydrated) scheduleSaveLayoutSettings();
}

function readLayoutPatchFromUI() {
  return {
    dashboardUiMode: dashboardUi.uiMode,
    dashboardSidebarLayout: dashboardUi.sidebarMode,
    dashboardSidebarPanels: { ...dashboardUi.panels },
    dashboardSidebarPanelOrder: [...dashboardUi.panelOrder],
    dashboardSidebarPanelSides: { ...dashboardUi.panelSides },
  };
}

function scheduleSaveLayoutSettings() {
  scheduleSaveLayoutOnly();
}

const scheduleSaveLayoutOnly = debounce(() => {
  if (!layoutSettingsHydrated || preferencesSaveAvailable === false) return;
  const layoutBeforeSave = readLayoutPatchFromUI();
  patchPreferencesApi(layoutBeforeSave)
    .then((res) => {
      const prefs = { ...(res.preferences || {}) };
      const uiFromApi = res.ui ? { ...res.ui } : {};
      if (!prefs.dashboardSidebarPanelSides && layoutBeforeSave.dashboardSidebarPanelSides) {
        prefs.dashboardSidebarPanelSides = layoutBeforeSave.dashboardSidebarPanelSides;
      }
      if (!uiFromApi.panelSides && layoutBeforeSave.dashboardSidebarPanelSides) {
        uiFromApi.panelSides = layoutBeforeSave.dashboardSidebarPanelSides;
      }
      if (res.ui) applyDashboardUiFromPreferences(prefs, uiFromApi);
      else if (res.preferences) applyDashboardUiFromPreferences(prefs);
      dispatchPrefsUpdated(prefs);
      flashSettingsSaved();
    })
    .catch((e) => {
      setSettingsHint(e.message || 'Ошибка сохранения интерфейса', 'err');
    });
}, 600);

function readSettingsPatchFromUI() {
  const modal = document.getElementById('settings-modal');
  return { ...readSettingsPatchFromHub(modal || document), ...readLayoutPatchFromUI() };
}

/** @param {Record<string, unknown>} prefs */
function dispatchPrefsUpdated(prefs) {
  window.__hhLastPreferences = prefs;
  window.dispatchEvent(new CustomEvent('hh:prefs-updated', { detail: { preferences: prefs } }));
}

let settingsHintClearTimer = null;

function setSettingsHint(text, variant = '') {
  if (!settingsSaveHintEl) return;
  if (settingsHintClearTimer) {
    clearTimeout(settingsHintClearTimer);
    settingsHintClearTimer = null;
  }
  const t = String(text || '').trim();
  settingsSaveHintEl.textContent = t;
  settingsSaveHintEl.hidden = !t;
  settingsSaveHintEl.classList.remove('settings-hint--saved', 'settings-hint--err', 'settings-hint--pending');
  if (variant) settingsSaveHintEl.classList.add(`settings-hint--${variant}`);
}

function flashSettingsSaved() {
  setSettingsHint('Сохранено', 'saved');
  if (!isSettingsModalOpen()) {
    showToast('Настройки сохранены', 'good');
  }
  settingsHintClearTimer = setTimeout(() => {
    settingsHintClearTimer = null;
    if (settingsSaveHintEl?.textContent === 'Сохранено') {
      setSettingsHint('Изменения сохраняются автоматически');
    }
  }, 1800);
}

async function probePreferencesSaveApi() {
  try {
    const data = await api('/api/preferences/save');
    return Boolean(data?.preferencesSave ?? data?.ok);
  } catch {
    return false;
  }
}

async function patchPreferencesApi(patch, extraOpts = {}) {
  const body = JSON.stringify({ patch });
  const tries = [
    () => api('/api/settings', { method: 'PATCH', body, ...extraOpts }),
    () => api('/api/preferences/save', { method: 'POST', body, ...extraOpts }),
    () => api('/api/preferences', { method: 'POST', body, ...extraOpts }),
    () => api('/api/preferences', { method: 'PATCH', body, ...extraOpts }),
  ];
  let lastErr;
  for (const fn of tries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.status !== 404) throw e;
    }
  }
  throw lastErr;
}

function getTauriInvoke() {
  return (
    window.__TAURI__?.core?.invoke ||
    window.__TAURI_INTERNALS__?.invoke ||
    window.__TAURI__?.invoke
  );
}

/** Desktop inject (#hh-desktop-health-banner) — снять после успешной загрузки очереди. */
function clearDesktopHealthBanner() {
  document.getElementById('hh-desktop-health-banner')?.remove();
}

async function pingDashboardHealth(timeoutMs = 12_000) {
  try {
    const r = await fetch(new URL('/api/health', window.location.origin), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return false;
    const j = await r.json();
    return j?.ok === true;
  } catch {
    return false;
  }
}

async function recoverDashboardIfStuck() {
  const invoke = getTauriInvoke();
  if (!invoke) return false;
  try {
    return Boolean(await invoke('restart_dashboard_sidecar'));
  } catch {
    return false;
  }
}

async function patchPreferencesApiWithRetry(patch, extraOpts = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      if (!(await pingDashboardHealth(4000))) {
        await recoverDashboardIfStuck();
      }
      await new Promise((r) => setTimeout(r, 900 * attempt));
    }
    try {
      return await patchPreferencesApi(patch, extraOpts);
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (attempt >= 2 || !/abort|timeout|timed out|fetch|network/i.test(msg)) throw e;
    }
  }
  throw lastErr;
}

function initDesktopDashboardWatchdog() {
  if (!getTauriInvoke()) return;
  let recovering = false;
  let lastToastAt = 0;
  const tick = async () => {
    if (recovering) return;
    // 12s: saveQueue большой очереди раньше занимал ~5с и ложно ронял health за 4с
    if (await pingDashboardHealth(12_000)) return;
    recovering = true;
    try {
      const ok = await recoverDashboardIfStuck();
      if (ok && (await pingDashboardHealth(15_000))) {
        if (Date.now() - lastToastAt > 60_000) {
          lastToastAt = Date.now();
          showToast('Дашборд перезапущен — обновляем очередь и настройки', 'neutral');
        }
        load({ preserveScroll: true });
        window.dispatchEvent(new CustomEvent('hh:dashboard-recovered'));
      }
    } finally {
      recovering = false;
    }
  };
  setInterval(tick, 40_000);
  setTimeout(tick, 8000);
}

async function saveSettingsFromUI() {
  if (preferencesSaveAvailable === false) {
    setSettingsHint('Перезапустите дашборд: npm run devops:dashboard, затем F5', 'err');
    return;
  }
  markSettingsSaving();
  const patch = readSettingsPatchFromUI();
  const saveSignal =
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(30_000)
      : undefined;
  try {
    if (!(await pingDashboardHealth(3500))) {
      await recoverDashboardIfStuck();
    }
    const res = await patchPreferencesApiWithRetry(patch, saveSignal ? { signal: saveSignal } : {});
    const prefs = { ...(res.preferences || {}) };
    const uiFromApi = res.ui ? { ...res.ui } : {};
    if (!prefs.dashboardSidebarPanelSides && patch.dashboardSidebarPanelSides) {
      prefs.dashboardSidebarPanelSides = patch.dashboardSidebarPanelSides;
    }
    if (!uiFromApi.panelSides && patch.dashboardSidebarPanelSides) {
      uiFromApi.panelSides = patch.dashboardSidebarPanelSides;
    }
    if (res.preferences) applyPreferencesToSettingsUI(res.preferences, prefBounds);
    if (isSettingsModalOpen()) {
      queueSettingsUiRefreshAfterSettings(prefs, res.ui ? uiFromApi : undefined);
      if (res.applyRates) queueSettingsApplyRatesRefresh(res.applyRates);
      queueDashboardRefreshAfterSettings();
    } else {
      applyDashboardUiFromPreferences(prefs, res.ui ? uiFromApi : undefined);
      if (res.applyRates) renderApplyRateMeters(res.applyRates);
    }
    dispatchPrefsUpdated(prefs);
    markSettingsSaved();
    flashSettingsSaved();
    if (!isSettingsModalOpen()) {
      invalidateLetterStatsCache();
      invalidateLettersSnapshot();
      void refreshLetterStatsSidebar(true);
      load({ preserveScroll: true });
    }
  } catch (e) {
    markSettingsSaveFailed();
    const msg = String(e?.message || e);
    const hint =
      e.status === 404
        ? 'Сервер без сохранения лимитов — перезапустите: npm run devops:dashboard, затем F5'
        : /abort|timeout|timed out/i.test(msg)
          ? getTauriInvoke()
            ? 'Сохранение: дашборд не ответил — перезапуск… подождите 5 с и нажмите «Сохранить сейчас»'
            : 'Сохранение: дашборд не ответил — npm run desktop:start, затем F5'
          : humanApiError(e);
    setSettingsHint(hint, 'err');
  }
}

const scheduleSaveSettings = debounce(() => {
  if (!settingsHydrated || preferencesSaveAvailable === false) return;
  saveSettingsFromUI();
}, 500);

function flushSaveSettings() {
  scheduleSaveSettings.flush();
}

function getBatchLimitForRun() {
  const cap = Number(batchLimitEl?.max) || batchSizeCap || 100;
  return Math.min(cap, Math.max(1, Number(batchLimitEl?.value) || 10));
}

function normalizeBatchHuntTrackIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => batchHuntTrackIds.includes(String(id || '').trim()));
}

function readBatchHuntTracksFromSession() {
  try {
    const raw = sessionStorage.getItem(BATCH_HUNT_TRACKS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const normalized = normalizeBatchHuntTrackIds(parsed);
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function persistBatchHuntTracksSelection(ids) {
  const normalized = normalizeBatchHuntTrackIds(ids);
  const tracks = normalized.length ? normalized : [...defaultBatchHuntTracks];
  try {
    sessionStorage.setItem(BATCH_HUNT_TRACKS_SESSION_KEY, JSON.stringify(tracks));
  } catch {
    /* ignore */
  }
  dashboardPreferences = { ...dashboardPreferences, batchHuntTracks: tracks };
  void patchPreferencesApi({ batchHuntTracks: tracks }).catch(() => {});
  return tracks;
}

function syncBatchHuntTracksUi(tracks) {
  const group = document.getElementById('batch-hunt-tracks');
  if (!group) return;
  const selected = new Set(normalizeBatchHuntTrackIds(tracks));
  if (!selected.size) {
    for (const id of defaultBatchHuntTracks) selected.add(id);
  }
  group.querySelectorAll('[data-hunt-track]').forEach((btn) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    const on = selected.has(btn.dataset.huntTrack || '');
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

async function hydrateHuntTracksBar() {
  const group = document.getElementById('batch-hunt-tracks');
  if (!group) return;
  try {
    const data = await api('/api/hunt-tracks');
    const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    if (!tracks.length) return;
    batchHuntTrackIds = tracks.map((t) => String(t.id || '').trim()).filter(Boolean);
    const metaDefaults = Array.isArray(data?.meta?.defaultActiveTracks) ? data.meta.defaultActiveTracks : [];
    const fromBatch = tracks.filter((t) => t.batch?.defaultIncluded).map((t) => t.id);
    defaultBatchHuntTracks = normalizeBatchHuntTrackIds(metaDefaults.length ? metaDefaults : fromBatch);
    if (!defaultBatchHuntTracks.length) {
      defaultBatchHuntTracks = batchHuntTrackIds.slice(0, Math.min(2, batchHuntTrackIds.length));
    }
    group.innerHTML = '';
    for (const t of tracks) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-btn';
      btn.dataset.huntTrack = t.id;
      btn.textContent = t.labelShort || t.labelRu || t.id;
      if (t.labelRu && t.labelRu !== btn.textContent) btn.title = t.labelRu;
      btn.setAttribute('aria-pressed', 'false');
      group.appendChild(btn);
    }
    delete group.dataset.bound;
    const session = readBatchHuntTracksFromSession();
    if (session && !session.some((id) => batchHuntTrackIds.includes(id))) {
      try {
        sessionStorage.removeItem(BATCH_HUNT_TRACKS_SESSION_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* devops defaults */
  }
}

function initBatchHuntTracksUi() {
  const group = document.getElementById('batch-hunt-tracks');
  if (!group || group.dataset.bound === '1') return;
  group.dataset.bound = '1';
  const initial =
    readBatchHuntTracksFromSession() ||
    normalizeBatchHuntTrackIds(dashboardPreferences?.batchHuntTracks) ||
    [...defaultBatchHuntTracks];
  syncBatchHuntTracksUi(initial);
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hunt-track]');
    if (!(btn instanceof HTMLButtonElement) || !group.contains(btn)) return;
    e.preventDefault();
    const trackId = btn.dataset.huntTrack || '';
    if (!batchHuntTrackIds.includes(trackId)) return;
    const selected = new Set(getSelectedHuntTracks());
    if (selected.has(trackId)) {
      if (selected.size <= 1) {
        showToast('Нужен хотя бы один маршрут', 'neutral');
        return;
      }
      selected.delete(trackId);
    } else {
      selected.add(trackId);
    }
    const next = persistBatchHuntTracksSelection([...selected]);
    syncBatchHuntTracksUi(next);
    renderListFromCache(null);
  });
}

function getSelectedHuntTracks() {
  const group = document.getElementById('batch-hunt-tracks');
  if (group) {
    const fromUi = [...group.querySelectorAll('[data-hunt-track][aria-pressed="true"]')]
      .map((btn) => btn.dataset.huntTrack)
      .filter(Boolean);
    const normalized = normalizeBatchHuntTrackIds(fromUi);
    if (normalized.length) return normalized;
  }
  const fromSession = readBatchHuntTracksFromSession();
  if (fromSession?.length) return fromSession;
  const fromPrefs = normalizeBatchHuntTrackIds(dashboardPreferences?.batchHuntTracks);
  if (fromPrefs.length) return fromPrefs;
  return [...defaultBatchHuntTracks];
}

function showUiTrimHintOnce() {
  try {
    if (localStorage.getItem(UI_TRIM_HINT_LS_KEY) === '1') return;
    if (dashboardUi.uiMode !== UI_MODES.simple) return;
    localStorage.setItem(UI_TRIM_HINT_LS_KEY, '1');
    showToast(glossaryLabel('uiTrimHint', dashboardUi.uiMode), 'neutral');
  } catch {
    /* ignore */
  }
}

async function loadDashboardSettings() {
  try {
    /** @type {Record<string, unknown>} */
    let data;
    try {
      data = await api('/api/settings');
    } catch (e) {
      if (e?.status === 404) data = await api('/api/preferences');
      else throw e;
    }
    if (data.conversionPresets) settingsModalHooks?.setConversionPresetsFromApi?.(data.conversionPresets);
    if (data.registry) setSettingsRegistryMeta(data.registry);
    const fromGet = data.apiFeatures?.preferencesSave === true;
    preferencesSaveAvailable = fromGet || (await probePreferencesSaveApi());
    applyPreferencesToSettingsUI(data.preferences, data.bounds);
    applyDashboardUiFromPreferences(data.preferences, data.ui);
    await hydrateHuntTracksBar();
    initBatchHuntTracksUi();
    showUiTrimHintOnce();
    if (data.applyRates) renderApplyRateMeters(data.applyRates);
    await refreshProfileSelect();
    if (data.systemStatus) settingsModalHooks?.renderSystemHealth?.(data.systemStatus);
    if (!preferencesSaveAvailable) {
      setSettingsHint('Сохранение недоступно — перезапустите дашборд (npm run devops:dashboard)', 'err');
    }
    settingsModalHooks?.afterPreferencesLoaded();
  } catch {
    settingsHydrated = true;
    preferencesSaveAvailable = false;
    await hydrateHuntTracksBar();
    initBatchHuntTracksUi();
    settingsModalHooks?.afterPreferencesLoaded();
  }
}

function closeSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (!settingsModal || settingsModal.hidden) return;
  if (!tryCloseSettingsModal()) return;
  settingsFocusTrapCleanup?.();
  settingsFocusTrapCleanup = null;
  settingsModal.hidden = true;
  closeModalEl(settingsModal);
  unlockBodyScrollForSettings();
  const shell = settingsModal.querySelector('.settings-shell');
  shell?.classList.remove(
    'settings-shell--pick',
    'settings-shell--drill',
    'settings-shell--solo',
    'settings-shell--sidebar',
    'settings-shell--wide'
  );
  const back = document.getElementById('settings-zone-back');
  if (back) {
    back.hidden = true;
    back.setAttribute('aria-hidden', 'true');
  }
  settingsShellLayoutFrozen = false;
  void flushDashboardRefreshAfterSettings();
  void refreshJobStatus();
}

function resetAppearanceSettingsSection({ includeLocalVisual = false } = {}) {
  const msg = includeLocalVisual
    ? 'Сбросить фильтры, панели «Стандарт», тему (тёмная), масштаб 100%, карточки «Средний» и размер окна настроек?'
    : 'Сбросить фильтры списка и пресет панелей «Стандарт»? Масштаб, тема и окно настроек не меняются.';
  if (!window.confirm(msg)) return;
  document.getElementById('filter-reset')?.click();
  applyLayoutPreset('standard');
  if (includeLocalVisual) {
    import('./settings-modal.mjs').then((m) => {
      m.resetLocalAppearanceVisuals();
      m.resetSettingsModalLayout();
    });
  }
  showToast(
    includeLocalVisual ? 'Интерфейс, тема и окно настроек сброшены' : 'Интерфейс: фильтры и панели сброшены',
    'neutral'
  );
}

function updateScoreBandTabLabels() {
  const t = scoreThreshold;
  document.querySelectorAll('.tab-band[data-band="high"]').forEach((el) => {
    el.textContent = `${COPY.tabRecommended} ≥${t}`;
  });
  document.querySelectorAll('.tab-band[data-band="low"]').forEach((el) => {
    el.textContent = `${COPY.tabBelowThreshold} <${t}`;
  });
  const autoBtn = document.getElementById('btn-batch-auto');
  if (autoBtn) autoBtn.textContent = `${COPY.batchAuto} (≥${t})`;
  const manualBtn = document.getElementById('btn-batch-manual');
  if (manualBtn) manualBtn.textContent = `${COPY.batchManual} (<${t})`;
}

/** Запасные фильтры ролей (если дашборд без актуального API). */
function itemRoleFilterBlob(item) {
  return [
    item.title,
    item.company,
    item.searchQuery,
    item.descriptionPreview,
    item.geminiSummary,
    ...(Array.isArray(item.geminiTags) ? item.geminiTags : []),
  ]
    .filter(Boolean)
    .join('\n');
}

function itemLooksSeniorOrLead(item) {
  const blob = itemRoleFilterBlob(item);
  return /\bsenior\b|\bсеньор\b|\btech\s*lead\b|\bteam\s*lead\b|\btechlead\b|\bтех\s*лид\b|\bтим\s*лид\b|\blead\s+(go|golang|python|java|ml|mlops|devops|sre)\b|\b(go|golang|python|java|ml|mlops|devops|sre)\s+lead\b/i.test(
    blob
  );
}

function itemLooks1CRole(item) {
  const blob = itemRoleFilterBlob(item);
  if (/\b1\s*[-:.]?\s*[сc]\b/i.test(blob) || /1[сc]:/i.test(blob)) return true;
  if (/\b(ит[-\s]?)?архитектор\b/i.test(blob) && /\b1\s*[-.]?\s*[сc]\b/i.test(blob)) return true;
  return /\b1с:предприятие\b|\bархитектор\s+1[сc]\b|\bит[-\s]?архитектор\b|\bпрограммист\s+1[сc]\b|\berp\s+1[сc]\b/i.test(
    blob
  );
}

/** QA-контур (:3850): Senior/Lead в заголовке — целевые роли, не шум DevOps. */
function isQaHuntDashboard() {
  return batchHuntTrackIds.some((id) =>
    ['qa-lead', 'senior-qa', 'aqa-ai-assist', 'manual-qa'].includes(String(id || '').trim())
  );
}

function itemPassesRoleFilters(item) {
  if (itemLooks1CRole(item)) return false;
  if (isQaHuntDashboard()) return true;
  return !itemLooksSeniorOrLead(item);
}

function vacancyHasHhApply(item) {
  const h = item?.hhApply;
  if (!h) return false;
  if (Boolean(h.responseSubmitted)) return true;
  if (h.questionnaire?.status === 'pending_manual') return false;
  return false;
}

function vacancyQuestionnairePending(item) {
  if (item?.hhApply?.responseSubmitted) return false;
  const q = item?.hhApply?.questionnaire;
  if (q?.status === 'pending_manual') return true;
  if (q?.likelyFromVacancyText) return true;
  return false;
}

function hhApplyBadgeText(item) {
  const h = item?.hhApply;
  if (!h?.lastAt && !vacancyQuestionnairePending(item)) return '';
  const parts = [];
  if (h.hhSiteState === 'invited') parts.push('приглашение hh.ru');
  else if (h.hhSiteState === 'declined') parts.push('отказ hh.ru');
  else if (h.hhSiteState === 'viewed') parts.push('просмотрели');
  else if (h.hhSiteState === 'awaiting') parts.push('ждём ответа');
  else if (h.hhSiteState === 'already_applied') {
    parts.push(h.hhDetectedOnly ? 'отклик на hh.ru (сайт)' : 'отклик на hh.ru');
  }
  if (h.letterDelivered) parts.push('письмо доставлено');
  else if (h.letterInForm) parts.push('письмо в форме');
  else if (h.chatSent) parts.push('письмо в чате');
  else if (h.responseSubmitted) parts.push('отклик без письма');
  const rl4 = h.resumeL4;
  if (rl4?.status === 'applied') parts.push(`L4 на hh.ru (${rl4.mode || 'ok'})`);
  else if (rl4?.status === 'skipped' && rl4.reason) {
    parts.push(`L4: ${rl4.reason.length > 40 ? 'пропущено' : rl4.reason}`);
  } else if (rl4?.status === 'failed') parts.push('L4: ошибка записи');
  const roleLabel =
    h.resumeTitleSelected || h.resumeTitlePlanned || item.resumeRouting?.label || h.resumeRole;
  if (roleLabel) {
    const rolePart = String(roleLabel).replace(/^Резюме:\s*/i, '');
    if (h.resumeMatchOk === false) parts.push(`резюме ⚠ ${rolePart}`);
    else parts.push(`резюме: ${rolePart}`);
  }
  const when = new Date(h.lastAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Отклик: ${parts.join(' · ') || 'отправлен'} · ${when}`;
}

/** Нормализованные веса для подсказки к скору (как в lib/openrouter-score.mjs) */
let scoreWeights = { vacancy: 0.35, cvMatch: 0.65 };

/** @type {{ id: string, variants: string[], selectedIndex: number } | null} */
let draftModalState = null;

document.addEventListener('click', () => {
  document.querySelectorAll('.model-info-panel').forEach((p) => {
    p.hidden = true;
  });
});

function showToast(message, variant = 'neutral', opts = {}) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${variant}`;
  t.setAttribute('role', 'status');
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--visible'));
  const hide = () => {
    t.classList.remove('toast--visible');
    setTimeout(() => t.remove(), 280);
  };
  const durationMs = Number(opts.durationMs) > 0 ? Number(opts.durationMs) : 2600;
  setTimeout(hide, durationMs);
}

/** @param {unknown} payload */
function normalizeInstanceInfo(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const info = /** @type {Record<string, unknown>} */ (payload);
  const instanceId = String(info.instanceId || info.id || '').trim().toLowerCase();
  const labelRaw = String(info.label || '').trim();
  const portRaw = Number(info.port);
  const fallbackPort = Number(window.location.port);
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : Number.isFinite(fallbackPort) ? fallbackPort : null;
  const label = labelRaw || formatInstanceBadge(instanceId, port || '');
  const resumeTitle = String(info.resumeTitle || info.hhResumeTitle || '').trim();
  if (!label) return null;
  return { instanceId, label, resumeTitle };
}

/** @param {{ instanceId?: string, label: string, resumeTitle?: string }} info */
function renderInstanceBadge(info) {
  if (!instanceBadgeEl) return;
  instanceBadgeEl.textContent = info.label;
  instanceBadgeEl.hidden = false;
  instanceBadgeEl.classList.remove('instance-badge--emil', 'instance-badge--anastasia');
  if (info.instanceId === 'emil') instanceBadgeEl.classList.add('instance-badge--emil');
  if (info.instanceId === 'anastasia') instanceBadgeEl.classList.add('instance-badge--anastasia');
}

/** @param {{ label: string, resumeTitle?: string }} info */
function maybeShowInstanceToast(info) {
  try {
    if (sessionStorage.getItem(INSTANCE_TOAST_SESSION_KEY) === '1') return;
    const resumeTitle = String(info.resumeTitle || '').trim() || 'не указано';
    showToast(`Профиль: ${info.label} · резюме: ${resumeTitle}`, 'neutral', { durationMs: 6200 });
    sessionStorage.setItem(INSTANCE_TOAST_SESSION_KEY, '1');
  } catch {
    /* ignore session storage in private mode */
  }
}

async function hydrateInstanceBadge() {
  if (!instanceBadgeEl) return;
  try {
    const payload = await api('/api/instance');
    const info = normalizeInstanceInfo(payload);
    if (!info) return;
    renderInstanceBadge(info);
    maybeShowInstanceToast(info);
  } catch {
    /* endpoint может отсутствовать на старом backend */
  }
}

function batchPrecheckReasonLabel(key) {
  const m = {
    'work-format': 'формат работы',
    'off-target-blue-collar': 'рабочие специальности',
    'off-target-l1': 'L1 поддержка',
    'off-target-sales': 'продажи/presale',
    'off-target-network': 'сетевые/телеком',
    'off-target-industrial': 'промышленный/полевой',
    'off-target-no-it-profile': 'нет IT-профиля',
    'off-target-promo': 'промо/служебные',
    'off-target': 'нецелевая',
    letterQuality: 'качество письма',
    fixableLetterQuality: 'можно подготовить автоматически',
    hh_state: 'уже на hh.ru',
  };
  return m[key] || key;
}

function batchPrecheckSummaryText(precheck) {
  if (!precheck || typeof precheck !== 'object') return '';
  const blocked = precheck.blocked || {};
  const top = Object.entries(blocked)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${batchPrecheckReasonLabel(k)}: ${v}`);
  let extra = '';
  if (Number(precheck.fixableLetterQuality || 0) > 0) {
    extra = `\nАвтоподготовка: ${precheck.fixableLetterQuality} (полировка/роль без LLM)`;
  }
  return (top.length ? `\nБлокеры: ${top.join(' · ')}` : '') + extra;
}

function batchPrecheckTopSampleText(precheck) {
  const blocked = precheck?.blocked || {};
  const samples = precheck?.blockedSamples || {};
  const top = Object.entries(blocked).sort((a, b) => b[1] - a[1])[0];
  if (!top) return '';
  const [key] = top;
  const first = Array.isArray(samples[key]) ? samples[key][0] : null;
  if (!first?.title) return '';
  const why = first.reason ? ` — ${first.reason}` : '';
  return `\nПример: ${first.title}${why}`.slice(0, 260);
}

function setLetterIssuesFilter(enabled) {
  for (const el of [filterLetterQualityBtnEl, letterToolbarChipEl]) {
    if (!el) continue;
    el.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    el.classList.toggle('active', enabled);
  }
}

function dashboardOriginHint() {
  try {
    const { protocol, hostname, port } = window.location;
    if (port) return `${protocol}//${hostname}:${port}`;
    return `${protocol}//${hostname}`;
  } catch {
    return 'http://127.0.0.1:3849';
  }
}

function formatFetchError(err, path) {
  if (isAbortLikeApiError(err)) {
    return humanApiError(err);
  }
  const msg = err?.message || String(err);
  if (msg === 'Failed to fetch' || /failed to fetch/i.test(msg)) {
    return (
      'Нет связи с дашбордом. Запустите в терминале: npm run dashboard\n' +
      `и откройте ${dashboardOriginHint()} (не file://).`
    );
  }
  if (/loadDevOpsEnv|ReferenceError/i.test(msg)) {
    return 'Ошибка сервера при запуске поиска — обновите код и перезапустите npm run dashboard';
  }
  return humanApiError(err);
}

/** @param {unknown} value */
function displayStatusText(value) {
  return coerceInterviewLine(value);
}

/** @param {{ label?: unknown } | null | undefined} progress */
function progressStatusLabel(progress) {
  return displayStatusText(progress?.label);
}

async function api(path, opts = {}) {
  const url =
    typeof path === 'string' && path.startsWith('/')
      ? new URL(path, window.location.origin).toString()
      : path;
  let r;
  try {
    r = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
  } catch (err) {
    const canRecover =
      typeof path === 'string' &&
      path.startsWith('/api/') &&
      getTauriInvoke() &&
      /failed to fetch|networkerror|network error/i.test(String(err?.message || err));
    if (canRecover) {
      const recovered = await recoverDashboardIfStuck();
      if (recovered) {
        try {
          r = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            ...opts,
          });
        } catch (retryErr) {
          const e = new Error(formatFetchError(retryErr, path));
          e.cause = retryErr;
          throw e;
        }
      } else {
        const e = new Error(formatFetchError(err, path));
        e.cause = err;
        throw e;
      }
    } else {
      const e = new Error(formatFetchError(err, path));
      e.cause = err;
      throw e;
    }
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const looksHtml = /^\s*</.test(text);
    const hint =
      r.status === 404 && (text.trim() === 'Not found' || looksHtml)
        ? `Ответ не JSON (часто 404 у статики). Запустите дашборд: npm run dashboard и откройте ${dashboardOriginHint()}`
        : text.slice(0, 400) || r.statusText;
    const err = new Error(hint);
    err.status = r.status;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function requestCoverLetterGenerate(id, force = false) {
  return api('/api/cover-letter/generate', {
    method: 'POST',
    body: JSON.stringify({ id, force }),
  });
}

async function requestCoverLetterImprove(id) {
  return api('/api/cover-letter/improve', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

async function requestCoverLetterBulkImprove(opts = {}) {
  return api('/api/cover-letter/bulk-improve', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

async function requestCoverLetterPrepareText(id, text) {
  return api('/api/cover-letter/prepare-text', {
    method: 'POST',
    body: JSON.stringify({ id, text }),
  });
}

async function requestCoverLetterEvaluate(id, text) {
  return api('/api/cover-letter/evaluate', {
    method: 'POST',
    body: JSON.stringify({ id, text }),
  });
}

/**
 * Read-only превью employer-rag в модалке письма.
 * @param {HTMLElement} mount
 * @param {object} item
 */
async function mountEmployerRagPreview(mount, item) {
  if (!mount || !item?.id) return;
  mount.innerHTML = '';
  if (!item.company && !item.employerIntel) return;

  const details = document.createElement('details');
  details.className = 'employer-rag-preview';
  details.hidden = true;

  const summary = document.createElement('summary');
  summary.textContent = 'Контекст работодателя для LLM';
  details.appendChild(summary);

  const scrollBody = document.createElement('div');
  scrollBody.className = 'employer-rag-preview__body';
  const pre = document.createElement('pre');
  pre.className = 'employer-rag-preview__text';
  pre.textContent = 'Загрузка…';
  scrollBody.appendChild(pre);
  details.appendChild(scrollBody);
  mount.appendChild(details);

  try {
    const res = await api(
      `/api/cover-letter/employer-context?id=${encodeURIComponent(item.id)}`
    );
    if (!res.enabled || !res.block) {
      mount.innerHTML = '';
      return;
    }
    pre.textContent = res.block;
    details.hidden = false;
  } catch {
    const intel = item.employerIntel;
    if (!intel?.applied) {
      mount.innerHTML = '';
      return;
    }
    pre.textContent = [
      `РАБОТОДАТЕЛЬ «${intel.company || item.company}» (рейтинг ${intel.score}/100):`,
      `История: откликов ${intel.applied}, приглашений ${intel.inviteRatePct}%, тишина ${intel.ghost}.`,
    ].join('\n');
    details.hidden = false;
  }
}

/**
 * Превью L4-подгонки резюме в модалке письма.
 * @param {HTMLElement} mount
 * @param {object} item
 */
function renderManifestSlotLines(manifest) {
  if (!manifest?.slots?.length) return '';
  const lines = [];
  for (const s of manifest.slots) {
    const audit =
      s.audit?.score != null
        ? ` · AI ${s.audit.score}${s.audit.pass ? '' : ' ⚠'}`
        : '';
    const label =
      s.id === 'aboutMe'
        ? 'О себе'
        : s.id === 'skills'
          ? 'Навыки'
          : s.id.startsWith('experience.')
            ? `Опыт #${(s.experienceIndex ?? 0) + 1}`
            : s.id;
    const body =
      s.kind === 'skills'
        ? Array.isArray(s.value)
          ? s.value.join(', ')
          : '—'
        : String(s.value || '—');
    lines.push(`▸ ${label}${audit}\n${s.reason ? `  (${s.reason})\n` : ''}${body}`);
  }
  if (manifest.skippedSlots?.length) {
    lines.push(
      '',
      'Пропущено:',
      ...manifest.skippedSlots.map((s) => `  · ${s.id}: ${s.reason}`)
    );
  }
  return lines.join('\n\n');
}

/**
 * @param {object} manifest
 * @param {HTMLElement} host
 */
function renderManifestSlotsDom(manifest, host) {
  host.innerHTML = '';
  if (!manifest?.slots?.length) return;

  for (const s of manifest.slots) {
    const slotEl = document.createElement('section');
    slotEl.className = 'resume-l4-slot';
    const audit =
      s.audit?.score != null
        ? ` · AI ${s.audit.score}${s.audit.pass ? '' : ' ⚠'}`
        : '';
    const label =
      s.id === 'aboutMe'
        ? 'О себе'
        : s.id === 'skills'
          ? 'Навыки'
          : s.id.startsWith('experience.')
            ? `Опыт #${(s.experienceIndex ?? 0) + 1}`
            : s.id;
    const head = document.createElement('h4');
    head.className = 'resume-l4-slot__title';
    head.textContent = `${label}${audit}`;
    slotEl.appendChild(head);
    if (s.reason) {
      const reason = document.createElement('p');
      reason.className = 'resume-l4-slot__reason muted';
      reason.textContent = s.reason;
      slotEl.appendChild(reason);
    }
    const body = document.createElement('div');
    body.className = 'resume-l4-slot__body';
    if (s.kind === 'skills') {
      body.textContent = Array.isArray(s.value) ? s.value.join(', ') : '—';
    } else {
      const pre = document.createElement('pre');
      pre.className = 'resume-l4-slot__text';
      pre.textContent = String(s.value || '—');
      body.appendChild(pre);
    }
    slotEl.appendChild(body);
    host.appendChild(slotEl);
  }

  if (manifest.skippedSlots?.length) {
    const skipped = document.createElement('details');
    skipped.className = 'resume-l4-skipped';
    const sum = document.createElement('summary');
    sum.textContent = `Пропущено (${manifest.skippedSlots.length})`;
    skipped.appendChild(sum);
    const ul = document.createElement('ul');
    ul.className = 'resume-l4-skipped__list';
    for (const s of manifest.skippedSlots) {
      const li = document.createElement('li');
      li.textContent = `${s.id}: ${s.reason}`;
      ul.appendChild(li);
    }
    skipped.appendChild(ul);
    host.appendChild(skipped);
  }
}

/** @param {object} ms */
function normalizeResumeL4MatchScore(ms = {}) {
  return {
    harvest: ms.harvest ?? ms.scoreHarvest,
    fit: ms.fit ?? ms.scoreFit,
    projected: ms.projected ?? ms.scoreProjected,
    delta: ms.delta,
    hrStackSummary: ms.hrStackSummary,
  };
}

/** @param {object} res */
function formatResumeL4EditsLine(res) {
  if (res.editsMax == null) return null;
  if (res.canEditToday === false) {
    return `Лимит правок резюме на сегодня исчерпан (${res.editsToday}/${res.editsMax}).`;
  }
  return `Правок резюме сегодня: ${res.editsToday}/${res.editsMax} (осталось ${res.editsRemaining}).`;
}

/** @param {object} res @param {{ loading?: boolean }} [opts] */
function buildResumeL4MetaText(res, opts = {}) {
  const ms = normalizeResumeL4MatchScore(res.matchScore || {});
  const scoreLines = [
    ms.harvest != null ? `Harvest (LLM): ${ms.harvest}` : null,
    ms.fit != null ? `Соответствие сейчас: ${ms.fit}` : null,
    ms.projected != null ? `После подгонки: ~${ms.projected}${ms.delta ? ` (+${ms.delta})` : ''}` : null,
    ms.hrStackSummary ? `Стек: ${ms.hrStackSummary}` : null,
  ].filter(Boolean);
  const gapPct = res.gap?.gapScore != null ? `Совпадение ключей: ${res.gap.gapScore}%.` : '';
  const missing =
    res.gap?.missing?.length > 0
      ? `Пробелы (не в резюме): ${res.gap.missing.slice(0, 8).join(', ')}`
      : '';
  if (!res.wouldUseL4) {
    return [
      scoreLines.join('\n'),
      gapPct,
      res.reason || 'Подгонка не требуется.',
      res.roleMismatchHint || null,
      res.applyAtHint || null,
      missing,
      formatResumeL4EditsLine(res),
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  const parts = [
    scoreLines.join('\n'),
    gapPct,
    res.mode ? `Режим: ${res.mode}` : null,
    res.roleMismatchHint || null,
    res.applyAtHint || null,
    formatResumeL4EditsLine(res),
    res.gap?.missing?.length ? `Пробелы: ${res.gap.missing.slice(0, 6).join(', ')}` : null,
    res.employerBrief ? `Контекст компании:\n${res.employerBrief.slice(0, 400)}` : null,
  ];
  if (opts.loading && res.quick) {
    parts.push('Генерация текста слотов LLM… (обычно 30–90 с, повторное открытие — мгновенно)');
  } else if (res.cached) {
    parts.push('Из кэша');
  }
  return parts.filter(Boolean).join('\n\n');
}

/** @param {HTMLElement} slotsEl @param {object[]} planSlots */
function renderResumeL4PlanSkeleton(slotsEl, planSlots) {
  slotsEl.innerHTML = '';
  for (const s of planSlots || []) {
    const slotEl = document.createElement('section');
    slotEl.className = 'resume-l4-slot resume-l4-slot--pending';
    const head = document.createElement('h4');
    head.className = 'resume-l4-slot__title';
    head.textContent = s.label || s.id;
    slotEl.appendChild(head);
    if (s.reason) {
      const reason = document.createElement('p');
      reason.className = 'resume-l4-slot__reason muted';
      reason.textContent = s.reason;
      slotEl.appendChild(reason);
    }
    const pending = document.createElement('p');
    pending.className = 'resume-l4-slot__pending muted';
    pending.textContent = '…';
    slotEl.appendChild(pending);
    slotsEl.appendChild(slotEl);
  }
}

/**
 * @param {HTMLElement} metaEl
 * @param {HTMLElement} slotsEl
 * @param {HTMLElement} scrollBody
 * @param {object} res
 */
function applyResumeL4PreviewResponse(metaEl, slotsEl, scrollBody, res, opts = {}) {
  metaEl.textContent = buildResumeL4MetaText(res, {
    loading: opts.loading ?? Boolean(res.quick),
  });
  scrollBody.querySelectorAll('.resume-l4-taskblocks').forEach((n) => n.remove());

  if (!res.wouldUseL4) {
    slotsEl.innerHTML = '';
    return;
  }

  if (res.manifest?.slots?.length) {
    renderManifestSlotsDom(res.manifest, slotsEl);
  } else if (res.quick && res.planSlots?.length) {
    renderResumeL4PlanSkeleton(slotsEl, res.planSlots);
  } else {
    slotsEl.innerHTML = '';
    const fallback = document.createElement('pre');
    fallback.className = 'resume-l4-slot__text';
    fallback.textContent = renderManifestSlotLines(res.manifest) || [
      res.aboutMe ? `О себе:\n${res.aboutMe}` : null,
      ...(res.experienceEntries || []).map((e, i) => `Опыт #${i + 1}:\n${e.text || '—'}`),
      res.skills?.length ? `Навыки: ${res.skills.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    slotsEl.appendChild(fallback);
  }

  if (res.taskBlocksText) {
    const tb = document.createElement('details');
    tb.className = 'resume-l4-taskblocks';
    const tbSum = document.createElement('summary');
    tbSum.textContent = 'Блоки задач из вакансии';
    const tbPre = document.createElement('pre');
    tbPre.className = 'resume-l4-slot__text';
    tbPre.textContent = res.taskBlocksText;
    tb.append(tbSum, tbPre);
    scrollBody.appendChild(tb);
  }
  if (!opts.loading && !res.quick) {
    void attachResumeHhRestoreUi(scrollBody);
  }
}

async function requestResumeHhRestore(resumeHash) {
  if (
    !confirm(
      'Вернуть резюме на hh.ru к состоянию до L4-подгонки?\n\nОткроется окно Chromium с профилем hh.'
    )
  ) {
    return;
  }
  try {
    const res = await api('/api/resume-hh/restore', {
      method: 'POST',
      body: JSON.stringify({ resumeHash: resumeHash || undefined }),
    });
    showToast(res.message || 'Восстановление запущено', 'good');
  } catch (e) {
    alert(e.message || 'Не удалось запустить restore');
  }
}

async function attachResumeHhRestoreUi(host) {
  if (!host) return;
  host.querySelector('.resume-hh-restore-bar')?.remove();
  try {
    const st = await api('/api/resume-hh/status');
    const bar = document.createElement('div');
    bar.className = 'resume-hh-restore-bar';
    if (st.batchRunning) {
      const p = document.createElement('p');
      p.className = 'resume-hh-restore-bar__hint muted';
      p.textContent = '«Вернуть базовое» недоступно — идёт серия откликов';
      bar.appendChild(p);
    } else if (st.hasSnapshot) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-ghost btn-sm resume-hh-restore-bar__btn';
      btn.textContent = 'Вернуть базовое на hh.ru';
      if (st.savedAt) {
        btn.title = `Снапшот от ${new Date(st.savedAt).toLocaleString('ru-RU')}`;
      }
      btn.addEventListener('click', () => void requestResumeHhRestore(st.resumeHash));
      bar.appendChild(btn);
    } else {
      const p = document.createElement('p');
      p.className = 'resume-hh-restore-bar__hint muted';
      p.textContent =
        'Снапшот для «Вернуть базовое» появится после отклика на hh.ru (кнопка «Авто-отклик» или «С письмом» на карточке), не после черновика письма';
      bar.appendChild(p);
    }
    host.appendChild(bar);
  } catch {
    /* status optional */
  }
}

async function mountResumeL4Preview(mount, item) {
  if (!mount || !item?.id) return;
  mount.innerHTML = '';

  const root = document.createElement('section');
  root.className = 'employer-rag-preview resume-l4-preview';
  root.dataset.loading = '1';

  const heading = document.createElement('h3');
  heading.className = 'resume-l4-preview__heading';
  heading.textContent = 'Подгонка резюме под вакансию';
  root.appendChild(heading);

  const scrollBody = document.createElement('div');
  scrollBody.className = 'employer-rag-preview__body resume-l4-preview__body';
  const metaEl = document.createElement('div');
  metaEl.className = 'resume-l4-preview__meta';
  const slotsEl = document.createElement('div');
  slotsEl.className = 'resume-l4-slots';
  scrollBody.append(metaEl, slotsEl);
  root.appendChild(scrollBody);
  mount.appendChild(root);

  const seq = ++mountResumeL4Preview._seq;
  const apiBase = `/api/cover-letter/resume-l4-preview?id=${encodeURIComponent(item.id)}`;

  const storedPayload = item.resumeL4Preview?.payload;
  if (storedPayload?.manifest?.slots?.length) {
    applyResumeL4PreviewResponse(metaEl, slotsEl, scrollBody, {
      ...storedPayload,
      quick: false,
      cached: true,
    });
    delete root.dataset.loading;
  } else if (item.matchScore) {
    metaEl.textContent = buildResumeL4MetaText(
      { wouldUseL4: true, matchScore: item.matchScore, gap: item.gap },
      { loading: true }
    );
    renderResumeL4PlanSkeleton(slotsEl, [
      { id: 'aboutMe', label: 'О себе' },
      { id: 'skills', label: 'Навыки' },
      { id: 'experience.0', label: 'Опыт #1' },
    ]);
  } else {
    metaEl.textContent = 'Загрузка превью подгонки…';
  }

  try {
    const quick = await api(`${apiBase}&quick=1`);
    if (seq !== mountResumeL4Preview._seq) return;
    applyResumeL4PreviewResponse(metaEl, slotsEl, scrollBody, { ...quick, quick: true }, { loading: true });
    if (!quick.wouldUseL4) {
      delete root.dataset.loading;
      return;
    }
  } catch {
    /* full fetch ниже */
  }

  try {
    const res = await api(apiBase);
    if (seq !== mountResumeL4Preview._seq) return;
    applyResumeL4PreviewResponse(metaEl, slotsEl, scrollBody, res);
    delete root.dataset.loading;
  } catch (e) {
    if (seq !== mountResumeL4Preview._seq) return;
    metaEl.textContent = e.message || 'Не удалось загрузить превью L4';
    slotsEl.innerHTML = '';
    const err = document.createElement('p');
    err.className = 'resume-l4-slot__reason muted';
    err.textContent =
      'Полная генерация слотов не завершилась. Закройте и откройте письмо снова или нажмите «Подготовить».';
    slotsEl.appendChild(err);
    delete root.dataset.loading;
  }
}
mountResumeL4Preview._seq = 0;

async function requestCoverLetterRegenerateWeak(opts = {}) {
  return api('/api/cover-letter/regenerate-weak', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

async function fetchBatchPrecheck(minScore, maxScore, limit) {
  const batchScope = batchScopeForCurrentView();
  const qs = new URLSearchParams({
    batchScope,
    queueStatus: batchScope === 'queue' && currentStatus === 'approved' ? 'approved' : 'pending',
    minScore: String(Math.max(0, Number(minScore || 0))),
    maxScore: String(Math.max(0, Number(maxScore || 0))),
    limit: String(Math.max(1, Number(limit) || getBatchLimitForRun())),
  });
  const huntTracks = getSelectedHuntTracks();
  if (huntTracks.length) qs.set('huntTracks', huntTracks.join(','));
  return api(`/api/batch-precheck?${qs.toString()}`);
}

async function runBulkLetterPrepare(minScore, maxScore) {
  const batchScope = batchScopeForCurrentView();
  return requestCoverLetterBulkImprove({
    batchScope,
    queueStatus: batchScope === 'queue' && currentStatus === 'approved' ? 'approved' : 'pending',
    minScore: Math.max(0, Number(minScore || 0)),
    maxScore: Math.max(0, Number(maxScore || 0)),
  });
}

let letterStatsCache = null;
let letterStatsCacheTs = 0;
let letterCenterKindFilter = 'all';
let letterQualityHubCache = null;
let letterStatsFetchSeq = 0;

function invalidateLetterStatsCache() {
  letterStatsCache = null;
  letterStatsCacheTs = 0;
}

function filterLetterCenterItems(items) {
  if (!Array.isArray(items)) return [];
  if (letterCenterKindFilter === 'all') return items;
  return items.filter((it) => it.kind === letterCenterKindFilter);
}

function updateLetterCenterKindButtons() {
  for (const [el, kind] of [
    [btnLetterCenterFixableEl, 'fixable'],
    [btnLetterCenterFailEl, 'fail'],
    [btnLetterCenterMissingEl, 'missing'],
  ]) {
    if (!el) continue;
    const on = letterCenterKindFilter === kind;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

function renderLetterStatusKpis({ s, hub, warn, baselineGoldenOk }) {
  if (!letterStatsBodyEl) return;
  const needWork = (s?.fixable || 0) + (s?.fail || 0) + (s?.missing || 0);
  const readyPct =
    s?.letterReadyRate != null && s?.approved > 0 ? ` <span class="status-kpi__sub">(${s.letterReadyRate}%)</span>` : '';
  const gl = hub?.golden?.letters;
  const gt = hub?.golden?.targeting;
  let qualityHtml = '';
  if (gl?.total || gt?.total) {
    const parts = [];
    if (gl?.total) {
      parts.push(`письма ${gl.passed}/${gl.total}${gl.ok === false ? ' ⚠' : ''}`);
    }
    if (gt?.total) {
      parts.push(`отбор ${gt.passed}/${gt.total}${gt.ok === false ? ' ⚠' : ''}`);
    }
    qualityHtml = `<div class="status-kpi status-kpi--quality${
      baselineGoldenOk === false ? ' status-kpi--warn' : ''
    }" title="Эталонные проверки качества">
      <span class="status-kpi__label">Качество</span>
      <span class="status-kpi__value">${parts.join(' · ')}</span>
    </div>`;
  }
  const br = hub?.batchReport;
  const batchNote =
    br?.letterQualitySkips > 0
      ? `<p class="status-kpi-note">Серия пропустила ${br.letterQualitySkips} по письмам</p>`
      : '';
  letterStatsBodyEl.innerHTML = `<div class="status-kpi-row">
    <div class="status-kpi">
      <span class="status-kpi__label">Готово</span>
      <span class="status-kpi__value">${s?.pass || 0}/${s?.approved || 0}${readyPct}</span>
    </div>
    <div class="status-kpi${needWork > 0 ? ' status-kpi--warn status-kpi--need-work' : ''}" data-action="letters-issues" title="${
      needWork > 0 ? 'Открыть список проблем писем' : ''
    }">
      <span class="status-kpi__label">Нужна работа</span>
      <span class="status-kpi__value">${needWork}</span>
    </div>
    ${qualityHtml}
  </div>${batchNote}`;
  letterStatsBodyEl.classList.toggle('letter-stats-mini--warn', Boolean(warn));
  letterStatsBodyEl.classList.toggle('letter-stats-mini--golden-warn', baselineGoldenOk === false);
}

function toggleLetterIssuesFilter() {
  const probe = letterToolbarChipEl || filterLetterQualityBtnEl;
  if (!probe) return;
  const next = !(probe.getAttribute('aria-pressed') === 'true');
  setLetterIssuesFilter(next);
  renderListFromCache(null);
  showToast(
    next ? 'Фильтр: только карточки с проблемами письма' : 'Фильтр писем снят',
    'neutral'
  );
}

function openLetterIssuesModal() {
  const modal = document.getElementById('letter-issues-modal');
  if (!modal) return;
  const payload = letterStatsCache?.payload;
  if (payload) {
    renderLetterCenterList(payload.s, payload.issues);
  }
  openModalEl(modal);
}

function openLetterQualityHubModal() {
  const modal = document.getElementById('letter-quality-hub-modal');
  const body = document.getElementById('letter-quality-hub-body');
  if (!modal || !body) return;
  const hub = letterQualityHubCache;
  if (!hub) {
    body.innerHTML = '<p class="modal-hint">Нет данных — откройте раздел очереди с письмами.</p>';
    openModalEl(modal);
    return;
  }
  const gen = hub.metrics?.generate;
  const bl = hub.baseline;
  const gl = hub.golden?.letters;
  const gt = hub.golden?.targeting;
  const rows = [
    ['LLM pass', gen?.qualityPassRate != null ? `${gen.qualityPassRate}%` : '—'],
    ['LLM retry', gen?.qualityRetry ?? '—'],
    [
      glossaryLabel('fpRejected', dashboardUi.uiMode),
      bl?.falsePositiveRate != null ? `${bl.falsePositiveRate}%` : '—',
    ],
    [LETTER_SERIES_READY_LABEL, bl?.letterBatchReadyRate != null ? `${bl.letterBatchReadyRate}%` : '—'],
    ['Invite', bl?.inviteRate != null ? `${bl.inviteRate}%` : '—'],
    [
      'Golden письма',
      gl ? `${gl.passed}/${gl.total}${gl.ok === false ? ' ⚠' : ''}` : '—',
    ],
    [
      'Golden таргет',
      gt ? `${gt.passed}/${gt.total}${gt.ok === false ? ' ⚠' : ''}` : '—',
    ],
  ];
  let html = renderLetterScaleLegendHtml();
  if (gl?.ok === false || gt?.ok === false) {
    html += `<p class="letter-quality-hub-alert">${escapeHtml(glossaryLabel('goldenRegression', dashboardUi.uiMode))} — <code>npm run audit:quality-golden</code></p>`;
  }
  const trends = hub.trends || {};
  const fp7 = trends.falsePositive7d || [];
  const lp7 = trends.letterPass7d || [];
  if (fp7.length || lp7.length) {
    html += '<div class="hub-trends-grid">';
    if (fp7.length) {
      html += `<div><p class="hub-trends-grid__label">${escapeHtml(glossaryLabel('fpRejected', dashboardUi.uiMode))}, 7 дн.</p>${renderSparklineHtml(fp7, { valueKey: 'total', suffix: '', ariaLabel: 'Ложные пропуски за 7 дней' })}</div>`;
    }
    if (lp7.length) {
      html += `<div><p class="hub-trends-grid__label">LLM pass, 7 дн.</p>${renderSparklineHtml(lp7, { valueKey: 'passRate', suffix: '%', ariaLabel: 'Pass rate писем за 7 дней' })}</div>`;
    }
    html += '</div>';
  }
  if (hub.letterNoEdit?.noEditPct != null) {
    html += `<p class="modal-hint">${escapeHtml(glossaryLabel('letterQuality', dashboardUi.uiMode))}: без правок <strong>${hub.letterNoEdit.noEditPct}%</strong> (${hub.letterNoEdit.noEdit}/${hub.letterNoEdit.samples} откликов)</p>`;
  }
  html += `<p class="modal-hint">${escapeHtml(LETTER_SERIES_READY_HINT)}</p>`;
  html += `<dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`).join('')}</dl>`;
  const batchSamples = hub.batchReport?.samples || [];
  if (batchSamples.length) {
    html += '<p><strong>Последний батч (письма):</strong></p><ul>';
    for (const s of batchSamples) {
      html += `<li class="letter-batch-sample">${escapeHtml(s.title || '')}${s.reason ? ` — <span>${escapeHtml(s.reason)}</span>` : ''}</li>`;
    }
    html += '</ul>';
  }
  if (hub.userEdits?.preview?.length) {
    html += '<p><strong>Ваши правки (фрагменты):</strong></p><ul>';
    for (const s of hub.userEdits.preview) {
      html += `<li>${escapeHtml(s)}</li>`;
    }
    html += '</ul>';
  }
  if (hub.correlation?.insight) {
    html += `<p class="modal-hint">${escapeHtml(hub.correlation.insight)}</p>`;
  }
  if (hub.styleInsights?.insight) {
    html += `<p class="modal-hint">${escapeHtml(hub.styleInsights.insight)}</p>`;
  }
  body.innerHTML = html;
  openModalEl(modal);
  body.querySelectorAll('.letter-batch-sample').forEach((li, i) => {
    const s = batchSamples[i];
    if (!s?.id) return;
    li.classList.add('letter-quality-hub-body__link');
    li.addEventListener('click', () => focusVacancyCard(s.id));
  });
}

function reapplyLetterCenterFromCache() {
  if (letterStatsCache?.payload) {
    applyLetterStatsPayload(letterStatsCache.payload);
  }
}

async function refreshLetterStatsSidebar(force = false) {
  if (!letterStatsBodyEl) return;
  const fetchSeq = ++letterStatsFetchSeq;
  const batchScope = batchScopeForCurrentView();
  if (!batchScope || currentApplyView === 'applied') {
    letterStatsBodyEl.hidden = true;
    if (btnStatusLettersIssuesEl) btnStatusLettersIssuesEl.hidden = true;
    return;
  }
  const cacheKey = `${batchScope}:${currentStatus}:${filterMinScoreEl?.value || ''}`;
  if (
    !force &&
    letterStatsCache &&
    Date.now() - letterStatsCacheTs < 25_000 &&
    letterStatsCache.key === cacheKey
  ) {
    applyLetterStatsPayload(letterStatsCache.payload);
    return;
  }

  letterStatsBodyEl.textContent = 'Письма…';
  letterStatsBodyEl.classList.add('letter-stats-mini--loading');
  letterStatsBodyEl.hidden = false;

  try {
    const qs = new URLSearchParams({
      batchScope,
      queueStatus: batchScope === 'queue' && currentStatus === 'approved' ? 'approved' : 'pending',
      minScore: String(Math.max(0, Number(filterMinScoreEl?.value || scoreThreshold || 0))),
    });
    const [s, issues, hub] = await Promise.all([
      api(`/api/cover-letter/stats?${qs.toString()}`),
      api(`/api/cover-letter/issues?${qs.toString()}&kind=issues&limit=24`),
      api('/api/cover-letter/quality-hub').catch(() => null),
    ]);
    letterQualityHubCache = hub;
    const baselineGoldenOk =
      hub?.golden?.letters?.ok !== false && hub?.golden?.targeting?.ok !== false;
    const payload = {
      s,
      issues,
      hub,
      warn: (s.fail || 0) + (s.fixable || 0) + (s.missing || 0) > 0,
      baselineGoldenOk,
    };
    letterStatsCache = { key: cacheKey, payload };
    letterStatsCacheTs = Date.now();
    if (fetchSeq !== letterStatsFetchSeq) return;
    applyLetterStatsPayload(payload);
  } catch {
    if (fetchSeq !== letterStatsFetchSeq) return;
    letterStatsBodyEl.hidden = true;
    if (btnStatusLettersIssuesEl) btnStatusLettersIssuesEl.hidden = true;
  } finally {
    letterStatsBodyEl.classList.remove('letter-stats-mini--loading');
  }
}

function renderLetterCenterList(s, issues) {
  if (!letterCenterListEl) return;
  updateLetterCenterKindButtons();
  const allItems = issues?.items || [];
  const items = filterLetterCenterItems(allItems);
  const issueTotal = (s?.fixable || 0) + (s?.fail || 0) + (s?.missing || 0);
  const showList = allItems.length > 0 || issueTotal > 0;
  if (letterCenterMetaEl) {
    if (!showList) {
      letterCenterMetaEl.hidden = true;
    } else {
      const shown = items.length;
      const listTotal = allItems.length;
      const filterLabel =
        letterCenterKindFilter === 'all'
          ? `Проблем: ${listTotal}`
          : `Показано ${shown} из ${listTotal}`;
      letterCenterMetaEl.textContent = filterLabel;
      letterCenterMetaEl.hidden = false;
    }
  }
  if (!showList) {
    letterCenterListEl.replaceChildren();
    const empty = document.createElement('li');
    empty.className = 'letter-center-list__empty';
    empty.textContent = 'Нет карточек с проблемами писем';
    letterCenterListEl.append(empty);
  } else if (items.length === 0 && letterCenterKindFilter !== 'all') {
    letterCenterListEl.replaceChildren();
    const empty = document.createElement('li');
    empty.className = 'letter-center-list__empty';
    empty.textContent = 'Нет карточек в этом фильтре';
    letterCenterListEl.append(empty);
  } else {
    letterCenterListEl.replaceChildren(
      ...items.slice(0, 24).map((it) => {
        const li = document.createElement('li');
        const kind =
          it.kind === 'fixable' ? '⚙' : it.kind === 'fail' ? '✕' : it.kind === 'missing' ? '?' : '·';
        const n10 = Number(it.letterScore10);
        const score =
          Number.isFinite(n10) && it.kind !== 'missing'
            ? ` <span class="letter-center-list__score ${letterScore10Class(n10)}">${n10}/10</span>`
            : '';
        li.innerHTML = `<span class="letter-center-list__kind">${kind}</span>${escapeHtml(it.title || it.id)}${score}`;
        const tip = [it.reason, it.hint].filter(Boolean).join(' · ');
        li.title = tip || '';
        li.addEventListener('click', () => {
          closeModalEl(document.getElementById('letter-issues-modal'));
          focusVacancyCard(it.id);
        });
        return li;
      })
    );
  }
  if (btnLetterCenterPrepareEl) {
    btnLetterCenterPrepareEl.hidden = !(s?.fixable > 0);
    btnLetterCenterPrepareEl.textContent =
      s?.fixable > 0 ? `Подготовить (${s.fixable})` : 'Подготовить';
  }
  const missingN = Number(s?.missing || 0);
  const failN = Number(s?.fail || 0);
  if (btnLetterCenterGenerateEl) {
    btnLetterCenterGenerateEl.hidden = missingN <= 0;
    btnLetterCenterGenerateEl.textContent =
      missingN > 0 ? `Сгенерировать письма (${missingN})` : 'Сгенерировать письма';
  }
  if (btnLetterCenterRegenEl) {
    btnLetterCenterRegenEl.hidden = failN <= 0;
    btnLetterCenterRegenEl.textContent =
      failN > 0 ? `Перегенерировать (${failN})` : 'Перегенерировать';
  }
}

/** @param {object} [s] */
function letterCenterRegenPayload(s = {}) {
  const missing = Number(s.missing || 0);
  const fail = Number(s.fail || 0);
  if (missing > 0) {
    return { mode: 'missing', limit: Math.min(40, Math.max(5, missing)) };
  }
  return { mode: 'fail', limit: Math.min(40, Math.max(5, fail || 25)) };
}

async function runLetterCenterRegen(modeHint) {
  const s = letterStatsCache?.payload?.s || {};
  const payload =
    modeHint === 'missing'
      ? { mode: 'missing', limit: Math.min(40, Math.max(5, Number(s.missing || 0) || 25)) }
      : modeHint === 'fail'
        ? { mode: 'fail', limit: Math.min(40, Math.max(5, Number(s.fail || 0) || 25)) }
        : letterCenterRegenPayload(s);
  const res = await requestCoverLetterRegenerateWeak(payload);
  const msg =
    res.message ||
    'Генерация писем в фоне. Прогресс — файл data/cover-letter-regen.log в папке проекта.';
  if (letterCenterMetaEl) {
    letterCenterMetaEl.hidden = false;
    letterCenterMetaEl.textContent = `${msg} Через 1–3 мин обновите список (F5).`;
  }
  showToast(msg, 'good', { durationMs: 7000 });
  return res;
}

function applyLetterStatsPayload({ s, issues, hub, warn, baselineGoldenOk }) {
  if (!letterStatsBodyEl) return;
  renderLetterStatusKpis({ s, hub, warn, baselineGoldenOk });
  letterStatsBodyEl.hidden = false;
  const issueTotal = (s?.fixable || 0) + (s?.fail || 0) + (s?.missing || 0);
  const allItems = issues?.items || [];
  const showIssuesCta = issueTotal > 0 || allItems.length > 0;
  if (btnStatusLettersIssuesEl) {
    btnStatusLettersIssuesEl.hidden = !showIssuesCta;
    btnStatusLettersIssuesEl.textContent =
      issueTotal > 0 ? `Разобрать письма (${issueTotal})` : 'Разобрать письма';
  }
  renderLetterCenterList(s, issues);
}

function focusVacancyCard(id) {
  if (!id) return;
  const node = listEl.querySelector(`[data-record-id="${CSS.escape(id)}"]`);
  if (node) {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.add('card-tile--focus-pulse');
    setTimeout(() => node.classList.remove('card-tile--focus-pulse'), 1600);
  }
}

function closeDraftModal() {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;
  closeModalEl(modal);
  draftModalState = null;
}

function closeApprovedLetterModal() {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function closeApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function closeBatchReportModal() {
  const modal = document.getElementById('batch-report-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function initBatchReportSettingsLinks() {
  const modal = document.getElementById('batch-report-modal');
  if (!modal || modal.dataset.settingsLinksBound === '1') return;
  modal.dataset.settingsLinksBound = '1';
  modal.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-batch-report-settings]');
    if (!btn) return;
    const kind = btn.getAttribute('data-batch-report-settings');
    closeBatchReportModal();
    const detail =
      kind === 'fp'
        ? { tab: 'letters', focus: 'fp', layout: 'wide' }
        : kind === 'limits'
          ? { tab: 'apply', focus: 'settings-limits-hh', layout: 'compact' }
          : { tab: 'letters', focus: 'settings-letters-group', layout: 'wide' };
    window.dispatchEvent(new CustomEvent('hh-open-settings', { detail }));
  });
}

function closeDailyDigestModal() {
  const modal = document.getElementById('daily-digest-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function closeTopModal() {
  const service = document.getElementById('service-drawer');
  if (service && !service.hidden) {
    closeServiceDrawer();
    return true;
  }
  for (const id of MODAL_ROOT_IDS) {
    const m = document.getElementById(id);
    if (!m || m.hidden) continue;
    return closeModalById(id);
  }
  return false;
}

function closeModalById(modalId) {
  if (modalId === 'vacancy-detail-modal') {
    closeVacancyDetail();
    return true;
  }
  if (modalId === 'draft-modal') {
    closeDraftModal();
    return true;
  }
  if (modalId === 'apply-log-modal') {
    closeApplyLogModal();
    return true;
  }
  if (modalId === 'batch-report-modal') {
    closeBatchReportModal();
    return true;
  }
  if (modalId === 'batch-precheck-modal') {
    closeModalEl(document.getElementById('batch-precheck-modal'));
    return true;
  }
  if (modalId === 'daily-digest-modal') {
    closeDailyDigestModal();
    return true;
  }
  if (modalId === 'approved-letter-modal') {
    closeApprovedLetterModal();
    return true;
  }
  if (modalId === 'questionnaire-modal') {
    closeQuestionnaireModal();
    return true;
  }
  if (modalId === 'settings-modal') {
    closeSettingsModal();
    return true;
  }
  if (modalId === 'funnel-modal') {
    closeFunnelModal();
    return true;
  }
  if (modalId === 'shortcuts-modal') {
    const m = document.getElementById('shortcuts-modal');
    if (m && !m.hidden) {
      closeModalEl(m);
      return true;
    }
  }
  if (modalId === 'letter-quality-hub-modal') {
    const m = document.getElementById('letter-quality-hub-modal');
    if (m && !m.hidden) {
      closeModalEl(m);
      return true;
    }
  }
  if (modalId === 'ingest-url-modal') {
    closeIngestUrlModal();
    return true;
  }
  if (modalId === 'intelligence-digest-modal') {
    closeModalEl(document.getElementById('intelligence-digest-modal'));
    return true;
  }
  const generic = document.getElementById(modalId);
  if (generic && !generic.hidden) {
    closeModalEl(generic);
    return true;
  }
  return false;
}

/** @type {{ id: string, item: object } | null} */
let questionnaireModalState = null;

function questionnaireAnswersMap(item) {
  const q = item?.hhApply?.questionnaire;
  const { map } = buildQuestionnaireAnswersMap(
    q?.questions || [],
    q?.suggestedAnswers || [],
    q?.savedAnswers || []
  );
  return map;
}

function closeQuestionnaireModal() {
  const modal = document.getElementById('questionnaire-modal');
  if (!modal) return;
  closeModalEl(modal);
  questionnaireModalState = null;
}

function formatMatchCv(v) {
  const map = {
    both: 'Оба CV подходят',
    primary: 'Основное CV',
    secondary: 'Дополнительное CV',
    none: 'Слабое совпадение с CV',
  };
  return map[v] || (v ? `CV: ${v}` : '');
}

function readCardDensityMode() {
  return document.documentElement.dataset.cardDensity || 'medium';
}

/** Разбивка длинного текста на абзацы для карточки (полный/средний режим). */
function splitCardParagraphs(text, max = 4) {
  const t = String(text || '').trim();
  if (!t) return [];
  const byNewline = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline.slice(0, max);
  const sentences = t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [t];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (out.length >= max) break;
    const next = (buf + s).trim();
    if (!buf || next.length <= 200) buf = next;
    else {
      out.push(buf);
      buf = s.trim();
    }
  }
  if (buf && out.length < max) out.push(buf);
  return out.length ? out.slice(0, max) : [t.slice(0, 600)];
}

function fillDescBlock(container, text, maxParas) {
  if (!container) return;
  const parts = splitCardParagraphs(text, maxParas);
  if (!parts.length) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  container.hidden = false;
  container.replaceChildren(
    ...parts.map((chunk) => {
      const p = document.createElement('p');
      p.className = 'card-para card-para--desc';
      p.textContent = chunk;
      return p;
    })
  );
  if (text.length > 400) container.title = text;
}

function buildCardFacts(item) {
  const density = readCardDensityMode();
  const lines = [];
  if (item.sourceQualityTier) lines.push(tierClassLabel(item.sourceQualityTier));
  const fh = Number(item.freshnessHours);
  if (Number.isFinite(fh) && fh < 72) lines.push('Свежая (<72ч)');
  if (item.applyMode === 'ats_form') lines.push('Отклик: форма на сайте компании');
  else if (item.applyMode === 'manual_link') lines.push('Отклик: вручную');
  if (item.remoteNote) lines.push(item.remoteNote);
  if (item.workFormat?.city && !String(item.remoteNote || '').includes(item.workFormat.city)) {
    lines.push(`Город: ${item.workFormat.city}`);
  }
  if (item.workFormat?.timezone) lines.push(item.workFormat.timezone);
  if (item.salaryNote && !item.salaryEstimate?.ok) lines.push(item.salaryNote);
  const mc = formatMatchCv(item.geminiMatchCv);
  if (mc) lines.push(mc);
  const cl = item.coverLetter;
  if (cl?.status === 'approved') lines.push('Сопроводительное: утверждено');
  else if (cl?.status === 'pending' && (cl.variants || []).length) lines.push('Сопроводительное: черновик');
  else if (cl?.status === 'declined') lines.push('Сопроводительное: отклонено');
  const factLimit = { compact: 3, medium: 5, full: 8 };
  return lines.slice(0, factLimit[density] ?? 5);
}

function renderQuestionnaireModalBody(modal, item) {
  const body = modal.querySelector('.modal-questionnaire-body');
  const meta = modal.querySelector('.questionnaire-meta');
  if (!body) return;

  const q = item.hhApply?.questionnaire;
  const raw = q?.questions || [];
  const { questions, map: answers } = buildQuestionnaireAnswersMap(
    raw,
    q?.suggestedAnswers || [],
    q?.savedAnswers || []
  );
  const clearCaptchaBtn = modal.querySelector('.btn-questionnaire-clear-captcha');
  if (clearCaptchaBtn) {
    clearCaptchaBtn.hidden = !recordLooksLikeCaptchaQuestionnaire(item);
  }

  body.innerHTML = '';
  if (!questions.length && questionsLookLikeCaptchaMisdetect(raw)) {
    body.innerHTML =
      '<p class="questionnaire-warn">Похоже на <strong>капчу hh.ru</strong> («Текст с картинки»), а не на анкету работодателя. Нажмите <strong>«Это капча, не анкета»</strong> — карточка вернётся в «Без анкет» / «Очередь». После решения капчи повторите отклик.</p>';
    if (meta) meta.textContent = (raw.map((x) => x.label).join(' · ') || '').slice(0, 200);
    return;
  }
  if (!questions.length) {
    const needsProbe = itemQuestionnaireNeedsProbe(item) || raw.length > 0;
    body.innerHTML = needsProbe
      ? '<p class="questionnaire-warn">В JSON нет текста вопросов (заглушка «Писать тут», «Текстовое поле N» или текст мастера отклика). Загрузка с hh.ru запускается автоматически; при необходимости нажмите <strong>«Загрузить с hh.ru»</strong> ещё раз.</p>'
      : '<p class="questionnaire-empty">Вопросов пока нет. Откроется Chromium и форма отклика (нужна сессия <code>npm run login</code>).</p>';
    if (meta) meta.textContent = '';
    return;
  }

  const parts = [];
  if (q.answersGeneratedAt) {
    parts.push(`Модель: ${q.answersModel || '—'} · ${new Date(q.answersGeneratedAt).toLocaleString('ru-RU')}`);
  }
  if (q.probedAt) parts.push(`с hh.ru: ${new Date(q.probedAt).toLocaleString('ru-RU')}`);
  if (meta) meta.textContent = parts.join(' · ');

  questions.forEach((question, pos) => {
    const field = document.createElement('fieldset');
    field.className = 'questionnaire-q';
    const legend = document.createElement('legend');
    legend.textContent = `${pos + 1}. ${question.label}`;
    field.appendChild(legend);

    if (isChoiceQuestion(question)) {
      const savedRaw = answers.get(question.index) || '';
      const matched = matchAnswerToOption(savedRaw, question.options);
      const want = normalizeChoiceOptionLabel(matched?.label || savedRaw);
      const optsWrap = document.createElement('div');
      optsWrap.className = 'questionnaire-choice';
      const groupName = `questionnaire-q-${question.index}`;
      const inputType = question.type === 'checkbox' ? 'checkbox' : 'radio';

      (question.options || []).forEach((opt, oi) => {
        const optLabel = normalizeChoiceOptionLabel(opt.label);
        const id = `q-${question.index}-opt-${oi}`;
        const lbl = document.createElement('label');
        lbl.className = 'questionnaire-choice-opt';
        lbl.htmlFor = id;
        const inp = document.createElement('input');
        inp.type = inputType;
        inp.name = groupName;
        inp.id = id;
        inp.className = 'questionnaire-a questionnaire-a--choice';
        inp.dataset.index = String(question.index);
        inp.value = optLabel;
        if (want && (optLabel === want || optLabel.toLowerCase() === want.toLowerCase())) {
          inp.checked = true;
        }
        const span = document.createElement('span');
        span.textContent = opt.label;
        lbl.appendChild(inp);
        lbl.appendChild(span);
        optsWrap.appendChild(lbl);
      });
      field.appendChild(optsWrap);
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'field-input questionnaire-a';
      ta.rows = question.type === 'textarea' ? 4 : 2;
      ta.dataset.index = String(question.index);
      ta.value = answers.get(question.index) || '';
      ta.placeholder = 'Черновик ответа';
      field.appendChild(ta);
    }

    body.appendChild(field);
  });
}

function collectQuestionnaireAnswersFromModal(modal) {
  const byIndex = new Map();
  for (const el of modal.querySelectorAll('.questionnaire-a')) {
    const index = Number(el.dataset.index);
    if (!index) continue;
    if (el.type === 'radio' || el.type === 'checkbox') {
      if (el.checked) byIndex.set(index, String(el.value || '').trim());
    } else {
      byIndex.set(index, String(el.value || '').trim());
    }
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, answer]) => ({ index, answer }));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setQuestionnaireModalBusy(modal, busy, message) {
  const body = modal.querySelector('.modal-questionnaire-body');
  if (busy && body) {
    body.innerHTML = `<p class="questionnaire-loading">${message || 'Загружаю вопросы с hh.ru…'}</p>`;
  }
  modal.querySelectorAll('.questionnaire-actions .btn').forEach((btn) => {
    btn.disabled = busy;
  });
}

async function runQuestionnaireProbe(opts = {}) {
  const modal = questionnaireModalEl;
  if (!modal || !questionnaireModalState?.id) return null;
  if (questionnaireModalState.probeInFlight) return null;

  questionnaireModalState.probeInFlight = true;
  const probeBtn = modal.querySelector('.btn-questionnaire-probe');
  if (probeBtn) probeBtn.disabled = true;
  setQuestionnaireModalBusy(modal, true, 'Открываю hh.ru и читаю анкету… (до ~1 мин)');
  if (!opts.silentToast) {
    showToast('Открываю hh.ru и читаю анкету… (до ~1 мин)', 'neutral');
  }

  try {
    const res = await api('/api/questionnaire/probe', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id }),
    });
    if (!opts.silentToast) {
      showToast(`Загружено вопросов: ${res.questionCount || 0}`, 'good');
    }
    await load();
    const fresh = cachedRawItems.find((x) => x.id === questionnaireModalState.id);
    if (fresh) {
      questionnaireModalState.item = fresh;
      setQuestionnaireModalBusy(modal, false);
      renderQuestionnaireModalBody(modal, fresh);
    }
    return res;
  } catch (e) {
    setQuestionnaireModalBusy(modal, false);
    const body = modal.querySelector('.modal-questionnaire-body');
    const msg = String(e.message || 'Ошибка загрузки').trim();
    if (body) {
      body.innerHTML = `<p class="questionnaire-warn">${escapeHtml(msg)}</p><p class="questionnaire-empty">Проверьте <code>npm run login</code>, закройте другие окна Chromium и нажмите «Загрузить с hh.ru» снова.</p>`;
    }
    showToast(msg, 'bad');
    return null;
  } finally {
    questionnaireModalState.probeInFlight = false;
    const probeBtnDone = modal.querySelector('.btn-questionnaire-probe');
    if (probeBtnDone) probeBtnDone.disabled = false;
  }
}

async function openQuestionnaireModal(item, options = {}) {
  const { autoProbe = true } = options;
  const modal = document.getElementById('questionnaire-modal');
  if (!modal) return;
  questionnaireModalState = { id: item.id, item, probeInFlight: false };
  modal.querySelector('.modal-vacancy-questionnaire').textContent = item.title || item.url || '';
  renderQuestionnaireModalBody(modal, item);
  openModalEl(modal);
  if (autoProbe && itemQuestionnaireShouldAutoProbe(item)) {
    await runQuestionnaireProbe({ silentToast: false });
  }
}

function getApplyLogSource() {
  const checked = document.querySelector('input[name="log-source"]:checked');
  return checked?.value === 'harvest' ? 'harvest' : 'apply';
}

const APPLY_LOG_PIN_PX = 48;
let applyLogFollowTail = true;
let applyLogScrollBound = false;
let applyLogFullscreen = false;
let lastJobStatus = null;

function applyLogPreEl() {
  return applyLogModalEl?.querySelector('.apply-log-pre') || null;
}

function isApplyLogAtBottom(pre) {
  if (!pre) return true;
  return pre.scrollHeight - pre.scrollTop - pre.clientHeight <= APPLY_LOG_PIN_PX;
}

function setApplyLogFollowTail(on) {
  applyLogFollowTail = Boolean(on);
  const cb = document.getElementById('apply-log-follow-tail');
  if (cb) cb.checked = applyLogFollowTail;
}

function scrollApplyLogToEnd(pre = applyLogPreEl()) {
  if (!pre) return;
  pre.scrollTop = pre.scrollHeight;
  setApplyLogFollowTail(true);
}

function bindApplyLogScrollGuard() {
  if (applyLogScrollBound) return;
  const pre = applyLogPreEl();
  if (!pre) return;
  applyLogScrollBound = true;
  pre.addEventListener(
    'scroll',
    () => {
      const atBottom = isApplyLogAtBottom(pre);
      if (atBottom !== applyLogFollowTail) setApplyLogFollowTail(atBottom);
    },
    { passive: true }
  );
}

function extractApplyLogInsights(text, st) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const parts = [];
  const skipCount = lines.filter((l) => /\[batch\]\s+Пропуск\s+\d+\/\d+:/i.test(l)).length;
  const offTargetCount = lines.filter((l) => /\[batch\]\s+OFF-TARGET\s+\d+\/\d+:/i.test(l)).length;
  const errorCount = lines.filter((l) => /\[batch\]\s+ОШИБКА\s+\d+\/\d+:/i.test(l)).length;
  const lastSkipLine = [...lines].reverse().find((l) => /\[batch\]\s+Пропуск\s+\d+\/\d+:/i.test(l));
  const lastSkipTag = [...lines].reverse().find((l) => /\[hh-apply-batch-skip\]\s+/i.test(l));
  const lastErrorLine = [...lines].reverse().find((l) => /(^|\s)Error:\s+/i.test(l));
  const bc = st?.batchControl || {};
  const br = st?.batchLastReport;

  if (br?.finishedAt) {
    const resumeLine = Object.entries(br.resumeUsage || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    const reportLine =
      `Последняя серия: успешно ${br.done}/${br.planned}` +
      (br.offTargetSkipped ? ` · нецелевых ${br.offTargetSkipped}` : '') +
      (resumeLine ? ` · ${resumeLine}` : '');
    parts.push(reportLine);
  }

  if (bc.planned || bc.done || bc.failed) {
    parts.push(
      `${COPY.batch}: ${bc.done || 0}/${bc.planned || '?'} · ошибок ${bc.failed || 0} · пропусков ${skipCount}` +
        (offTargetCount ? ` · нецелевых ${offTargetCount}` : '')
    );
  } else if (skipCount || errorCount || offTargetCount) {
    parts.push(
      `По текущему логу: пропусков ${skipCount}` +
        (offTargetCount ? `, нецелевых ${offTargetCount}` : '') +
        `, ошибок ${errorCount}`
    );
  }

  if (lastSkipLine) {
    const rawReason = lastSkipLine.split(':').slice(1).join(':').trim();
    const normalizedReason =
      /hh-apply-chat exit 1/i.test(rawReason) && lastSkipTag
        ? lastSkipTag.replace(/^.*\[hh-apply-batch-skip\]\s*/i, '')
        : rawReason;
    parts.push(`Последний пропуск: ${normalizedReason || 'без причины в строке'}`);
  }

  if (lastErrorLine) {
    parts.push(`Последняя ошибка: ${lastErrorLine.replace(/^\[[^\]]+\]\s*/, '')}`);
  }

  const lastSiteState = [...lines]
    .reverse()
    .find((l) => /\[hh-site-state\]/i.test(l));
  if (lastSiteState) {
    parts.push(`Статус hh.ru: ${lastSiteState.replace(/^.*\[hh-site-state\]\s*/i, '')}`);
  }

  const blob = parts.join('\n');
  if (/капч|hh-captcha/i.test(blob)) {
    parts.push(
      'Капча: дождитесь — откроется окно Chromium, пройдите проверку. Батч продолжит сам. Затем при необходимости «Продолжить».'
    );
  }

  return parts.slice(0, 6);
}

function renderApplyLogInsights(text, st = lastJobStatus) {
  const el = document.getElementById('apply-log-insights');
  const reportBtn = document.getElementById('btn-batch-report');
  if (!el) return;
  const parts = extractApplyLogInsights(text, st);
  const hasReport = Boolean(st?.batchLastReport?.finishedAt);
  if (reportBtn) reportBtn.hidden = !hasReport;

  if (!parts.length) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = parts.map((p) => `<div class="apply-log-insight-line">${escapeHtml(p)}</div>`).join('');
}

function buildBatchReportHeadline(report) {
  const done = Number(report?.done || 0);
  const skipped = Number(report?.skipped || 0);
  const failed = Number(report?.failed || 0);
  if (done === 0 && skipped === 0 && failed === 0) {
    return 'Серия завершилась без откликов — проверьте очередь и настройки писем.';
  }
  const parts = [];
  if (done > 0) parts.push(`отправлено ${done} отклик${done === 1 ? '' : done < 5 ? 'а' : 'ов'}`);
  if (skipped > 0) parts.push(`пропущено ${skipped}`);
  if (failed > 0) parts.push(`ошибок ${failed}`);
  let line = parts.join(', ');
  const topSkip = Object.entries(report?.skipReasons || {}).sort((a, b) => b[1] - a[1])[0];
  if (topSkip && topSkip[1] > 0) {
    const reason = /letter|письм/i.test(topSkip[0])
      ? 'качество письма'
      : /нецел|off-target/i.test(topSkip[0])
        ? 'нецелевые вакансии'
        : topSkip[0];
    line += `. Чаще всего пропускали: ${reason} (${topSkip[1]})`;
  }
  return line.charAt(0).toUpperCase() + line.slice(1) + '.';
}

function renderBatchReportModal(report) {
  const modal = document.getElementById('batch-report-modal');
  if (!modal || !report) return;
  const summaryEl = document.getElementById('batch-report-summary');
  const gridEl = document.getElementById('batch-report-grid');
  const skipsSec = document.getElementById('batch-report-skips');
  const skipsList = document.getElementById('batch-report-skips-list');
  const itemsSec = document.getElementById('batch-report-items');
  const itemsList = document.getElementById('batch-report-items-list');

  const when = report.finishedAt
    ? new Date(report.finishedAt).toLocaleString('ru-RU')
    : '—';
  if (summaryEl) {
    summaryEl.innerHTML = [
      `<p class="batch-report-headline">${escapeHtml(buildBatchReportHeadline(report))}</p>`,
      `<p class="batch-report-meta">Завершено ${escapeHtml(when)} · раздел: ${escapeHtml(batchReportScopeLabel(report.batchScope, report.queueStatus) || report.batchScope || '—')}</p>`,
    ].join('');
  }

  const metrics = [
    { label: 'Успешно', value: report.done, tone: 'good' },
    { label: 'Пропуск', value: report.skipped, tone: 'neutral' },
    { label: 'Ошибки', value: report.failed, tone: report.failed ? 'warn' : 'neutral' },
    { label: 'Нецелевые', value: report.offTargetSkipped || 0, tone: 'neutral' },
  ];
  if (gridEl) {
    gridEl.innerHTML = metrics
      .map(
        (m) =>
          `<div class="batch-report-metric batch-report-metric--${m.tone}"><span class="batch-report-metric__val">${m.value ?? 0}</span><span class="batch-report-metric__lab">${escapeHtml(m.label)}</span></div>`
      )
      .join('');
    const resumeLine = Object.entries(report.resumeUsage || {})
      .map(([k, v]) => `${escapeHtml(k)}: ${v}`)
      .join(' · ');
    if (resumeLine) {
      gridEl.insertAdjacentHTML(
        'beforeend',
        `<div class="batch-report-metric batch-report-metric--wide"><span class="batch-report-metric__lab">Резюме</span><span class="batch-report-metric__val batch-report-metric__val--sm">${resumeLine}</span></div>`
      );
    }
  }

  const skipEntries = Object.entries(report.skipReasons || {}).sort((a, b) => b[1] - a[1]);
  const letterSkip = skipEntries.find(([r]) => /letter|письм/i.test(r));
  if (skipsSec && skipsList) {
    if (skipEntries.length) {
      skipsSec.hidden = false;
      skipsList.replaceChildren(
        ...skipEntries.map(([reason, count]) => {
          const li = document.createElement('li');
          const isLetter = /letter|письм/i.test(reason);
          const reasonRu = applySkipReasonRuLabel(reason);
          if (isLetter) {
            li.innerHTML = `${escapeHtml(reasonRu)} — ${count} · <button type="button" class="btn btn-ghost btn-sm" data-batch-report-settings="fp">настроить фильтр</button>`;
          } else {
            li.textContent = `${reasonRu} — ${count}`;
          }
          return li;
        })
      );
    } else {
      skipsSec.hidden = true;
    }
  }
  const actions = document.getElementById('batch-report-actions');
  if (actions) {
    actions.hidden = false;
    if (letterSkip) {
      actions.classList.add('batch-report-actions--letter-warn');
    } else {
      actions.classList.remove('batch-report-actions--letter-warn');
    }
  }

  const items = (report.items || []).slice().reverse();
  if (itemsSec && itemsList) {
    if (items.length) {
      itemsSec.hidden = false;
      itemsList.replaceChildren(
        ...items.map((it) => {
          const li = document.createElement('li');
          const status = it.status === 'ok' ? '✓' : it.status === 'off-target' ? '⊘' : '—';
          li.textContent = `${status} ${it.title || '—'}${it.resumeRole ? ` · ${it.resumeRole}` : ''}${it.resumeTitle ? ` · «${it.resumeTitle}»` : ''}${it.reason ? ` · ${it.reason}` : ''}`;
          return li;
        })
      );
    } else {
      itemsSec.hidden = true;
    }
  }

  openModalEl(modal);
}

async function openBatchReportModal() {
  try {
    const data = await api('/api/batch-report');
    if (!data.ok || !data.report) {
      showToast(data.message || 'Отчёт батча ещё не создан', 'neutral');
      return;
    }
    renderBatchReportModal(data.report);
  } catch (e) {
    showToast(e.message || 'Не удалось загрузить отчёт', 'neutral');
  }
}

function initOnboardingPanel(st) {
  const panel = document.getElementById('onboarding-panel');
  const stepsEl = document.getElementById('onboarding-steps');
  if (!panel || !stepsEl) return;
  if ((st?.batchLastReport?.done || 0) > 0) {
    try {
      localStorage.setItem('hh-dashboard-onboarding-dismissed', '1');
      localStorage.setItem('hh-settings-letters-onboarding-dismissed', '1');
    } catch {
      /* ignore */
    }
    panel.hidden = true;
    return;
  }
  if (localStorage.getItem('hh-dashboard-onboarding-dismissed') === '1') {
    panel.hidden = true;
    return;
  }
  const stats = st?.dashboardStats || {};
  const queueTotal = stats.queue?.queueTotal ?? stats.queueTotal ?? 0;
  const applied = stats.applied ?? 0;
  const rhOk = st?.routingHealth?.ok !== false;
  const steps = [
    {
      num: 1,
      done: rhOk,
      text: COPY.onboardingStepResume,
      cta: COPY.onboardingCtaSettings,
      action: 'settings-profile',
    },
    {
      num: 2,
      done: queueTotal > 0,
      text:
        queueTotal > 0
          ? COPY.onboardingStepHarvest
          : 'Загрузите демо-очередь — познакомьтесь с карточками без поиска на hh.ru',
      cta: queueTotal > 0 ? COPY.onboardingCtaHarvest : 'Загрузить демо',
      action: queueTotal > 0 ? 'harvest' : 'demo',
    },
    {
      num: 3,
      done: applied > 0,
      text: COPY.onboardingStepApply,
      cta: COPY.onboardingCtaQueue,
      action: 'view-queue',
    },
    {
      num: 4,
      done: applied >= 3,
      text: COPY.onboardingStepSync,
      cta: COPY.onboardingCtaRoutine,
      action: 'routine',
    },
  ];
  if (steps.every((s) => s.done)) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const doneCount = steps.filter((s) => s.done).length;
  let progressEl = panel.querySelector('.onboarding-progress');
  if (!progressEl) {
    progressEl = document.createElement('div');
    progressEl.className = 'onboarding-progress';
    progressEl.innerHTML =
      '<div class="onboarding-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="onboarding-progress__bar"></div></div>' +
      '<span class="onboarding-progress__label"></span>';
    panel.querySelector('.onboarding-card__head')?.after(progressEl);
  }
  const pct = Math.round((doneCount / steps.length) * 100);
  const bar = progressEl.querySelector('.onboarding-progress__bar');
  const track = progressEl.querySelector('.onboarding-progress__track');
  const label = progressEl.querySelector('.onboarding-progress__label');
  if (bar) bar.style.width = `${pct}%`;
  if (track) {
    track.setAttribute('aria-valuenow', String(pct));
    track.setAttribute('aria-label', `${doneCount} из ${steps.length} шагов`);
  }
  if (label) label.textContent = `Шаг ${doneCount} из ${steps.length}`;
  stepsEl.replaceChildren(
    ...steps.map((s) => {
      const li = document.createElement('li');
      li.className = s.done ? 'onboarding-step onboarding-step--done' : 'onboarding-step';
      li.innerHTML =
        `<span class="onboarding-step__num" aria-hidden="true">${s.num}</span>` +
        `<div class="onboarding-step__body">` +
        `<span class="onboarding-step__text">${escapeHtml(s.text)}</span>` +
        (s.done ? '' : `<button type="button" class="btn btn-ghost btn-sm onboarding-step__cta">${escapeHtml(s.cta)}</button>`) +
        `</div>`;
      if (!s.done) {
        li.querySelector('.onboarding-step__cta')?.addEventListener('click', () => {
          runOnboardingAction(s.action);
        });
      }
      return li;
    })
  );
  const dismissBtn = panel.querySelector('.onboarding-dismiss');
  if (dismissBtn && !dismissBtn.dataset.bound) {
    dismissBtn.dataset.bound = '1';
    dismissBtn.addEventListener('click', () => {
      localStorage.setItem('hh-dashboard-onboarding-dismissed', '1');
      panel.hidden = true;
    });
  }
}

function runOnboardingAction(action) {
  switch (action) {
    case 'settings-profile':
      openDashboardSettings('system', { focusId: 'settings-profile-card' });
      break;
    case 'harvest':
      document.getElementById('btn-run-harvest')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;
    case 'view-queue':
      applyViewTabsEl?.querySelector('[data-apply-view="queue"]')?.click();
      break;
    case 'routine':
      document.getElementById('btn-daily-routine')?.click();
      break;
    case 'demo':
      void loadDemoQueue().catch((e) => showToast(e.message || String(e), 'bad'));
      break;
    default:
      break;
  }
}

async function restoreVacancyFromCard(item, restoreBtn, toastMessage) {
  restoreBtn.disabled = true;
  try {
    await api('/api/action', {
      method: 'POST',
      body: JSON.stringify({ id: item.id, action: 'restore' }),
    });
    showToast(toastMessage, 'good');
    await load({ preserveScroll: true, anchorCardId: item.id });
  } catch (e) {
    alert(e.message);
    restoreBtn.disabled = false;
  }
}

function renderEmptyState(message, actions = []) {
  const wrap = document.createElement('div');
  wrap.className = 'empty empty--actions hh-empty';
  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);
  if (actions.length) {
    const row = document.createElement('div');
    row.className = 'empty-actions';
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = act.primary ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
      btn.textContent = act.label;
      btn.addEventListener('click', act.onClick);
      row.appendChild(btn);
    }
    wrap.appendChild(row);
  }
  return wrap;
}

/**
 * @param {{ silent?: boolean, showLoading?: boolean, scrollToEnd?: boolean }} [opts]
 * silent — фоновое обновление: без «Загрузка…», сохраняем позицию прокрутки
 */
async function refreshApplyLogModal(opts = {}) {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  const pre = applyLogPreEl();
  if (!pre) return;
  bindApplyLogScrollGuard();

  const pathEl = modal.querySelector('.apply-log-path');
  const metaEl = document.getElementById('apply-log-meta');
  const source = getApplyLogSource();
  const lastRun = document.getElementById('apply-log-last-run')?.checked !== false;
  const lineCount = 400;
  const endpoint =
    source === 'harvest'
      ? `/api/harvest-log?lines=${lineCount}&lastRun=${lastRun ? '1' : '0'}`
      : `/api/hh-apply-chat-log?lines=${lineCount}&lastRun=${lastRun ? '1' : '0'}`;

  const prevScrollTop = pre.scrollTop;
  const wasAtBottom = isApplyLogAtBottom(pre);
  const followTail = opts.scrollToEnd ?? applyLogFollowTail;
  const cacheKey = `${source}|${lastRun ? 1 : 0}`;

  if (opts.showLoading) {
    pre.textContent = 'Загрузка…';
    if (metaEl) metaEl.textContent = '';
  }

  try {
    const data = await api(endpoint);
    const rel = data.relativePath || (source === 'harvest' ? 'data/harvest-run.log' : 'data/hh-apply-chat.log');
    pathEl.textContent = data.absolutePath || rel;
    pathEl.title = data.absolutePath || rel;
    if (metaEl && data.exists) {
      const parts = [];
      if (data.modifiedAt) {
        parts.push(`обновлён ${new Date(data.modifiedAt).toLocaleString('ru-RU')}`);
      }
      if (data.sizeBytes != null) parts.push(`${Math.round(data.sizeBytes / 1024)} КБ`);
      if (data.lastRunHeader) parts.push(data.lastRunHeader.slice(0, 72));
      metaEl.textContent = parts.length ? ` · ${parts.join(' · ')}` : '';
    }
    if (!data.exists) {
      pre.textContent =
        source === 'harvest'
          ? 'Лог сбора пуст. Нажмите «Собрать вакансии».'
          : 'Лог отклика пуст. Нажмите «Авто-отклик» на карточке.';
      pre.dataset.logCacheKey = '';
      pre.dataset.logContent = '';
      return;
    }

    const newText = data.text || '(пусто)';
    if (opts.silent && pre.dataset.logCacheKey === cacheKey && pre.dataset.logContent === newText) {
      return;
    }

    pre.dataset.logCacheKey = cacheKey;
    pre.dataset.logContent = newText;
    pre.textContent = newText;
    renderApplyLogInsights(newText);

    const pinToEnd =
      opts.scrollToEnd === true || (opts.scrollToEnd !== false && followTail && wasAtBottom);
    if (pinToEnd) {
      scrollApplyLogToEnd(pre);
    } else {
      pre.scrollTop = Math.min(prevScrollTop, Math.max(0, pre.scrollHeight - pre.clientHeight));
    }
  } catch (e) {
    pre.textContent = `Ошибка: ${e.message}`;
    renderApplyLogInsights(pre.textContent);
  }
}

function openApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  setApplyLogFollowTail(true);
  modal.classList.toggle('modal--fullscreen', applyLogFullscreen);
  openModalEl(modal);
  refreshApplyLogModal({ showLoading: true, scrollToEnd: true });
  refreshJobStatus();
}

function openDailyDigestModal(digest) {
  const modal = document.getElementById('daily-digest-modal');
  const pre = document.getElementById('daily-digest-text');
  if (!modal || !pre) return;
  const text = String(digest?.text || '').trim() || 'Дайджест пуст';
  pre.textContent = text;
  const meta = document.getElementById('daily-digest-meta');
  if (meta) {
    const at = digest?.generatedAt ? new Date(digest.generatedAt).toLocaleString('ru-RU') : 'сейчас';
    const tg = digest?.telegram?.ok ? ' · Telegram отправлен' : '';
    meta.textContent = `Сформирован: ${at}${tg}`;
  }
  openModalEl(modal);
}

function openLetterModal(item) {
  const cl = item?.coverLetter || {};
  const approved = String(cl.approvedText || '').trim();
  const variants = Array.isArray(cl.variants) ? cl.variants.filter(Boolean) : [];
  if (!approved && variants.length) {
    openDraftModal(item);
    return;
  }
  openApprovedLetterModal(item);
}

function openApprovedLetterModal(item) {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  const text =
    String(item.coverLetter?.approvedText || '').trim() ||
    String(item.coverLetter?.variants?.[0] || '').trim();
  modal.querySelector('.modal-vacancy-approved').textContent = item.title || item.url || '';
  modal.querySelector('.modal-approved-text').textContent = text;
  const actions = modal.querySelector('.modal-draft-actions');
  let prepBtn = modal.querySelector('.btn-improve-approved-letter');
  if (!prepBtn && actions) {
    prepBtn = document.createElement('button');
    prepBtn.type = 'button';
    prepBtn.className = 'btn btn-improve-approved-letter';
    prepBtn.textContent = 'Подготовить';
    actions.insertBefore(prepBtn, actions.firstChild);
  }
  const q = item.letterQuality;
  const hints = Array.isArray(q?.hints) ? q.hints : [];
  let hintEl = modal.querySelector('.letter-quality-hint');
  if (!hintEl) {
    hintEl = document.createElement('p');
    hintEl.className = 'letter-quality-hint draft-variant-hint';
    const pre = modal.querySelector('.modal-approved-text');
    pre?.before(hintEl);
  }
  if (q?.pass === false || q?.fixable) {
    const parts = [];
    if (q.reason) parts.push(q.reason);
    if (hints.length) parts.push(hints[0]);
    hintEl.textContent = parts.join(' · ');
    hintEl.hidden = false;
  } else {
    hintEl.hidden = true;
  }
  if (prepBtn) {
    const showPrep = q?.fixable || q?.pass === false;
    prepBtn.hidden = !showPrep;
    prepBtn.onclick = async () => {
      prepBtn.disabled = true;
      try {
        const res = await requestCoverLetterImprove(item.id);
        showToast(res.improved ? 'Письмо подготовлено' : 'Уже в порядке', 'good');
        closeApprovedLetterModal();
        await load();
        void refreshLetterStatsSidebar(true);
      } catch (e) {
        alert(e.message);
      } finally {
        prepBtn.disabled = false;
      }
    };
  }
  openModalEl(modal);
}

/** @param {number} n */
function draftVariantLetter(n) {
  return String.fromCharCode(65 + n);
}

/** @param {string} text @param {number} max */
function draftVariantPreview(text, max = 110) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function openDraftModal(item) {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;
  const body = modal.querySelector('.modal-draft-body');
  const footer = modal.querySelector('.modal-draft-actions--footer');
  const vacEl = modal.querySelector('.modal-vacancy');
  const titleEl = modal.querySelector('#draft-modal-title');
  if (titleEl) titleEl.textContent = COPY.draftTitle || 'Черновик письма';
  vacEl.textContent = item.title || item.url || '';
  body.innerHTML = '';
  if (footer) footer.innerHTML = '';

  const ragMount = document.createElement('div');
  ragMount.className = 'employer-rag-mount';
  body.appendChild(ragMount);
  void mountEmployerRagPreview(ragMount, item);

  const l4Mount = document.createElement('div');
  l4Mount.className = 'resume-l4-mount';
  body.appendChild(l4Mount);
  void mountResumeL4Preview(l4Mount, item);

  const raw = item.coverLetter?.variants || [];
  const variants = raw.length ? raw.map((s) => String(s)) : [];
  if (!variants.length) {
    const p = document.createElement('p');
    p.className = 'modal-empty';
    p.textContent = 'Нет вариантов.';
    body.appendChild(p);
    openModalEl(modal);
    draftModalState = null;
    return;
  }

  const picker = document.createElement('div');
  picker.className = 'draft-variant-picker';

  const tabs = document.createElement('div');
  tabs.className = 'segmented draft-variant-tabs crm-seg-tight';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', COPY.draftVariantLabel || 'Вариант');

  const preview = document.createElement('p');
  preview.className = 'draft-variant-preview';

  const hint = document.createElement('p');
  hint.className = 'draft-variant-hint';
  hint.textContent =
    variants.length > 1 ? COPY.draftVariantHint || '1–3 или ← → — переключить вариант' : '';

  const variantQualityEarly = item.coverLetter?.variantQuality || [];
  const bestStart = pickBestVariantIndex(variantQualityEarly, variants.length);

  variants.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seg-btn tab draft-variant-tab${i === bestStart ? ' active' : ''}`;
    btn.dataset.variantIndex = String(i);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === bestStart ? 'true' : 'false');
    const q = variantQualityEarly.find((x) => Number(x.index) === i);
    const qMark = q?.rawPass ? ' ✓' : q?.pass ? ' ~' : q ? ' !' : '';
    const scoreTip = Number.isFinite(Number(q?.letterScore10)) ? ` · ${q.letterScore10}/10` : '';
    btn.title =
      draftVariantPreview(text, 200) + scoreTip + (q?.reason ? ` — ${q.reason}` : '');
    btn.textContent = `${draftVariantLetter(i)}${qMark}`;
    tabs.appendChild(btn);
  });

  picker.appendChild(tabs);
  picker.appendChild(preview);
  if (variants.length > 1) picker.appendChild(hint);

  const qualityBanner = document.createElement('p');
  qualityBanner.className = 'draft-letter-quality';
  qualityBanner.hidden = true;

  const lbl = document.createElement('label');
  lbl.className = 'modal-letter-label';
  lbl.htmlFor = `draft-v-${item.id}-edit`;
  lbl.textContent = COPY.draftLetterLabel;

  const ta = document.createElement('textarea');
  ta.className = 'modal-letter-edit';
  ta.id = `draft-v-${item.id}-edit`;
  ta.rows = 8;

  const actions = document.createElement('div');
  actions.className = 'modal-draft-actions';

  const btnPrepare = document.createElement('button');
  btnPrepare.type = 'button';
  btnPrepare.className = 'btn btn-ghost';
  btnPrepare.textContent = 'Подготовить';

  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn';
  btnSave.textContent = COPY.draftSave;

  const btnApprove = document.createElement('button');
  btnApprove.type = 'button';
  btnApprove.className = 'btn ok';
  btnApprove.textContent = COPY.draftApprove;

  const btnDecline = document.createElement('button');
  btnDecline.type = 'button';
  btnDecline.className = 'btn bad';
  btnDecline.textContent = COPY.draftDecline;

  actions.append(btnPrepare, btnSave, btnApprove, btnDecline);
  body.append(picker, qualityBanner, lbl, ta);
  (footer || body).appendChild(actions);

  const variantQuality = item.coverLetter?.variantQuality || [];
  const startIndex = pickBestVariantIndex(variantQuality, variants.length);
  ta.value = variants[startIndex] || variants[0] || '';

  draftModalState = {
    id: item.id,
    variants,
    selectedIndex: startIndex,
    variantQuality,
    qualityBanner,
  };

  const refreshDraftQualityBanner = debounce(async () => {
    if (!qualityBanner) return;
    try {
      const res = await requestCoverLetterEvaluate(item.id, ta.value);
      const fmt = formatLetterQualityBanner(res.letterQuality);
      qualityBanner.textContent = fmt.text;
      qualityBanner.className = fmt.className;
      qualityBanner.hidden = !fmt.text;
    } catch {
      qualityBanner.hidden = true;
    }
  }, 400);

  function updatePreview() {
    preview.textContent = draftVariantPreview(ta.value);
    void refreshDraftQualityBanner();
  }

  function syncTextareaToVariant() {
    if (!draftModalState) return;
    draftModalState.variants[draftModalState.selectedIndex] = ta.value;
  }

  function selectVariant(idx) {
    if (!draftModalState) return;
    const max = draftModalState.variants.length - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx > max) return;
    syncTextareaToVariant();
    draftModalState.selectedIndex = idx;
    ta.value = draftModalState.variants[idx] ?? '';
    tabs.querySelectorAll('.draft-variant-tab').forEach((b, i) => {
      const on = i === idx;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    updatePreview();
    ta.focus();
  }

  draftModalState.selectVariant = selectVariant;

  tabs.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.draft-variant-tab');
    if (!btn) return;
    selectVariant(Number(btn.dataset.variantIndex));
  });

  ta.addEventListener('input', updatePreview);
  updatePreview();

  btnPrepare.addEventListener('click', async () => {
    syncTextareaToVariant();
    btnPrepare.disabled = btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      const res = await requestCoverLetterPrepareText(item.id, ta.value);
      ta.value = res.text || ta.value;
      draftModalState.variants[draftModalState.selectedIndex] = ta.value;
      updatePreview();
      showToast('Текст подготовлен', 'good');
    } catch (e) {
      alert(e.message);
    } finally {
      btnPrepare.disabled = btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnSave.addEventListener('click', async () => {
    syncTextareaToVariant();
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/save-draft', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, variants: draftModalState.variants }),
      });
      showToast('Правки сохранены', 'good');
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnApprove.addEventListener('click', async () => {
    syncTextareaToVariant();
    const text = ta.value.trim();
    if (!text) {
      alert('Введите или выберите текст письма.');
      return;
    }
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/action', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, action: 'approve', text }),
      });
      showToast('Письмо утверждено', 'good');
      closeDraftModal();
      invalidateLetterStatsCache();
      await load();
      void refreshLetterStatsSidebar(true);
    } catch (e) {
      alert(e.message);
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnDecline.addEventListener('click', async () => {
    if (!confirm('Отклонить черновик?')) return;
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/action', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, action: 'decline' }),
      });
      showToast('Черновик отклонён', 'neutral');
      closeDraftModal();
      await load();
    } catch (e) {
      alert(e.message);
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  draftModalState.triggerSave = () => btnSave.click();
  draftModalState.triggerApprove = () => btnApprove.click();
  draftModalState.triggerDecline = () => btnDecline.click();

  openModalEl(modal);
}

const draftModalEl = document.getElementById('draft-modal');
const approvedModalEl = document.getElementById('approved-letter-modal');
const applyLogModalEl = document.getElementById('apply-log-modal');
const questionnaireModalEl = document.getElementById('questionnaire-modal');

function setApplyLogFullscreen(on) {
  applyLogFullscreen = Boolean(on);
  if (!applyLogModalEl) return;
  applyLogModalEl.classList.toggle('modal--fullscreen', applyLogFullscreen);
  const btn = applyLogModalEl.querySelector('.btn-apply-log-fullscreen');
  if (btn) {
    syncFullscreenIcon(btn, applyLogFullscreen);
    btn.title = applyLogFullscreen ? 'Обычный размер' : 'Полноэкранный режим';
    btn.setAttribute('aria-label', applyLogFullscreen ? 'Обычный размер' : 'Полноэкранный режим');
  }
}

questionnaireModalEl?.querySelector('.btn-questionnaire-probe')?.addEventListener('click', () => {
  void runQuestionnaireProbe({ silentToast: false });
});

questionnaireModalEl?.querySelector('.btn-questionnaire-clear-captcha')?.addEventListener('click', async () => {
  if (!questionnaireModalState?.id) return;
  try {
    const res = await api('/api/questionnaire/clear-captcha', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id }),
    });
    showToast(`Сброшено (капча): ${res.fixed || 1}`, 'good');
    closeModalEl(questionnaireModalEl);
    await load();
  } catch (e) {
    toastApiError(e);
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-generate')?.addEventListener('click', async () => {
  if (!questionnaireModalState?.id) return;
  const modal = questionnaireModalEl;
  const btn = modal.querySelector('.btn-questionnaire-generate');
  const prevLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Генерация…';
  }
  modal.querySelectorAll('.questionnaire-actions .btn').forEach((b) => {
    b.disabled = true;
  });
    showToast('Подставляю ответы из резюме (CV/)…', 'neutral');
  try {
    const res = await api('/api/questionnaire/generate', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id }),
    });
    const n = res.answerCount ?? res.questionnaire?.suggestedAnswers?.length ?? 0;
    if (res.questionnaire && questionnaireModalState.item) {
      const item = {
        ...questionnaireModalState.item,
        hhApply: {
          ...questionnaireModalState.item.hhApply,
          questionnaire: res.questionnaire,
        },
      };
      questionnaireModalState.item = item;
      renderQuestionnaireModalBody(modal, item);
    }
    const src =
      res.model === 'cv-heuristic' || String(res.model || '').startsWith('cv')
        ? 'из резюме'
        : res.model || 'LLM';
    showToast(`Ответы: ${n} шт. (${src})`, 'good');
    await load();
    const fresh = cachedRawItems.find((x) => x.id === questionnaireModalState.id);
    if (fresh) {
      questionnaireModalState.item = fresh;
      renderQuestionnaireModalBody(modal, fresh);
    }
  } catch (e) {
    const body = modal.querySelector('.modal-questionnaire-body');
    const msg = String(e.message || 'Ошибка LLM').trim();
    if (body && !body.querySelector('.questionnaire-q')) {
      body.insertAdjacentHTML(
        'afterbegin',
        `<p class="questionnaire-warn">${escapeHtml(msg)}</p>`
      );
    }
    showToast(msg, 'bad');
  } finally {
    modal.querySelectorAll('.questionnaire-actions .btn').forEach((b) => {
      b.disabled = false;
    });
    if (btn) {
      btn.textContent = prevLabel || 'Сгенерировать ответы';
    }
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-save')?.addEventListener('click', async () => {
  if (!questionnaireModalState?.id) return;
  const btn = questionnaireModalEl.querySelector('.btn-questionnaire-save');
  const answers = collectQuestionnaireAnswersFromModal(questionnaireModalEl);
  btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/save-answers', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id, answers }),
    });
    const msg =
      res.learnedEdits > 0
        ? `Сохранено; ${res.learnedEdits} пример(ов) для следующих генераций`
        : 'Ответы сохранены в очереди';
    showToast(msg, 'good');
    await load();
  } catch (e) {
    toastApiError(e, 'Ошибка сохранения');
  } finally {
    btn.disabled = false;
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-copy')?.addEventListener('click', async () => {
  const item = questionnaireModalState?.item;
  if (!item) return;
  const questions = meaningfulQuestions(item.hhApply?.questionnaire?.questions || []);
  const answers = collectQuestionnaireAnswersFromModal(questionnaireModalEl);
  const byIdx = new Map(answers.map((a) => [a.index, a.answer]));
  const text = questions
    .map((q) => `${q.index}. ${q.label}\n${byIdx.get(q.index) || ''}`)
    .join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано в буфер', 'good');
  } catch {
    showToast('Не удалось скопировать', 'bad');
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-apply')?.addEventListener('click', async () => {
  const state = questionnaireModalState;
  if (!state?.id) return;
  const item = state.item;
  const btn = questionnaireModalEl.querySelector('.btn-questionnaire-apply');
  const approvedLetter = String(item?.coverLetter?.approvedText || '').trim();
  btn.disabled = true;
  try {
    const answers = collectQuestionnaireAnswersFromModal(questionnaireModalEl);
    if (answers.some((a) => a.answer)) {
      await api('/api/questionnaire/save-answers', {
        method: 'POST',
        body: JSON.stringify({ id: state.id, answers }),
      });
    }
  } catch (e) {
    showToast(`Не удалось сохранить ответы: ${e.message}`, 'bad');
    btn.disabled = false;
    return;
  }
  closeQuestionnaireModal();
  try {
    const res = await api('/api/hh-launch-apply-chat', {
      method: 'POST',
      body: JSON.stringify({
        id: state.id,
        usePoolLetter: !approvedLetter,
        tailorResume: true,
        questionnaireWait: true,
        questionnaireAuto: true,
      }),
    });
    const pid = res.pid != null ? ` PID ${res.pid}.` : '';
    showToast(`Отклик с анкетой запущен.${pid}`, 'good');
    openApplyLogModal();
    startJobLogPoll();
    refreshJobStatus();
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
  }
});

document.querySelector('.btn-log-apply')?.addEventListener('click', () => openApplyLogModal());

applyLogModalEl?.querySelector('.btn-refresh-apply-log')?.addEventListener('click', () =>
  refreshApplyLogModal({ showLoading: true, scrollToEnd: applyLogFollowTail })
);
applyLogModalEl?.querySelector('.btn-apply-log-jump')?.addEventListener('click', () => {
  scrollApplyLogToEnd();
});
applyLogModalEl?.querySelector('.btn-apply-log-copy')?.addEventListener('click', async () => {
  const pre = applyLogPreEl();
  const insights = document.getElementById('apply-log-insights');
  const path = applyLogModalEl?.querySelector('.apply-log-path')?.textContent?.trim() || '';
  const meta = document.getElementById('apply-log-meta')?.textContent?.trim() || '';
  const body = pre?.textContent || '';
  const header = [path && `Файл: ${path}`, meta].filter(Boolean).join('\n');
  const insightBlock =
    insights && !insights.hidden && insights.textContent?.trim()
      ? `\n---\n${insights.textContent.trim()}\n---\n`
      : '\n';
  const text = `${header}${insightBlock}${body}`.trim();
  if (!text) {
    showToast('Журнал пуст — нажмите «Обновить»', 'neutral');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Лог скопирован в буфер', 'good');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Лог скопирован', 'good');
  }
});
applyLogModalEl?.querySelector('.btn-apply-log-fullscreen')?.addEventListener('click', () => {
  setApplyLogFullscreen(!applyLogFullscreen);
});
document.getElementById('apply-log-follow-tail')?.addEventListener('change', (e) => {
  setApplyLogFollowTail(e.target.checked);
  if (applyLogFollowTail) scrollApplyLogToEnd();
});
applyLogModalEl?.querySelectorAll('input[name="log-source"]').forEach((el) => {
  el.addEventListener('change', () => {
    setApplyLogFollowTail(true);
    refreshApplyLogModal({ showLoading: true, scrollToEnd: true });
  });
});
document.getElementById('apply-log-last-run')?.addEventListener('change', () => {
  setApplyLogFollowTail(true);
  refreshApplyLogModal({ showLoading: true, scrollToEnd: true });
});
document.getElementById('apply-log-pause')?.addEventListener('click', () => sendJobControl('pause'));
document.getElementById('apply-log-stop')?.addEventListener('click', () => {
  const msg =
    activeJobControl === 'harvest' ? COPY.confirmStopHarvest : COPY.confirmStopBatch;
  if (confirm(msg)) sendJobControl('stop');
});
document.getElementById('apply-log-resume')?.addEventListener('click', () => sendJobControl('resume'));

approvedModalEl?.querySelector('.btn-copy-approved')?.addEventListener('click', async () => {
  const pre = approvedModalEl.querySelector('.modal-approved-text');
  const t = pre?.textContent || '';
  try {
    await navigator.clipboard.writeText(t);
    showToast('Скопировано в буфер', 'good');
  } catch {
    showToast('Не удалось скопировать', 'bad');
  }
});

function bindDismiss(node, item) {
  const dismissBtn = node.querySelector('.card-dismiss');
  if (!dismissBtn) return;
  dismissBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Удалить эту запись из очереди? (без «подходит / не подходит»)')) return;
    dismissBtn.disabled = true;
    try {
      await api('/api/dismiss', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      });
      showToast('Запись удалена из очереди', 'neutral');
      await load();
    } catch (err) {
      alert(err.message);
      dismissBtn.disabled = false;
    }
  });
}

async function sendVacancyDecision(item, action, reason = '') {
  try {
    const data = await api('/api/action', {
      method: 'POST',
      body: JSON.stringify({
        id: item.id,
        action,
        reason: String(reason || '').trim(),
      }),
    });
    if (action === 'approve') {
      showToast('Сохранено: подходит', 'good');
    } else {
      const n = Array.isArray(data?.autoRejected) ? data.autoRejected.length : 0;
      const trimmed = String(reason || '').trim();
      if (n > 0) {
        showToast(
          trimmed
            ? `Отклонено + ещё ${n} похожих («${trimmed}»)`
            : `Отклонено + ещё ${n} похожих`,
          'bad'
        );
      } else {
        showToast('Сохранено: не подходит', 'bad');
      }
    }
    await load({ preserveScroll: true, anchorCardId: item.id });
  } catch (e) {
    alert(e.message);
    throw e;
  }
}

function bindCardDecision(node, item) {
  if (item.status !== 'pending') return;
  const approveBtn = node.querySelector('.btn-tile-approve');
  const rejectBtn = node.querySelector('.btn-tile-reject');
  if (!approveBtn && !rejectBtn) return;

  const setBusy = (busy) => {
    if (approveBtn) approveBtn.disabled = busy;
    if (rejectBtn) rejectBtn.disabled = busy;
  };

  approveBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await sendVacancyDecision(item, 'approve');
    } catch {
      setBusy(false);
    }
  });

  rejectBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    setBusy(true);
    try {
      await sendVacancyDecision(item, 'reject');
    } catch {
      setBusy(false);
    }
  });
}

function scoreOf(item) {
  return Number(item.scoreOverall ?? item.geminiScore ?? 0) || 0;
}

function isDashboardExpertMode() {
  return dashboardUi.uiMode === UI_MODES.expert;
}

function renderCard(item, options = {}) {
  const inModal = Boolean(options.inModal);
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.recordId = item.id;
  const s = scoreOf(item);
  if (s >= scoreThreshold) node.classList.add('card--score-high');
  else if (s > 0) node.classList.add('card--score-low');

  bindDismiss(node, item);

  const scoreEl = node.querySelector('.score');
  const expert = isDashboardExpertMode();
  const scoreDisplay = formatScoreLineDisplay(item, { expert });
  scoreEl.textContent = scoreDisplay;
  scoreEl.setAttribute('aria-label', formatScoreLineAriaLabel(item, { expert }));

  const tooltip = node.querySelector('.score-tooltip');
  const llmBreakdown = buildLlmScoreBreakdownHtml(item, { scoreWeights, escapeHtml });
  if (llmBreakdown) {
    tooltip.innerHTML = llmBreakdown;
    if (item.matchScore) {
      tooltip.innerHTML += `<br><br>${buildScoreTooltipHtml(item, { escapeHtml })}`;
    }
  } else if (item.matchScore) {
    tooltip.innerHTML = buildScoreTooltipHtml(item, { escapeHtml });
  } else {
    tooltip.textContent =
      'Нет разбивки по компонентам. Добавьте записи через npm run harvest с включённым LLM (без --skip-llm).';
  }
  const humanHint = buildScoreHumanHint(item);
  if (humanHint) {
    tooltip.innerHTML += `<br><br><strong>Суть:</strong> ${escapeHtml(humanHint)}`;
  }

  const modelBtn = node.querySelector('.model-info-btn');
  const modelPanel = node.querySelector('.model-info-panel');
  const modelName = item.openRouterModel ? String(item.openRouterModel).trim() : '';
  if (modelName) {
    modelBtn.hidden = false;
    modelPanel.textContent = `Модель OpenRouter: ${modelName}`;
    modelPanel.addEventListener('click', (e) => e.stopPropagation());
    modelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = modelPanel.hidden;
      document.querySelectorAll('.model-info-panel').forEach((p) => {
        p.hidden = true;
      });
      if (open) modelPanel.hidden = false;
    });
  }

  const a = node.querySelector('.title-link');
  a.href = item.url;
  a.textContent = item.title || item.url;
  a.title = formatSourceOpenLabel(item.source);

  const sourceRow = node.querySelector('.card-source-row');
  if (sourceRow) {
    sourceRow.hidden = false;
    sourceRow.replaceChildren(buildSourceBadgeFragment(item));
  }

  const cardLayout = inModal
    ? 'expanded'
    : normalizeCardLayout(document.documentElement.dataset.cardLayout || 'expanded');
  const density =
    options.forceDensity ?? (cardLayout === 'tile-medium' ? 'medium' : readCardDensityMode());
  node.classList.add(`card--density-${density}`);
  if (inModal) {
    node.classList.add('card--in-modal', 'card--layout-expanded');
  } else if (cardLayout === 'expanded') {
    node.classList.add('card--layout-expanded');
  }
  const metaCompact = node.querySelector('.meta--compact');
  const metaDetail = node.querySelector('.card-meta-detail');
  const salaryLine =
    item.salaryEstimate?.ok
      ? `≈${item.salaryEstimate.minUsd}–${item.salaryEstimate.maxUsd} USD/мес`
      : item.salaryRaw || '';
  const parts = [item.company, salaryLine, item.searchQuery ? `запрос: ${item.searchQuery}` : '']
    .filter(Boolean);
  if (metaCompact) {
    const metaParts = [...new Set(parts)];
    if (item.resumeRouting?.label) metaParts.push(`Резюме: ${item.resumeRouting.label}`);
    const appliedOnHh =
      item.status === 'responded' ||
      Boolean(item.hhApply?.responseSubmitted || item.hhApply?.lastAt);
    if (item.targeting?.eligible === false && !appliedOnHh) {
      metaParts.push(`⚠ ${item.targeting.skipReason || 'нецелевая'}`);
      node.classList.add('card--off-target');
    }
    metaCompact.textContent = metaParts.join(' · ');
  }

  renderStatusChips(node.querySelector('.card-status-chips'), item);

  const journeyHost = node.querySelector('.card-journey-host');
  if (journeyHost) {
    mountJourneyStrip(journeyHost, item, {
      onAction: (action, rec) => {
        if (action === 'open-letter') openDraftModal(rec);
        else if (action === 'apply-chat') node.querySelector('.btn-apply-chat')?.click();
        else if (action === 'open-interview-hub') openInterviewHubModal(rec?.id);
        else if (action === 'interview-prep') node.querySelector('.btn-interview-prep')?.click();
        else if (action === 'open-chat') {
          document.dispatchEvent(new CustomEvent('hh-open-chat-inbox', { detail: { id: rec.id } }));
        }
      },
    });
  }

  const setMetaLine = (sel, label, value) => {
    const el = node.querySelector(sel);
    if (!el) return;
    const v = String(value || '').trim();
    if (!v) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = label ? `${label}: ${v}` : v;
  };

  if (density === 'full') {
    if (metaCompact) metaCompact.hidden = true;
    if (metaDetail) metaDetail.hidden = false;
    setMetaLine('.meta-line--company', 'Компания', item.company);
    setMetaLine('.meta-line--salary', 'Зарплата', salaryLine);
    setMetaLine('.meta-line--search', 'Поиск', item.searchQuery);
    const resumeLabel = item.resumeRouting?.label?.replace(/^Резюме:\s*/i, '') || '';
    setMetaLine('.meta-line--resume', 'Резюме', resumeLabel);
    const resumeLine = node.querySelector('.meta-line--resume');
    if (resumeLine && item.hhApply?.resumeMatchOk === false) {
      resumeLine.classList.add('meta-line--warn');
    }
    const metrics = item.coverLetter?.metrics;
    if (metrics?.editRatioPct != null && item.coverLetter?.status === 'approved') {
      const label =
        metrics.editRatioPct <= 5 ? 'Письмо без правок' : `Правки письма ~${metrics.editRatioPct}%`;
      setMetaLine('.meta-line--letter-metrics', '', label);
    } else {
      setMetaLine('.meta-line--letter-metrics', '', '');
    }
  } else {
    if (metaCompact) metaCompact.hidden = false;
    if (metaDetail) metaDetail.hidden = true;
  }

  const factsEl = node.querySelector('.card-facts');
  const facts = buildCardFacts(item);
  if (factsEl && facts.length) {
    factsEl.hidden = false;
    factsEl.replaceChildren(
      ...facts.map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      })
    );
  }

  const descBlock = node.querySelector('.card-desc-block');
  const desc = String(item.descriptionPreview || '').trim();
  if (descBlock && desc && density === 'medium') {
    fillDescBlock(descBlock, desc, 2);
  } else if (descBlock && desc && density === 'full') {
    fillDescBlock(descBlock, desc, 8);
  } else if (descBlock) {
    descBlock.hidden = true;
    descBlock.replaceChildren();
  }

  const applyBadge = node.querySelector('.hh-apply-badge');
  const qBanner = node.querySelector('.questionnaire-banner');
  const qSlot = node.querySelector('.card-slot--questionnaire');
  const meaningfulQs = meaningfulQuestions(item.hhApply?.questionnaire?.questions);
  const needsProbe = itemQuestionnaireNeedsProbe(item);
  const showQuestionnaireBlock =
    qBanner &&
    currentApplyView !== 'noQuestionnaire' &&
    recordNeedsQuestionnaireWork(item) &&
    (meaningfulQs.length > 0 || needsProbe);

  if (showQuestionnaireBlock) {
    const textEl = qBanner.querySelector('.questionnaire-banner__text');
    if (meaningfulQs.length > 0) {
      const hasAnswers =
        (item.hhApply.questionnaire?.savedAnswers?.length ?? 0) > 0 ||
        (item.hhApply.questionnaire?.suggestedAnswers?.length ?? 0) > 0;
      if (textEl) {
        textEl.textContent = hasAnswers
          ? `${meaningfulQs.length} вопросов · ответы в дашборде — открыть`
          : `${meaningfulQs.length} вопросов работодателя — открыть и сгенерировать ответы`;
      }
    } else if (textEl) {
      textEl.textContent = item.hhApply?.questionnaire?.likelyFromVacancyText
        ? 'В описании похоже на анкету — «Вопросы» → загрузить с hh.ru'
        : 'Анкета на hh.ru — открыть «Вопросы» и загрузить с сайта';
    }
    qBanner.hidden = false;
    qSlot?.classList.add('card-slot--questionnaire-active');
    qBanner.addEventListener('click', () => openQuestionnaireModal(item));
    if (applyBadge) applyBadge.hidden = true;
    node.classList.add('card--questionnaire');
  } else if (qBanner) {
    qBanner.hidden = true;
  }

  if (!showQuestionnaireBlock && applyBadge && vacancyHasHhApply(item)) {
    applyBadge.hidden = false;
    applyBadge.textContent = hhApplyBadgeText(item);
    node.classList.add('card--applied');
  }

  const siteBadge = node.querySelector('.hh-site-badge');
  const siteOnly =
    !showQuestionnaireBlock &&
    item?.hhApply?.hhSiteState &&
    item.hhApply.hhSiteState !== 'none' &&
    (!vacancyHasHhApply(item) || item.hhApply.hhDetectedOnly);
  if (siteBadge && siteOnly) {
    siteBadge.hidden = false;
    siteBadge.textContent = hhSiteStateBadgeText(item);
    siteBadge.title = hhSiteStateBadgeTitle(item);
    siteBadge.classList.add(`hh-site-badge--${item.hhApply.hhSiteState}`);
    node.classList.add('card--applied');
    if (item.hhApply.hhSiteState === 'invited') node.classList.add('card--hh-invited');
    if (item.hhApply.hhSiteState === 'declined') node.classList.add('card--hh-declined');
    if (item.hhApply.hhSiteState === 'viewed') node.classList.add('card--hh-viewed');
  }

  const interviewBtn = node.querySelector('.btn-interview-prep');
  if (interviewBtn && item.hhApply?.hhSiteState === 'invited') {
    interviewBtn.hidden = false;
    interviewBtn.addEventListener('click', async () => {
      interviewBtn.disabled = true;
      try {
        const res = await api('/api/interview-prep', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        const p = res.interviewPrep;
        const lines = [
          ...(p?.checklist || []),
          '',
          p?.llm?.pitch ? `Питч: ${p.llm.pitch}` : '',
          (p?.llm?.techQuestions || []).map((q) => `• ${q}`).join('\n'),
        ].filter(Boolean);
        alert(lines.join('\n') || 'Пакет сохранён в карточке');
        await load();
      } catch (e) {
        alert(e.message);
      } finally {
        interviewBtn.disabled = false;
      }
    });
  }

  const negOnlyBadge = node.querySelector('.negotiation-only-badge');
  if (item.negotiationOnly || item.hhApply?.negotiationOnly) {
    if (negOnlyBadge) negOnlyBadge.hidden = false;
    node.classList.add('card--negotiation-only');
    node.querySelectorAll('.btn-apply-auto, .btn-apply-chat, .btn-apply-questionnaire').forEach((b) => {
      b.disabled = true;
    });
  }

  const chatBlock = node.querySelector('.card-chat-block');
  const chatMsgs = item.hhApply?.chatMessages;
  const chatEditor = chatBlock?.querySelector('.chat-reply-editor');
  const chatOpen = chatBlock?.querySelector('.btn-chat-open-hh');
  if (chatBlock && Array.isArray(chatMsgs) && chatMsgs.length) {
    chatBlock.hidden = false;
    const ul = chatBlock.querySelector('.chat-messages');
    if (ul) {
      ul.replaceChildren(
        ...chatMsgs.slice(-8).map((m) => {
          const li = document.createElement('li');
          li.className = `chat-msg chat-msg--${m.kind || 'other'}`;
          const who = m.kind === 'question' ? 'Работодатель' : m.kind === 'answer' ? 'Вы' : 'Сообщение';
          li.textContent = `${who}: ${m.text}`;
          return li;
        })
      );
    }
    const savedDraft = item.hhApply?.chatReplyDraft?.reply;
    if (chatEditor && savedDraft) chatEditor.value = savedDraft;
    const chatUrl = item.hhApply?.chatUrl;
    if (chatOpen && chatUrl) {
      chatOpen.href = chatUrl;
      chatOpen.hidden = false;
    }
    chatBlock.querySelector('.btn-chat-copy')?.addEventListener('click', async () => {
      const text = chatEditor?.value?.trim();
      if (!text) return alert('Сначала сгенерируйте черновик («Ответ в чат»)');
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      showToast('Скопировано', 'good');
    });
    const tplRow = chatBlock.querySelector('.chat-template-row');
    if (tplRow) {
      ensureChatTemplates().then((templates) => {
        tplRow.replaceChildren(
          ...templates.map((t) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-ghost btn-xs chat-tpl-btn';
            b.textContent = t.label;
            b.title = t.text.slice(0, 120);
            b.addEventListener('click', () => {
              if (chatEditor) chatEditor.value = t.text;
            });
            return b;
          })
        );
      });
    }
  }

  const chatDraftBtn = node.querySelector('.btn-chat-reply-draft');
  const chatSummary = item.hhApply?.chatSummary;
  const hasChat =
    chatSummary?.needsReply ||
    chatSummary?.questionCount > 0 ||
    (Array.isArray(chatMsgs) && chatMsgs.some((m) => m.kind === 'question'));
  if (chatDraftBtn && hasChat) {
    chatDraftBtn.hidden = false;
    chatDraftBtn.addEventListener('click', async () => {
      chatDraftBtn.disabled = true;
      try {
        const res = await api('/api/chat-reply-draft', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        if (chatEditor) chatEditor.value = res.reply || '';
        else if (navigator.clipboard) await navigator.clipboard.writeText(res.reply);
        showToast(
          res.source === 'llm' ? 'Черновик в поле ниже — проверьте и вставьте в чат hh.ru' : 'Шаблонный черновик',
          'good'
        );
      } catch (e) {
        alert(e.message);
      } finally {
        chatDraftBtn.disabled = false;
      }
    });
  }

  const hiddenBadge = node.querySelector('.hidden-role-badge');
  const hiddenReasons = item.hiddenRoleReasons || [];
  if (hiddenBadge && hiddenReasons.length) {
    hiddenBadge.hidden = false;
    hiddenBadge.textContent = `Скрыто фильтром: ${hiddenReasons.join(', ')}`;
    node.classList.add('card--hidden-role');
  }

  const summaryText = String(item.geminiSummary || '').trim();
  const summaryEl = node.querySelector('.summary');
  const summaryLabel = node.querySelector('.card-label--summary');
  if (summaryEl) {
    summaryEl.textContent = summaryText;
    if (summaryText) summaryEl.title = summaryText;
  }
  if (summaryLabel) summaryLabel.hidden = !summaryText;

  const risksText = String(item.geminiRisks || '').trim();
  const risksEl = node.querySelector('.risks');
  const risksBox = node.querySelector('.risks-box');
  const risksLabel = node.querySelector('.card-label--risks');
  const risksSlot = node.querySelector('.card-slot--risks');
  if (risksText && risksEl) {
    risksEl.textContent = risksText;
    risksEl.title = risksText;
    if (risksBox) risksBox.hidden = false;
    if (risksLabel) risksLabel.hidden = false;
    risksSlot?.classList.add('card-slot--risks-active');
    node.classList.add('card-has-risks');
  } else {
    if (risksBox) risksBox.hidden = true;
    if (risksLabel) risksLabel.hidden = true;
  }

  const tags = node.querySelector('.tags');
  (item.geminiTags || []).forEach((t) => {
    const s = document.createElement('span');
    s.className = 'tag';
    s.textContent = t;
    tags.appendChild(s);
  });

  const cl = item.coverLetter;
  const draftBtn = node.querySelector('.cover-draft-btn');
  const regenBtn = node.querySelector('.btn-regenerate-letter');
  const viewLetterBtn = node.querySelector('.btn-view-approved');
  const exportBtn = node.querySelector('.btn-export-md');

  node.addEventListener('focusin', () => {
    lastFocusedVacancyId = item.id;
  });

  if (exportBtn) {
    exportBtn.hidden = false;
    exportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await copyVacancyMarkdown(item);
        showToast('Markdown в буфере обмена', 'good');
      } catch {
        downloadVacancyMarkdown(item);
        showToast('Markdown сохранён в файл', 'good');
      }
    });
  }

  if (cl?.status === 'pending' && (cl?.variants || []).length) {
    draftBtn.hidden = false;
    const n = (cl.variants || []).filter(Boolean).length;
    draftBtn.textContent = n > 1 ? `${COPY.draftButton} · ${n}` : COPY.draftButton;
    draftBtn.addEventListener('click', () => openDraftModal(item));
  }

  if (cl?.status === 'declined') {
    regenBtn.hidden = false;
    regenBtn.addEventListener('click', async () => {
      regenBtn.disabled = true;
      try {
        const gen0 = await requestCoverLetterGenerate(item.id, false);
        showToast(
          gen0.autoApproved ? 'Письмо сгенерировано и утверждено' : 'Новые варианты готовы',
          'good'
        );
        invalidateLetterStatsCache();
        await load();
        void refreshLetterStatsSidebar(true);
      } catch (e) {
        if (e.status === 409) {
          const ok = confirm(
            'Уже есть утверждённое письмо. Пересоздать и заменить черновиком?'
          );
          if (ok) {
            try {
              const gen1 = await requestCoverLetterGenerate(item.id, true);
              showToast(
                gen1.autoApproved ? 'Письмо сгенерировано и утверждено' : 'Новые варианты готовы',
                'good'
              );
              invalidateLetterStatsCache();
              await load();
              void refreshLetterStatsSidebar(true);
            } catch (e2) {
              alert(e2.message);
            }
          }
        } else {
          alert(e.message);
        }
      } finally {
        regenBtn.disabled = false;
      }
    });
  }

  if (cl?.variants?.length || (cl?.status === 'approved' && String(cl?.approvedText || '').trim())) {
    viewLetterBtn.hidden = false;
    viewLetterBtn.addEventListener('click', () => openLetterModal(item));
  }

  const tailorBtn = node.querySelector('.btn-tailor-resume');
  tailorBtn?.addEventListener('click', async () => {
    tailorBtn.disabled = true;
    try {
      const res = await api('/api/tailor-resume', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      });
      showToast(`PDF: ${res.tailoredResume?.pdfPath || 'готово'}`, 'good');
    } catch (e) {
      alert(e.message);
    } finally {
      tailorBtn.disabled = false;
    }
  });

  const applyAutoBtn = node.querySelector('.btn-apply-auto');
  const applyChatBtn = node.querySelector('.btn-apply-chat');
  const approvedLetter =
    cl?.status === 'approved' && String(cl?.approvedText || '').trim();

  const launchApply = async (
    btn,
    { usePoolLetter, tailorResume = true, questionnaireWait = false, questionnaireAuto = false }
  ) => {
    btn.disabled = true;
    try {
      const storedBlocked = vacancyHhSiteBlocked(item);
      if (!storedBlocked) {
        let probeHint = null;
        if (item.hhApply?.hhSiteState === 'already_applied') {
          probeHint = {
            source: item.hhApply.hhSiteStateSource || 'store',
            label: item.hhApply.hhSiteStateLabel || 'Отклик уже на hh.ru',
          };
        } else {
          try {
            const probe = await api(
              `/api/hh-vacancy-probe?id=${encodeURIComponent(item.id)}`
            );
            if (!probe.canApply && probe.state === 'already_applied') {
              probeHint = {
                source: probe.source || 'live-probe',
                label: probe.label || 'Отклик уже на hh.ru',
                cached: probe.cached,
              };
            }
          } catch {
            /* probe недоступен — продолжаем без подтверждения */
          }
        }
        if (probeHint) {
          const cacheNote = probeHint.cached ? ' (кэш probe)' : '';
          const ok = window.confirm(
            `На hh.ru отклик уже есть (${probeHint.label}, source=${probeHint.source}${cacheNote}).\n\n` +
              'Продолжить без L4? Письмо может уйти в чат, снапшот не создастся.'
          );
          if (!ok) {
            btn.disabled = false;
            return;
          }
          if (probeHint.source === 'live-probe' || String(probeHint.source || '').includes('probe')) {
            try {
              await api(`/api/hh-vacancy-probe?id=${encodeURIComponent(item.id)}&write=1`);
              await load();
            } catch {
              /* badge optional */
            }
          }
        }
      }

      const res = await api('/api/hh-launch-apply-chat', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          usePoolLetter,
          tailorResume,
          questionnaireWait,
          questionnaireAuto,
        }),
      });
      const pid = res.pid != null ? ` PID ${res.pid}.` : '';
      showToast(
        `Отклик запущен.${pid} Должно открыться окно Chromium — смотрите лог и панель прогресса.`,
        'good'
      );
      openApplyLogModal();
      startJobLogPoll();
      refreshJobStatus();
    } catch (e) {
      alert(e.message);
      btn.disabled = false;
    }
  };

  const invitedBtn = node.querySelector('.btn-hh-invited');
  const declinedBtn = node.querySelector('.btn-hh-declined');
  const deferBtn = node.querySelector('.btn-defer-vacancy');
  const undeferBtn = node.querySelector('.btn-undefer-vacancy');

  if (isVacancyDeferredClient(item)) {
    if (undeferBtn) {
      undeferBtn.hidden = false;
      undeferBtn.addEventListener('click', async () => {
        undeferBtn.disabled = true;
        try {
          await api('/api/vacancy/defer', { method: 'POST', body: JSON.stringify({ id: item.id, clear: true }) });
          showToast('Вакансия снова в очереди', 'good');
          await load();
        } catch (e) {
          alert(e.message);
          undeferBtn.disabled = false;
        }
      });
    }
  } else if (item.status === 'pending' && !vacancyHasHhApply(item) && deferBtn) {
    deferBtn.hidden = false;
    deferBtn.title = 'Отложить до завтра 09:00 (Shift+клик — на 7 дней)';
    deferBtn.addEventListener('click', async (ev) => {
      deferBtn.disabled = true;
      const days = ev.shiftKey ? 7 : 1;
      try {
        await api('/api/vacancy/defer', { method: 'POST', body: JSON.stringify({ id: item.id, days }) });
        showToast(days === 7 ? 'Отложено на 7 дней' : 'Отложено до завтра 09:00', 'neutral');
        await load();
      } catch (e) {
        alert(e.message);
        deferBtn.disabled = false;
      }
    });
  }

  if (canMarkHhOutcome(item)) {
    if (invitedBtn) {
      invitedBtn.hidden = false;
      invitedBtn.addEventListener('click', async () => {
        invitedBtn.disabled = true;
        try {
          await setHhSiteStateManual(item, 'invited');
        } catch (e) {
          alert(e.message);
          invitedBtn.disabled = false;
        }
      });
    }
    if (declinedBtn) {
      declinedBtn.hidden = false;
      declinedBtn.addEventListener('click', async () => {
        declinedBtn.disabled = true;
        try {
          await setHhSiteStateManual(item, 'declined');
        } catch (e) {
          alert(e.message);
          declinedBtn.disabled = false;
        }
      });
    }
  }

  if (item.status === 'pending' && applyAutoBtn) {
    const hhBlocked = vacancyHhSiteBlocked(item);
    applyAutoBtn.disabled = hhBlocked;
    if (hhBlocked) {
      applyAutoBtn.title = hhSiteStateBadgeText(item) || 'Повторный отклик на hh.ru не нужен';
    } else if (currentApplyView === 'hidden') {
      applyAutoBtn.disabled = false;
      applyAutoBtn.title = 'Скрыта фильтром — отклик на ваш риск';
    } else {
      applyAutoBtn.disabled = false;
    }
    if (!hhBlocked) {
      applyAutoBtn.addEventListener('click', () =>
        launchApply(applyAutoBtn, {
          usePoolLetter: true,
          tailorResume: true,
          questionnaireAuto: true,
          questionnaireWait:
            vacancyQuestionnairePending(item) ||
            (item.hhApply?.questionnaire?.savedAnswers?.length ?? 0) > 0,
        })
      );
    }
  }

  if (approvedLetter && applyChatBtn) {
    const hhBlocked = vacancyHhSiteBlocked(item);
    applyChatBtn.disabled = hhBlocked;
    if (hhBlocked) {
      applyChatBtn.title =
        (hhSiteStateBadgeText(item) || 'Отклик уже на hh.ru') +
        ' — L4 и снапшот только при первом отклике';
    } else {
      applyChatBtn.removeAttribute('title');
      applyChatBtn.addEventListener('click', () =>
        launchApply(applyChatBtn, { usePoolLetter: false, tailorResume: true })
      );
    }
  }

  const questionnaireBtn = node.querySelector('.btn-apply-questionnaire');
  if (questionnaireBtn && item.status === 'pending' && !vacancyHasHhApply(item) && !vacancyHhSiteBlocked(item)) {
    questionnaireBtn.hidden = false;
    questionnaireBtn.disabled = false;
    questionnaireBtn.addEventListener('click', () =>
      launchApply(questionnaireBtn, {
        usePoolLetter: !approvedLetter,
        tailorResume: true,
        questionnaireWait: true,
        questionnaireAuto: true,
      })
    );
  }

  const qViewBtn = node.querySelector('.btn-questionnaire-view');
  if (qViewBtn) {
    const showQ =
      vacancyQuestionnairePending(item) ||
      itemHasMeaningfulQuestionnaire(item) ||
      itemQuestionnaireNeedsProbe(item) ||
      currentApplyView === 'questionnaire';
    if (showQ) {
      qViewBtn.hidden = false;
      if (itemQuestionnaireNeedsProbe(item)) {
        qViewBtn.textContent = 'Анкета ↓';
        qViewBtn.dataset.tip = 'Загрузить текст вопросов с hh.ru';
      }
      qViewBtn.addEventListener('click', () => openQuestionnaireModal(item));
    }
  }

  const actions = node.querySelector('.actions');
  const doneReason = node.querySelector('.done-reason');
  const restoreBtn = node.querySelector('.card-restore-queue');
  const ta = node.querySelector('.reason');

  if (item.status === 'pending') {
    actions.hidden = false;
    if (ta) ta.hidden = false;
    const ok = actions.querySelector('.ok');
    const bad = actions.querySelector('.bad');
    const refreshBtn = actions.querySelector('.btn-refresh-vacancy');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      if (ok) ok.disabled = true;
      if (bad) bad.disabled = true;
      try {
        const refreshRes = await api('/api/vacancy/refresh-body', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        if (refreshRes.scoreUpdated) {
          showToast('Текст с hh.ru и оценка (OpenRouter) обновлены', 'good');
        } else if (refreshRes.scoreError) {
          showToast(`Текст обновлён с hh.ru. Оценка: ${refreshRes.scoreError}`, 'neutral');
        } else {
          showToast('Текст вакансии обновлён с hh.ru', 'good');
        }
        await load();
      } catch (e) {
        alert(e.message);
        refreshBtn.disabled = false;
        if (ok) ok.disabled = false;
        if (bad) bad.disabled = false;
      }
    });
    }

    const send = async (action) => {
      if (ok) ok.disabled = true;
      if (bad) bad.disabled = true;
      try {
        await sendVacancyDecision(item, action, ta?.value || '');
      } catch {
        if (ok) ok.disabled = false;
        if (bad) bad.disabled = false;
      }
    };
    ok?.addEventListener('click', () => send('approve'));
    bad?.addEventListener('click', () => send('reject'));

    const hiddenReasons = item.hiddenRoleReasons || [];
    if (restoreBtn && hiddenReasons.length) {
      restoreBtn.hidden = false;
      restoreBtn.textContent = COPY.restoreToMainQueue;
      restoreBtn.title = 'Обойти фильтр роли и показать в основной очереди';
      restoreBtn.addEventListener('click', () =>
        restoreVacancyFromCard(item, restoreBtn, 'Показали в основной очереди')
      );
    }
  } else if (item.status === 'rejected' || item.status === 'approved') {
    if (ta) ta.hidden = true;
    const autoPrefix = item.status === 'rejected' ? autoRejectDoneReasonPrefix(item) : '';
    doneReason.textContent = item.feedbackReason
      ? `${autoPrefix}Комментарий: ${item.feedbackReason}`
      : item.status === 'rejected'
        ? autoPrefix
          ? `${autoPrefix.trim()}`
          : 'Отклонено'
        : 'Отмечено как подходит';
    if (restoreBtn) {
      restoreBtn.hidden = false;
      restoreBtn.textContent =
        item.status === 'approved' ? COPY.restoreFromApproved : COPY.restoreToQueue;
      restoreBtn.addEventListener('click', () =>
        restoreVacancyFromCard(
          item,
          restoreBtn,
          item.status === 'approved' ? 'Одобрение отменено' : 'Вернули в очередь'
        )
      );
    }
    if (item.status === 'rejected') {
      const suggest = inferRejectLearningPattern(item);
      const foot = node.querySelector('.card-foot--v4') || node.querySelector('.card-foot');
      if (foot && suggest) {
        const ruleBtn = document.createElement('button');
        ruleBtn.type = 'button';
        ruleBtn.className = 'btn btn-ghost btn-sm ui-expert-only';
        ruleBtn.textContent = 'В правила';
        ruleBtn.title = `Добавить «${suggest.pattern}» в таргетинг`;
        ruleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void learnFalsePositivePattern(suggest.pattern, suggest.target);
        });
        foot.appendChild(ruleBtn);
      }
    }
  } else if (doneReason) {
    if (ta) ta.hidden = true;
    doneReason.textContent = '';
  }

  return node;
}

function syncVacancyTabs() {
  vacancyTabsEl?.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.status === currentStatus);
  });
}

function syncScoreBandTabs() {
  document.querySelectorAll('#panel-score-band .tab-band').forEach((b) => {
    b.classList.toggle('active', b.dataset.band === currentScoreBand);
  });
}

function batchScopeForCurrentView() {
  if (currentApplyView === 'hidden') return 'hidden';
  if (currentApplyView === 'questionnaire') return 'questionnaire';
  if (currentApplyView === 'noQuestionnaire') return 'noQuestionnaire';
  if (currentApplyView === 'queue') return 'queue';
  return null;
}

function batchScopeUiLabel(scope) {
  return batchScopeLabel(scope);
}

function updateBatchButtonsForView() {
  const scope = batchScopeForCurrentView();
  const autoBtn = document.getElementById('btn-batch-auto');
  const manualBtn = document.getElementById('btn-batch-manual');
  const disabled = !scope;
  for (const btn of [autoBtn, manualBtn]) {
    if (!btn) continue;
    btn.disabled = disabled;
    btn.classList.toggle('btn--disabled', disabled);
  }
  if (autoBtn && scope) {
    autoBtn.dataset.tip =
      scope === 'hidden'
        ? `${COPY.batchAuto} · «Скрытые» (≥${scoreThreshold}) — с предупреждением`
        : `${COPY.batchAuto} · «${batchScopeUiLabel(scope)}» · балл ≥${scoreThreshold}`;
  }
  if (manualBtn && scope) {
    manualBtn.dataset.tip =
      scope === 'hidden'
        ? `${COPY.batchManual} · «Скрытые» (<${scoreThreshold}) — с предупреждением`
        : `${COPY.batchManual} · «${batchScopeUiLabel(scope)}» · балл <${scoreThreshold}`;
  }
}

function syncApplyViewTabs() {
  if (!applyViewTabsEl) return;
  applyViewTabsEl.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.applyView === currentApplyView);
  });
  syncDockMiniActiveView(currentApplyView);
  window.dispatchEvent(new CustomEvent('hh-apply-view-change', { detail: { view: currentApplyView } }));
  const hideQueueFilters =
    currentApplyView === 'applied' ||
    currentApplyView === 'questionnaire' ||
    currentApplyView === 'deferred';
  const queueFiltersEl = document.getElementById('sidebar-queue-filters');
  if (queueFiltersEl) queueFiltersEl.hidden = hideQueueFilters;

  updateBatchButtonsForView();

  const onQ = currentApplyView === 'questionnaire';
  const onApplied = currentApplyView === 'applied';
  const prepBtn = document.getElementById('btn-questionnaire-prep-batch');
  const reprobeBtn = document.getElementById('btn-questionnaire-reprobe-batch');
  const probeFilterBtn = document.getElementById('btn-questionnaire-probe-filter');
  const qActions = document.getElementById('context-questionnaire-actions');
  if (prepBtn) prepBtn.hidden = !onQ;
  if (reprobeBtn) reprobeBtn.hidden = !onQ;
  if (probeFilterBtn) probeFilterBtn.hidden = !onQ;
  if (qActions) qActions.hidden = !onQ;
  document.querySelectorAll('[data-service-q-only]').forEach((el) => {
    el.hidden = !onQ;
  });
  if (onQ) void refreshQuestionnaireReprobeStats();

  const funnelEl = document.getElementById('applied-funnel-tabs');
  if (funnelEl) funnelEl.hidden = !onApplied;

  const contextBar = document.getElementById('main-context-bar');
  if (contextBar) contextBar.hidden = !onApplied && !onQ;
}

const APPLY_VIEW_COPY_KEYS = {
  queue: 'navQueue',
  noQuestionnaire: 'navNoQuestionnaire',
  questionnaire: 'navQuestionnaire',
  applied: 'navApplied',
  hidden: 'navHidden',
  deferred: 'navDeferred',
};

function updateApplyViewTabCounts(counts) {
  if (!applyViewTabsEl || !counts) return;
  const map = {
    queue: counts.queue,
    noQuestionnaire: counts.noQuestionnaire,
    questionnaire: counts.questionnaire,
    applied: counts.applied,
    hidden: counts.hiddenByRole,
    deferred: counts.deferred,
  };
  applyViewTabsEl.querySelectorAll('.tab[data-apply-view]').forEach((btn) => {
    const view = btn.dataset.applyView;
    const copyKey = APPLY_VIEW_COPY_KEYS[view];
    const base = (copyKey && COPY[copyKey]) || btn.getAttribute('data-copy') || view;
    const n = map[view];
    btn.textContent = typeof n === 'number' && Number.isFinite(n) ? `${base} (${n})` : base;
    if (copyKey) btn.dataset.copy = copyKey;
  });
}

function mergeBatchAndApplyProgress(st) {
  const batch = st.batchProgress;
  const chat = st.applyChatProgress;
  const batchActive = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
  if (!batchActive || !batch) return batch;
  if (!chat || chat.phase === 'done' || chat.phase === 'error' || chat.phase === 'skipped') return batch;
  const floor = Math.max(0, Math.floor(Number(batch.current) || 0));
  const current = Math.min(batch.total || 1, floor + (Number(chat.percent) || 0) / 100);
  const stepLabel = chat.label || '';
  return {
    ...batch,
    current,
    label: stepLabel && batch.label ? `${batch.label} — ${stepLabel}` : batch.label || stepLabel,
    detailStep: chat.step || batch.detailStep,
    lastLogLine: stepLabel || batch.lastLogLine,
  };
}

function startJobLogPoll() {
  if (applyLogPollTimer) clearInterval(applyLogPollTimer);
  applyLogPollTimer = setInterval(() => {
    const modal = document.getElementById('apply-log-modal');
    if (modal && !modal.hidden) refreshApplyLogModal({ silent: true });
    refreshJobStatus();
  }, 1200);
}

function pickJobProgressPayload(st) {
  const batchActive = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
  const batchMerged = batchActive ? mergeBatchAndApplyProgress(st) : st.batchProgress;
  if (batchActive && batchMerged) {
    return { ...batchMerged, title: COPY.batch };
  }
  if (st.batchProgress?.phase === 'running' || st.batchProgress?.phase === 'paused') {
    return { ...st.batchProgress, title: COPY.batch };
  }
  if (st.applyChat?.running && st.applyChatProgress) {
    return { ...st.applyChatProgress, title: 'Отклик в браузере' };
  }
  if (st.harvest?.running && st.harvestProgress) {
    return { ...st.harvestProgress, title: COPY.harvest };
  }
  const side = st.sideJobs || {};
  if (side.syncResponses?.running) {
    return {
      phase: 'running',
      percent: 45,
      label: 'Синхронизация откликов с hh.ru…',
      title: 'Отклики hh.ru',
    };
  }
  if (side.syncChats?.running) {
    return {
      phase: 'running',
      percent: 45,
      label: 'Синхронизация чатов…',
      title: 'Чаты hh.ru',
    };
  }
  if (
    st.applyChatProgress?.phase === 'done' ||
    st.applyChatProgress?.phase === 'error' ||
    st.applyChatProgress?.phase === 'skipped'
  ) {
    return { ...st.applyChatProgress, title: 'Отклик в браузере' };
  }
  if (st.harvestProgress?.phase === 'done' || st.harvestProgress?.phase === 'error') {
    return { ...st.harvestProgress, title: COPY.harvest };
  }
  if (st.batchProgress?.phase === 'done' || st.batchProgress?.phase === 'error') {
    return { ...st.batchProgress, title: COPY.batch };
  }
  return null;
}

function paintJobProgressBox(box, p, st, { scoped = false } = {}) {
  if (!box) return;
  const titleEl = scoped
    ? box.querySelector('.job-progress-title')
    : document.getElementById('job-progress-title');
  const pctEl = scoped ? box.querySelector('.job-progress-pct') : document.getElementById('job-progress-pct');
  const bar = scoped ? box.querySelector('.job-progress-bar') : document.getElementById('job-progress-bar');
  const labelEl = scoped
    ? box.querySelector('.job-progress-label')
    : document.getElementById('job-progress-label');
  const metaEl = scoped ? box.querySelector('.job-progress-meta') : document.getElementById('job-progress-meta');
  const track = box.querySelector('.job-progress-track');

  if (!p) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  box.classList.add('hh-status-strip');
  box.classList.toggle('job-progress--done', p.phase === 'done');
  box.classList.toggle('job-progress--skipped', p.phase === 'skipped');
  box.classList.toggle('job-progress--error', p.phase === 'error');
  box.classList.toggle('job-progress--paused', p.phase === 'paused');

  const pct = Math.min(100, Math.max(0, Number(p.percent) || 0));

  if (titleEl) titleEl.textContent = p.title || 'Выполнение';
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;
  if (track) {
    track.setAttribute('aria-valuenow', String(pct));
    track.setAttribute('aria-valuetext', `${pct}%`);
  }
  if (labelEl) labelEl.textContent = p.label || '';

  const parts = [];
  if (p.current != null && p.total) {
    const cur =
      Number.isInteger(p.current) || p.current === Math.floor(p.current)
        ? `${p.current}`
        : p.current.toFixed(1);
    parts.push(`${cur} / ${p.total}`);
  }
  if (p.elapsedSec != null) parts.push(`прошло ${p.elapsedSec} с`);
  if (p.etaLabel) parts.push(`осталось ${p.etaLabel}`);
  if (p.detailStep) parts.push(`шаг: ${p.detailStep}`);
  const s = p.stats || {};
  if (s.added != null) parts.push(`в очередь: ${s.added}`);
  if (s.skipped != null) parts.push(`пропущено: ${s.skipped}`);
  if (s.urlsFound != null) parts.push(`новых URL: ${s.urlsFound}`);
  if (s.newToProcess != null && s.urlsFound == null) parts.push(`на обход: ${s.newToProcess}`);
  if (s.serpCards != null) parts.push(`выдача: ${s.serpCards}`);
  if (s.skippedKnown != null && s.skippedKnown > 0) parts.push(`уже в очереди: ${s.skippedKnown}`);
  if (s.skippedTitle != null && s.skippedTitle > 0) parts.push(`фильтр заголовка: ${s.skippedTitle}`);
  if (s.knownIds != null) parts.push(`известно ID: ${s.knownIds}`);
  if (s.done != null) parts.push(`откликов: ${s.done}`);
  if (s.failed) parts.push(`ошибок: ${s.failed}`);
  if (metaEl) metaEl.textContent = parts.join(' · ');

  if (!scoped) {
    const batchActive = Boolean(st?.batchActive ?? st?.batch?.running ?? st?.batchControl?.batchRunning);
    const isBatchBlock = p.title === COPY.batch;
    const clickable = Boolean(
      isBatchBlock &&
        (batchActive || p.phase === 'running' || p.phase === 'paused' || p.phase === 'done' || p.phase === 'error')
    );
    box.classList.toggle('job-progress--clickable', clickable);
    box.tabIndex = clickable ? 0 : -1;
    if (track) track.setAttribute('role', clickable ? 'presentation' : 'progressbar');

    const logEl = document.getElementById('job-progress-log');
    if (logEl) {
      const tail = (st?.applyLog?.tail || '').trim();
      const showLog = (batchActive || st?.applyChat?.running) && tail;
      logEl.hidden = !showLog;
      if (showLog) {
        const lines = tail.split('\n').filter(Boolean);
        logEl.textContent = lines.slice(-2).join('\n');
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  }
}

function initJobProgressOpenLog() {
  const box = document.getElementById('job-progress');
  if (!box) return;
  const open = (e) => {
    if (box.hidden || !box.classList.contains('job-progress--clickable')) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    if (e.type === 'keydown') e.preventDefault();
    openApplyLogModal();
    startJobLogPoll();
  };
  box.addEventListener('click', open);
  box.addEventListener('keydown', open);
}

function renderJobProgress(st) {
  const p = pickJobProgressPayload(st);
  paintJobProgressBox(document.getElementById('job-progress'), p, st);
  const logModal = document.getElementById('apply-log-modal');
  if (logModal && !logModal.hidden) {
    paintJobProgressBox(document.getElementById('apply-log-progress'), p, st, { scoped: true });
  }
}

/** @type {'idle'|'harvest'|'batch'} */
let activeJobControl = 'idle';

function updateBrowserSideJobButtons(st) {
  const busy = Boolean(st.browserBusy?.busy);
  const ids = ['btn-daily-routine', 'btn-run-harvest'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = busy;
      el.title = busy ? st.browserBusy?.message || 'Дождитесь завершения батча' : el.dataset.tip || '';
    }
  }
  document
    .querySelectorAll(
      '[data-service-action="sync-hh-responses"], [data-service-action="sync-hh-chats"], [data-service-action^="raise-resumes"]'
    )
    .forEach((el) => {
      el.disabled = busy;
      if (busy) el.title = st.browserBusy?.message || 'Недоступно — дождитесь завершения батча';
      else if (el.dataset.tip) el.title = el.dataset.tip;
    });
}

function renderRoutingHealthBanner(st) {
  const el = document.getElementById('crm-health-banner');
  if (!el) return;
  const rh = st.routingHealth;
  const nc = st.negotiationsCache;
  const parts = [];
  if (rh && !rh.ok) {
    const roles = rh.issues.map((i) => i.label).join(', ');
    parts.push(`Резюме ${roles}: нет привязки на hh.ru`);
  }
  if (nc?.count != null) {
    parts.push(`Кэш hh: ${nc.count} откликов`);
  }
  if (!parts.length) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('crm-health-banner--warn');
    return;
  }
  el.hidden = false;
  el.textContent = `${parts.join(' · ')} · нажмите для сервиса`;
  el.classList.toggle('crm-health-banner--warn', Boolean(rh && !rh.ok));
  if (!el.dataset.bound) {
    el.dataset.bound = '1';
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      document.getElementById('btn-open-service')?.click();
    });
  }
}

function updateJobControlButtons(st) {
  updateBrowserSideJobButtons(st);
  renderRoutingHealthBanner(st);
  const row = document.getElementById('job-control-actions');
  const labelEl = document.getElementById('job-control-label');
  const pauseBtn = document.getElementById('btn-job-pause');
  const stopBtn = document.getElementById('btn-job-stop');
  const resumeBtn = document.getElementById('btn-job-resume');
  const logPauseBtn = document.getElementById('apply-log-pause');
  const logStopBtn = document.getElementById('apply-log-stop');
  const logResumeBtn = document.getElementById('apply-log-resume');
  const mirrorToLogButtons = () => {
    if (logPauseBtn) logPauseBtn.disabled = pauseBtn?.disabled ?? true;
    if (logStopBtn) logStopBtn.disabled = stopBtn?.disabled ?? true;
    if (logResumeBtn) {
      logResumeBtn.disabled = resumeBtn?.disabled ?? true;
      logResumeBtn.title = resumeBtn?.title || '';
    }
  };
  const bc = st.batchControl || {};
  const hc = st.harvestControl || {};
  const harvestRunning = Boolean(st.harvest?.running);
  const batchRunning = Boolean(st.batchActive ?? st.batch?.running ?? bc.batchRunning);

  if (harvestRunning) {
    activeJobControl = 'harvest';
    const paused = hc.command === 'paused';
    if (row) row.hidden = false;
    if (labelEl) labelEl.textContent = paused ? `${COPY.harvest} · пауза` : COPY.harvest;
    if (pauseBtn) pauseBtn.disabled = paused;
    if (stopBtn) stopBtn.disabled = false;
    if (resumeBtn) {
      resumeBtn.disabled = !paused;
      resumeBtn.title = paused ? 'Продолжить сбор' : 'Сбор не на паузе';
    }
    mirrorToLogButtons();
    return;
  }

  if (batchRunning || bc.canResume) {
    activeJobControl = 'batch';
    const paused = batchRunning && bc.command === 'paused';
    if (row) row.hidden = false;
    if (labelEl) labelEl.textContent = paused ? `${COPY.batch} · пауза` : COPY.batchShort || COPY.batch;
    if (pauseBtn) pauseBtn.disabled = !batchRunning || paused;
    if (stopBtn) stopBtn.disabled = !batchRunning;
    if (resumeBtn) {
      resumeBtn.disabled = paused ? false : !bc.canResume;
      resumeBtn.title = paused
        ? 'Снять паузу батча'
        : bc.canResume
          ? 'Продолжить прерванный батч'
          : 'Нет сохранённого батча';
    }
    mirrorToLogButtons();
    return;
  }

  activeJobControl = 'idle';
  if (row) row.hidden = true;
  mirrorToLogButtons();
}

async function postBatchControl(action) {
  const payload = JSON.stringify({ action });
  try {
    return await api('/api/batch-control', { method: 'POST', body: payload });
  } catch (e) {
    if (e.status !== 404) throw e;
    return await api('/api/hh-launch-apply-batch', { method: 'POST', body: payload });
  }
}

async function postHarvestControl(action) {
  return await api('/api/harvest-control', { method: 'POST', body: JSON.stringify({ action }) });
}

async function sendJobControl(action) {
  try {
    if (activeJobControl === 'harvest') {
      const res = await postHarvestControl(action);
      showToast(res.message || action, 'neutral');
    } else {
      const res = await postBatchControl(action);
      if (res.needsRelaunch) {
        const launch = await api('/api/hh-launch-apply-batch', {
          method: 'POST',
          body: JSON.stringify({ resume: true }),
        });
        showToast(launch.message || 'Батч продолжен', 'good');
        openApplyLogModal();
        startJobLogPoll();
      } else {
        showToast(res.message || action, 'neutral');
      }
    }
    refreshJobStatus();
  } catch (e) {
    const hint =
      e.status === 404
        ? 'Пауза/Стоп: перезапустите дашборд (npm run devops:dashboard) и обновите страницу (F5).'
        : e.message;
    alert(hint);
  }
}

async function probeBatchControlApi() {
  try {
    await api('/api/batch-control');
  } catch (e) {
    if (e.status === 404) {
      showToast('Перезапустите дашборд (npm run devops:dashboard) — иначе Пауза/Стоп не работают', 'neutral');
    }
  }
  try {
    await api('/api/harvest-control');
  } catch (e) {
    if (e.status === 404) {
      showToast('Перезапустите дашборд — пауза сбора недоступна', 'neutral');
    }
  }
}

function isSideSyncBusy(st) {
  const side = st.sideJobs || {};
  return Boolean(
    side.syncResponses?.running ||
      side.syncChats?.running ||
      side.dailyRoutine?.running ||
      side.resumeRaise?.running
  );
}

function formatHumanJobStatus(st) {
  const bc = st.batchControl || {};
  const batchAlive = Boolean(st.batchActive ?? st.batch?.running ?? bc.batchRunning);
  const side = st.sideJobs || {};
  const msgs = [];

  if (st.harvest?.running) {
    const hp = st.harvestProgress;
    const hc = st.harvestControl || {};
    if (hc.command === 'paused') {
      msgs.push(progressStatusLabel(hp) || `${COPY.harvest} на паузе`);
    } else {
      msgs.push(progressStatusLabel(hp) || 'Собираем вакансии с hh.ru…');
    }
  }

  if (batchAlive) {
    const done = Number(bc.done) || 0;
    const planned = Number(bc.planned) || 0;
    const progress = planned ? ` (${done} из ${planned})` : '';
    if (bc.command === 'paused') {
      const captcha =
        bc.pauseReason === 'captcha'
          ? ' — капча, пройдите проверку в Chromium'
          : '';
      msgs.push(`${COPY.batch} на паузе${progress}${captcha}`);
    } else {
      const bp = st.batchProgress;
      const fromProgress = progressStatusLabel(bp);
      msgs.push(fromProgress || `Идёт ${COPY.batch.toLowerCase()}${progress}`);
    }
  } else if (bc.canResume) {
    const done = Number(bc.done) || 0;
    const planned = Number(bc.planned) || 0;
    msgs.push(
      planned
        ? `${COPY.batch} не завершена (${done} из ${planned}) — «Продолжить» ниже`
        : `Есть незавершённая ${COPY.batch.toLowerCase()} — «Продолжить» ниже`
    );
  } else if (st.batchLastReport?.finishedAt && !batchAlive) {
    const br = st.batchLastReport;
    const resumeLine = Object.entries(br.resumeUsage || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    msgs.push(
      `Последняя серия: ${br.done}/${br.planned} успешно` +
        (br.offTargetSkipped ? ` · нецелевых ${br.offTargetSkipped}` : '') +
        (resumeLine ? ` · ${resumeLine}` : '')
    );
  }

  if (st.applyChat?.running && !batchAlive) {
    const ap = st.applyChatProgress;
    msgs.push(progressStatusLabel(ap) || 'Отклик в браузере…');
    if (dashboardPreferences?.dashboardPlaywrightDisplayMode === 'visible') {
      msgs.push('Окно Chromium может перекрывать дашборд — сверните или смените режим в Настройки → Система');
    }
  }

  if (side.syncResponses?.running) {
    msgs.push('Синхронизация откликов с hh.ru…');
  }
  if (side.syncChats?.running) {
    msgs.push('Синхронизация чатов…');
  }
  if (side.dailyRoutine?.running) {
    msgs.push('Утренний цикл…');
  }
  if (side.resumeRaise?.running) {
    msgs.push('Подъём резюме на hh.ru…');
  }

  if (st.browserLock?.held && !msgs.length) {
    const ownerLabels = {
      harvest: COPY.harvest.toLowerCase(),
      batch: COPY.batch.toLowerCase(),
      'hh-apply-chat': 'отклик',
      'hh-apply-batch': 'батч',
    };
    const who = ownerLabels[st.browserLock.owner] || String(st.browserLock.owner || 'задача');
    msgs.push(`Браузер занят (${who})`);
  }

  let main = msgs.length ? msgs.join(' · ') : 'Готов к работе';

  if (
    msgs.length === 0 &&
    st.syncResponsesLog?.lastError &&
    !side.syncResponses?.running &&
    !isSideSyncBusy(st)
  ) {
    main = 'Последняя синхронизация откликов — ошибка';
  } else if (
    msgs.length === 0 &&
    st.harvestLog?.lastError &&
    !st.harvest?.running &&
    !isSideSyncBusy(st)
  ) {
    main = 'Последний сбор завершился с ошибкой';
  }

  return { main, msgs };
}

function formatJobStatusTooltip(st, { msgs = [] } = {}) {
  const lines = [];
  if (st.harvest?.running && st.harvest.pid)
    lines.push(`${COPY.harvest} (процесс ${st.harvest.pid})`);
  if (st.batch?.running && st.batch.pid) lines.push(`${COPY.batchShort} (процесс ${st.batch.pid})`);
  if (st.applyChat?.running && st.applyChat.pid) lines.push(`Отклик (процесс ${st.applyChat.pid})`);
  const side = st.sideJobs || {};
  if (side.syncResponses?.running && side.syncResponses.pid) {
    lines.push(`Sync откликов (процесс ${side.syncResponses.pid})`);
  }
  if (side.syncChats?.running && side.syncChats.pid) {
    lines.push(`Sync чатов (процесс ${side.syncChats.pid})`);
  }
  if (st.queuePath) lines.push(`Файл очереди: ${st.queuePath}`);
  if (st.browserLock?.held) lines.push(`Блокировка браузера: ${st.browserLock.owner}`);
  if (st.harvestLog?.lastError && !st.harvest?.running) {
    lines.push(`Ошибка сбора: ${st.harvestLog.lastError}`);
  }
  if (st.syncResponsesLog?.lastError && !side.syncResponses?.running) {
    lines.push(`Ошибка sync откликов: ${st.syncResponsesLog.lastError}`);
  }
  const tail = st.harvestLog?.tail?.trim();
  if (tail) lines.push('', tail);
  const syncTail = st.syncResponsesLog?.tail?.trim();
  if (syncTail && !side.syncResponses?.running) lines.push('', syncTail);
  if (!lines.length && msgs.length) return '';
  return lines.join('\n');
}

function formatHarvestStatsLine(h) {
  if (!h) return '';
  const msg = displayStatusText(h.message);
  if (msg) return msg;
  if (h.added != null) return `${COPY.harvest}: +${h.added} в очередь`;
  return '';
}

function formatDashboardStatsExtra(stats) {
  if (!stats) return '';
  const q = stats.queue || {};
  const roll = stats.appliedRolling || {};
  const f = stats.funnel || {};
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
  const parts = [];
  if (q.unionRecords != null) {
    parts.push(`всего карточек: ${q.unionRecords}`);
  } else if (q.queueTotal != null) {
    parts.push(`вакансий: ${q.queueTotal}`);
  }
  if (q.knownVacancyIds != null) {
    parts.push(`известно ID: ${q.knownVacancyIds}`);
  }
  if (roll.last7d != null) parts.push(`откл. 7д: ${roll.last7d}`);
  if (roll.sinceFunnel != null && roll.sinceLabel) {
    parts.push(`${roll.sinceLabel}: ${roll.sinceFunnel}`);
  }
  parts.push(`просмотр ${viewPct}%`);
  const hLine = formatHarvestStatsLine(stats.harvestLast);
  if (hLine) parts.push(hLine);
  return parts.join(' · ');
}

async function refreshIntelligenceSourcesMini() {
  await refreshIntelligencePanel({ api });
}

function renderFunnelMini(stats) {
  const el = document.getElementById('funnel-mini');
  if (!el || !stats) return;
  const f = stats.funnel || {};
  const applied = Number(stats.applied ?? f.applied ?? 0) || 0;
  const onHh = Number(stats.appliedOnHh ?? f.appliedOnHh ?? applied) || applied;
  const sinceLabel = stats.funnelSince ? `с ${stats.funnelSince}` : 'с 1 апр';
  const viewed = Number(stats.viewed ?? f.viewed ?? 0) || 0;
  const invited = Number(stats.invited ?? f.invited ?? 0) || 0;
  const awaiting = Number(stats.awaiting ?? 0) || 0;
  const declined = Number(stats.declined ?? f.declined ?? 0) || 0;
  const max = Math.max(applied, viewed, invited, 1);
  const invitePct = f.inviteRatePct ?? stats.rates?.invitePct ?? 0;
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
  const invitePctRounded = Math.round(Number(invitePct) || 0);
  const viewPctRounded = Math.round(Number(viewPct) || 0);
  const inQueue =
    stats.byStatus != null ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—';
  const queueNum = Number(inQueue);
  const maxCount = Math.max(
    Number.isFinite(queueNum) ? queueNum : 0,
    applied,
    viewed,
    invited,
    1
  );
  const steps = [
    { label: 'Очер.', count: inQueue },
    { label: 'Откл.', count: applied },
    { label: 'Просм.', count: viewed },
    { label: 'Пригл.', count: invited },
  ].map((s) => {
    const n = Number(s.count);
    const ratio = Number.isFinite(n) ? n / maxCount : 0;
    return { ...s, fh: `${Math.max(6, Math.round(ratio * 100))}%` };
  });
  el.hidden = false;
  el.title = `${sinceLabel}: ${applied} откл.${onHh > applied ? ` · hh ${onHh}` : ''} · ${viewPct}% просм. · ${invitePct}% пригл. · ждём ${awaiting} · отказ ${declined}`;
  const hhExtra = onHh > applied ? ` · hh ${onHh}` : '';
  const sparkline = renderDailySparklineHtml(stats.applyTimelineLast7 || []);
  el.innerHTML = `
    ${sparkline}
    <div class="funnel-mini__bars" aria-hidden="true">
      ${steps
        .map(
          (s) =>
            `<div class="funnel-mini__step" title="${escapeHtml(s.label)}: ${s.count}">
              <span class="funnel-mini__label">${escapeHtml(s.label)}</span>
              <span class="funnel-mini__bar" style="--fh:${s.fh}"></span>
              <span class="funnel-mini__num">${s.count}</span>
            </div>`
        )
        .join('')}
    </div>
    <div class="funnel-mini__rates">${applied} откл.${hhExtra} · ${viewPctRounded}% просм. · ${invitePctRounded}% пригл.</div>`;
}

function readFunnelFiltersFromUI() {
  const periodVal = String(document.getElementById('funnel-filter-period')?.value ?? 'since:2026-04-01');
  const scope = document.getElementById('funnel-filter-scope')?.value || 'applied';
  const minRaw = document.getElementById('funnel-filter-min-score')?.value;
  const minScore = minRaw != null && String(minRaw).trim() !== '' ? Number(minRaw) : 0;
  /** @type {{ periodDays: number, since: string, scope: string, minScore: number }} */
  const out = { periodDays: 0, since: '', scope, minScore: Number.isFinite(minScore) ? minScore : 0 };
  if (periodVal.startsWith('since:')) {
    out.since = periodVal.slice(6);
  } else {
    const n = Number(periodVal);
    out.periodDays = Number.isFinite(n) ? n : 0;
  }
  return out;
}

function renderScoreBucketChart(buckets) {
  const total = (buckets.high || 0) + (buckets.mid || 0) + (buckets.low || 0) + (buckets.none || 0);
  if (!total) return '';
  const segs = [
    { cls: 'funnel-stack__seg--high', n: buckets.high || 0, label: '≥70' },
    { cls: 'funnel-stack__seg--mid', n: buckets.mid || 0, label: '50–69' },
    { cls: 'funnel-stack__seg--low', n: buckets.low || 0, label: '<50' },
    { cls: 'funnel-stack__seg--none', n: buckets.none || 0, label: 'без' },
  ].filter((s) => s.n > 0);
  const bar = segs
    .map((s) => `<span class="funnel-stack__seg ${s.cls}" style="flex:${s.n}" title="${s.label}: ${s.n}"></span>`)
    .join('');
  const legend = segs
    .map((s) => `<span class="funnel-stack__legend-item"><i class="funnel-stack__dot ${s.cls}"></i>${s.label} ${s.n}</span>`)
    .join('');
  return `<div class="funnel-stack-chart" role="img" aria-label="Распределение по баллам">${bar}</div><div class="funnel-stack__legend">${legend}</div>`;
}

function renderHhStatusChart(hh) {
  const total = Number(hh.total) || 0;
  if (!total) return '';
  const segs = [
    { cls: 'funnel-stack__seg--viewed', n: hh.viewed || 0, label: 'просм.' },
    { cls: 'funnel-stack__seg--invited', n: hh.invited || 0, label: 'пригл.' },
    { cls: 'funnel-stack__seg--declined', n: hh.declined || 0, label: 'отказ' },
    { cls: 'funnel-stack__seg--awaiting', n: hh.awaiting || 0, label: 'ждём' },
  ].filter((s) => s.n > 0);
  const bar = segs
    .map((s) => `<span class="funnel-stack__seg ${s.cls}" style="flex:${s.n}" title="${s.label}: ${s.n}"></span>`)
    .join('');
  const legend = segs
    .map((s) => `<span class="funnel-stack__legend-item"><i class="funnel-stack__dot ${s.cls}"></i>${s.label} ${s.n}</span>`)
    .join('');
  return `<div class="funnel-stack-chart funnel-stack-chart--hh" role="img" aria-label="Статусы в кэше hh">${bar}</div><div class="funnel-stack__legend">${legend}</div>`;
}

function funnelFilterQuery(filters) {
  const p = new URLSearchParams();
  if (filters.since) p.set('since', filters.since);
  else p.set('period', String(filters.periodDays ?? 0));
  p.set('scope', filters.scope || 'applied');
  if (filters.minScore > 0) p.set('minScore', String(filters.minScore));
  return p.toString();
}

function renderFunnelModalBody(data) {
  const body = document.getElementById('funnel-modal-body');
  if (!body) return;
  if (!data) {
    body.innerHTML = '<p class="funnel-loading">Нет данных</p>';
    return;
  }
  const {
    counts,
    steps,
    rates,
    timeline,
    hhNegotiations,
    hhRates,
    scoreBuckets,
    filters,
    byResume,
    dataSources,
  } = data;
  const sinceNote = filters?.since
    ? `Период: с ${filters.since}`
    : filters?.periodDays
      ? `Период: ${filters.periodDays} дн.`
      : 'Период: всё время';
  const stepsSafe = Array.isArray(steps) ? steps : [];
  const timelineSafe = Array.isArray(timeline) ? timeline : [];
  const buckets = scoreBuckets && typeof scoreBuckets === 'object' ? scoreBuckets : { high: 0, mid: 0, low: 0, none: 0 };
  const hh = hhNegotiations && typeof hhNegotiations === 'object' ? hhNegotiations : { total: 0, viewed: 0, invited: 0, declined: 0, awaiting: 0, syncedAt: null };
  const hhR = hhRates && typeof hhRates === 'object' ? hhRates : { viewFromAll: 0, inviteFromAll: 0, declineFromAll: 0 };
  const ratesSafe = rates && typeof rates === 'object' ? rates : {};
  const countsSafe = counts && typeof counts === 'object' ? counts : {};
  const maxStep = Math.max(...stepsSafe.map((s) => s.count), 1);

  const funnelBars = stepsSafe
    .map((s) => {
      const w = Math.round((s.count / maxStep) * 100);
      const sub =
        s.pctOfApplied != null
          ? `${s.pctOfApplied}% от откликов`
          : s.pctOfPrev != null
            ? `${s.pctOfPrev}% от пред. шага`
            : `${s.pctOfBase ?? 0}%`;
      return `<div class="funnel-chart__row funnel-chart__row--${s.color || s.id}">
        <span class="funnel-chart__label">${s.label}</span>
        <div class="funnel-chart__track"><span class="funnel-chart__bar" style="width:${Math.max(2, w)}%"></span></div>
        <span class="funnel-chart__count">${s.count}</span>
        <span class="funnel-chart__pct">${sub}</span>
      </div>`;
    })
    .join('');

  const timelineChart = bucketTimelineForDisplay(timelineSafe);
  const timelineHtml = renderFunnelTimelineHtml(timelineChart);

  const sourcesLine = (dataSources || [])
    .map((s) => `${s.file} (${s.count})`)
    .join(' · ');
  const queueNote =
    data.queueOverview != null
      ? `<p class="funnel-period-note funnel-queue-note">Охват: <strong>${
          countsSafe.unionVacancyIds ?? data.queueOverview.queueTotal
        }</strong> вакансий · <strong>${countsSafe.unionRecords ?? data.queueOverview.unionRecords ?? '—'}</strong> карточек${
          data.queueOverview.hhCacheItems
            ? ` · кэш hh: ${data.queueOverview.hhCacheItems}`
            : ''
        }${sourcesLine ? `<br><span class="funnel-sources">${sourcesLine}</span>` : ''}</p>`
      : sourcesLine
        ? `<p class="funnel-period-note funnel-queue-note"><span class="funnel-sources">${sourcesLine}</span></p>`
        : '';

  const resumeRows = (byResume || [])
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td>${r.applied}</td><td>${r.viewed}</td><td>${r.invited}</td><td>${r.declined}</td><td>${r.viewPct}%</td><td>${r.invitePct}%</td></tr>`
    )
    .join('');
  const resumeTable = resumeRows
    ? `<section class="funnel-panel funnel-panel--wide">
        <h3 class="funnel-panel__title">По резюме (фактический выбор)</h3>
        <table class="funnel-resume-table">
          <thead><tr><th>Резюме</th><th>Откл.</th><th>Просм.</th><th>Пригл.</th><th>Отказ</th><th>% просм.</th><th>% пригл.</th></tr></thead>
          <tbody>${resumeRows}</tbody>
        </table>
      </section>`
    : `<section class="funnel-panel funnel-panel--wide"><p class="funnel-empty">Нет данных по резюме — сделайте отклики и синхронизируйте hh.ru</p></section>`;

  const staleItems = data.staleFollowUp || [];
  const staleSection = staleItems.length
    ? `<section class="funnel-panel funnel-panel--wide">
        <h3 class="funnel-panel__title">Follow-up: ${data.staleFollowUpDays || 7}+ дней без ответа (${staleItems.length})</h3>
        <ul class="funnel-stale-list">${staleItems
          .slice(0, 12)
          .map(
            (it) =>
              `<li><strong>${escapeHtml(it.title || '—')}</strong>${it.company ? ` · ${escapeHtml(it.company)}` : ''} — ${it.days} дн.</li>`
          )
          .join('')}</ul>
        <p class="funnel-period-note">В разделе «Отклики» → вкладка «7+ дн.» — полный список для напоминания работодателю.</p>
      </section>`
    : '';

  const harvestNote = data.harvestLast
    ? `<p class="funnel-period-note funnel-harvest-note">Последний сбор: ${
        esc(displayStatusText(data.harvestLast.message) || '—')
      }${
        data.harvestLast.serpCards != null
          ? ` · выдача ${data.harvestLast.serpCards}, дубликаты ${data.harvestLast.skippedKnown ?? 0}`
          : ''
      }${
        data.harvestLast.finishedAt
          ? ` · ${new Date(data.harvestLast.finishedAt).toLocaleString('ru-RU')}`
          : ''
      }</p>`
    : '';

  body.innerHTML = `
    ${queueNote}
    ${harvestNote}
    <p class="funnel-period-note">${sinceNote} · откликов: <strong>${countsSafe.applied ?? 0}</strong>${
      countsSafe.appliedHhCacheOnly
        ? ` (${countsSafe.appliedHhCacheOnly} только из кэша hh — синхр. «Отклики» в сервисе)`
        : ''
    }</p>
    <div class="funnel-modal-grid">
      ${resumeTable}
      ${staleSection}
      <div class="funnel-modal-row funnel-modal-row--pair">
        <section class="funnel-panel funnel-panel--pair-funnel">
          <h3 class="funnel-panel__title">Воронка</h3>
          <div class="funnel-chart">${funnelBars}</div>
          <ul class="funnel-rates-list funnel-rates-list--compact">
            <li>Просмотр от откликов: <strong>${ratesSafe.viewFromApplied ?? 0}%</strong></li>
            <li>Приглашения от откликов: <strong>${ratesSafe.inviteFromApplied ?? 0}%</strong></li>
            <li>Приглашения от просмотров: <strong>${ratesSafe.inviteFromViewed ?? 0}%</strong></li>
            <li>Отказы: ${countsSafe.declined ?? 0} (${ratesSafe.declineFromApplied ?? 0}%)</li>
            <li>Ждём: ${countsSafe.awaiting ?? 0} · без статуса: ${countsSafe.noResponseYet ?? 0}</li>
          </ul>
        </section>
        <section class="funnel-panel funnel-panel--timeline">
          <h3 class="funnel-panel__title">Динамика откликов</h3>
          <div class="funnel-timeline-wrap">${timelineHtml}</div>
        </section>
      </div>
      <section class="funnel-panel funnel-panel--half">
        <h3 class="funnel-panel__title">По баллам</h3>
        ${renderScoreBucketChart(buckets)}
        <div class="funnel-buckets">
          <div class="funnel-bucket"><span>≥70</span><strong>${buckets.high}</strong></div>
          <div class="funnel-bucket"><span>50–69</span><strong>${buckets.mid}</strong></div>
          <div class="funnel-bucket"><span>&lt;50</span><strong>${buckets.low}</strong></div>
          <div class="funnel-bucket"><span>без</span><strong>${buckets.none}</strong></div>
        </div>
        <div class="funnel-panel__section funnel-panel__section--tail">
          <h3 class="funnel-panel__title">Активность</h3>
          <ul class="funnel-rates-list">
            <li>Отклики за 7 дн.: <strong>${data.appliedRolling?.last7d ?? '—'}</strong></li>
            <li>Отклики за 30 дн.: <strong>${data.appliedRolling?.last30d ?? '—'}</strong></li>
            <li>Анкеты: ${countsSafe.withQuestionnaire ?? 0}</li>
            <li>Чаты ждут ответ: ${countsSafe.chatNeedsReply ?? 0}</li>
            <li>Отклонено в очереди: ${countsSafe.rejected ?? 0}</li>
            ${
              data.feedbackStats?.total
                ? `<li>Обратная связь LLM: пригл. <strong>${data.feedbackStats.invited ?? 0}</strong> · отказ <strong>${data.feedbackStats.declined ?? 0}</strong> · в файле ${data.feedbackStats.total}</li>`
                : '<li>Обратная связь LLM: отметьте «Пригласили» / «Отказ» на карточках</li>'
            }
          </ul>
        </div>
      </section>
      <section class="funnel-panel funnel-panel--half">
        <h3 class="funnel-panel__title">Кэш hh.ru (все переговоры)</h3>
        <p class="funnel-panel__meta">${hh.syncedAt ? `Синхр.: ${new Date(hh.syncedAt).toLocaleString('ru-RU')}` : 'Синхронизируйте отклики в «Сервис»'}</p>
        ${renderHhStatusChart(hh)}
        <ul class="funnel-rates-list">
          <li>Всего: <strong>${hh.total}</strong></li>
          <li>Просмотр: ${hh.viewed} (${hhR.viewFromAll}%)</li>
          <li>Приглашения: ${hh.invited} (${hhR.inviteFromAll}%)</li>
          <li>Отказы: ${hh.declined} (${hhR.declineFromAll}%)</li>
          <li>Ждём: ${hh.awaiting}</li>
        </ul>
      </section>
    </div>`;
}

async function refreshNorthStarKpi() {
  const el = document.getElementById('north-star-kpi');
  if (!el) return;
  try {
    const res = await api('/api/north-star-metrics?periodDays=7');
    const m = res?.metrics;
    if (!m) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const lines = [m.slotFillText, m.ePerApplied7dText, m.prepCoverageText].filter(Boolean);
    const unique = [...new Set(lines)];
    el.innerHTML = [
      `<p class="north-star-kpi__title">К собеседованию</p>`,
      ...unique.map((line) => `<p class="north-star-kpi__line">${escapeHtml(line)}</p>`),
    ].join('');
  } catch {
    el.hidden = true;
  }
}

async function loadFunnelAnalytics(filters) {
  const q = funnelFilterQuery(filters ?? readFunnelFiltersFromUI());
  const [funnel, dash] = await Promise.all([
    api(`/api/funnel-analytics?${q}`),
    api('/api/dashboard-stats').catch(() => null),
  ]);
  if (dash) {
    funnel.queueOverview = dash.queue;
    funnel.harvestLast = dash.harvestLast;
    funnel.appliedRolling = dash.appliedRolling;
    funnel.feedbackStats = dash.feedbackStats;
  }
  return funnel;
}

async function refreshFunnelModal() {
  const body = document.getElementById('funnel-modal-body');
  if (body) body.innerHTML = '<p class="funnel-loading">Загрузка…</p>';
  try {
    const data = await loadFunnelAnalytics();
    renderFunnelModalBody(data);
  } catch (e) {
    if (body) body.innerHTML = `<p class="err">${e.message}</p>`;
  }
}

function openFunnelModal() {
  closeServiceDrawer();
  const modal = document.getElementById('funnel-modal');
  if (!modal) return;
  openModalEl(modal);
  void refreshFunnelModal();
}

function closeFunnelModal() {
  const modal = document.getElementById('funnel-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function initFunnelUi() {
  document.querySelector('.crm-kpi')?.addEventListener('click', openFunnelModal);
  document.querySelectorAll('[data-close-funnel]').forEach((el) => {
    el.addEventListener('click', closeFunnelModal);
  });
  document.getElementById('funnel-filter-apply')?.addEventListener('click', () => refreshFunnelModal());
  for (const id of ['funnel-filter-period', 'funnel-filter-scope', 'funnel-filter-min-score']) {
    document.getElementById(id)?.addEventListener('change', () => {
      const modal = document.getElementById('funnel-modal');
      if (modal && !modal.hidden) refreshFunnelModal();
    });
  }
}

function readCachedPromptPack(li) {
  try {
    const raw = li?.dataset?.promptPack;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cachePromptPack(li, pack) {
  if (!li || !pack) return;
  try {
    li.dataset.promptPack = JSON.stringify(pack);
  } catch {
    /* ignore */
  }
}

let interviewHubCache = null;
let interviewHubSelectedId = null;
/** @type {import('./command-palette.mjs').PaletteAction[]} */
let commandPaletteStaticActions = [];
const INTERVIEW_PREP_STEP_IDS = (INTERVIEW_PREP_CHECKLIST_COPY.steps || [])
  .map((step) => String(step?.id || '').trim())
  .filter(Boolean);
let interviewPrepCaptureHealthTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let interviewHubPrepRefreshTimer = null;

function scheduleInterviewHubRefresh(delayMs = 700) {
  if (interviewHubPrepRefreshTimer) clearTimeout(interviewHubPrepRefreshTimer);
  interviewHubPrepRefreshTimer = setTimeout(() => {
    interviewHubPrepRefreshTimer = null;
    void refreshInterviewHubModal();
  }, delayMs);
}

function buildInterviewPrepDefaultDone() {
  return Object.fromEntries(INTERVIEW_PREP_STEP_IDS.map((id) => [id, false]));
}

function readInterviewPrepChecklistState() {
  const fallback = {
    done: buildInterviewPrepDefaultDone(),
    updatedAt: 0,
  };
  try {
    const raw = localStorage.getItem(INTERVIEW_PREP_CHECKLIST_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const done = buildInterviewPrepDefaultDone();
    const sourceDone = parsed.done && typeof parsed.done === 'object' ? parsed.done : {};
    for (const id of INTERVIEW_PREP_STEP_IDS) done[id] = sourceDone[id] === true;
    return {
      done,
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return fallback;
  }
}

/**
 * @param {Record<string, boolean>} done
 */
function writeInterviewPrepChecklistState(done) {
  try {
    const normalizedDone = Object.fromEntries(
      INTERVIEW_PREP_STEP_IDS.map((id) => [id, done[id] === true])
    );
    localStorage.setItem(
      INTERVIEW_PREP_CHECKLIST_STORAGE_KEY,
      JSON.stringify({
        done: normalizedDone,
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* ignore localStorage quota/privacy errors */
  }
}

function applyInterviewPrepChecklistState(root) {
  if (!root) return;
  const state = readInterviewPrepChecklistState();
  let doneCount = 0;
  root.querySelectorAll('[data-prep-check-id]').forEach((input) => {
    const id = input.getAttribute('data-prep-check-id');
    if (!id) return;
    const checked = state.done[id] === true;
    input.checked = checked;
    if (checked) doneCount += 1;
  });
  const progressEl = root.querySelector('[data-prep-progress]');
  if (progressEl) {
    progressEl.textContent = interviewPrepChecklistProgressLabel(
      doneCount,
      INTERVIEW_PREP_STEP_IDS.length
    );
  }
}

function resolveInterviewPrepCaptureHealthStatus(health) {
  if (!health?.ok) return 'error';
  if (!health?.available) return 'missing';
  const ageMs = Date.now() - Number(health.lastHeardAt || 0);
  const staleByAge = !Number.isFinite(ageMs) || ageMs > 45_000;
  const staleByLag = Number(health.processingLagMs || 0) > 4_000;
  return staleByAge || staleByLag ? 'stale' : 'fresh';
}

function applyInterviewPrepCaptureHealth(root, health) {
  if (!root) return;
  const badge = root.querySelector('[data-capture-health-indicator]');
  if (!badge) return;
  const status = resolveInterviewPrepCaptureHealthStatus(health);
  badge.dataset.captureHealthState = status;
  badge.textContent = interviewPrepCaptureHealthLabel(status);
  if (health?.available) {
    const lag = Number(health.processingLagMs || 0);
    const queue = Number(health.queueDepth || 0);
    badge.title = `Очередь: ${queue} · lag: ${lag}мс`;
  } else {
    badge.title = '';
  }
}

function stopInterviewPrepCaptureHealthPoll() {
  if (interviewPrepCaptureHealthTimer) clearInterval(interviewPrepCaptureHealthTimer);
  interviewPrepCaptureHealthTimer = null;
}

async function refreshInterviewPrepCaptureHealth(root) {
  if (!root?.isConnected) return;
  try {
    const health = await api('/api/copilot/capture-health');
    applyInterviewPrepCaptureHealth(root, health);
  } catch {
    applyInterviewPrepCaptureHealth(root, { ok: false, available: false });
  }
}

function startInterviewPrepCaptureHealthPoll(root) {
  stopInterviewPrepCaptureHealthPoll();
  void refreshInterviewPrepCaptureHealth(root);
  interviewPrepCaptureHealthTimer = setInterval(() => {
    if (!root?.isConnected) {
      stopInterviewPrepCaptureHealthPoll();
      return;
    }
    void refreshInterviewPrepCaptureHealth(root);
  }, 20_000);
}

function wireInterviewPrepChecklist(root) {
  if (!root) return;
  root.querySelectorAll('[data-prep-check-id]').forEach((input) => {
    if (input.dataset.prepChecklistWired === '1') return;
    input.dataset.prepChecklistWired = '1';
    input.addEventListener('change', () => {
      const stepId = input.getAttribute('data-prep-check-id');
      if (!stepId) return;
      const state = readInterviewPrepChecklistState();
      state.done[stepId] = input.checked === true;
      writeInterviewPrepChecklistState(state.done);
      applyInterviewPrepChecklistState(root);
    });
  });
  applyInterviewPrepChecklistState(root);
  startInterviewPrepCaptureHealthPoll(root);
}

function applyJourneyPresetToDom(preset) {
  const p = preset === 'interview' ? 'interview' : 'apply';
  document.documentElement.dataset.journeyPreset = p;
}

function highlightWorkflowForJourneyPreset(preset) {
  const nav = document.querySelector('.workflow-nav');
  if (!nav) return;
  nav.querySelectorAll('[data-workflow]').forEach((btn) => {
    const isTrack = btn.getAttribute('data-workflow') === 'track';
    btn.classList.toggle('workflow-nav__step--journey-focus', preset === 'interview' && isTrack);
  });
}

async function setJourneyPreset(preset) {
  const p = preset === 'interview' ? 'interview' : 'apply';
  try {
    await patchPreferencesApi({ hiringJourney: { preset: p } });
    dashboardPreferences = {
      ...dashboardPreferences,
      hiringJourney: { ...(dashboardPreferences.hiringJourney || {}), preset: p },
    };
    applyJourneyPresetToDom(p);
    highlightWorkflowForJourneyPreset(p);
    showToast(p === 'interview' ? 'Фокус: собеседование' : 'Фокус: отклики', 'neutral');
    document.querySelectorAll('[data-journey-preset]').forEach((btn) => {
      const active = btn.getAttribute('data-journey-preset') === p;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  } catch (e) {
    showToast(e.message || String(e), 'bad');
  }
}

function hubItemById(hub, id) {
  if (!id || !hub) return null;
  const fromOffers = (hub.offers || []).find((o) => o.id === id);
  if (fromOffers) return fromOffers;
  const demo = resolveDemoInstrumentForHub(hub);
  return demo?.id === id ? demo : null;
}

function wireInterviewHubTabs(root) {
  if (!root) return;
  root.querySelectorAll('[data-hub-tab]').forEach((tabBtn) => {
    if (tabBtn.dataset.hubTabWired === '1') return;
    tabBtn.dataset.hubTabWired = '1';
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.getAttribute('data-hub-tab');
      const detail = tabBtn.closest('.interview-hub__detail');
      if (!detail || !tab) return;
      detail.querySelectorAll('[data-hub-tab]').forEach((b) => {
        const on = b.getAttribute('data-hub-tab') === tab;
        b.classList.toggle('interview-hub__tab--active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      detail.querySelectorAll('[data-hub-tab-panel]').forEach((panel) => {
        panel.hidden = panel.getAttribute('data-hub-tab-panel') !== tab;
      });
    });
  });
}

function clearInterviewHubOutputs(root) {
  if (!root) return;
  root.querySelectorAll('.interview-hub__output').forEach((out) => {
    out.hidden = true;
    out.classList.remove('interview-hub__output--loading');
    out.textContent = '';
    out.innerHTML = '';
  });
  root.querySelectorAll('[data-hub-action]').forEach((btn) => {
    btn.disabled = false;
  });
}

function mountHubDetailJourney(container, offer, copilot) {
  const host = container?.querySelector('[data-hub-journey-host]');
  if (!host || !offer?.id) return;
  const rec = hubOfferToClientRecord(offer);
  if (!rec) {
    host.hidden = true;
    return;
  }
  mountJourneyStrip(host, rec, {
    fetchRemote: true,
    onAction: (action, item) => {
      if (action === 'open-interview-hub') return;
      if (action === 'open-letter' || action === 'apply-chat') {
        void openVacancyFromHub(item.id || offer.id);
        return;
      }
      if (action === 'interview-prep') copilot?.focusPrepTab?.();
    },
  });
}

async function openVacancyFromHub(recordId) {
  if (!recordId) return;
  closeInterviewHubModal();
  let targetView = 'queue';
  const hit = cachedRawItems.find((x) => x.id === recordId);
  if (hit && vacancyShownInAppliedTab(hit)) targetView = 'applied';
  if (!hit) {
    try {
      const { items } = await api(
        `/api/vacancies?status=pending&scoreBand=all&applyView=${encodeURIComponent('applied')}`
      );
      if (items.some((x) => x.id === recordId)) targetView = 'applied';
    } catch {
      /* ignore */
    }
  }
  if (targetView !== currentApplyView) {
    currentApplyView = targetView;
    syncApplyViewTabs();
  }
  await load({ preserveScroll: true, anchorCardId: recordId });
  requestAnimationFrame(() => {
    const card = listEl.querySelector(`[data-record-id="${CSS.escape(recordId)}"]`);
    card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const toggle = card?.querySelector('.journey-strip__toggle');
    if (toggle?.getAttribute('aria-expanded') !== 'true') toggle?.click();
  });
}

function wireInterviewHubActions(root, copilot) {
  if (!root) return;
  root.querySelectorAll('[data-hub-action]').forEach((btn) => {
    if (btn.dataset.hubWired === '1') return;
    btn.dataset.hubWired = '1';
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-hub-action');
      const title = btn.getAttribute('data-title') || '';
      const company = btn.getAttribute('data-company') || '';

      if (action === 'open-teleprompter-settings') {
        window.dispatchEvent(
          new CustomEvent('hh-open-settings', {
            detail: {
              tab: 'teleprompter',
              focus: 'copilot',
              layout: 'wide',
              focusToast: 'Настройки звука суфлёра',
            },
          })
        );
        return;
      }

      if (action === 'desktop-live') {
        if (id && copilot) {
          copilot.setMeta({
            title,
            company,
            vacancyId: id,
            recordId: id,
            isDemoInstrument: id === 'demo-interview-instrument',
          });
        }
        if (typeof copilot?.startDesktopLive === 'function') {
          void copilot.startDesktopLive();
          return;
        }
        /* запасной путь — полная панель в этом же окне */
        const panel = root.closest('#interview-hub-body')?.querySelector('.interview-copilot-panel')
          || document.querySelector('#interview-hub-body .interview-copilot-panel');
        const fold = root.closest('#interview-hub-body')?.querySelector('[data-hub-copilot-fold]');
        if (fold) fold.open = true;
        panel?.querySelector('[data-copilot-action="desktop-live"]')?.click();
        return;
      }

      if (action === 'prep-criterion') {
        const criterion = btn.getAttribute('data-criterion');
        if (!id || !criterion) return;
        const checked = btn.type === 'checkbox' ? Boolean(btn.checked) : true;
        btn.disabled = true;
        try {
          await api('/api/prep-foundation', {
            method: 'PATCH',
            body: JSON.stringify({ id, criteria: { [criterion]: checked } }),
          });
          interviewHubCache = null;
          clearInterviewHubCacheFromStorage();
          showToast(
            checked
              ? `Подготовка: ${criterion} ✓`
              : `Подготовка: ${criterion} снято`,
            'good'
          );
          // Не полный rebuild сразу: saveQueue большой очереди + hub scan → баннер «не отвечает»
          scheduleInterviewHubRefresh(900);
        } catch (e) {
          if (btn.type === 'checkbox') btn.checked = !checked;
          showToast(e.message || String(e), 'bad');
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === 'prep-day-t') {
        if (!id) return;
        btn.disabled = true;
        try {
          const res = await api('/api/prep-foundation/day-t', {
            method: 'POST',
            body: JSON.stringify({ id }),
          });
          const plan = res.plan || {};
          const prefsStage = plan.prefsStage || 'tech';
          try {
            await api('/api/settings', {
              method: 'PATCH',
              body: JSON.stringify({
                patch: { 'interviewCopilot.interviewStage': prefsStage },
              }),
            });
          } catch {
            /* prefs optional if settings down */
          }
          if (copilot) {
            copilot.setMeta({
              title: plan.title || title,
              company: plan.company || company,
              vacancyId: id,
              recordId: id,
              interviewStage: prefsStage,
              isDemoInstrument: id === 'demo-interview-instrument',
            });
          }
          const panel = btn.closest('.interview-hub__foundation') || btn.closest('.interview-hub__item');
          const view = panel?.querySelector('[data-prep-artifact-view]');
          if (plan.openScriptFirst !== false || plan.prepStage === 'hr' || plan.prepStage === 'manager') {
            try {
              const art = await api(
                `/api/prep-foundation/artifact?id=${encodeURIComponent(id)}&kind=script`
              );
              if (view && art.markdown) {
                view.textContent = art.markdown;
                view.hidden = false;
              }
            } catch {
              /* no script yet */
            }
          }
          interviewHubCache = null;
          clearInterviewHubCacheFromStorage();
          const toast =
            plan.prepStage === 'hr'
              ? PREP_FOUNDATION_HUB_COPY.dayTDoneToastHr
              : plan.prepStage === 'manager'
                ? PREP_FOUNDATION_HUB_COPY.dayTDoneToastManager
                : PREP_FOUNDATION_HUB_COPY.dayTDoneToastTech;
          showToast(`${toast}${plan.line ? ` · ${plan.line}` : ''}`, 'good');
          if (plan.openCopilotLive) {
            if (typeof copilot?.startDesktopLive === 'function') {
              void copilot.startDesktopLive();
            } else {
              const fold = document.querySelector('#interview-hub-body [data-hub-copilot-fold]');
              if (fold) fold.open = true;
              copilot?.focusPrepTab?.();
            }
          }
          await refreshInterviewHubModal();
        } catch (e) {
          showToast(
            e.message || PREP_FOUNDATION_HUB_COPY.dayTError || 'Не удалось подготовить день встречи',
            'bad'
          );
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === 'prep-artifact') {
        const kind = btn.getAttribute('data-kind') || 'script';
        if (!id) return;
        const panel = btn.closest('.interview-hub__foundation') || btn.closest('.interview-hub__item');
        const view = panel?.querySelector('[data-prep-artifact-view]');
        btn.disabled = true;
        try {
          const res = await api(
            `/api/prep-foundation/artifact?id=${encodeURIComponent(id)}&kind=${encodeURIComponent(kind)}`
          );
          if (view) {
            view.textContent = res.markdown || '';
            view.hidden = false;
          } else {
            const out =
              btn.closest('.interview-hub__item')?.querySelector('.interview-hub__output') ||
              root.querySelector('.interview-hub__output');
            if (out) {
              out.hidden = false;
              out.textContent = res.markdown || '';
            }
          }
        } catch (e) {
          showToast(
            e.message || PREP_FOUNDATION_HUB_COPY.errorArtifactFailed || 'Не удалось открыть файл',
            'bad'
          );
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === 'prep-outcome') {
        if (!id) return;
        const form =
          btn.closest('[data-prep-outcome-form]') ||
          root.querySelector(`[data-prep-outcome-form][data-id="${CSS.escape(id)}"]`);
        if (!form) {
          showToast(PREP_FOUNDATION_HUB_COPY.errorSaveFailed || 'Форма P7 не найдена', 'bad');
          return;
        }
        const outcome = form.querySelector('[data-prep-form="outcome"]')?.value?.trim() || '';
        const fixes = [...form.querySelectorAll('[data-prep-form="fix"]')]
          .map((el) => String(el.value || '').trim())
          .filter(Boolean);
        const asked = form.querySelector('[data-prep-form="asked"]')?.value?.trim() || '';
        const note = form.querySelector('[data-prep-form="note"]')?.value?.trim() || '';
        if (!outcome) {
          showToast(PREP_FOUNDATION_HUB_COPY.errorNeedOutcome || 'Выберите код исхода', 'bad');
          return;
        }
        if (fixes.length < 3) {
          showToast(PREP_FOUNDATION_HUB_COPY.errorNeedFixes || 'Нужны три правки', 'bad');
          return;
        }
        btn.disabled = true;
        try {
          await api('/api/prep-foundation/outcome', {
            method: 'POST',
            body: JSON.stringify({ id, outcome, fixes, note: note || undefined, asked: asked || undefined }),
          });
          interviewHubCache = null;
          clearInterviewHubCacheFromStorage();
          showToast('P7 сохранён — цикл обновлён', 'good');
          await refreshInterviewHubModal();
        } catch (e) {
          showToast(
            e.message || PREP_FOUNDATION_HUB_COPY.errorSaveFailed || 'Не удалось сохранить исход',
            'bad'
          );
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === 'go-vacancy') {
        clearInterviewHubOutputs(root);
        await openVacancyFromHub(id);
        return;
      }

      if (action === 'offer-decision') {
        const status = btn.getAttribute('data-decision');
        if (!id || !status) return;
        try {
          await api('/api/offer-decision', {
            method: 'POST',
            body: JSON.stringify({ id, status }),
          });
          showToast(`Оффер: ${status === 'negotiating' ? 'торг' : status === 'accepted' ? 'принят' : status === 'declined' ? 'отклонён' : 'на рассмотрении'}`, 'good');
          void refreshInterviewHubModal();
        } catch (e) {
          showToast(e.message || String(e), 'bad');
        }
        return;
      }

      if (copilot) {
        const isDemo = btn.closest('.interview-hub__item--demo') != null || id === 'demo-interview-instrument';
        copilot.setMeta({ title, company, vacancyId: id, recordId: id, isDemoInstrument: isDemo });
      }

      if (action === 'copilot-go') {
        clearInterviewHubOutputs(root);
        if (copilot && id) {
          copilot.setMeta({
            title,
            company,
            vacancyId: id,
            recordId: id,
            isDemoInstrument: id === 'demo-interview-instrument',
            interviewStage: copilot.getMeta?.()?.interviewStage,
          });
        }
        const bodyEl = root.closest('#interview-hub-body') || document.getElementById('interview-hub-body');
        const fold = bodyEl?.querySelector('[data-hub-copilot-fold]');
        if (fold) fold.open = true;
        copilot?.focusPrepTab?.();
        showToast('Полная панель суфлёра открыта ниже', 'neutral');
        return;
      }

      if (action === 'slot-save') {
        const queueId = btn.getAttribute('data-queue-id') || id;
        const li = btn.closest('.interview-hub__item');
        if (!li || !queueId) {
          showToast('Нет ID записи — синхронизируйте отклики');
          return;
        }
        const patch = {};
        li.querySelectorAll('[data-slot-field]').forEach((el) => {
          const key = el.getAttribute('data-slot-field');
          if (!key) return;
          const val = el.value;
          if (key === 'startsAt') {
            patch.startsAt = val ? new Date(val).toISOString() : null;
          } else {
            patch[key] = val;
          }
        });
        patch.source = 'manual';
        btn.disabled = true;
        try {
          await api('/api/interview-slot', {
            method: 'PATCH',
            body: JSON.stringify({ id: queueId, ...patch }),
          });
          showToast('Слот сохранён');
          await refreshInterviewHubModal();
          load();
        } catch (e) {
          showToast(e.message || String(e));
        } finally {
          btn.disabled = false;
        }
        return;
      }

      const li = btn.closest('.interview-hub__item');
      const out = li?.querySelector('.interview-hub__output');
      if (!id && action !== 'open-teleprompter-settings') {
        showToast('Нет ID вакансии — обновите хаб или синхронизируйте отклики hh.ru');
        return;
      }

      if (action === 'prompt') {
        btn.disabled = true;
        try {
          const cached = readCachedPromptPack(li);
          if (cached?.questions?.length) {
            await openInterviewPromptModal(cached, { api, showToast }, 'script');
            return;
          }

          openInterviewPromptLoading({ title, company }, { api, showToast });
          let pack = null;
          try {
            const techRes = await api('/api/interview-mock-tech', {
              method: 'POST',
              body: JSON.stringify({ id }),
            });
            pack = normalizeToPromptPack(techRes.mock, 'mock-tech', { id, title, company });
          } catch {
            const hrRes = await api('/api/interview-mock-hr', {
              method: 'POST',
              body: JSON.stringify({ id }),
            });
            pack = normalizeToPromptPack(hrRes.hrMock, 'mock-hr', { id, title, company });
          }
          if (!pack?.questions?.length) {
            closeInterviewPromptModal();
            showToast('Не удалось собрать вопросы — нажмите «Тех. вопросы» или «HR-скрининг»');
            return;
          }
          cachePromptPack(li, pack);
          await loadInterviewPromptPack(pack, { api, showToast }, 'script');
        } catch (e) {
          closeInterviewPromptModal();
          showToast(e.message || String(e));
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (!out) return;
      btn.disabled = true;
      out.hidden = false;
      out.classList.add('interview-hub__output--loading');
      out.textContent = 'Загрузка…';
      try {
        let path = '/api/interview-prep';
        if (action === 'mock-tech') path = '/api/interview-mock-tech';
        if (action === 'mock-hr') path = '/api/interview-mock-hr';
        const res = await api(path, { method: 'POST', body: JSON.stringify({ id }) });
        const pack = res.interviewPrep || res.mock || res.hrMock;
        out.innerHTML = renderMockOutputHtml(pack);
        if (action === 'mock-tech' || action === 'mock-hr' || action === 'prep') {
          const src = action === 'mock-hr' ? 'mock-hr' : action === 'mock-tech' ? 'mock-tech' : 'prep';
          const promptPack = normalizeToPromptPack(pack, src, { id, title, company });
          cachePromptPack(li, promptPack);
          if (copilot && action === 'prep' && pack) {
            copilot.setMeta({ title, company, vacancyId: id, recordId: id, interviewPrep: pack });
          }
          const promptBtn = document.createElement('button');
          promptBtn.type = 'button';
          promptBtn.className = 'btn btn-primary btn-sm interview-hub__prompt-from-output';
          promptBtn.textContent = 'Открыть суфлёр';
          promptBtn.addEventListener('click', () => {
            void openInterviewPromptModal(promptPack, { api, showToast }, 'script');
          });
          out.appendChild(promptBtn);
        }
      } catch (e) {
        out.textContent = e.message || String(e);
      } finally {
        out.classList.remove('interview-hub__output--loading');
        btn.disabled = false;
      }
    });
  });
}

async function refreshInterviewHubModal() {
  const body = document.getElementById('interview-hub-body');
  if (!body) return;
  stopInterviewPrepCaptureHealthPoll();

  try {
    const hub = await loadInterviewHubStaleWhileRevalidate(api, {
      memoryCache: interviewHubCache,
      onPaint: (hubData, meta) => {
        if (meta.kind === 'skeleton') {
          body.innerHTML = renderInterviewHubSkeletonHtml();
          return;
        }
        if (hubData) {
          paintInterviewHubBody(hubData);
        }
      },
      onError: (e, meta) => {
        if (meta.kind === 'stale-fallback') {
          showToast?.('Хаб: не обновился — показан кэш', 'neutral');
          return;
        }
        body.innerHTML = `<p class="err">${humanApiError(e)}</p>`;
      },
    });
    interviewHubCache = hub;
    writeInterviewHubCacheToStorage(hub);
    rebuildCommandPaletteActions();
    paintInterviewHubBody(hub);
  } catch (e) {
    stopInterviewPrepCaptureHealthPoll();
    body.innerHTML = `<p class="err">${humanApiError(e)}</p>`;
  }
}

function paintInterviewHubBody(hub) {
  const body = document.getElementById('interview-hub-body');
  if (!body || !hub) return;
  try {
    const preset = hub.journeyPreset || dashboardPreferences?.hiringJourney?.preset || 'apply';
    if (!interviewHubSelectedId || !hubItemById(hub, interviewHubSelectedId)) {
      interviewHubSelectedId = hub.offers?.find((o) => o.bucket === 'E')?.id || hub.offers?.[0]?.id || null;
    }
    body.innerHTML =
      renderInterviewHubHtml(hub, {
        selectedId: interviewHubSelectedId,
        journeyPreset: preset,
        prefs: dashboardPreferences,
      }) +
      `<details class="interview-hub__copilot-fold" data-hub-copilot-fold><summary>Полная панель суфлёра</summary>${renderCopilotPanelHtml()}</details>`;
    const copilot = initCopilotPanel(
      {
        api,
        showToast,
        dismissLiveObstructions: () => {
          closeServiceDrawer();
          closeModalEl(document.getElementById('settings-modal'));
          closeModalEl(document.getElementById('letter-issues-modal'));
          closeModalEl(document.getElementById('interview-prompt-modal'));
          closeModalEl(document.getElementById('batch-precheck-modal'));
        },
      },
      body
    );
    const firstSlot = hubItemById(hub, interviewHubSelectedId) || resolveDemoInstrumentForHub(hub);
    if (firstSlot && copilot) {
      copilot.setMeta({
        title: firstSlot.title,
        company: firstSlot.company,
        vacancyId: firstSlot.id,
        recordId: firstSlot.id,
        isDemoInstrument: Boolean(firstSlot.isDemoInstrument),
      });
    }
    applyJourneyPresetToDom(preset);
    highlightWorkflowForJourneyPreset(preset);

    body.querySelectorAll('[data-journey-preset]').forEach((btn) => {
      btn.addEventListener('click', () => void setJourneyPreset(btn.getAttribute('data-journey-preset')));
    });

    body.querySelectorAll('[data-hub-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        interviewHubSelectedId = btn.getAttribute('data-hub-select');
        const item = hubItemById(hub, interviewHubSelectedId);
        const main = body.querySelector('.interview-hub__main');
        if (main && item) {
          main.innerHTML = renderInterviewHubDetailHtml(item, { prefs: dashboardPreferences });
          wireInterviewHubActions(main, copilot);
          wireInterviewHubTabs(main);
          mountHubDetailJourney(main, item, copilot);
        }
        body.querySelectorAll('[data-hub-select]').forEach((navBtn) => {
          const active = navBtn.getAttribute('data-hub-select') === interviewHubSelectedId;
          navBtn.classList.toggle('interview-hub__nav-item--active', active);
          navBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        if (item && copilot) {
          copilot.setMeta({
            title: item.title,
            company: item.company,
            vacancyId: item.id,
            recordId: item.id,
            isDemoInstrument: Boolean(item.isDemoInstrument),
          });
        }
      });
    });

    wireInterviewHubActions(body, copilot);
    wireInterviewHubTabs(body);
    wireInterviewPrepChecklist(body);
    void refreshCopilotLivePrepBanner(api, body).then((payload) => {
      copilot?.setLivePrepGate?.(payload);
    });
    const firstDetail = body.querySelector('.interview-hub__main');
    const firstItem = hubItemById(hub, interviewHubSelectedId) || resolveDemoInstrumentForHub(hub);
    if (firstDetail && firstItem) mountHubDetailJourney(firstDetail, firstItem, copilot);
  } catch (e) {
    stopInterviewPrepCaptureHealthPoll();
    body.innerHTML = `<p class="err">${e.message}</p>`;
  }
}

function openInterviewHubModal(selectedId = null) {
  closeServiceDrawer();
  if (selectedId) interviewHubSelectedId = selectedId;
  const modal = document.getElementById('interview-hub-modal');
  if (!modal) return;
  openModalEl(modal);
  void refreshInterviewHubModal();
}

function closeInterviewHubModal() {
  const modal = document.getElementById('interview-hub-modal');
  if (!modal) return;
  stopInterviewPrepCaptureHealthPoll();
  closeModalEl(modal);
}

function initInterviewHubUi() {
  document.getElementById('btn-open-interview-hub')?.addEventListener('click', openInterviewHubModal);
  document.querySelectorAll('[data-close-interview-hub]').forEach((el) => {
    el.addEventListener('click', closeInterviewHubModal);
  });
}

function renderDashboardStats(stats) {
  const panel = document.getElementById('stats-panel');
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  if (!stats) {
    grid.innerHTML = '<p class="stats-placeholder">Загрузка статистики…</p>';
    const mini = document.getElementById('funnel-mini');
    if (mini) mini.hidden = true;
    return;
  }
  void refreshNorthStarKpi();
  const f = stats.funnel || {};
  if (panel) panel.hidden = false;
  renderFunnelMini(stats);
  void refreshIntelligenceSourcesMini();
  const compact = panel?.classList.contains('stats-panel--crm');
  const invitePct = f.inviteRatePct ?? stats.rates?.invitePct ?? 0;
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
  const weekly = stats.weeklyInvite || {};
  const weeklyTrend =
    weekly.trendDelta != null
      ? `${weekly.trendDelta > 0 ? '+' : ''}${weekly.trendDelta} п.п.`
      : '';
  const noEditPct = stats.letterNoEdit?.noEditPct;
  const q = stats.queue || {};
  const roll = stats.appliedRolling || {};
  const items = compact
    ? [
        { label: 'Очередь', value: stats.byStatus ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—' },
        { label: 'Всего', value: q.unionRecords ?? stats.total ?? q.queueTotal ?? '—', title: 'Все очереди + кэш hh' },
        { label: 'ID известно', value: q.knownVacancyIds ?? '—', title: 'Учитывается при сборе (дедуп)' },
        { label: 'Отклики', value: stats.applied ?? f.applied ?? 0 },
        { label: '7 дней', value: roll.last7d ?? '—' },
        { label: 'Просмотр', value: stats.viewed ?? f.viewed ?? 0 },
        { label: '% просм.', value: `${viewPct}%` },
        { label: 'Пригл.', value: stats.invited ?? f.invited ?? 0, highlight: true },
        { label: '% пригл.', value: `${invitePct}%`, highlight: true },
        {
          label: 'Неделя',
          value: weekly.currentInvitePct != null ? `${weekly.currentInvitePct}%` : '—',
          title:
            weekly.currentInvitePct != null
              ? `Конверсия приглашений за неделю${weeklyTrend ? ` · ${weeklyTrend}` : ''}`
              : 'Конверсия приглашений за текущую неделю',
        },
        ...(noEditPct != null
          ? [
              {
                label: 'Без правки',
                value: `${noEditPct}%`,
                title: 'Отклики без правки письма (K-01) — открыть настройки писем',
                statAction: 'letters',
                moreOnly: true,
              },
            ]
          : []),
        { label: 'Ждём', value: stats.awaiting ?? 0 },
        { label: 'Отказы', value: stats.declined ?? f.declined ?? 0 },
        { label: 'Анкеты', value: stats.withQuestionnaire ?? 0 },
        { label: 'Чаты', value: stats.chatNeedsReply ?? 0 },
      ]
    : [
        { label: 'В очереди', value: stats.byStatus ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—' },
        { label: 'Откликов', value: stats.applied ?? f.applied ?? 0 },
        { label: 'Просмотрели', value: stats.viewed ?? f.viewed ?? 0 },
        { label: 'Приглашения', value: stats.invited ?? f.invited ?? 0, highlight: true },
        { label: 'Отказы', value: stats.declined ?? f.declined ?? 0 },
        { label: '% приглашений', value: `${f.inviteRatePct ?? stats.rates?.invitePct ?? 0}%`, highlight: true },
        { label: 'Чаты: вопрос', value: stats.chatNeedsReply ?? 0 },
        { label: 'Анкеты', value: stats.withQuestionnaire ?? 0 },
        { label: '7+ дн. без ответа', value: stats.staleFollowUp ?? f.staleFollowUp ?? 0, title: 'Follow-up: отклик без ответа работодателя' },
        {
          label: 'Воронка',
          value: `${f.viewRatePct ?? 0}% просмотр → ${f.inviteRatePct ?? 0}% пригл.`,
          wide: true,
        },
      ];
  if (!compact && stats.hhNegotiations?.total) {
    items.push({
      label: 'На hh.ru (всего)',
      value: stats.hhNegotiations.total,
      wide: true,
    });
    items.push({
      label: 'hh: просмотр / отказ',
      value: `${stats.hhNegotiations.viewed} / ${stats.hhNegotiations.declined}`,
    });
  }

  const buildStatNodes = (list) =>
    list.map((it) => {
      const div = document.createElement('div');
      div.className = `stat-item${it.wide ? ' stat-item--wide' : ''}${it.statAction ? ' stat-item--clickable' : ''}`;
      if (it.title) div.title = it.title;
      if (it.statAction) div.dataset.statAction = it.statAction;
      const val = document.createElement('span');
      val.className = `stat-value${it.highlight ? ' stat-highlight' : ''}`;
      val.textContent = String(it.value);
      const lab = document.createElement('span');
      lab.className = 'stat-label';
      lab.textContent = it.label;
      div.append(val, lab);
      return div;
    });

  const shell = document.getElementById('app-shell');
  const focusSimple =
    compact &&
    shell?.classList.contains('workspace-shell--focus') &&
    shell.dataset.uiMode === UI_MODES.simple;
  const moreFold = document.getElementById('stats-more-fold');
  const moreGrid = document.getElementById('stats-grid-more');
  const moreOnlyItems = items.filter((it) => it.moreOnly);
  const primaryItems = items.filter((it) => !it.moreOnly);
  let visibleItems = primaryItems;
  if (focusSimple) {
    const pending = stats.byStatus?.pending ?? '—';
    visibleItems = [
      { label: 'Отклики', value: stats.applied ?? f.applied ?? 0 },
      { label: '% пригл.', value: `${invitePct}%`, highlight: true },
      {
        label: 'Очередь',
        value: stats.byStatus ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—',
      },
      { label: 'На проверке', value: pending },
    ];
    const moreItems = primaryItems.filter((it) => !['Отклики', '% пригл.', 'Очередь'].includes(it.label));
    const moreAll = [...moreItems, ...moreOnlyItems];
    if (moreFold) moreFold.hidden = moreAll.length === 0;
    if (moreGrid) moreGrid.replaceChildren(...buildStatNodes(moreAll));
  } else if (moreFold) {
    if (moreOnlyItems.length) {
      moreFold.hidden = false;
      if (moreGrid) moreGrid.replaceChildren(...buildStatNodes(moreOnlyItems));
    } else {
      moreFold.hidden = true;
      if (moreGrid) moreGrid.replaceChildren();
    }
  }

  grid.replaceChildren(...buildStatNodes(visibleItems));
  grid.querySelectorAll('[data-stat-action="letters"]').forEach((el) => {
    el.addEventListener('click', () =>
      openDashboardSettings('letters', { focusId: 'settings-letters-group' })
    );
  });

  const extraEl = document.getElementById('stats-extra');
  const techFold = document.getElementById('stats-tech-fold');
  if (extraEl && techFold) {
    const extra = formatDashboardStatsExtra(stats);
    if (extra) {
      extraEl.textContent = extra;
      techFold.hidden = false;
    } else {
      extraEl.textContent = '';
      techFold.hidden = true;
    }
  }
}

function renderTopFalsePositives(data) {
  const host = document.getElementById('fp-top-panel');
  if (!host) return;
  if (!host.dataset.bindClick) {
    host.dataset.bindClick = '1';
    host.addEventListener('click', (e) => {
      const el = e.target instanceof Element ? e.target : null;
      const applyAllBtn = el?.closest('[data-fp-apply-all]');
      if (applyAllBtn) {
        void applyLearningSuggestionsBatch();
        return;
      }
      const learnBtn = el?.closest('[data-fp-learn]');
      if (learnBtn) {
        const pattern = learnBtn.getAttribute('data-fp-pattern') || '';
        const target = learnBtn.getAttribute('data-fp-target') || 'irrelevant';
        if (pattern) {
          void learnFalsePositivePattern(pattern, target);
        }
        return;
      }
      const focusBtn = el?.closest('[data-fp-key]');
      if (!focusBtn) return;
      const key = focusBtn.getAttribute('data-fp-key') || '';
      applyFalsePositiveFocus(key);
    });
  }
  if (!data) {
    host.innerHTML = '<p class="fp-top__placeholder">Загрузка…</p>';
    host.classList.remove('fp-top--alert');
    return;
  }
  const total = Number(data.totalFalsePositives || 0);
  host.classList.toggle('fp-top--alert', total > 0);
  const trend = data.trend || {};
  const trendDelta = Number(trend.deltaTotal || 0);
  const trendHtml =
    trendDelta !== 0
      ? ` <span class="fp-top__trend fp-top__trend--${trendDelta > 0 ? 'up' : 'down'}" title="Изменение с прошлого снимка">${trendDelta > 0 ? '▲' : '▼'}${Math.abs(trendDelta)}</span>`
      : '';
  const rate = Number(data.falsePositiveRate || 0);
  const top = Array.isArray(data.top) ? data.top : [];
  if (!top.length) {
    host.innerHTML =
      `<p class="fp-top__ok">${escapeHtml(glossaryLabel('fpOk', dashboardUi.uiMode))}.</p>`;
    return;
  }
  host.innerHTML =
    `<p class="fp-top__meta">Осталось: <strong>${total}</strong>${trendHtml}${rate ? ` · ${rate}%` : ''}</p>` +
    `<ul class="fp-top__list">` +
    top
      .map((row) => {
        const sampleTitles = (row.samples || [])
          .slice(0, 2)
          .map((s) => String(s.title || '—'));
        const samplesFull = sampleTitles.join(' · ');
        const focusTitle = samplesFull
          ? `Показать отклонённые этой категории · ${samplesFull}`
          : 'Показать отклонённые этой категории';
        const suggestion = falsePositiveSuggestedPattern(row);
        return `<li class="fp-top__item"><button type="button" class="fp-top__focus" data-fp-key="${escapeHtml(row.key || 'прочее')}" title="${escapeHtml(focusTitle)}">${escapeHtml(row.key || 'прочее')}</button><strong class="fp-top__count">${Number(row.count || 0)}</strong>${suggestion ? `<button type="button" class="fp-top__learn" data-fp-learn="1" data-fp-pattern="${escapeHtml(suggestion.pattern)}" data-fp-target="${escapeHtml(suggestion.target)}" title="Добавить в правила">+ ${escapeHtml(suggestion.pattern)}</button>` : ''}</li>`;
      })
      .join('') +
    '</ul>' +
    renderLearningSuggestionsMini();
}

function renderLearningSuggestionsMini() {
  const rows = Array.isArray(learningSuggestionsCache) ? learningSuggestionsCache.slice(0, 4) : [];
  const history = Array.isArray(learningHistoryCache) ? learningHistoryCache.slice(0, 3) : [];
  if (!rows.length && !history.length) return '';
  const items = rows
    .map(
      (r) =>
        `<li><code>${escapeHtml(r.pattern || '')}</code><span>· ${escapeHtml(
          r.target || 'irrelevant'
        )} · ${Number(r.count || 0)}</span></li>`
    )
    .join('');
  const historyHtml = history.length
    ? `<p class="fp-top__suggest-title">Последние применения</p><ul class="fp-top__history-list">${history
        .map((h) => {
          const when = h.at ? new Date(h.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '--:--';
          if (h.source === 'single') {
            return `<li>${when} · ${escapeHtml(h.pattern || '—')} · ${escapeHtml(h.target || 'irrelevant')} · ${h.added ? 'добавлено' : 'уже было'}</li>`;
          }
          return `<li>${when} · пакет: +${Number(h.added || 0)} из ${Number(h.total || 0)}</li>`;
        })
        .join('')}</ul>`
    : '';
  const fpCount = Number(topFalsePositivesCache?.totalFalsePositives || 0);
  const suggestTitle =
    fpCount > 0
      ? glossaryLabel('fpSuggestTitle', dashboardUi.uiMode)
      : glossaryLabel('fpSuggestTitleManual', dashboardUi.uiMode);
  const suggestHtml = rows.length
    ? `<p class="fp-top__suggest-title">${escapeHtml(suggestTitle)}</p><ul class="fp-top__suggest-list">${items}</ul><button type="button" class="fp-top__apply-all" data-fp-apply-all="1">${fpCount > 0 ? `Применить пакет (сейчас ${fpCount})` : 'Применить топ-пакет'}</button>`
    : '';
  return `<div class="fp-top__suggest">${suggestHtml}${historyHtml}</div>`;
}

function falsePositiveSuggestedPattern(row) {
  const key = String(row?.key || '').toLowerCase();
  const sampleTitle = String(row?.samples?.[0]?.title || '').toLowerCase();
  const fromSample = (re, fallback) => {
    const m = sampleTitle.match(re);
    return (m?.[1] || fallback || '').trim();
  };
  if (key.includes('senior') || key.includes('lead')) {
    return { pattern: fromSample(/\b((?:team|tech)\s*lead|head of [a-z]+|senior [a-z]+)/i, 'team lead'), target: 'senior' };
  }
  if (key.includes('dev вне профиля')) {
    return { pattern: fromSample(/\b(go-разработ\w*|java-разработ\w*|python-разработ\w*|android-разработ\w*|php-разработ\w*|frontend developer|backend developer)\b/i, 'go-разработ'), target: 'developer' };
  }
  if (key.includes('смежные')) {
    return { pattern: fromSample(/\b(тестировщик|qa|аналитик|product manager|project manager)\b/i, 'тестировщик'), target: 'irrelevant' };
  }
  if (key.includes('индустриальные')) {
    return { pattern: fromSample(/\b(инженер-проектировщик|пусконалад\w*|сервисный инженер|сметчик)\b/i, 'инженер-проектировщик'), target: 'irrelevant' };
  }
  if (key.includes('sales')) {
    return { pattern: fromSample(/\b(менеджер по продажам|sales manager|presale)\b/i, 'менеджер по продажам'), target: 'irrelevant' };
  }
  return null;
}

/** @param {object} item */
function inferRejectLearningPattern(item) {
  const title = String(item.title || '').toLowerCase();
  if (/\bgo\b|\bgolang\b|\bjava\b|\bpython\b/i.test(title)) {
    return { pattern: 'go-разработ', target: 'developer' };
  }
  if (/\bsenior\b|\blead\b|ведущ|архитект/i.test(title)) {
    return { pattern: 'team lead', target: 'senior' };
  }
  const chunk = String(item.title || '')
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim()
    .slice(0, 48);
  if (chunk.length >= 4) return { pattern: chunk, target: 'irrelevant' };
  return null;
}

async function learnFalsePositivePattern(pattern, target) {
  try {
    const r = await api('/api/learning/add-pattern', {
      method: 'POST',
      body: JSON.stringify({ pattern, target }),
    });
    showToast(r.message || `Добавлено: ${pattern}`, r.added ? 'good' : 'neutral');
    await refreshTopFalsePositives(true);
    await load({ preserveScroll: true });
  } catch (e) {
    showToast(e.message || 'Не удалось сохранить правило', 'bad');
  }
}

async function refreshLearningSuggestions() {
  try {
    const [s, h] = await Promise.all([
      api('/api/learning/suggestions?limit=6'),
      api('/api/learning/history?limit=8'),
    ]);
    learningSuggestionsCache = Array.isArray(s.suggestions) ? s.suggestions : [];
    learningHistoryCache = Array.isArray(h.items) ? h.items : [];
  } catch {
    learningSuggestionsCache = [];
    learningHistoryCache = [];
  }
}

async function applyLearningSuggestionsBatch() {
  const items = (learningSuggestionsCache || []).slice(0, 4).map((x) => ({
    pattern: x.pattern,
    target: x.target,
  }));
  if (!items.length) {
    showToast('Нет новых предложений для применения', 'neutral');
    return;
  }
  try {
    const r = await api('/api/learning/add-patterns', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    showToast(r.message || 'Пакет правил применён', r.added > 0 ? 'good' : 'neutral');
    await refreshLearningSuggestions();
    await refreshTopFalsePositives(true);
    await load({ preserveScroll: true });
  } catch (e) {
    showToast(e.message || 'Не удалось применить пакет правил', 'bad');
  }
}

function falsePositiveQueryByKey(key) {
  const k = String(key || '').toLowerCase();
  if (k.includes('senior') || k.includes('lead')) return 'senior lead ведущ';
  if (k.includes('dev вне профиля')) return 'разработчик developer backend frontend fullstack android ios java php python go golang';
  if (k.includes('смежные')) return 'qa тестировщик analyst аналитик product project scrum agile';
  if (k.includes('индустриальные')) return 'инженер проектировщик сервисный scada плк кипиа монтаж';
  if (k.includes('sales')) return 'sales presale продажи аккаунт';
  if (k.includes('support')) return 'support поддержка helpdesk service desk';
  return '';
}

function applyFalsePositiveFocus(key) {
  applyViewTabsEl?.querySelector('[data-apply-view="queue"]')?.click();
  vacancyTabsEl?.querySelector('[data-status="rejected"]')?.click();
  const q = falsePositiveQueryByKey(key);
  if (filterSearchEl) {
    filterSearchEl.value = q;
  }
  if (q) {
    showToast(`Фокус: ${key}`, 'neutral');
  }
  renderListFromCache(null);
}

let learningAutoApplyDone = false;

async function tryAutoApplyLearningPatterns(fpTotal) {
  if (learningAutoApplyDone) return;
  if (dashboardPreferences.learningAutoApplyPatterns !== true) return;
  if (Number(fpTotal || 0) < 5) return;
  const hasSuggestions = (learningSuggestionsCache || []).some((x) => Number(x.count || 0) >= 3);
  if (!hasSuggestions) return;
  const dayKey = new Date().toISOString().slice(0, 10);
  try {
    if (sessionStorage.getItem('hh-learning-auto-apply-day') === dayKey) {
      learningAutoApplyDone = true;
      return;
    }
  } catch {
    /* ignore */
  }
  learningAutoApplyDone = true;
  try {
    const r = await api('/api/learning/auto-apply-safe', { method: 'POST', body: '{}' });
    try {
      sessionStorage.setItem('hh-learning-auto-apply-day', dayKey);
    } catch {
      /* ignore */
    }
    if (r.added > 0) {
      showToast(r.message || `Авто-правила: +${r.added}`, 'good');
      await refreshLearningSuggestions();
      await refreshTopFalsePositives(true);
      await load({ preserveScroll: true });
    }
  } catch {
    /* ignore */
  }
}

async function refreshTopFalsePositives(force = false) {
  const now = Date.now();
  if (!force && now - topFalsePositivesTs < 60_000) {
    renderTopFalsePositives(topFalsePositivesCache);
    return;
  }
  if (topFalsePositivesInFlight) return;
  topFalsePositivesInFlight = Promise.all([
    api('/api/top-false-positives?limit=5'),
    refreshLearningSuggestions(),
  ])
    .then(([data]) => {
      const prev = Number(topFalsePositivesCache?.totalFalsePositives || 0);
      topFalsePositivesCache = data;
      topFalsePositivesTs = Date.now();
      renderTopFalsePositives(data);
      const next = Number(data?.totalFalsePositives || 0);
      if (next > 0 && prev === 0) {
        showToast(glossaryLabel('fpFoundToast', dashboardUi.uiMode, { n: next }), 'neutral');
      }
      void tryAutoApplyLearningPatterns(next);
    })
    .catch(() => {
      renderTopFalsePositives(topFalsePositivesCache);
    })
    .finally(() => {
      topFalsePositivesInFlight = null;
    });
  await topFalsePositivesInFlight;
}

async function refreshJobStatus() {
  const el = document.getElementById('job-status');
  if (!el) return;
  try {
    const st = await api('/api/job-status');
    lastJobStatus = st;
    const freezeBg = isSettingsModalOpen();

    if (!freezeBg) {
      renderJobProgress(st);
      updateJobControlButtons(st);
      renderApplyLogInsights(applyLogPreEl()?.dataset.logContent || '', st);
      if (st.applyRates) renderApplyRateMeters(st.applyRates);
      renderDashboardStats(st.dashboardStats || st.conversion);
      void refreshTopFalsePositives();
      initOnboardingPanel(st);
      const { main, msgs } = formatHumanJobStatus(st);
      el.textContent = main;
      el.title = formatJobStatusTooltip(st, { msgs });
      el.classList.toggle('job-status--busy', msgs.length > 0);
      el.classList.toggle('job-status--warn', Boolean(
        (st.harvestLog?.lastError && !st.harvest?.running && !isSideSyncBusy(st)) ||
          (st.syncResponsesLog?.lastError &&
            !st.sideJobs?.syncResponses?.running &&
            !isSideSyncBusy(st))
      ));
      renderResumeRaiseScheduleStatus(st.resumeRaiseSchedule);
      renderChatFollowUpScheduleStatus(st.chatFollowUpSchedule);
    }

    if (st.harvestTick?.sequence > lastHarvestTickSeq) {
      lastHarvestTickSeq = st.harvestTick.sequence;
      if (freezeBg) queueDashboardRefreshAfterSettings();
      else if (st.harvest?.running) scheduleHarvestListReload();
      else {
        if (harvestReloadTimer) {
          clearTimeout(harvestReloadTimer);
          harvestReloadTimer = null;
        }
        void load({ preserveScroll: true });
      }
    }

    if (applyChatWasRunning && !st.applyChat?.running) {
      const phase = st.applyChatProgress?.phase;
      if (freezeBg) queueDashboardRefreshAfterSettings();
      else await load();
      if (!freezeBg) {
        if (phase === 'done') {
          const label = String(st.applyChatProgress?.label || '');
          const isRealSubmit =
            /отклик отправлен/i.test(label) && !/уже отклик|пропуск/i.test(label);
          if (isRealSubmit) {
            const msg =
              currentApplyView === 'applied'
                ? 'Отклик отправлен, список обновлён'
                : 'Отклик отправлен — карточка в разделе «Отклики»';
            showToast(msg, 'good');
          }
        } else if (phase === 'skipped') {
          const label = String(st.applyChatProgress?.label || 'Уже отклик');
          const msg = /повтор|переписк/i.test(label)
            ? `hh.ru: ${label}`
            : `hh.ru: ${label} — L4 не выполнялся`;
          showToast(msg, 'neutral');
        } else if (phase === 'error') {
          showToast('Отклик завершился с ошибкой — см. журнал', 'neutral');
        }
      }
    }
    applyChatWasRunning = Boolean(st.applyChat?.running);

    if (harvestWasRunning && !st.harvest?.running) {
      const hp = st.harvestProgress;
      const msg =
        displayStatusText(hp?.stats?.message) ||
        progressStatusLabel(hp) ||
        'Сбор завершён';
      const added = hp?.stats?.added;
      if (freezeBg) {
        queueDashboardRefreshAfterSettings();
      } else {
        const kind = added > 0 ? 'good' : 'neutral';
        const toastText =
          typeof added === 'number' && added > 0 ? `${msg} (+${added})` : msg;
        showToast(toastText, kind);
        void load();
      }
    }
    harvestWasRunning = Boolean(st.harvest?.running);

    const batchAlive = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
    if (batchWasRunning && !batchAlive) {
      const br = st.batchLastReport;
      const bc = st.batchControl || {};
      const skipped = br?.skipped ?? bc.skipped ?? 0;
      const failed = br?.failed ?? bc.failed ?? 0;
      if (br?.finishedAt) {
        if (freezeBg) {
          queueDashboardRefreshAfterSettings();
          invalidateLetterStatsCache();
        } else {
          const msg = `Серия завершена: ${br.done}/${br.planned} успешно` +
            (skipped ? `, пропуск ${skipped}` : '') +
            (failed ? `, ошибок ${failed}` : '');
          showToast(msg, failed ? 'neutral' : skipped ? 'neutral' : 'good');
          invalidateLetterStatsCache();
          void load();
          void refreshLetterStatsSidebar(true);
          if (skipped || failed) {
            setTimeout(() => openBatchReportModal(), 400);
          }
        }
      }
    }
    batchWasRunning = batchAlive;

    const pauseReason = st.batchControl?.pauseReason || null;
    if (
      batchAlive &&
      pauseReason === 'captcha' &&
      st.batchControl?.command === 'paused' &&
      !batchCaptchaToastShown
    ) {
      batchCaptchaToastShown = true;
      showToast(
        'Капча на hh.ru — пройдите проверку в Chromium. Батч продолжится автоматически.',
        'neutral'
      );
    }
    if (pauseReason !== 'captcha') batchCaptchaToastShown = false;
    lastBatchPauseReason = pauseReason;

    const side = st.sideJobs || {};
    if (side.syncResponses?.running && !syncResponsesWasRunning) {
      syncResponsesStartedAt = Date.now();
    }
    if (syncResponsesWasRunning && !side.syncResponses?.running) {
      if (freezeBg) {
        queueDashboardRefreshAfterSettings();
      } else {
        const logFresh =
          (st.syncResponsesLog?.modifiedAt || 0) >= syncResponsesStartedAt - 3000;
        if (logFresh && st.syncResponsesLog?.lastError) {
          showToast(
            `Sync откликов: ${st.syncResponsesLog.lastError.slice(0, 200)}`,
            'bad'
          );
        }
        try {
          await applyNegotiationsCacheToQueue();
        } catch (e) {
          showToast(e.message || 'Не удалось применить кэш откликов', 'bad');
        }
      }
    }
    syncResponsesWasRunning = Boolean(side.syncResponses?.running);
    syncChatsWasRunning = Boolean(side.syncChats?.running);
    if (syncChatsWasRunning && !side.syncChats?.running) {
      if (freezeBg) queueDashboardRefreshAfterSettings();
      else {
        void load();
        showToast('Чаты синхронизированы', 'good');
      }
    }
    if (dailyRoutineWasRunning && !side.dailyRoutine?.running) {
      if (freezeBg) queueDashboardRefreshAfterSettings();
      else {
        showToast('Утренний цикл завершён — проверьте вкладку «Отклики»', 'good');
        void load();
      }
    }
    dailyRoutineWasRunning = Boolean(side.dailyRoutine?.running);
    if (resumeRaiseWasRunning && !side.resumeRaise?.running) {
      const lr = st.resumeRaiseSchedule?.lastResult;
      const msg = lr
        ? `Подъём резюме: +${lr.raised ?? 0}, пропуск ${lr.skipped ?? 0}`
        : 'Подъём резюме завершён';
      showToast(msg, lr?.ok !== false ? 'good' : 'neutral');
    }
    resumeRaiseWasRunning = Boolean(side.resumeRaise?.running);

    if (!freezeBg && !st.applyChat?.running && !st.batch?.running && applyLogPollTimer) {
      clearInterval(applyLogPollTimer);
      applyLogPollTimer = null;
      document.querySelectorAll('.btn-apply-auto, .btn-apply-chat').forEach((b) => {
        b.disabled = false;
      });
      const modal = document.getElementById('apply-log-modal');
      if (modal && !modal.hidden) refreshApplyLogModal();
    }
  } catch {
    el.textContent = 'Статус: —';
  }
}

function captureListScroll(anchorCardId) {
  return { y: window.scrollY, anchorCardId: anchorCardId || null };
}

function restoreListScroll(state) {
  if (!state) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.anchorCardId) {
        const el = listEl.querySelector(`[data-record-id="${CSS.escape(state.anchorCardId)}"]`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          return;
        }
      }
      window.scrollTo({ top: state.y, left: 0, behavior: 'instant' });
    });
  });
}

function updateListCount(items, counts) {
  const host = document.getElementById('list-breadcrumbs-host');
  const filters = readFiltersFromUI();
  const hasLocalFilter =
    filters.search || filters.minScore || filters.onlySalary || filters.onlyLetterIssues;
  const shown = items.length;
  const total = cachedRawItems.length;

  if (!counts) {
    if (host) host.innerHTML = '<span class="list-breadcrumbs__item">Загрузка…</span>';
    return;
  }

  mountListBreadcrumbs(
    host,
    buildListBreadcrumbItems({
      applyView: currentApplyView,
      scoreBand: currentScoreBand,
      status: currentStatus,
      count: shown,
      total,
      tabTotal: countForApplyViewTab(currentApplyView),
      threshold: scoreThreshold,
      appliedFunnel: currentAppliedFunnel,
      hasLocalFilter: Boolean(hasLocalFilter),
      sourceFilter: filters.source,
      tierFilter: filters.tier,
    })
  );
}

function updateLetterQualityFilterButton() {
  const filters = readFiltersFromUI();
  const issueCount = cachedRawItems.filter((it) => hasLetterQualityIssue(it)).length;
  const fixableCount = cachedRawItems.filter((it) => it.letterQuality?.fixable).length;
  if (filterLetterQualityBtnEl) {
    filterLetterQualityBtnEl.textContent = `Письма: проверка${issueCount > 0 ? ` (${issueCount})` : ''}`;
    filterLetterQualityBtnEl.classList.toggle('active', Boolean(filters.onlyLetterIssues));
    filterLetterQualityBtnEl.setAttribute('aria-pressed', filters.onlyLetterIssues ? 'true' : 'false');
  }
  if (letterToolbarChipEl) {
    const label = issueCount > 0 ? `Письма · ${issueCount}` : 'Письма';
    letterToolbarChipEl.textContent = label;
    letterToolbarChipEl.classList.toggle('active', Boolean(filters.onlyLetterIssues));
    letterToolbarChipEl.setAttribute('aria-pressed', filters.onlyLetterIssues ? 'true' : 'false');
  }
  if (btnBulkImproveLettersEl) {
    btnBulkImproveLettersEl.hidden = fixableCount === 0;
    btnBulkImproveLettersEl.textContent =
      fixableCount > 0 ? `Подготовить письма (${fixableCount})` : 'Подготовить письма';
  }
}

function renderListFromCache(scrollState) {
  try {
  const filters = readFiltersFromUI();
  updateLetterQualityFilterButton();
  const items = applyClientFilters(cachedRawItems, filters);
  updateListCount(items, cachedCounts);
  listEl.innerHTML = '';
  if (!items.length) {
    const viewPool = cachedRawItems.length;
    const tabTotal = countForApplyViewTab(currentApplyView);
    if (currentApplyView === 'applied') {
      const funnelLabels = {
        invited: 'Приглашения',
        viewed: 'Просмотр',
        awaiting: 'Ждём',
        stale: '7+ дней',
        declined: 'Отказы',
      };
      if (viewPool > 0 && currentAppliedFunnel !== 'all') {
        listEl.appendChild(
          renderEmptyState(
            `В подразделе «${funnelLabels[currentAppliedFunnel] || currentAppliedFunnel}» нет карточек — всего откликов ${viewPool}.`,
            [
              {
                label: 'Все отклики',
                primary: true,
                onClick: () =>
                  document.getElementById('applied-funnel-tabs')?.querySelector('[data-applied-funnel="all"]')?.click(),
              },
            ]
          )
        );
      } else if (currentAppliedFunnel === 'stale') {
        listEl.appendChild(
          renderEmptyState('Нет откликов без ответа дольше 7 дней — хороший знак.', [
            { label: 'Все отклики', onClick: () => document.getElementById('applied-funnel-tabs')?.querySelector('[data-applied-funnel="all"]')?.click() },
          ])
        );
      } else {
        listEl.appendChild(
          renderEmptyState('Пока нет откликов через дашборд. После «Авто-отклики» или серии вакансии появятся здесь.', [
            { label: COPY.batchAuto, primary: true, onClick: () => document.getElementById('btn-batch-auto')?.click() },
          ])
        );
      }
    } else if (currentApplyView === 'hidden') {
      listEl.appendChild(renderEmptyState('Нет скрытых вакансий в этой вкладке. Смените диапазон баллов или статус.'));
    } else if (viewPool > 0) {
      const hiddenMsg = filteredHiddenListMessage(viewPool);
      listEl.appendChild(
        renderEmptyState(
          hiddenMsg || `В разделе ${viewPool} карточек, но фильтры их скрывают.`,
          [
            { label: 'Сбросить фильтры', primary: true, onClick: () => resetListFiltersToDefault() },
            { label: 'Все баллы', onClick: () => document.querySelector('#panel-score-band [data-band="all"]')?.click() },
            ...(currentApplyView === 'questionnaire'
              ? [{ label: 'Проверка анкет', onClick: () => document.getElementById('btn-questionnaire-probe-filter')?.click() }]
              : [{ label: 'Очередь', onClick: () => applyViewTabsEl?.querySelector('[data-apply-view="queue"]')?.click() }]),
          ]
        )
      );
    } else if (currentApplyView === 'questionnaire') {
      listEl.appendChild(
        renderEmptyState('Нет вакансий с анкетой в этом разделе.', [
          {
            label: 'Проверка анкет',
            primary: true,
            onClick: () => document.getElementById('btn-questionnaire-probe-filter')?.click(),
          },
          { label: 'Очередь', onClick: () => applyViewTabsEl?.querySelector('[data-apply-view="queue"]')?.click() },
        ])
      );
    } else if (currentApplyView === 'deferred') {
      listEl.appendChild(
        renderEmptyState('Нет отложенных вакансий. На карточке — «Завтра», чтобы убрать из батча на сутки.', [
          { label: 'Очередь', onClick: () => applyViewTabsEl?.querySelector('[data-apply-view="queue"]')?.click() },
        ])
      );
    } else if (currentApplyView === 'noQuestionnaire') {
      listEl.appendChild(
        renderEmptyState('Нет вакансий без анкеты в этом диапазоне.', [
          { label: COPY.batchAuto, primary: true, onClick: () => document.getElementById('btn-batch-auto')?.click() },
          { label: 'Анкета', onClick: () => applyViewTabsEl?.querySelector('[data-apply-view="questionnaire"]')?.click() },
        ])
      );
    } else if (viewPool === 0 && tabTotal != null && tabTotal > 0) {
      listEl.appendChild(
        renderEmptyState(
          `В этой вкладке ${tabTotal} карточек, но текущий фильтр «${currentStatus === 'approved' ? 'Подходят' : currentStatus === 'rejected' ? 'Отклонены' : 'На проверке'}» и диапазон баллов ничего не показывают.`,
          [
            { label: 'Все баллы', onClick: () => document.querySelector('#panel-score-band [data-band="all"]')?.click() },
            {
              label: 'На проверке',
              onClick: () => vacancyTabsEl?.querySelector('[data-status="pending"]')?.click(),
            },
          ]
        )
      );
    } else if (cachedCounts?.hiddenByRole > 0 && !filters.search) {
      listEl.appendChild(
        renderEmptyState(`Все скрыты фильтрами роли (${cachedCounts.hiddenByRole}).`, [
          { label: `Скрытые (${cachedCounts.hiddenByRole})`, onClick: () => applyViewTabsEl?.querySelector('[data-apply-view="hidden"]')?.click() },
        ])
      );
    } else {
      const emptyActions = [];
      if (cachedQueueMeta?.demoAvailable) {
        emptyActions.push({
          label: `Загрузить демо (${cachedQueueMeta.demoCount || '—'})`,
          primary: true,
          onClick: () => void loadDemoQueue().catch((e) => showToast(e.message || String(e), 'bad')),
        });
      }
      emptyActions.push(
        {
          label: COPY.harvestRun,
          primary: !cachedQueueMeta?.demoAvailable,
          onClick: () => document.getElementById('btn-run-harvest')?.click(),
        },
        { label: COPY.openSettings, onClick: () => document.getElementById('btn-open-settings')?.click() }
      );
      listEl.appendChild(
        renderEmptyState('Очередь пуста. Загрузите демо для знакомства или соберите вакансии с hh.ru.', emptyActions)
      );
    }
    restoreListScroll(scrollState);
    return;
  }
  const browseMode = currentBrowseMode();
  listRenderGeneration += 1;
  const generation = listRenderGeneration;
  const searchActive = Boolean(filters.search?.trim());
  const effectiveLimit =
    searchActive || items.length <= LIST_RENDER_INITIAL ? items.length : listRenderLimit;
  const toRender = items.slice(0, effectiveLimit);
  appendVacancyCardsChunked(toRender, browseMode, scrollState, generation, () => {
    if (items.length > toRender.length) {
      appendListLoadMoreButton(toRender.length, items.length);
    }
    if (currentApplyView === 'questionnaire') {
      void refreshQuestionnaireReprobeStats().then(() => maybeAutoReprobeQuestionnaires());
    }
  });
  } catch (e) {
    console.error('[dashboard] renderListFromCache', e);
    listEl.innerHTML = '';
    listEl.appendChild(
      renderEmptyState('Не удалось отрисовать список. Обновите страницу или нажмите «Обновить».', [
        { label: 'Обновить', primary: true, onClick: () => void load() },
      ])
    );
    restoreListScroll(scrollState);
  }
}

async function refreshQuestionnaireReprobeStats() {
  if (currentApplyView !== 'questionnaire') {
    questionnaireReprobeCandidateCount = 0;
    updateQuestionnaireReprobeUi();
    return;
  }
  try {
    const st = await api('/api/questionnaire/reprobe-candidates');
    questionnaireReprobeCandidateCount = Number(st.count) || 0;
  } catch {
    questionnaireReprobeCandidateCount = cachedRawItems.filter((x) => itemQuestionnaireNeedsProbe(x)).length;
  }
  updateQuestionnaireReprobeUi();
}

function updateQuestionnaireReprobeUi() {
  const reprobeBtn = document.getElementById('btn-questionnaire-reprobe-batch');
  if (!reprobeBtn) return;
  const n = questionnaireReprobeCandidateCount;
  reprobeBtn.textContent = n > 0 ? `Обновить вопросы (${n})` : 'Обновить вопросы';
  reprobeBtn.title =
    n > 0
      ? `${n} анкет с заглушками — загрузить реальные вопросы с hh.ru`
      : 'Загрузить текст вопросов с hh.ru для карточек с заглушками';
}

async function maybeAutoReprobeQuestionnaires() {
  if (autoReprobeInFlight) return;
  if (navigator.webdriver) return;
  if (currentApplyView !== 'questionnaire') return;
  if (questionnaireReprobeCandidateCount <= 0) return;

  const last = Number(localStorage.getItem(AUTO_REPROBE_LS_KEY) || 0);
  if (Date.now() - last < AUTO_REPROBE_COOLDOWN_MS) return;

  const st = lastJobStatus;
  if (st?.harvest?.running || st?.batch?.running || st?.batchActive || st?.applyChat?.running) return;

  autoReprobeInFlight = true;
  localStorage.setItem(AUTO_REPROBE_LS_KEY, String(Date.now()));
  showToast('Авто-reprobe: до 3 анкет с заглушками…', 'neutral');

  try {
    const res = await api('/api/questionnaire/reprobe-batch', {
      method: 'POST',
      body: JSON.stringify({ auto: true, limit: 3 }),
    });
    const kind = res.okCount > 0 ? 'good' : res.failed ? 'neutral' : 'good';
    showToast(res.message || 'Auto-reprobe завершён', kind);
    if (res.okCount > 0) await load({ preserveScroll: true });
    else await refreshQuestionnaireReprobeStats();
  } catch (e) {
    if (e.status !== 409) showToast(e.message || 'Auto-reprobe не удался', 'bad');
  } finally {
    autoReprobeInFlight = false;
  }
}

function renderListSkeleton(count = 6) {
  listEl.replaceChildren();
  const browseMode = currentBrowseMode();
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('div');
    el.className = browseMode ? 'card-tile card-tile--skeleton' : 'card card--skeleton';
    el.setAttribute('aria-hidden', 'true');
    listEl.appendChild(el);
  }
}

async function refreshQueueMeta() {
  try {
    cachedQueueMeta = await api('/api/queue-meta');
  } catch {
    cachedQueueMeta = null;
  }
  return cachedQueueMeta;
}

async function loadDemoQueue(opts = {}) {
  try {
    const data = await api('/api/load-demo-queue', {
      method: 'POST',
      body: JSON.stringify({ replace: Boolean(opts.replace) }),
    });
    if (!data.ok) {
      throw new Error(data.error || data.reason || 'Не удалось загрузить демо');
    }
    showToast(`Демо-очередь: ${data.count} вакансий`, 'good');
    await refreshQueueMeta();
    await load({ preserveScroll: true });
    return data;
  } catch (e) {
    if (e.status === 409 && !opts.replace) {
      if (
        confirm(
          'Очередь не пуста. Заменить текущие записи демо-очередью?\n\nТекущие данные будут перезаписаны.'
        )
      ) {
        return loadDemoQueue({ replace: true });
      }
      throw new Error('Загрузка демо отменена');
    }
    throw e;
  }
}

async function load(opts = {}) {
  const scrollState = opts.preserveScroll ? captureListScroll(opts.anchorCardId) : null;
  if (!opts.preserveScroll) {
    resetListRenderLimit();
    renderListSkeleton();
  }
  try {
    if (!settingsHydrated) await loadDashboardSettings();
    try {
      const { preferences } = await api('/api/preferences');
      const w = preferences?.llmScoreWeights;
      if (w) {
        let v = Number(w.vacancy);
        let c = Number(w.cvMatch);
        if (Number.isFinite(v) && Number.isFinite(c) && v + c > 0) {
          const sum = v + c;
          scoreWeights = { vacancy: v / sum, cvMatch: c / sum };
        }
      }
    } catch {
      scoreWeights = { vacancy: 0.35, cvMatch: 0.65 };
    }

    const { items: rawItems, counts } = await api(
      `/api/vacancies?status=${encodeURIComponent(currentStatus)}&scoreBand=${encodeURIComponent(currentScoreBand)}&applyView=${encodeURIComponent(currentApplyView)}`
    );
    let items = currentApplyView === 'hidden' ? rawItems : rawItems.filter((x) => itemPassesRoleFilters(x));
    items = filterItemsForApplyView(items);
    cachedRawItems = items;
    cachedCounts = counts;
    await refreshQueueMeta();
    if (
      cachedQueueMeta?.empty &&
      cachedQueueMeta?.demoAvailable &&
      !demoEmptyToastShown &&
      currentApplyView === 'queue' &&
      currentStatus === 'pending' &&
      !filters.search
    ) {
      demoEmptyToastShown = true;
      showToast('Очередь пуста — нажмите «Загрузить демо» для быстрого старта', 'neutral');
    }
    updateApplyViewTabCounts(counts);
    renderListFromCache(scrollState);
    clearDesktopHealthBanner();
    window.dispatchEvent(new CustomEvent('hh:dashboard-ready'));
    void refreshLetterStatsSidebar();
    void refreshTopTierList({ api, onFilterTier: setTierFilter });
  } catch (e) {
    listEl.innerHTML = `<p class="err">${e.message}</p>`;
    restoreListScroll(scrollState);
  }
}

const rerenderListDebounced = debounce(() => renderListFromCache(null), 180);

vacancyTabsEl?.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentStatus = btn.dataset.status || 'pending';
    syncVacancyTabs();
    load();
  });
});

applyViewTabsEl?.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.applyView;
    currentApplyView =
      view === 'applied' ||
      view === 'hidden' ||
      view === 'questionnaire' ||
      view === 'noQuestionnaire' ||
      view === 'deferred' ||
      view === 'queue'
        ? view
        : 'queue';
    if (currentApplyView === 'questionnaire') openQuestionnaireOnNextLoad = true;
    syncApplyViewTabs();
    load();
  });
});

syncApplyViewTabs();

document.querySelectorAll('#panel-score-band .tab-band').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentScoreBand = btn.dataset.band || 'all';
    syncScoreBandTabs();
    load();
  });
});

async function launchApplyBatchFromUi({ minScore, maxScore, limit, batchScope }) {
  try {
    const st0 = await api('/api/job-status');
    if (st0.batchActive) {
      showToast('Батч уже выполняется — дождитесь паузы или стопа', 'neutral');
      return;
    }
    try {
      const rh = await api('/api/routing-health');
      if (!rh.ok) {
        const detail = rh.issues.map((i) => `• ${i.label}: ${i.issue}`).join('\n');
        if (
          !confirm(
            `В resume-routing не хватает hash:\n${detail}\n\nБатч может пропускать вакансии. Запустить всё равно?`
          )
        ) {
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const body = { limit, batchScope };
    if (batchScope === 'queue' && (currentStatus === 'pending' || currentStatus === 'approved')) {
      body.queueStatus = currentStatus;
    }
    if (minScore != null) body.minScore = minScore;
    if (maxScore != null) body.maxScore = maxScore;
    const huntTracks = getSelectedHuntTracks();
    if (huntTracks.length) body.huntTracks = huntTracks;
    const res = await api('/api/hh-launch-apply-batch', { method: 'POST', body: JSON.stringify(body) });
    showToast(res.message || `${COPY.batch} запущена`, 'neutral');
    startJobLogPoll();
    refreshJobStatus();
  } catch (e) {
    alert(e.message);
  }
}

async function runBatch({ minScore, maxScore, label }) {
  const batchScope = batchScopeForCurrentView();
  if (!batchScope) {
    showToast(`${COPY.batch} недоступна в разделе «Отклики»`, 'neutral');
    return;
  }
  const limit = getBatchLimitForRun();
  const section = batchScopeUiLabel(batchScope);
  const queueTabLabel =
    batchScope === 'queue' && currentStatus === 'approved'
      ? 'Подходят'
      : batchScope === 'queue' && currentStatus === 'pending'
        ? 'На проверке'
        : null;
  if (batchScope === 'queue' && currentStatus === 'rejected') {
    showToast(
      'Авто-отклики для вкладки «Отказные» недоступны — переключитесь на «На проверке» или «Подходят»',
      'neutral'
    );
    return;
  }

  let precheck = null;
  try {
    precheck = await fetchBatchPrecheck(minScore, maxScore, limit);
  } catch {
    precheck = null;
  }

  if (
    precheck &&
    Number(precheck.fixableLetterQuality || 0) > 0 &&
    dashboardPreferences.batchAutoPrepareLetters !== false
  ) {
    try {
      const imp = await runBulkLetterPrepare(minScore, maxScore);
      if (imp.improved > 0) {
        showToast(imp.message || `Подготовлено писем: ${imp.improved}`, 'good');
        precheck = await fetchBatchPrecheck(minScore, maxScore, limit);
        await load();
        void refreshLetterStatsSidebar(true);
      }
    } catch (e) {
      showToast(e.message, 'bad');
    }
  }

  for (;;) {
    const action = await openBatchPrecheckModal({
      precheck,
      label,
      limit,
      section,
      queueTabLabel,
      reasonLabel: batchPrecheckReasonLabel,
      huntTracks: getSelectedHuntTracks(),
    });
    if (action === false) return;

    if (action === 'prepare') {
      try {
        const imp = await runBulkLetterPrepare(minScore, maxScore);
        showToast(imp.message || `Подготовлено: ${imp.improved || 0}`, imp.improved ? 'good' : 'neutral');
        precheck = await fetchBatchPrecheck(minScore, maxScore, limit);
        updateBatchPrecheckModal(precheck);
        await load();
        void refreshLetterStatsSidebar(true);
      } catch (e) {
        showToast(e.message, 'bad');
      }
      continue;
    }

    if (action === 'regen') {
      try {
        const failN = precheck?.blocked?.letterQuality || 15;
        const res = await requestCoverLetterRegenerateWeak({
          mode: 'fail',
          limit: Math.min(40, Math.max(5, failN)),
        });
        showToast(res.message || 'Перегенерация запущена', 'good');
      } catch (e) {
        showToast(e.message, 'bad');
      }
      continue;
    }

    if (action === 'filter') {
      setLetterIssuesFilter(true);
      renderListFromCache(null);
      showToast('Фильтр «Письма: проверка» включён', 'neutral');
      continue;
    }

    if (action === 'start') {
      if (precheck?.readiness?.tier === 'blocked') {
        showToast(
          precheck.readiness.blockers?.[0]?.message || 'Серию нельзя запустить — см. блок «Можно ли запускать»',
          'bad'
        );
        continue;
      }
      if (precheck?.readiness?.tier === 'caution') {
        const warn = (precheck.readiness.warnings || []).join('\n');
        if (
          warn &&
          !confirm(`Осторожно — перед серией из ${limit} откликов:\n${warn}\n\nЗапустить всё равно?`)
        ) {
          continue;
        }
      }
      if (precheck && Number(precheck.ready || 0) === 0) {
        showToast('Нет готовых карточек — исправьте блокеры или смените фильтр', 'neutral');
        continue;
      }
      if (precheck?.falsePositiveGuardrail) {
        const fpN = Number(precheck.falsePositives || 0);
        const fpMax = Number(precheck.falsePositiveMax || 20);
        if (
          !confirm(
            glossaryLabel('batchFpConfirm', dashboardUi.uiMode, { fpN, fpMax })
          )
        ) {
          continue;
        }
      }
      if (batchScope === 'hidden') {
        if (
          !confirm(
            'Внимание: батч по скрытым вакансиям (Senior/Lead, 1С, разработчик). Запустить серию?'
          )
        ) {
          continue;
        }
      }
      await launchApplyBatchFromUi({ minScore, maxScore, limit, batchScope });
      return;
    }
  }
}

document.getElementById('btn-batch-auto')?.addEventListener('click', () =>
  runBatch({ minScore: scoreThreshold, label: `Авто ≥${scoreThreshold}` })
);
document.getElementById('btn-batch-manual')?.addEventListener('click', () =>
  runBatch({ maxScore: scoreThreshold - 1, label: `Ручной <${scoreThreshold}` })
);

document.getElementById('btn-job-pause')?.addEventListener('click', () => sendJobControl('pause'));
document.getElementById('btn-job-stop')?.addEventListener('click', () => {
  const msg =
    activeJobControl === 'harvest'
      ? 'Остановить сбор вакансий? Текущая страница прервётся.'
      : 'Остановить батч? Прогресс сохранится — можно будет нажать «Продолжить».';
  if (confirm(msg)) sendJobControl('stop');
});
document.getElementById('btn-job-resume')?.addEventListener('click', () => sendJobControl('resume'));

document.getElementById('btn-questionnaire-reprobe-batch')?.addEventListener('click', async () => {
  if (
    !confirm(
      'Открыть hh.ru в Chromium и обновить текст вопросов для карточек с заглушками?\n\n' +
        'За один раз — до 5 вакансий (нужна сессия npm run login).'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-questionnaire-reprobe-batch');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/reprobe-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: 5 }),
    });
    showToast(res.message || COPY.questionnaireProbeToast.replace('{n}', String(res.okCount ?? 0)), res.failed ? 'neutral' : 'good');
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById('btn-questionnaire-probe-filter')?.addEventListener('click', async () => {
  if (
    !confirm(
      'Загрузить анкеты с hh.ru для карточек раздела «Анкета»?\n\n' +
        'До 5 вакансий за запуск (нужна сессия npm run login).'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-questionnaire-probe-filter');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/probe-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: 5, scope: 'questionnaire' }),
    });
    showToast(res.message || COPY.questionnaireProbeToast.replace('{n}', String(res.okCount ?? 0)), res.failed ? 'neutral' : 'good');
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById('btn-questionnaire-prep-batch')?.addEventListener('click', async () => {
  if (
    !confirm(
      'Сгенерировать черновики ответов для всех карточек с анкетой (pending/approved)?\n\n' +
        'Используется CV/ и при HH_QUESTIONNAIRE_LLM=1 — LLM. Уже сохранённые ответы не перезаписываются.'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-questionnaire-prep-batch');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/prep-batch', { method: 'POST', body: '{}' });
    showToast(res.message || `Готово: ${res.okCount}`, 'good');
    await load();
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

async function launchBackgroundApi(path, toastMsgOrOpts) {
  const opts =
    typeof toastMsgOrOpts === 'object' && toastMsgOrOpts !== null
      ? toastMsgOrOpts
      : { method: 'POST', body: '{}', toast: toastMsgOrOpts };
  try {
    const res = await api(path, {
      method: opts.method || 'POST',
      body: opts.body ?? '{}',
    });
    showToast(res.message || opts.toast || 'Запущено', 'good');
    refreshJobStatus();
  } catch (e) {
    if (e.status === 409) {
      showToast(e.message || 'Браузер занят — дождитесь завершения батча', 'neutral');
      return;
    }
    throw e;
  }
}

async function applyNegotiationsCacheToQueue() {
  const res = await api('/api/apply-negotiations-cache', { method: 'POST', body: '{}' });
  showToast(res.message || `Статусы hh: ${res.updated} карточек`, 'good');
  await load();
}

async function runServiceAction(action, triggerEl) {
  closeServiceDrawer();
  const wasDisabled = Boolean(triggerEl?.disabled);
  if (triggerEl) triggerEl.disabled = true;
  try {
    switch (action) {
      case 'sync-hh-responses':
        await launchBackgroundApi('/api/launch-sync-hh-responses', 'Синхронизация откликов hh.ru');
        break;
      case 'sync-hh-chats':
        await launchBackgroundApi('/api/launch-sync-hh-chats', 'Синхронизация чатов');
        break;
      case 'apply-negotiations-cache':
        await applyNegotiationsCacheToQueue();
        refreshJobStatus();
        break;
      case 'import-negotiations-queue': {
        const res = await api('/api/import-negotiations-queue', { method: 'POST', body: '{}' });
        showToast(res.message || `Импорт: ${res.imported}`, 'good');
        await load();
        break;
      }
      case 'prune-responded':
        if (
          !confirm(
            'Убрать из очереди все вакансии (Проверка/Подходят), где отклик уже на hh.ru?\n\n' +
              'Статус станет responded — батч их не тронет.'
          )
        ) {
          return;
        }
        {
          const res = await api('/api/prune-responded-queue', { method: 'POST' });
          showToast(res.message || `Убрано: ${res.changed}`, 'good');
          await load();
        }
        break;
      case 'sync-resume-from-source':
        if (
          !(await openConfirmActionModal({
            title: 'Синхронизация резюме',
            message:
              'Синхронизировать резюме с эталона (техподдержка)?\n\n' +
              'Заполнит «О себе» и описание опыта на DevOps и других вариантах, если они пустее эталона.\n\n' +
              'Откроется Chromium. Нужен config/resume-variants.json с hash.',
            confirmLabel: 'Синхронизировать',
          }))
        ) {
          return;
        }
        await launchBackgroundApi('/api/launch-sync-resume-from-source', 'Синхронизация резюме запущена');
        break;
      case 'sync-resume-variants':
        if (
          !(await openConfirmActionModal({
            title: 'Обновление резюме',
            message:
              'Обновить до 5 резюме на hh.ru?\n\nНужен config/resume-variants.json и Chromium (npm run devops:list-resumes).',
            confirmLabel: 'Обновить',
          }))
        ) {
          return;
        }
        await launchBackgroundApi('/api/launch-sync-resume-variants', 'Обновление резюме на hh.ru');
        break;
      case 'restore-hh-resume':
        await requestResumeHhRestore();
        break;
      case 'raise-resumes-all':
        if (
          !confirm(
            'Поднять все резюме в поиске на hh.ru?\n\nОткроется Chromium. Не чаще раза в 4 ч на резюме (лимит hh.ru).'
          )
        ) {
          return;
        }
        await launchBackgroundApi('/api/resume-raise', {
          method: 'POST',
          body: JSON.stringify({ all: true }),
        });
        break;
      case 'raise-resumes-routing':
        if (
          !confirm(
            'Поднять резюме из config/resume-routing.json (все роли с hash)?\n\nОткроется Chromium.'
          )
        ) {
          return;
        }
        await launchBackgroundApi('/api/resume-raise', { method: 'POST', body: '{}' });
        break;
      case 'raise-resumes-role': {
        const role = document.getElementById('resume-raise-role')?.value;
        if (!role) {
          alert('Выберите роль');
          return;
        }
        if (!confirm(`Поднять резюме для роли «${role}» на hh.ru?`)) return;
        await launchBackgroundApi('/api/resume-raise', {
          method: 'POST',
          body: JSON.stringify({ role }),
        });
        break;
      }
      case 'open-interview-hub':
        openInterviewHubModal();
        break;
      case 'import-interview-notes': {
        const res = await api('/api/import-interview-notes', { method: 'POST', body: '{}' });
        showToast(res.ok ? `Импорт: ${res.count} файлов` : res.error, res.ok ? 'good' : 'bad');
        break;
      }
      case 'daily-digest': {
        const res = await api('/api/daily-digest', { method: 'POST', body: JSON.stringify({ sendTelegram: true }) });
        openDailyDigestModal(res.digest);
        break;
      }
      case 'chat-reply-batch':
        if (!confirm('Сгенерировать черновики ответов для до 15 карточек с вопросами в чате?')) return;
        {
          const res = await api('/api/chat-reply-batch', { method: 'POST', body: '{}' });
          showToast(`Готово: ${res.processed} черновиков`, 'good');
          await load();
        }
        break;
      case 'questionnaire-reprobe':
        document.getElementById('btn-questionnaire-reprobe-batch')?.click();
        break;
      case 'questionnaire-prep':
        document.getElementById('btn-questionnaire-prep-batch')?.click();
        break;
      default:
        break;
    }
  } catch (e) {
    alert(e.message);
  } finally {
    if (triggerEl) triggerEl.disabled = wasDisabled;
  }
}

function renderResumeRaiseScheduleStatus(st) {
  const el = document.getElementById('resume-raise-schedule-status');
  const cb = document.getElementById('resume-raise-auto-enabled');
  const settingsCb = document.getElementById('settings-resume-raise-auto');
  if (cb && st && typeof st.enabled === 'boolean' && document.activeElement !== cb) {
    cb.checked = st.enabled;
  }
  if (settingsCb && st && typeof st.enabled === 'boolean' && document.activeElement !== settingsCb) {
    settingsCb.checked = st.enabled;
  }
  if (!el || !st) return;
  const slotLabel = (s) => {
    if (typeof s === 'string' && s.includes(':')) return s;
    if (s && typeof s === 'object' && Number.isFinite(s.hour)) {
      const m = Number.isFinite(s.minute) ? s.minute : 0;
      return `${String(s.hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return typeof s === 'number' && Number.isFinite(s) ? `${s}:00` : String(s ?? '');
  };
  const slots = (st.slots || []).map(slotLabel).join(', ');
  const pending = st.pendingToday?.length
    ? `осталось: ${st.pendingToday.map((p) => (typeof p.label === 'string' && p.label.includes(':') ? p.label : slotLabel(p.hour ?? p))).join(', ')}`
    : 'слоты на сегодня закрыты';
  const last = st.lastRunAt ? ` · ${new Date(st.lastRunAt).toLocaleString('ru-RU')}` : '';
  el.textContent = `${st.enabled ? 'Авто вкл' : 'Авто выкл'} · ${slots} (${st.timezone || 'MSK'}) · ${pending}${last}`;
}

function renderChatFollowUpScheduleStatus(st) {
  const el = document.getElementById('chat-follow-up-schedule-status');
  const cb = document.getElementById('chat-follow-up-auto-enabled');
  const settingsCb = document.getElementById('settings-chat-follow-up-auto');
  if (cb && st && typeof st.enabled === 'boolean' && document.activeElement !== cb) {
    cb.checked = st.enabled;
  }
  if (settingsCb && st && typeof st.enabled === 'boolean' && document.activeElement !== settingsCb) {
    settingsCb.checked = st.enabled;
  }
  if (!el || !st) return;
  const slotLabel = (s) => {
    if (typeof s === 'string' && s.includes(':')) return s;
    if (s && typeof s === 'object' && Number.isFinite(s.hour)) {
      const m = Number.isFinite(s.minute) ? s.minute : 0;
      return `${String(s.hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return typeof s === 'number' && Number.isFinite(s) ? `${s}:00` : String(s ?? '');
  };
  const slots = (st.slots || []).map(slotLabel).join(', ');
  const pending = st.pendingToday?.length
    ? `осталось: ${st.pendingToday.map((p) => slotLabel(p.hour ?? p)).join(', ')}`
    : 'слоты на сегодня закрыты';
  const last = st.lastRunAt ? ` · ${new Date(st.lastRunAt).toLocaleString('ru-RU')}` : '';
  el.textContent = `${st.enabled ? 'Авто вкл' : 'Авто выкл'} · ${slots} (${st.timezone || 'MSK'}) · ${pending}${last}`;
  const hint = document.getElementById('settings-automation-schedule-hint');
  if (hint) {
    hint.textContent = `Подъём: ${document.getElementById('resume-raise-auto-enabled')?.checked ? 'вкл' : 'выкл'} · Follow-up: ${st.enabled ? 'вкл' : 'выкл'}`;
  }
}

async function patchResumeRaiseScheduleEnabled(enabled) {
  await api('/api/resume-raise-schedule', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
  showToast(enabled ? 'Авто-подъём включён' : 'Авто-подъём выключен', 'neutral');
  refreshJobStatus();
}

async function patchChatFollowUpScheduleEnabled(enabled) {
  await api('/api/chat-follow-up-schedule', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
  showToast(enabled ? 'Follow-up чатов включён' : 'Follow-up чатов выключен', 'neutral');
  refreshJobStatus();
}

async function fillResumeRaiseRoleSelect() {
  const sel = document.getElementById('resume-raise-role');
  if (!sel) return;
  try {
    const rh = await api('/api/routing-health');
    const roles = rh.roles || [];
    sel.replaceChildren(
      ...roles.map((r) => {
        const o = document.createElement('option');
        o.value = r.role;
        o.textContent = r.hash ? `${r.label}` : `${r.label} (нет hash)`;
        o.disabled = !r.hash;
        return o;
      })
    );
    if (rh.defaultRole && sel.querySelector(`option[value="${rh.defaultRole}"]`)) {
      sel.value = rh.defaultRole;
    }
  } catch {
    sel.innerHTML = '<option value="devops">devops</option>';
  }
}

function initResumeRaiseScheduleUi() {
  fillResumeRaiseRoleSelect();
  const bindResumeRaiseToggle = (el) => {
    el?.addEventListener('change', async (e) => {
      try {
        await patchResumeRaiseScheduleEnabled(e.target.checked);
      } catch (err) {
        alert(err.message);
        e.target.checked = !e.target.checked;
      }
    });
  };
  bindResumeRaiseToggle(document.getElementById('resume-raise-auto-enabled'));
  bindResumeRaiseToggle(document.getElementById('settings-resume-raise-auto'));
}

function initChatFollowUpScheduleUi() {
  const bindFollowUpToggle = (el) => {
    el?.addEventListener('change', async (e) => {
      try {
        await patchChatFollowUpScheduleEnabled(e.target.checked);
      } catch (err) {
        alert(err.message);
        e.target.checked = !e.target.checked;
      }
    });
  };
  bindFollowUpToggle(document.getElementById('chat-follow-up-auto-enabled'));
  bindFollowUpToggle(document.getElementById('settings-chat-follow-up-auto'));
}

function initServiceActions() {
  initResumeRaiseScheduleUi();
  initChatFollowUpScheduleUi();
  document.querySelectorAll('[data-service-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.dataset.serviceAction;
      if (action) void runServiceAction(action, el);
    });
  });
}
async function loadDailyRoutineSteps() {
  const list = document.getElementById('routine-steps');
  if (!list) return;
  try {
    const res = await api('/api/daily-routine');
    list.replaceChildren(
      ...(res.steps || []).map((s) => {
        const li = document.createElement('li');
        li.textContent = s.optional ? `${s.label} (опц.)` : s.label;
        li.title = s.detail || '';
        return li;
      })
    );
  } catch {
    list.innerHTML = '<li>Синхр. отклики → кэш → чаты</li>';
  }
}

document.getElementById('btn-daily-routine')?.addEventListener('click', async () => {
  const withHarvest = document.getElementById('daily-routine-harvest')?.checked;
  const withHabrHarvest = document.getElementById('daily-routine-habr-harvest')?.checked;
  if (
    !confirm(
      'Запустить утренний цикл?\n\n' +
        '1) Синхр. откликов hh.ru (браузер)\n' +
        '2) Обновление статусов в очереди\n' +
        '3) Синхр. чатов (браузер)' +
        (withHarvest ? '\n4) Сбор вакансий на hh.ru' : '') +
        (withHabrHarvest ? `\n+ ${COPY.dailyRoutineExternalConfirm}` : '') +
        '\n\nНе закрывайте окно Chromium до завершения.'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-daily-routine');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/daily-routine-run', {
      method: 'POST',
      body: JSON.stringify({ withHarvest: !!withHarvest, withHabrHarvest: !!withHabrHarvest }),
    });
    showToast(res.message || 'Рутина запущена', 'good');
    dailyRoutineWasRunning = true;
    refreshJobStatus();
  } catch (e) {
    if (e.status === 409) showToast(e.message, 'neutral');
    else alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById('btn-run-harvest')?.addEventListener('click', async () => {
  const periodRaw = document.getElementById('harvest-period')?.value;
  const period = periodRaw === '0' ? 0 : Number(periodRaw) || 7;
  const periodLabel =
    period === 0
      ? 'за всё время'
      : period === 1
        ? 'за сутки'
        : period === 3
          ? 'за 3 дня'
          : period === 7
            ? 'за неделю'
            : `${period} дн.`;
  const btn = document.getElementById('btn-run-harvest');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/run-harvest', {
      method: 'POST',
      body: JSON.stringify({ periodDays: period }),
    });
    showToast(`${COPY.harvest} запущен (${periodLabel}), pid ${res.pid}`, 'good');
    renderJobProgress({
      harvest: { running: true },
      harvestProgress: {
        phase: 'starting',
        percent: 0,
        label: 'Запуск…',
        title: COPY.harvest,
      },
    });
    startJobLogPoll();
    refreshJobStatus();
    window.setTimeout(async () => {
      try {
        const st = await api('/api/job-status');
        if (!st.harvest?.running && st.harvestLog?.lastError) {
          showToast(st.harvestLog.lastError.slice(0, 220), 'bad');
          renderJobProgress({
            harvest: { running: false },
            harvestProgress: {
              phase: 'error',
              percent: 0,
              label: st.harvestLog.lastError.slice(0, 120),
              title: COPY.harvest,
            },
          });
        }
      } catch {
        /* ignore */
      }
    }, 4000);
  } catch (e) {
    showToast(e.message, 'bad');
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById('filter-reset')?.addEventListener('click', () => {
  if (filterSearchEl) filterSearchEl.value = '';
  if (filterLetterQualityBtnEl) {
    filterLetterQualityBtnEl.classList.remove('active');
    filterLetterQualityBtnEl.setAttribute('aria-pressed', 'false');
  }
  if (letterToolbarChipEl) {
    letterToolbarChipEl.classList.remove('active');
    letterToolbarChipEl.setAttribute('aria-pressed', 'false');
  }
  if (filterMinScoreEl) filterMinScoreEl.value = '';
  if (filterSortEl) filterSortEl.value = 'score-desc';
  if (filterSourceEl) filterSourceEl.value = 'all';
  if (filterTierEl) filterTierEl.value = 'all';
  if (sidebarFilterSourceEl) sidebarFilterSourceEl.value = 'all';
  if (sidebarFilterTierEl) sidebarFilterTierEl.value = 'all';
  filterPresetExtras = { onlyManual: false, onlyFresh: false };
  document.querySelectorAll('[data-preset]').forEach((btn) => btn.classList.remove('active'));
  if (filterSalaryEl) filterSalaryEl.checked = false;
  if (currentScoreBand !== 'all') {
    switchScoreBandToAll();
    return;
  }
  renderListFromCache(null);
});

function onLetterQualityFilterClick() {
  const probe = letterToolbarChipEl || filterLetterQualityBtnEl;
  if (!probe) return;
  const next = !(probe.getAttribute('aria-pressed') === 'true');
  setLetterIssuesFilter(next);
  if (next && filterLetterWeakBtnEl) {
    filterLetterWeakBtnEl.setAttribute('aria-pressed', 'false');
    filterLetterWeakBtnEl.classList.remove('active');
  }
  renderListFromCache(null);
  showToast(
    next ? 'Фильтр: только карточки с проблемами письма' : 'Фильтр писем снят',
    'neutral'
  );
}

letterToolbarChipEl?.addEventListener('click', onLetterQualityFilterClick);
filterLetterQualityBtnEl?.addEventListener('click', onLetterQualityFilterClick);

filterLetterWeakBtnEl?.addEventListener('click', () => {
  const next = !(filterLetterWeakBtnEl.getAttribute('aria-pressed') === 'true');
  filterLetterWeakBtnEl.setAttribute('aria-pressed', next ? 'true' : 'false');
  filterLetterWeakBtnEl.classList.toggle('active', next);
  if (next && (letterToolbarChipEl || filterLetterQualityBtnEl)) {
    setLetterIssuesFilter(false);
  }
  renderListFromCache(null);
  showToast(next ? 'Фильтр: письма с оценкой ниже 6/10' : 'Фильтр «Письмо <6» снят', 'neutral');
});

btnLetterCenterPrepareEl?.addEventListener('click', () => btnBulkImproveLettersEl?.click());

btnLetterCenterGenerateEl?.addEventListener('click', async () => {
  btnLetterCenterGenerateEl.disabled = true;
  try {
    await runLetterCenterRegen('missing');
  } catch (e) {
    showToast(e.message, 'bad');
  } finally {
    btnLetterCenterGenerateEl.disabled = false;
  }
});

btnLetterCenterRegenEl?.addEventListener('click', async () => {
  btnLetterCenterRegenEl.disabled = true;
  try {
    await runLetterCenterRegen('fail');
  } catch (e) {
    showToast(e.message, 'bad');
  } finally {
    btnLetterCenterRegenEl.disabled = false;
  }
});

btnLetterCenterFilterEl?.addEventListener('click', () => {
  setLetterIssuesFilter(true);
  renderListFromCache(null);
  closeModalEl(document.getElementById('letter-issues-modal'));
});

btnLetterCenterFixableEl?.addEventListener('click', (ev) => {
  if (ev.shiftKey) {
    openDashboardSettings('letters');
    return;
  }
  letterCenterKindFilter = letterCenterKindFilter === 'fixable' ? 'all' : 'fixable';
  reapplyLetterCenterFromCache();
});

btnLetterCenterFailEl?.addEventListener('click', () => {
  letterCenterKindFilter = letterCenterKindFilter === 'fail' ? 'all' : 'fail';
  reapplyLetterCenterFromCache();
});

btnLetterCenterMissingEl?.addEventListener('click', () => {
  letterCenterKindFilter = letterCenterKindFilter === 'missing' ? 'all' : 'missing';
  reapplyLetterCenterFromCache();
});

btnLetterCenterMoreEl?.addEventListener('click', () => openLetterQualityHubModal());

btnStatusLettersIssuesEl?.addEventListener('click', () => openLetterIssuesModal());

letterStatsBodyEl?.addEventListener('click', (ev) => {
  if (ev.target.closest('.status-kpi--need-work')) {
    openLetterIssuesModal();
    return;
  }
  openLetterQualityHubModal();
});
letterStatsBodyEl?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    openLetterQualityHubModal();
  }
});

btnBulkImproveLettersEl?.addEventListener('click', async () => {
  const batchScope = batchScopeForCurrentView();
  if (!batchScope) {
    showToast('Подготовка писем доступна в разделах очереди/батча', 'neutral');
    return;
  }
  btnBulkImproveLettersEl.disabled = true;
  try {
    const imp = await requestCoverLetterBulkImprove({
      batchScope,
      queueStatus: batchScope === 'queue' && currentStatus === 'approved' ? 'approved' : 'pending',
      minScore: Math.max(0, Number(filterMinScoreEl?.value || 0)),
    });
    showToast(imp.message || `Готово: ${imp.improved || 0}`, imp.improved ? 'good' : 'neutral');
    await load();
    void refreshLetterStatsSidebar(true);
  } catch (e) {
    showToast(e.message, 'bad');
  } finally {
    btnBulkImproveLettersEl.disabled = false;
  }
});

document.getElementById('btn-review-tier-a')?.addEventListener('click', () => {
  setTierFilter('A');
  showToast(`Фильтр: ${tierClassLabel('A')}`, 'neutral');
});

for (const el of [
  filterSearchEl,
  filterMinScoreEl,
  filterSortEl,
  filterSalaryEl,
  filterSourceEl,
  filterTierEl,
  sidebarFilterSourceEl,
  sidebarFilterTierEl,
]) {
  el?.addEventListener('input', () => {
    if (el === filterSourceEl || el === sidebarFilterSourceEl) {
      syncFilterControlsFrom(el.value, filterTierEl?.value || sidebarFilterTierEl?.value || 'all');
    }
    if (el === filterTierEl || el === sidebarFilterTierEl) {
      syncFilterControlsFrom(filterSourceEl?.value || sidebarFilterSourceEl?.value || 'all', el.value);
    }
    filterPresetExtras = { onlyManual: false, onlyFresh: false };
    document.querySelectorAll('[data-preset]').forEach((btn) => btn.classList.remove('active'));
    rerenderListDebounced();
  });
  el?.addEventListener('change', () => {
    if (el === filterSourceEl || el === sidebarFilterSourceEl) {
      syncFilterControlsFrom(el.value, filterTierEl?.value || sidebarFilterTierEl?.value || 'all');
    }
    if (el === filterTierEl || el === sidebarFilterTierEl) {
      syncFilterControlsFrom(filterSourceEl?.value || sidebarFilterSourceEl?.value || 'all', el.value);
    }
    filterPresetExtras = { onlyManual: false, onlyFresh: false };
    document.querySelectorAll('[data-preset]').forEach((btn) => btn.classList.remove('active'));
    rerenderListDebounced();
  });
}

for (const btn of document.querySelectorAll('[data-preset]')) {
  btn.addEventListener('click', () => {
    const preset = btn.getAttribute('data-preset');
    if (preset) applyFilterPreset(/** @type {'tierAFresh'|'manualApply'|'allSources'} */ (preset));
  });
}

for (const btn of document.querySelectorAll('[data-queue-list-mode]')) {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-queue-list-mode');
    if (mode !== 'toApply' && mode !== 'all') return;
    currentQueueListMode = mode;
    syncQueueListModeTabs();
    renderListFromCache(null);
  });
}

syncQueueListModeTabs();

settingsProfileSelectEl?.addEventListener('change', async () => {
  const id = settingsProfileSelectEl.value;
  if (!id || !profileOptionsLoaded) return;
  settingsProfileSelectEl.disabled = true;
  try {
    await changeActiveProfile(id);
  } catch (e) {
    showToast(e.message || 'Не удалось сменить профиль', 'bad');
    try {
      const data = await api('/api/profiles');
      applyProfileOptionsToSettingsUI(data);
    } catch {
      /* ignore */
    }
  } finally {
    settingsProfileSelectEl.disabled = false;
  }
});

await applyLocalDashboardDefaults();
if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
  document.documentElement.classList.add('hh-desktop');
  document.documentElement.style.setProperty('--ui-scale', '1');
  initDesktopDashboardWatchdog();
}
initUiScaleControls();
initThemeControls();
initCardTuningControls();
window.addEventListener('hh-card-density-change', () => renderListFromCache(null));
window.addEventListener('hh-card-layout-change', () => renderListFromCache(null));
initFloatingTooltips();
configureVacancyDetailNav({
  getItems: () => applyClientFilters(cachedRawItems, readFiltersFromUI()),
  renderCard,
});
initVacancyDetailModal();
initModalLayer({
  onEscape: (modalId) => {
    if (modalId) return closeModalById(modalId);
    return closeTopModal();
  },
});

syncVacancyTabs();
syncScoreBandTabs();
syncApplyViewTabs();
async function ensureChatTemplates() {
  if (chatTemplatesCache) return chatTemplatesCache;
  try {
    const res = await api('/api/chat-templates');
    chatTemplatesCache = res.templates || [];
  } catch {
    chatTemplatesCache = [];
  }
  return chatTemplatesCache;
}

function getSettingsDialogWidth() {
  const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
  return dlg?.getBoundingClientRect().width ?? 0;
}

function isNarrowSettingsDialog() {
  const w = getSettingsDialogWidth();
  if (w > 0) return w <= 640;
  return window.matchMedia('(max-width: 640px)').matches;
}

function healSettingsShellLayout() {
  if (settingsShellLayoutFrozen) return;
  const dlg = document.querySelector('#settings-modal .settings-dialog--v5');
  const content = document.querySelector('#settings-modal .settings-content');
  const shell = document.querySelector('#settings-modal .settings-shell');
  if (!dlg || !content || !shell) return;
  const dr = dlg.getBoundingClientRect().width;
  const cr = content.getBoundingClientRect().width;
  if (dr > 640 && cr / dr < 0.5) {
    shell.classList.add('settings-shell--wide');
  }
}

function updateSettingsShellLayoutClasses({ mode, force = false } = {}) {
  if (settingsShellLayoutFrozen && !force) return;
  const settingsModal = document.getElementById('settings-modal');
  if (!settingsModal || settingsModal.hidden) return;
  const shell = settingsModal.querySelector('.settings-shell');
  if (!shell) return;
  const wide = getSettingsDialogWidth() > 640;
  shell.classList.toggle('settings-shell--wide', wide);
  if (wide) {
    syncSettingsMobileShell(null);
  } else {
    const m = mode ?? (shell.classList.contains('settings-shell--pick') ? 'pick' : 'drill');
    syncSettingsMobileShell(m);
  }
  healSettingsShellLayout();
}

/** @param {'pick' | 'drill' | null} mode */
function syncSettingsMobileShell(mode) {
  if (settingsShellLayoutFrozen) return;
  const settingsModal = document.getElementById('settings-modal');
  const shell = settingsModal?.querySelector('.settings-shell');
  const back = document.getElementById('settings-zone-back');
  if (!shell) return;
  const narrow = isNarrowSettingsDialog();
  shell.classList.remove(
    'settings-shell--pick',
    'settings-shell--drill',
    'settings-shell--solo',
    'settings-shell--sidebar'
  );
  if (!narrow) {
    shell.classList.add('settings-shell--sidebar');
    if (back) {
      back.hidden = true;
      back.setAttribute('aria-hidden', 'true');
    }
  } else if (mode === 'pick') {
    shell.classList.add('settings-shell--pick', 'settings-shell--sidebar');
  } else {
    shell.classList.add('settings-shell--drill', 'settings-shell--solo');
  }
  if (back) {
    const showBack = shell.classList.contains('settings-shell--drill');
    back.hidden = !showBack;
    back.setAttribute('aria-hidden', showBack ? 'false' : 'true');
  }
  const wide = getSettingsDialogWidth() > 640;
  shell.classList.toggle('settings-shell--wide', wide);
  healSettingsShellLayout();
}

const syncSettingsMobileOnResize = debounce(() => {
  if (isSettingsDialogLayoutSyncSuppressed()) return;
  if (isSettingsModalOpen()) {
    settingsShellLayoutFrozen = !isNarrowSettingsDialog();
  }
  updateSettingsShellLayoutClasses({ force: true });
}, 150);
window.addEventListener('resize', syncSettingsMobileOnResize);

function openDashboardSettings(tabId = 'system', { focusId, clearUrl = true, layout, focusToast, quietToast } = {}) {
  closeServiceDrawer();
  const settingsModal = document.getElementById('settings-modal');
  if (!settingsModal) return;
  if (!settingsTabSetter) {
    console.error('[dashboard] settings UI not initialized — check console for module load errors');
    showToast('Настройки не загрузились — обновите страницу (Ctrl+F5)', 'bad');
    return;
  }
  let tab = tabId;
  if (!tab) {
    try {
      tab = sessionStorage.getItem('hh-settings-tab') || 'system';
    } catch {
      tab = 'system';
    }
  }
  const normalizedTab = normalizeSettingsTab(tab);
  const alreadyOpen = !settingsModal.hidden && settingsModal.classList.contains('modal--open');
  settingsTabSetter?.(normalizedTab);
  settingsModal.hidden = false;
  if (!alreadyOpen) {
    lockBodyScrollForSettings();
    openModalEl(settingsModal);
    settingsFocusTrapCleanup?.();
    settingsFocusTrapCleanup = installModalFocusTrap(settingsModal);
  }
  applySettingsOpenLayout(layout);
  settingsModalHooks?.onOpen(normalizedTab);
  if (!alreadyOpen) {
    settingsShellLayoutFrozen = false;
    syncSettingsMobileShell(isNarrowSettingsDialog() ? (focusId ? 'drill' : 'pick') : null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        updateSettingsShellLayoutClasses({ force: true });
        if (!isNarrowSettingsDialog()) settingsShellLayoutFrozen = true;
      });
    });
  }
  if (!settingsProfileSelectEl?.value) void refreshProfileSelect();
  if (focusId) focusSettingsField(focusId, { toast: quietToast ? '' : focusToast || '' });
  if (clearUrl) clearSettingsLocationParams();
}

function openDashboardSettingsFromUrl() {
  const req = parseSettingsFromLocation();
  if (!req) return;
  openDashboardSettings(req.tab, { focusId: req.focus, layout: req.layout, clearUrl: true });
}

function initDashboardDeepLinks() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('batchReport') === '1') {
    url.searchParams.delete('batchReport');
    const qs = url.searchParams.toString();
    window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : '') + url.hash);
    void openBatchReportModal();
  }
}

/** @param {unknown} err @param {string} [fallback] */
function toastApiError(err, fallback = 'Ошибка') {
  const msg = humanApiError(err instanceof Error ? err : String(err ?? ''));
  showToast(msg || fallback, 'bad');
}

function hardReloadDashboard() {
  const url = new URL(window.location.href);
  url.searchParams.set('_', String(Date.now()));
  window.location.replace(url.toString());
}

function initBrandHardReload() {
  document.getElementById('crm-brand-reload')?.addEventListener('click', hardReloadDashboard);
}

function initLimitsStatusLink() {
  const box = document.getElementById('crm-status-limits');
  if (!box) return;
  const open = () => openDashboardSettings('apply', { focusId: 'settings-limits-hh' });
  box.addEventListener('click', open);
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    open();
  });
}

function initLayoutSettingsUi() {
  initSidebarBuilderHooks();
  document.getElementById('btn-reset-panel-order')?.addEventListener('click', () => {
    applyLayoutPreset('standard');
  });
  document.querySelectorAll('[data-ui-mode-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.uiModePreset === UI_MODES.expert ? UI_MODES.expert : UI_MODES.simple;
      dashboardUi.uiMode = mode;
      if (mode === UI_MODES.simple) {
        dashboardUi.panels = { ...dashboardUi.panels, ...defaultPanelsForMode(UI_MODES.simple) };
      }
      applyDashboardUiFromPreferences(
        { dashboardUiMode: mode, dashboardSidebarPanels: dashboardUi.panels },
        dashboardUi
      );
      document.querySelectorAll('[data-ui-mode-preset]').forEach((b) => {
        b.classList.toggle('active', b.dataset.uiModePreset === mode);
      });
      syncLayoutPresetButtons();
      if (layoutSettingsHydrated) scheduleSaveLayoutSettings();
    });
  });
  document.querySelectorAll('[data-layout-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.layoutPreset;
      if (LAYOUT_PRESET_KEYS.includes(name)) applyLayoutPreset(name);
    });
  });
  layoutSettingsHydrated = true;
}

function initCrmUi() {
  initBatchReportSettingsLinks();
  const shell = document.getElementById('app-shell');
  const sidebarModeBtns = document.querySelectorAll('[data-sidebar-mode]');
  function setSidebarMode(mode) {
    const m = mode === 'compact' ? 'compact' : 'full';
    dashboardUi.sidebarMode = m;
    if (shell) shell.dataset.sidebarMode = m;
    try {
      localStorage.setItem('hh-sidebar-mode', m);
    } catch {
      /* ignore */
    }
    sidebarModeBtns.forEach((b) => b.classList.toggle('active', b.dataset.sidebarMode === m));
    if (shell && shell.dataset.dockLeftHidden !== '1' && shell.dataset.dockLeftCollapsed !== '1') {
      if (m === 'compact') shell.style.setProperty('--dock-left-w', '11.5rem');
      else {
        shell.style.removeProperty('--dock-left-w');
        applyDockState(loadDockState());
      }
    }
    if (layoutSettingsHydrated) scheduleSaveLayoutSettings();
  }
  sidebarModeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSidebarMode(btn.dataset.sidebarMode));
  });

  const funnelEl = document.getElementById('applied-funnel-tabs');
  document.querySelectorAll('[data-applied-funnel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentAppliedFunnel = btn.dataset.appliedFunnel || 'all';
      funnelEl?.querySelectorAll('[data-applied-funnel]').forEach((b) =>
        b.classList.toggle('active', b.dataset.appliedFunnel === currentAppliedFunnel)
      );
      renderListFromCache(null);
    });
  });

  const settingsModal = document.getElementById('settings-modal');
  const settingsTabBtns = settingsModal?.querySelectorAll('[data-settings-tab]') || [];
  const settingsPanels = {
    system: document.getElementById('settings-panel-system'),
    harvest: document.getElementById('settings-panel-harvest'),
    targeting: document.getElementById('settings-panel-targeting'),
    apply: document.getElementById('settings-panel-apply'),
    letters: document.getElementById('settings-panel-letters'),
    teleprompter: document.getElementById('settings-panel-teleprompter'),
    appearance: document.getElementById('settings-panel-appearance'),
    services: document.getElementById('settings-panel-services'),
    expert: document.getElementById('settings-panel-expert'),
  };

  function setSettingsTab(tabId) {
    const id = normalizeSettingsTab(tabId);
    try {
      sessionStorage.setItem('hh-settings-tab', id);
    } catch {
      /* ignore */
    }
    for (const btn of settingsTabBtns) {
      const on = btn.dataset.settingsTab === id;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const [key, panel] of Object.entries(settingsPanels)) {
      if (!panel) continue;
      const on = key === id;
      panel.classList.toggle('active', on);
      panel.hidden = !on;
    }
    if (isNarrowSettingsDialog()) {
      syncSettingsMobileShell('drill');
    } else {
      syncSettingsMobileShell(null);
    }
    updateSettingsShellLayoutClasses();
    settingsModalHooks?.onTabChange(id);
  }

  document.getElementById('settings-zone-back')?.addEventListener('click', () => {
    syncSettingsMobileShell('pick');
  });

  settingsTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSettingsTab(btn.dataset.settingsTab));
  });

  settingsTabSetter = setSettingsTab;
  settingsModalHooks = initSettingsModal({
    api,
    scheduleSaveSettings,
    flushSaveSettings,
    setSettingsTab,
    openLetterQualityHubModal,
    resetAppearanceSection: resetAppearanceSettingsSection,
    setSettingsHint,
    showToast,
    onScoreThresholdChange: (n) => {
      if (Number.isFinite(n) && n >= 0 && n <= 100) {
        scoreThreshold = n;
        updateScoreBandTabLabels();
      }
    },
    openServiceFromSettings: () => {
      if (!tryCloseSettingsModal()) return;
      closeSettingsModal();
      openServiceDrawer();
    },
    applyPreferencesResponse: (res) => {
      if (!res?.preferences) return;
      applyPreferencesToSettingsUI(res.preferences, prefBounds);
      applyDashboardUiFromPreferences(res.preferences, res.ui);
      if (res.applyRates) renderApplyRateMeters(res.applyRates);
      dispatchPrefsUpdated(res.preferences);
      settingsModalHooks?.syncDerivedState?.();
      invalidateLettersSnapshot();
    },
    hasCompletedBatch: () => (lastJobStatus?.batchLastReport?.done || 0) > 0,
    onOpenTab: (id) => {
      if (id === 'system') void refreshProfileSelect();
    },
  });
  syncSettingsMobileShell(isNarrowSettingsDialog() ? 'pick' : null);
  updateSettingsShellLayoutClasses({ mode: 'pick' });
  document.getElementById('btn-open-settings')?.addEventListener('click', () => openDashboardSettings());
  settingsModal?.querySelector('[data-close-settings]')?.addEventListener('click', closeSettingsModal);
  settingsModal?.querySelector('.modal-close--settings')?.addEventListener('click', closeSettingsModal);

  window.addEventListener('hh-show-toast', (ev) => {
    const d = ev.detail || {};
    if (d.message) showToast(String(d.message), d.variant || 'neutral');
  });

  window.addEventListener('hh-open-settings', (ev) => {
    const detail = ev.detail || {};
    const precheck = document.getElementById('batch-precheck-modal');
    if (precheck && !precheck.hidden) closeModalEl(precheck);
    const tab = detail.tab ? normalizeSettingsTab(detail.tab) : undefined;
    openDashboardSettings(tab, {
      focusId: detail.focus || '',
      focusToast: detail.focusToast || '',
      quietToast: Boolean(detail.quietToast),
      layout: detail.layout || '',
      clearUrl: false,
    });
  });

  initServiceDrawer();
  initLayoutSettingsUi();
  initWorkspaceDocks();
  initMobileShell({
    onDesktopRefresh: () => {
      window.dispatchEvent(new CustomEvent('hh-docks-refresh'));
    },
  });
  initWorkflowNav({
    getApplyView: () => currentApplyView,
    onApplyView: (view) => {
      applyViewTabsEl?.querySelector(`[data-apply-view="${view}"]`)?.click();
    },
    onQueueStatus: (status) => {
      vacancyTabsEl?.querySelector(`[data-status="${status}"]`)?.click();
    },
  });
}

function closeServiceDrawer() {
  const drawer = document.getElementById('service-drawer');
  if (!drawer) return;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
  drawer.classList.remove('service-drawer--open');
}

function openServiceDrawer() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal && !settingsModal.hidden) return;
  const drawer = document.getElementById('service-drawer');
  const panel = drawer?.querySelector('.service-drawer__panel');
  if (!drawer || !panel) return;
  void fillResumeRaiseRoleSelect();
  api('/api/resume-raise-schedule')
    .then(renderResumeRaiseScheduleStatus)
    .catch(() => {});
  api('/api/chat-follow-up-schedule')
    .then(renderChatFollowUpScheduleStatus)
    .catch(() => {});
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    drawer.classList.add('service-drawer--open');
    panel.focus();
    void refreshMarketSkillsPanel({ api });
  });
}

function initServiceDrawer() {
  const open = () => openServiceDrawer();
  document.getElementById('btn-open-service')?.addEventListener('click', open);
  document.querySelectorAll('[data-open-service]').forEach((el) => {
    el.addEventListener('click', open);
  });
  document.querySelectorAll('[data-close-service]').forEach((el) => {
    el.addEventListener('click', closeServiceDrawer);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeServiceDrawer();
  });
}

function openShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  modal.hidden = false;
  openModalEl(modal);
}

function initShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  document.getElementById('btn-open-shortcuts')?.addEventListener('click', openShortcutsModal);
  modal?.querySelectorAll('[data-close-shortcuts]').forEach((el) => {
    el.addEventListener('click', () => {
      modal.hidden = true;
      closeModalEl(modal);
    });
  });
}

function buildInterviewPaletteActions(hub) {
  return listInterviewHubPaletteTargets(hub).map((target) => ({
    id: `interview-hub-${target.id}`,
    group: 'Следить',
    label: interviewHubPaletteLabel(target),
    hint: target.kind === 'demo' ? 'Без hh.ru' : target.kind === 'offer' ? 'Корзина F' : 'Хаб собесов',
    keywords: `interview собес суфлёр слот ${target.title} ${target.company} ${target.kind}`,
    run: () => openInterviewHubModal(target.id),
  }));
}

function rebuildCommandPaletteActions() {
  registerCommandPaletteActions([
    ...commandPaletteStaticActions,
    ...buildInterviewPaletteActions(interviewHubCache),
  ]);
}

async function prefetchInterviewHubForPalette() {
  try {
    const hub = await api('/api/interview-hub');
    interviewHubCache = hub;
    rebuildCommandPaletteActions();
  } catch {
    /* дашборд без API — palette без динамики */
  }
}

function initCommandPaletteAndShortcuts() {
  const panelPaletteActions = Object.entries(SIDEBAR_PANELS)
    .filter(([id]) => id !== 'brand')
    .map(([id, meta]) => ({
      id: `panel-${id}`,
      group: 'Панели',
      label: `Панель: ${meta.label}`,
      hint: 'Показать в боковой колонке',
      keywords: `панель sidebar ${meta.label} ${id}`,
      run: () => enableSidebarPanel(id),
    }));

  commandPaletteStaticActions = [
    {
      id: 'harvest',
      group: 'Найти',
      label: COPY.harvestRun || 'Запустить поиск',
      hint: 'Поиск вакансий на hh.ru',
      keywords: 'поиск hh вакансии',
      run: () => document.getElementById('btn-run-harvest')?.click(),
    },
    {
      id: 'ingest-url',
      group: 'Найти',
      label: COPY.ingestUrl || 'Вставить ссылку',
      hint: 'Добавить вакансию по URL',
      keywords: 'ingest url habr ats ссылка',
      run: () => openIngestUrlModal(),
    },
    {
      id: 'harvest-habr',
      group: 'Найти',
      label: COPY.harvestHabr || 'Сбор с Хабра',
      hint: 'Внешние источники',
      keywords: 'хабр habr внешние сбор telegram',
      run: async () => {
        enableSidebarPanel('sources', { toast: false });
        const sel = document.getElementById('sources-external-target');
        if (sel) sel.value = 'habr';
        document.getElementById('btn-sources-external-run')?.click();
      },
    },
    {
      id: 'top-tier-a',
      group: 'Найти',
      label: 'Топ в списке',
      hint: 'Фильтр лучших вакансий',
      keywords: 'топ класс а top качество',
      run: () => setTierFilter('A'),
    },
    {
      id: 'intelligence-digest',
      group: 'Найти',
      label: COPY.intelligenceDigest || 'Сводка по источникам',
      hint: 'Статистика по источникам вакансий',
      keywords: 'intelligence digest источники сводка',
      run: () => document.getElementById('btn-open-intelligence-digest')?.click(),
    },
    {
      id: 'letter-issues',
      group: 'Разобрать',
      label: 'Фильтр: проблемы писем',
      hint: 'Только карточки с проверкой письма',
      keywords: 'письмо letter quality filter',
      run: () => toggleLetterIssuesFilter(),
    },
    {
      id: 'letter-hub',
      group: 'Разобрать',
      label: 'Качество писем — подробнее',
      keywords: 'письмо hub golden',
      run: () => openLetterQualityHubModal(),
    },
    {
      id: 'view-deferred',
      group: 'Разобрать',
      label: COPY.navDeferred || 'Отложенные',
      hint: 'Раздел списка',
      keywords: 'deferred отложенные',
      run: () => applyViewTabsEl?.querySelector('[data-apply-view="deferred"]')?.click(),
    },
    {
      id: 'band-low',
      group: 'Разобрать',
      label: COPY.tabBelowThreshold || 'Ниже порога',
      hint: 'Полоса оценки в списке',
      keywords: 'low band порог',
      run: () => document.querySelector('[data-band="low"]')?.click(),
    },
    {
      id: 'card-size-compact',
      group: 'Разобрать',
      label: 'Вид карточек: компактный',
      keywords: 'card size compact вид',
      run: () => applyCardSizePreset('compact'),
    },
    {
      id: 'card-size-medium',
      group: 'Разобрать',
      label: 'Вид карточек: средний',
      keywords: 'card size medium вид',
      run: () => applyCardSizePreset('medium'),
    },
    {
      id: 'card-size-full',
      group: 'Разобрать',
      label: 'Вид карточек: полный',
      keywords: 'card size full вид',
      run: () => applyCardSizePreset('full'),
    },
    {
      id: 'batch-auto',
      group: 'Откликнуться',
      label: COPY.batchAuto,
      hint: 'Серия ≥ порога',
      keywords: 'batch auto серия',
      run: () => document.getElementById('btn-batch-auto')?.click(),
    },
    {
      id: 'batch-manual',
      group: 'Откликнуться',
      label: COPY.batchManual || 'Ниже порога (разведка)',
      hint: 'Серия ниже порога',
      keywords: 'batch manual ручные',
      run: () => document.getElementById('btn-batch-manual')?.click(),
    },
    {
      id: 'daily-routine',
      group: 'Следить',
      label: 'Утренний цикл',
      hint: 'Синхронизация откликов и чатов',
      keywords: 'sync routine утро',
      run: () => document.getElementById('btn-daily-routine')?.click(),
    },
    {
      id: 'chat-inbox',
      group: 'Следить',
      label: 'Чаты hh.ru — inbox',
      hint: 'Ответы и черновики',
      keywords: 'chat inbox чаты переписка',
      run: () => void openChatInboxModal(),
    },
    {
      id: 'funnel',
      group: 'Следить',
      label: 'Воронка и конверсия',
      keywords: 'stats funnel график',
      run: () => openFunnelModal(),
    },
    {
      id: 'interview-hub',
      group: 'Следить',
      label: 'Хаб собеседований',
      hint: 'Слоты E, офферы, суфлёр',
      keywords: 'interview собес суфлёр слот приглашение',
      run: () => openInterviewHubModal(),
    },
    {
      id: 'interview-prompt',
      group: 'Следить',
      label: 'Суфлёр — последний',
      hint: 'Быстрый запуск сохранённых подсказок',
      keywords: 'teleprompter суфлёр prompt подсказки',
      run: () => openLastInterviewPrompt({ api, showToast }),
    },
    ...panelPaletteActions,
    {
      id: 'ui-mode-expert',
      group: 'Настройки',
      label: 'Расширенный интерфейс',
      hint: 'Все кнопки и панели на экране',
      keywords: 'expert ui режим',
      run: () => switchUiMode(UI_MODES.expert),
    },
    {
      id: 'ui-mode-simple',
      group: 'Настройки',
      label: 'Простой интерфейс',
      hint: 'Меньше элементов — функции через Ctrl+K',
      keywords: 'simple ui режим',
      run: () => switchUiMode(UI_MODES.simple),
    },
    {
      id: 'settings',
      group: 'Настройки',
      label: COPY.openSettings,
      keywords: 'настройки system preferences',
      run: () => openDashboardSettings('system'),
    },
    {
      id: 'settings-fullscreen',
      group: 'Настройки',
      label: 'Настройки: полный экран',
      hint: 'Alt+F в окне настроек',
      keywords: 'настройки fullscreen полноэкранный',
      run: () => {
        const m = document.getElementById('settings-modal');
        if (!m || m.hidden) openDashboardSettings('system', { layout: 'fullscreen' });
        else toggleSettingsModalFullscreen();
      },
    },
    {
      id: 'settings-wide',
      group: 'Настройки',
      label: 'Настройки: широкое окно',
      hint: 'Пресет для писем и таргетинга',
      keywords: 'настройки wide широкое окно layout',
      run: () => openDashboardSettings('letters', { layout: 'wide' }),
    },
    {
      id: 'settings-before-batch',
      group: 'Настройки',
      label: 'Настройки: перед батчем',
      hint: 'Письма и порог',
      keywords: 'батч письма пресет',
      run: () => openDashboardSettings('letters', { focusId: 'settings-letters-group' }),
    },
    {
      id: 'settings-targeting',
      group: 'Настройки',
      label: 'Настройки: таргетинг',
      keywords: 'настройки remote salary targeting',
      run: () => openDashboardSettings('targeting'),
    },
    {
      id: 'settings-letters',
      group: 'Настройки',
      label: 'Настройки: письма и батч',
      keywords: 'настройки letter quality batch precheck',
      run: () => openDashboardSettings('letters'),
    },
    {
      id: 'settings-apply',
      group: 'Настройки',
      label: 'Настройки: отклики и лимиты',
      keywords: 'настройки threshold batch limits',
      run: () => openDashboardSettings('apply'),
    },
    {
      id: 'settings-appearance',
      group: 'Настройки',
      label: 'Настройки: интерфейс',
      keywords: 'настройки theme layout panels',
      run: () => openDashboardSettings('appearance'),
    },
    {
      id: 'service',
      group: 'Настройки',
      label: COPY.openService,
      keywords: 'сервис sync',
      run: () => openServiceDrawer(),
    },
    {
      id: 'load-demo-queue',
      group: 'Справка',
      label: 'Загрузить демо-очередь',
      hint: '10 вакансий для знакомства с UI',
      keywords: 'demo демо очередь empty',
      run: () => void loadDemoQueue().catch((e) => showToast(e.message || String(e), 'bad')),
    },
    {
      id: 'log',
      group: 'Справка',
      label: COPY.openLog,
      keywords: 'журнал log',
      run: () => document.querySelector('.btn-log-apply')?.click(),
    },
    {
      id: 'shortcuts',
      group: 'Справка',
      label: 'Горячие клавиши',
      hint: '?',
      run: () => openShortcutsModal(),
    },
    {
      id: 'apply-e2e-playbook',
      group: 'Справка',
      label: COPY.applyE2ePlaybook || 'Сценарий отклика',
      hint: COPY.applyE2ePlaybookHint || 'Корзина → анкета → робот',
      keywords: 'корзина отклик анкета робот рекрутер playbook e2e ship',
      run: () => {
        window.open(COPY.applyE2ePlaybookUrl || '/apply-e2e-playbook.html', '_blank', 'noopener');
      },
    },
    {
      id: 'open-palette',
      group: 'Справка',
      label: COPY.allFeatures || 'Все функции',
      hint: 'Ctrl+K',
      keywords: 'palette команды поиск',
      run: () => openCommandPalette(),
    },
  ];

  rebuildCommandPaletteActions();
  void prefetchInterviewHubForPalette();

  initKeyboardShortcuts({
    openShortcutsHelp: openShortcutsModal,
    isDraftModalOpen: () => draftModalEl && !draftModalEl.hidden,
    onDraftApprove: () => draftModalState?.triggerApprove?.(),
    onDraftDecline: () => draftModalState?.triggerDecline?.(),
    onDraftSave: () => draftModalState?.triggerSave?.(),
    onDraftSelectVariant: (idx) => draftModalState?.selectVariant?.(idx),
    onDraftPrevVariant: () => {
      if (!draftModalState) return;
      const n = draftModalState.variants.length;
      draftModalState.selectVariant?.((draftModalState.selectedIndex + n - 1) % n);
    },
    onDraftNextVariant: () => {
      if (!draftModalState) return;
      const n = draftModalState.variants.length;
      draftModalState.selectVariant?.((draftModalState.selectedIndex + 1) % n);
    },
    onToggleLetterIssuesFilter: () => toggleLetterIssuesFilter(),
    onExportFocused: () => {
      const id = lastFocusedVacancyId;
      const item = id ? cachedRawItems.find((x) => x.id === id) : cachedRawItems[0];
      if (!item) {
        showToast('Выберите карточку в списке', 'neutral');
        return;
      }
      copyVacancyMarkdown(item)
        .then(() => showToast('Markdown в буфере', 'good'))
        .catch(() => {
          downloadVacancyMarkdown(item);
          showToast('Markdown сохранён', 'good');
        });
    },
  });
}

loadDailyRoutineSteps();
applyCopyToDom();
initServiceActions();
initChatInboxUi({ api, showToast });
initSourcesPanel({
  api,
  showToast,
  onFilterTier: setTierFilter,
  onFocusVacancy: focusVacancyCard,
  onOpenIngest: () => openIngestUrlModal(),
});
initIngestUrlModal({ api, showToast, onAdded: () => load() });
initIntelligencePanel({ api });
initMarketSkillsPanel({ api });
restoreFilterPresetFromStorage();
document.addEventListener('hh-open-chat-inbox', (e) => {
  const id = e.detail?.id;
  void openChatInboxModal({ threadId: id || undefined, filter: 'needs_reply' });
});
initFunnelUi();
initInterviewHubUi();
initInterviewPrompt({ api, showToast });
initJobProgressOpenLog();
document.getElementById('btn-batch-report')?.addEventListener('click', () => openBatchReportModal());
initCrmUi();
initBrandHardReload();
initLimitsStatusLink();
initShortcutsModal();
initAllFeaturesButton();
initCommandPaletteAndShortcuts();
initListKeyboardNav(listEl, () => [...listEl.querySelectorAll('.card, .card-tile')]);

configureCardPrimaryCta({
  enabled: () => {
    try {
      const p = JSON.parse(localStorage.getItem('hh-dashboard-prefs-cache') || '{}');
      if (p.cardPrimaryCta === false) return false;
    } catch {
      /* ignore */
    }
    return true;
  },
  onOpenLetter: (item) => openLetterModal(item),
  onApply: async (item, btn) => {
    btn.disabled = true;
    try {
      const res = await api('/api/hh-launch-apply-chat', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          usePoolLetter: true,
          tailorResume: true,
        }),
      });
      const pid = res.pid != null ? ` PID ${res.pid}.` : '';
      showToast(
        `Отклик запущен.${pid} Должно открыться окно Chromium — смотрите лог и панель прогресса.`,
        'good'
      );
      openApplyLogModal();
      startJobLogPoll();
      refreshJobStatus();
    } catch (e) {
      alert(e.message);
      btn.disabled = false;
    }
  },
});

loadDashboardSettings().then(() => {
  openDashboardSettingsFromUrl();
  initDashboardDeepLinks();
  void hydrateInstanceBadge();
  const isDesktop =
    document.documentElement.classList.contains('hh-desktop') ||
    /\bhh-desktop=1\b/.test(location.search || '');
  const focusInterview = new URLSearchParams(location.search).get('focus') === 'interview';
  // Desktop: не блокировать event loop тяжёлым /api/vacancies на старте
  // (иначе /api/health таймаутится → баннер «Дашборд не отвечает»).
  if (isDesktop || focusInterview) {
    clearDesktopHealthBanner();
    const listEl = document.getElementById('list') || document.getElementById('vacancy-list');
    if (listEl && !listEl.childElementCount) {
      listEl.innerHTML =
        '<p class="stats-placeholder" style="padding:1rem">Очередь не грузится автоматически в Desktop (чтобы не вешать дашборд). Нажмите «Обновить» в очереди, когда понадобится. Суфлёр — кнопка хаба собесов.</p>';
    }
    // Не вызываем load() и не открываем hub сразу — оба пути могут сканировать большую очередь
    return;
  }
  return load();
});
refreshJobStatus();
setInterval(refreshJobStatus, 2000);

const LLM_PROVIDER_EVENT_KEY = 'hh-llm-last-event';
let lastLlmProviderEventId = sessionStorage.getItem(LLM_PROVIDER_EVENT_KEY) || '';
let llmProviderPollReady = false;

async function pollLlmProviderStatus() {
  try {
    const st = await api('/api/llm/provider-status');
    const ev = st?.lastEvent;
    if (ev?.id) {
      if (llmProviderPollReady && ev.id !== lastLlmProviderEventId) {
        showToast(ev.message || 'LLM: переключён резервный провайдер', 'neutral', { durationMs: 6500 });
      }
      lastLlmProviderEventId = ev.id;
      sessionStorage.setItem(LLM_PROVIDER_EVENT_KEY, ev.id);
      llmProviderPollReady = true;
    } else if (!llmProviderPollReady) {
      llmProviderPollReady = true;
    }
  } catch {
    /* фоновый poll */
  }
}

void pollLlmProviderStatus();
setInterval(() => void pollLlmProviderStatus(), 12000);

probeBatchControlApi();
