import { vacancyMatchesSearch } from './vacancy-search.mjs';
import { bucketTimelineForDisplay, renderFunnelTimelineHtml } from './funnel-timeline.mjs';
import { initFloatingTooltips } from './tooltips.mjs';
import { initModalLayer, openModalEl, closeModalEl } from './modals.mjs';
import { initUiScaleControls } from './ui-scale.mjs';
import { initThemeControls } from './ui-theme.mjs';
import { initCardTuningControls, normalizeCardLayout } from './ui-card-tuning.mjs';
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
  defaultPanelsForMode,
  defaultPanelSides,
  normalizePanelSides,
  panelSideFor,
} from './dashboard-ux.mjs';
import { initSidebarBuilder, renderSidebarBuilder } from './ui-sidebar-builder.mjs';
import { initMobileShell, isMobileViewport } from './ui-mobile.mjs';
import {
  initWorkspaceDocks,
  loadDockState,
  applyDockState,
  syncDockMiniActiveView,
} from './workspace-docks.mjs';
import { renderCardTile, currentBrowseMode } from './card-tiles.mjs';
import { renderDailySparklineHtml } from './daily-sparkline.mjs';
import { copyVacancyMarkdown, downloadVacancyMarkdown } from './vacancy-export.mjs';
import {
  registerCommandPaletteActions,
  openCommandPalette,
  closeCommandPalette,
} from './command-palette.mjs';
import { initKeyboardShortcuts } from './keyboard-shortcuts.mjs';
import { buildListBreadcrumbItems, mountListBreadcrumbs } from './list-breadcrumbs.mjs';
import { initListKeyboardNav } from './list-keyboard-nav.mjs';
import { renderStatusChips } from './card-status.mjs';
import { applyCopyToDom, syncFullscreenIcon } from './apply-copy-dom.mjs';
import { initWorkflowNav } from './ui-workflow.mjs';
import {
  closeVacancyDetail,
  configureVacancyDetailNav,
  initVacancyDetailModal,
} from './vacancy-detail.mjs';

const listEl = document.getElementById('list');
const tpl = document.getElementById('card-tpl');

const vacancyTabsEl = document.querySelector('.vacancy-tabs');
const applyViewTabsEl = document.querySelector('.apply-view-tabs');
const filterSearchEl = document.getElementById('filter-search');
const filterCompanyEl = document.getElementById('filter-company');
const filterMinScoreEl = document.getElementById('filter-min-score');
const filterSortEl = document.getElementById('filter-sort');
const filterSalaryEl = document.getElementById('filter-salary');
const scoreThresholdInputEl = document.getElementById('score-threshold-input');
const batchLimitEl = document.getElementById('batch-limit');
const prefMaxHourEl = document.getElementById('pref-max-hour');
const prefMaxDayEl = document.getElementById('pref-max-day');
const prefMaxMonthEl = document.getElementById('pref-max-month');
const settingsProfileSelectEl = document.getElementById('settings-profile-select');
const settingsProfileQueueHintEl = document.getElementById('settings-profile-queue-hint');
const settingsSaveHintEl = document.getElementById('settings-save-hint');
const applyRateMetersEl = document.getElementById('apply-rate-meters');

/** @type {((tabId: string) => void) | null} */
let settingsTabSetter = null;

let currentStatus = 'pending';
let currentApplyView = 'queue';
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
/** @type {{ uiMode: string, sidebarMode: string, panels: Record<string, boolean>, panelOrder: string[], panelSides: Record<string, string> }} */
let dashboardUi = {
  uiMode: UI_MODES.simple,
  sidebarMode: 'compact',
  panels: defaultPanelsForMode(UI_MODES.simple),
  panelOrder: [...SIDEBAR_PANEL_ORDER_DEFAULT],
  panelSides: defaultPanelSides(),
};
let layoutSettingsHydrated = false;

const DASHBOARD_LAYOUT_LS_KEY = 'hh-dashboard-sidebar-layout-v1';

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
let lastHarvestTickSeq = 0;
let applyLogPollTimer = null;
let applyChatWasRunning = false;
let harvestWasRunning = false;
let batchWasRunning = false;
let syncResponsesWasRunning = false;
let resumeRaiseWasRunning = false;
let syncChatsWasRunning = false;
let dailyRoutineWasRunning = false;
let cachedRawItems = [];
let cachedCounts = null;
/** Открыть первую анкету после перехода на вкладку «Анкета». */
let openQuestionnaireOnNextLoad = false;
const AUTO_REPROBE_COOLDOWN_MS = 30 * 60 * 1000;
const AUTO_REPROBE_LS_KEY = 'hh-dashboard-auto-reprobe-ts';
let autoReprobeInFlight = false;
let questionnaireReprobeCandidateCount = 0;

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function readFiltersFromUI() {
  return {
    search: (filterSearchEl?.value || '').trim(),
    company: (filterCompanyEl?.value || '').trim(),
    minScore: filterMinScoreEl?.value?.trim() ?? '',
    sort: filterSortEl?.value || 'score-desc',
    onlySalary: Boolean(filterSalaryEl?.checked),
  };
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
  const labels = {
    invited: 'Приглашение на hh.ru',
    declined: 'Отказ на hh.ru',
    already_applied: 'Отклик уже на hh.ru',
    viewed: 'Резюме просмотрели',
    awaiting: 'Ждём ответа',
    archived: 'Вакансия в архиве',
    unavailable: 'Отклик недоступен',
  };
  const label = h.hhSiteStateLabel || labels[st] || st;
  const when = h.hhSiteStateAt
    ? new Date(h.hhSiteStateAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return when ? `${label} · ${when}` : label;
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
  await loadItems();
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

function applyClientFilters(items, filters) {
  let out = filterItemsForApplyView([...items]);
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
  if (filters.onlySalary) {
    out = out.filter((it) => it.salaryEstimate?.ok);
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
  const rows = [
    { key: 'hour', label: 'ч', used: rates.lastHour, max: rates.maxPerHour },
    { key: 'day', label: 'сут', used: rates.lastDay, max: rates.maxPerDay },
    { key: 'month', label: '30д', used: rates.lastMonth, max: rates.maxPerMonth },
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
  setNum(batchLimitEl, 'dashboardBatchSize', 10);
  setNum(prefMaxHourEl, 'hhApplyChatMaxPerHour', 50);
  setNum(prefMaxDayEl, 'hhApplyChatMaxPerDay', 1000);
  setNum(prefMaxMonthEl, 'hhApplyChatMaxPerMonth', 5000);
  const defMin = Number(p.dashboardMinScoreFilter);
  if (Number.isFinite(defMin) && defMin >= 0) scoreThreshold = defMin;
  const batchN = Number(p.dashboardBatchSize);
  batchSizeCap = Number.isFinite(batchN) && batchN >= 1 ? Math.min(1000, batchN) : 1000;
  if (batchLimitEl && prefBounds.dashboardBatchSize) {
    batchLimitEl.max = String(prefBounds.dashboardBatchSize.max);
  }
  updateScoreBandTabLabels();
  settingsHydrated = true;
}

function applyProfileOptionsToSettingsUI(data) {
  if (!settingsProfileSelectEl || !data?.profiles?.length) return;
  const active = String(data.activeProfile || '').trim();
  settingsProfileSelectEl.replaceChildren(
    ...data.profiles.map((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label || p.id;
      if (p.id === active) opt.selected = true;
      return opt;
    })
  );
  if (settingsProfileQueueHintEl) {
    settingsProfileQueueHintEl.textContent = data.queuePath
      ? `Очередь: ${data.queuePath}`
      : 'Очередь по умолчанию';
  }
  profileOptionsLoaded = true;
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
  applySidebarPanelVisibility();
  reorderSidebarPanels();
  renderSidebarBuilder();
  syncLayoutPresetButtons();
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

function applySidebarPanelVisibility() {
  const { panels, uiMode } = dashboardUi;
  document.querySelectorAll('.sidebar-panel[data-panel]').forEach((el) => {
    const id = el.dataset.panel;
    if (!id) return;
    const visible = panels[id] !== false;
    el.dataset.panelHidden = visible ? '0' : '1';
    el.hidden = !visible;
  });
  syncDockSectionShells();
}

/** v4: секция dock-section — оболочка с заголовком; панель должна оставаться внутри. */
function dockSectionHostForPanel(el) {
  if (!el?.closest('#sidebar-scroll')) return el;
  const section = el.closest('.dock-section');
  if (section?.closest('#sidebar-scroll')) return section;
  return el;
}

/** Скрыть пустые оболочки, если все вложенные панели выключены. */
function syncDockSectionShells() {
  document.querySelectorAll('#sidebar-scroll .dock-section').forEach((section) => {
    if (section.dataset.panel) return;
    const innerPanels = section.querySelectorAll('.sidebar-panel[data-panel]');
    if (!innerPanels.length) return;
    const anyVisible = [...innerPanels].some(
      (p) => p.dataset.panelHidden !== '1' && !p.hidden
    );
    section.hidden = !anyVisible;
  });
}

function reorderSidebarPanels() {
  const scroll = document.getElementById('sidebar-scroll');
  const rightBody = document.querySelector('#dock-right .dock__body');
  const footer = document.querySelector('#dock-right .sidebar-footer');
  if (!scroll || !rightBody) return;
  const order = dashboardUi.panelOrder || SIDEBAR_PANEL_ORDER_DEFAULT;
  const panels = [...document.querySelectorAll('.sidebar-panel[data-panel]')];
  const byId = Object.fromEntries(panels.map((el) => [el.dataset.panel, el]));

  const placedLeft = new Set();
  for (const id of order) {
    if (panelSideFor(dashboardUi, id) !== 'left' || id === 'brand') continue;
    if (dashboardUi.panels[id] === false) continue;
    const el = byId[id];
    if (!el) continue;
    const host = dockSectionHostForPanel(el);
    if (placedLeft.has(host)) continue;
    placedLeft.add(host);
    scroll.appendChild(host);
  }
  syncDockSectionShells();

  for (const id of order) {
    if (panelSideFor(dashboardUi, id) !== 'right') continue;
    if (id === 'jobFooter') continue;
    if (dashboardUi.panels[id] === false) continue;
    const el = byId[id];
    if (!el) continue;
    rightBody.insertBefore(el, footer?.parentElement === rightBody ? footer : null);
  }
  if (
    footer &&
    dashboardUi.panels.jobFooter !== false &&
    panelSideFor(dashboardUi, 'jobFooter') === 'right'
  ) {
    rightBody.appendChild(footer);
  }
}

function initSidebarBuilderHooks() {
  initSidebarBuilder({
    getUi: () => dashboardUi,
    patchUi: (partial) => {
      dashboardUi = { ...dashboardUi, ...partial };
      if (partial.panels) applySidebarPanelVisibility();
      if (partial.panelOrder || partial.panelSides) {
        reorderSidebarPanels();
        renderSidebarBuilder();
      }
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
    panelSides: defaultPanelSides(),
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

const scheduleSaveLayoutSettings = debounce(() => {
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
      flashSettingsSaved();
    })
    .catch((e) => {
      setSettingsHint(e.message || 'Ошибка сохранения интерфейса', 'err');
    });
}, 600);

function readSettingsPatchFromUI() {
  /** @type {Record<string, number>} */
  const patch = {};
  for (const el of document.querySelectorAll('[data-pref]')) {
    const key = el.dataset.pref;
    if (!key) continue;
    const n = Number(el.value);
    if (Number.isFinite(n)) patch[key] = n;
  }
  return { ...patch, ...readLayoutPatchFromUI() };
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
  settingsSaveHintEl.classList.remove('settings-hint--saved', 'settings-hint--err');
  if (variant) settingsSaveHintEl.classList.add(`settings-hint--${variant}`);
}

function flashSettingsSaved() {
  setSettingsHint('Сохранено', 'saved');
  settingsHintClearTimer = setTimeout(() => {
    settingsHintClearTimer = null;
    if (settingsSaveHintEl?.textContent === 'Сохранено') setSettingsHint('');
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

async function patchPreferencesApi(patch) {
  const body = JSON.stringify({ patch });
  const tries = [
    () => api('/api/preferences/save', { method: 'POST', body }),
    () => api('/api/preferences', { method: 'POST', body }),
    () => api('/api/preferences', { method: 'PATCH', body }),
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

async function saveSettingsFromUI() {
  if (preferencesSaveAvailable === false) {
    setSettingsHint('Перезапустите дашборд: npm run devops:dashboard, затем F5', 'err');
    return;
  }
  const patch = readSettingsPatchFromUI();
  try {
    const res = await patchPreferencesApi(patch);
    const prefs = { ...(res.preferences || {}) };
    const uiFromApi = res.ui ? { ...res.ui } : {};
    if (!prefs.dashboardSidebarPanelSides && patch.dashboardSidebarPanelSides) {
      prefs.dashboardSidebarPanelSides = patch.dashboardSidebarPanelSides;
    }
    if (!uiFromApi.panelSides && patch.dashboardSidebarPanelSides) {
      uiFromApi.panelSides = patch.dashboardSidebarPanelSides;
    }
    if (res.preferences) applyPreferencesToSettingsUI(res.preferences, prefBounds);
    applyDashboardUiFromPreferences(prefs, res.ui ? uiFromApi : undefined);
    if (res.applyRates) renderApplyRateMeters(res.applyRates);
    flashSettingsSaved();
    if (currentScoreBand !== 'all') load({ preserveScroll: true });
  } catch (e) {
    const hint =
      e.status === 404
        ? 'Сервер без сохранения лимитов — перезапустите: npm run devops:dashboard, затем F5'
        : e.message || 'Ошибка сохранения';
    setSettingsHint(hint, 'err');
  }
}

const scheduleSaveSettings = debounce(() => {
  if (!settingsHydrated || preferencesSaveAvailable === false) return;
  saveSettingsFromUI();
}, 500);

function getBatchLimitForRun() {
  const cap = Number(batchLimitEl?.max) || batchSizeCap || 100;
  return Math.min(cap, Math.max(1, Number(batchLimitEl?.value) || 10));
}

async function loadDashboardSettings() {
  try {
    const data = await api('/api/preferences');
    const fromGet = data.apiFeatures?.preferencesSave === true;
    preferencesSaveAvailable = fromGet || (await probePreferencesSaveApi());
    applyPreferencesToSettingsUI(data.preferences, data.bounds);
    applyDashboardUiFromPreferences(data.preferences, data.ui);
    if (data.applyRates) renderApplyRateMeters(data.applyRates);
    applyProfileOptionsToSettingsUI(data);
    if (!preferencesSaveAvailable) {
      setSettingsHint('Сохранение недоступно — перезапустите дашборд (npm run devops:dashboard)', 'err');
    }
  } catch {
    settingsHydrated = true;
    preferencesSaveAvailable = false;
  }
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
  const topAuto = document.getElementById('btn-top-batch-auto');
  if (topAuto) topAuto.textContent = `${COPY.batchAuto} (≥${t})`;
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

function itemPassesRoleFilters(item) {
  return !itemLooksSeniorOrLead(item) && !itemLooks1CRole(item);
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
  else if (h.hhSiteState === 'already_applied') parts.push('отклик на hh.ru');
  if (h.letterDelivered) parts.push('письмо доставлено');
  else if (h.letterInForm) parts.push('письмо в форме');
  else if (h.chatSent) parts.push('письмо в чате');
  else if (h.responseSubmitted) parts.push('отклик без письма');
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

function showToast(message, variant = 'neutral') {
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
  setTimeout(hide, 2600);
}

function formatFetchError(err, path) {
  const msg = err?.message || String(err);
  if (msg === 'Failed to fetch' || /failed to fetch/i.test(msg)) {
    return (
      'Нет связи с дашбордом. Запустите в терминале: npm run dashboard\n' +
      'и откройте http://127.0.0.1:3849 (не file://).'
    );
  }
  if (/loadDevOpsEnv|ReferenceError/i.test(msg)) {
    return 'Ошибка сервера при запуске поиска — обновите код и перезапустите npm run dashboard';
  }
  return msg;
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
    const e = new Error(formatFetchError(err, path));
    e.cause = err;
    throw e;
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const looksHtml = /^\s*</.test(text);
    const hint =
      r.status === 404 && (text.trim() === 'Not found' || looksHtml)
        ? 'Ответ не JSON (часто 404 у статики). Запустите дашборд: npm run dashboard и откройте http://127.0.0.1:3849'
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

function closeTopModal() {
  const service = document.getElementById('service-drawer');
  if (service && !service.hidden) {
    closeServiceDrawer();
    return true;
  }
  const vacancyDetail = document.getElementById('vacancy-detail-modal');
  if (vacancyDetail && !vacancyDetail.hidden) {
    closeVacancyDetail();
    return true;
  }
  const settings = document.getElementById('settings-modal');
  if (settings && !settings.hidden) {
    closeModalEl(settings);
    return true;
  }
  const funnel = document.getElementById('funnel-modal');
  if (funnel && !funnel.hidden) {
    closeFunnelModal();
    return true;
  }
  const questionnaire = document.getElementById('questionnaire-modal');
  if (questionnaire && !questionnaire.hidden) {
    closeQuestionnaireModal();
    return true;
  }
  const approved = document.getElementById('approved-letter-modal');
  if (approved && !approved.hidden) {
    closeApprovedLetterModal();
    return true;
  }
  const log = document.getElementById('apply-log-modal');
  if (log && !log.hidden) {
    closeApplyLogModal();
    return true;
  }
  const shortcuts = document.getElementById('shortcuts-modal');
  if (shortcuts && !shortcuts.hidden) {
    closeModalEl(shortcuts);
    return true;
  }
  const draft = document.getElementById('draft-modal');
  if (draft && !draft.hidden) {
    closeDraftModal();
    return true;
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
  if (modalId === 'approved-letter-modal') {
    closeApprovedLetterModal();
    return true;
  }
  if (modalId === 'questionnaire-modal') {
    closeQuestionnaireModal();
    return true;
  }
  if (modalId === 'settings-modal') {
    const m = document.getElementById('settings-modal');
    if (m && !m.hidden) {
      closeModalEl(m);
      return true;
    }
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
  return closeTopModal();
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
    summaryEl.innerHTML = `<p class="batch-report-meta">Завершено ${escapeHtml(when)} · раздел: ${escapeHtml(batchScopeLabel(report.batchScope) || report.batchScope || '—')}</p>`;
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
  if (skipsSec && skipsList) {
    if (skipEntries.length) {
      skipsSec.hidden = false;
      skipsList.replaceChildren(
        ...skipEntries.map(([reason, count]) => {
          const li = document.createElement('li');
          li.textContent = `${reason} — ${count}`;
          return li;
        })
      );
    } else {
      skipsSec.hidden = true;
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

function normalizeSettingsTab(tabId) {
  const t = String(tabId || 'apply').trim();
  if (t === 'list' || t === 'ui') return 'appearance';
  return t === 'appearance' || t === 'apply' ? t : 'apply';
}

function initOnboardingPanel(st) {
  const panel = document.getElementById('onboarding-panel');
  const stepsEl = document.getElementById('onboarding-steps');
  if (!panel || !stepsEl) return;
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
      text: COPY.onboardingStepHarvest,
      cta: COPY.onboardingCtaHarvest,
      action: 'harvest',
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
      openDashboardSettings('apply', { focusId: 'settings-profile-card' });
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
    default:
      break;
  }
}

function renderEmptyState(message, actions = []) {
  const wrap = document.createElement('div');
  wrap.className = 'empty empty--actions';
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

function openApprovedLetterModal(item) {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  const text = String(item.coverLetter?.approvedText || '').trim();
  modal.querySelector('.modal-vacancy-approved').textContent = item.title || item.url || '';
  modal.querySelector('.modal-approved-text').textContent = text;
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
  const vacEl = modal.querySelector('.modal-vacancy');
  const titleEl = modal.querySelector('#draft-modal-title');
  if (titleEl) titleEl.textContent = COPY.draftTitle || 'Черновик письма';
  vacEl.textContent = item.title || item.url || '';
  body.innerHTML = '';

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

  variants.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seg-btn tab draft-variant-tab${i === 0 ? ' active' : ''}`;
    btn.dataset.variantIndex = String(i);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.title = draftVariantPreview(text, 200);
    btn.textContent = draftVariantLetter(i);
    tabs.appendChild(btn);
  });

  picker.appendChild(tabs);
  picker.appendChild(preview);
  if (variants.length > 1) picker.appendChild(hint);

  const lbl = document.createElement('label');
  lbl.className = 'modal-letter-label';
  lbl.htmlFor = `draft-v-${item.id}-edit`;
  lbl.textContent = COPY.draftLetterLabel;

  const ta = document.createElement('textarea');
  ta.className = 'modal-letter-edit';
  ta.id = `draft-v-${item.id}-edit`;
  ta.rows = 12;
  ta.value = variants[0] || '';

  const actions = document.createElement('div');
  actions.className = 'modal-draft-actions';

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

  actions.append(btnSave, btnApprove, btnDecline);
  body.append(picker, lbl, ta, actions);

  draftModalState = { id: item.id, variants, selectedIndex: 0 };

  function updatePreview() {
    preview.textContent = draftVariantPreview(ta.value);
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
      await load();
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
    showToast(e.message || String(e), 'bad');
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
    showToast(e.message || 'Ошибка сохранения', 'bad');
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
  dismissBtn.addEventListener('click', async () => {
    if (!confirm('Удалить эту запись из очереди? (без «подходит / не подходит»)')) return;
    dismissBtn.disabled = true;
    try {
      await api('/api/dismiss', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      });
      showToast('Запись удалена из очереди', 'neutral');
      await load();
    } catch (e) {
      alert(e.message);
      dismissBtn.disabled = false;
    }
  });
}

function scoreOf(item) {
  return Number(item.scoreOverall ?? item.geminiScore ?? 0) || 0;
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
  const overall = item.scoreOverall ?? item.geminiScore;
  const displayOverall = overall != null && overall !== '' ? String(overall) : '—';
  scoreEl.textContent = displayOverall;
  scoreEl.setAttribute(
    'aria-label',
    displayOverall === '—'
      ? 'Нет скора'
      : `Итоговый балл ${displayOverall}, наведи для расшифровки`
  );

  const tooltip = node.querySelector('.score-tooltip');
  const wv = scoreWeights.vacancy;
  const wc = scoreWeights.cvMatch;
  const sv = item.scoreVacancy;
  const scm = item.scoreCvMatch;
  const so = item.scoreOverall ?? item.geminiScore;
  if (Number.isFinite(Number(sv)) && Number.isFinite(Number(scm))) {
    tooltip.innerHTML = [
      '<strong>Вакансия</strong> (оценка модели): ',
      String(sv),
      '<br><strong>Сходство с твоими CV</strong>: ',
      String(scm),
      '<br><strong>Итог на карточке</strong>: ',
      so != null && so !== '' ? String(so) : '—',
      '<br><br>Если модель не вернула свой <code>scoreOverall</code>, итог считается как ',
      `<code>${wv.toFixed(2)}×</code>вакансия + <code>${wc.toFixed(2)}×</code>CV (веса из preferences.json).`,
    ].join('');
  } else {
    tooltip.textContent =
      'Нет разбивки по компонентам. Добавь записи через npm run harvest с включённым LLM (без --skip-llm).';
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

  const cardLayout = inModal
    ? 'expanded'
    : normalizeCardLayout(document.documentElement.dataset.cardLayout || 'expanded');
  const density =
    options.forceDensity ?? (cardLayout === 'tile-medium' ? 'medium' : readCardDensityMode());
  node.classList.add(`card--density-${density}`);
  if (inModal) {
    node.classList.add('card--in-modal', 'card--layout-expanded');
  } else if (cardLayout === 'tile-medium') {
    node.classList.add('card--layout-medium');
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
    if (item.targeting?.eligible === false) {
      metaParts.push(`⚠ ${item.targeting.skipReason || 'нецелевая'}`);
      node.classList.add('card--off-target');
    }
    metaCompact.textContent = metaParts.join(' · ');
  }

  renderStatusChips(node.querySelector('.card-status-chips'), item);

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
    !vacancyHasHhApply(item) &&
    item?.hhApply?.hhSiteState &&
    item.hhApply.hhSiteState !== 'none';
  if (siteBadge && siteOnly) {
    siteBadge.hidden = false;
    siteBadge.textContent = hhSiteStateBadgeText(item);
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
        await requestCoverLetterGenerate(item.id, false);
        showToast('Новые варианты готовы', 'good');
        await load();
      } catch (e) {
        if (e.status === 409) {
          const ok = confirm(
            'Уже есть утверждённое письмо. Пересоздать и заменить черновиком?'
          );
          if (ok) {
            try {
              await requestCoverLetterGenerate(item.id, true);
              showToast('Новые варианты готовы', 'good');
              await load();
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

  if (cl?.status === 'approved' && String(cl?.approvedText || '').trim()) {
    viewLetterBtn.hidden = false;
    viewLetterBtn.addEventListener('click', () => openApprovedLetterModal(item));
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

  if (approvedLetter) {
    applyChatBtn.disabled = false;
    applyChatBtn.removeAttribute('title');
    applyChatBtn.addEventListener('click', () =>
      launchApply(applyChatBtn, { usePoolLetter: false, tailorResume: true })
    );
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

  if (item.status === 'pending') {
    actions.hidden = false;
    const ta = actions.querySelector('.reason');
    const ok = actions.querySelector('.ok');
    const bad = actions.querySelector('.bad');
    const coverBtn = actions.querySelector('.btn-cover');
    const refreshBtn = actions.querySelector('.btn-refresh-vacancy');

    if (coverBtn) {
      coverBtn.addEventListener('click', async () => {
      coverBtn.disabled = true;
      if (refreshBtn) refreshBtn.disabled = true;
      try {
        await requestCoverLetterGenerate(item.id, false);
        showToast('Сгенерированы варианты сопроводительного', 'good');
        await load();
      } catch (e) {
        if (e.status === 409) {
          const confirmed = confirm(
            'Письмо уже утверждено. Пересоздать черновик? (утверждённый текст будет сброшен до нового согласования)'
          );
          if (confirmed) {
            try {
              await requestCoverLetterGenerate(item.id, true);
              showToast('Новые варианты готовы', 'good');
              await load();
            } catch (e2) {
              alert(e2.message);
            }
          }
        } else {
          alert(e.message);
        }
      } finally {
        coverBtn.disabled = false;
        if (refreshBtn) refreshBtn.disabled = false;
      }
    });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      if (coverBtn) coverBtn.disabled = true;
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
        if (coverBtn) coverBtn.disabled = false;
        if (ok) ok.disabled = false;
        if (bad) bad.disabled = false;
      }
    });
    }

    const send = async (action) => {
      if (ok) ok.disabled = true;
      if (bad) bad.disabled = true;
      try {
        const data = await api('/api/action', {
          method: 'POST',
          body: JSON.stringify({
            id: item.id,
            action,
            reason: ta.value.trim(),
          }),
        });
        if (action === 'approve') {
          showToast('Сохранено: подходит', 'good');
        } else {
          const n = Array.isArray(data?.autoRejected) ? data.autoRejected.length : 0;
          if (n > 0) {
            showToast(`Отклонено + ещё ${n} похожих («${ta.value.trim()}»)`, 'bad');
          } else {
            showToast('Сохранено: не подходит', 'bad');
          }
        }
        await load({ preserveScroll: true, anchorCardId: item.id });
      } catch (e) {
        alert(e.message);
        if (ok) ok.disabled = false;
        if (bad) bad.disabled = false;
      }
    };
    ok?.addEventListener('click', () => send('approve'));
    bad?.addEventListener('click', () => send('reject'));
  } else {
    doneReason.textContent = item.feedbackReason
      ? `Комментарий: ${item.feedbackReason}`
      : '';
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
  if (!chat || chat.phase === 'done' || chat.phase === 'error') return batch;
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
  if (st.applyChatProgress?.phase === 'done' || st.applyChatProgress?.phase === 'error') {
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
  box.classList.toggle('job-progress--done', p.phase === 'done');
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
    parts.push(
      `Резюме: ${rh.issues.map((i) => i.label).join(', ')} — hash в config/resume-routing.json`
    );
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
  const row = document.getElementById('job-control-row');
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

function formatHumanJobStatus(st) {
  const bc = st.batchControl || {};
  const batchAlive = Boolean(st.batchActive ?? st.batch?.running ?? bc.batchRunning);
  const msgs = [];

  if (st.harvest?.running) {
    const hp = st.harvestProgress;
    const hc = st.harvestControl || {};
    if (hc.command === 'paused') {
      msgs.push(hp?.label?.trim() || `${COPY.harvest} на паузе`);
    } else {
      msgs.push(hp?.label?.trim() || 'Собираем вакансии с hh.ru…');
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
      const fromProgress = bp?.label?.trim();
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
    msgs.push(ap?.label?.trim() || 'Отклик в браузере…');
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

  if (st.harvestLog?.lastError && !st.harvest?.running) {
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
  if (st.queuePath) lines.push(`Файл очереди: ${st.queuePath}`);
  if (st.browserLock?.held) lines.push(`Блокировка браузера: ${st.browserLock.owner}`);
  if (st.harvestLog?.lastError && !st.harvest?.running) {
    lines.push(`Ошибка сбора: ${st.harvestLog.lastError}`);
  }
  const tail = st.harvestLog?.tail?.trim();
  if (tail) lines.push('', tail);
  if (!lines.length && msgs.length) return '';
  return lines.join('\n');
}

function formatHarvestStatsLine(h) {
  if (!h) return '';
  if (h.message) return h.message;
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
  const inQueue =
    stats.byStatus != null ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—';
  const steps = [
    { label: 'Очередь', count: inQueue, w: Math.min(100, (Number(inQueue) / Math.max(applied, 1)) * 100) },
    { label: 'Откл.', count: applied, w: (applied / max) * 100 },
    { label: 'Просм.', count: viewed, w: (viewed / max) * 100 },
    { label: 'Пригл.', count: invited, w: (invited / max) * 100 },
  ];
  el.hidden = false;
  const hhExtra = onHh > applied ? ` · hh ${onHh}` : '';
  const sparkline = renderDailySparklineHtml(stats.applyTimelineLast7 || []);
  el.innerHTML = `
    ${sparkline}
    <div class="funnel-mini__rates">${sinceLabel}: ${applied} откл.${hhExtra} · ${viewPct}% просм. · ${invitePct}% пригл. · ждём ${awaiting} · отказ ${declined}</div>
    <div class="funnel-mini__bars">
      ${steps
        .map(
          (s) =>
            `<div class="funnel-mini__step" title="${s.label}: ${s.count}">
              <span class="funnel-mini__bar" style="width:${Math.max(4, s.w)}%"></span>
              <span class="funnel-mini__num">${s.count}</span>
            </div>`
        )
        .join('')}
    </div>`;
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
        data.harvestLast.message || '—'
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
  const f = stats.funnel || {};
  if (panel) panel.hidden = false;
  renderFunnelMini(stats);
  const compact = panel?.classList.contains('stats-panel--crm');
  const invitePct = f.inviteRatePct ?? stats.rates?.invitePct ?? 0;
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
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
  grid.replaceChildren(
    ...items.map((it) => {
      const div = document.createElement('div');
      div.className = `stat-item${it.wide ? ' stat-item--wide' : ''}`;
      if (it.title) div.title = it.title;
      const val = document.createElement('span');
      val.className = `stat-value${it.highlight ? ' stat-highlight' : ''}`;
      val.textContent = String(it.value);
      const lab = document.createElement('span');
      lab.className = 'stat-label';
      lab.textContent = it.label;
      div.append(val, lab);
      return div;
    })
  );

  const extraEl = document.getElementById('stats-extra');
  if (extraEl) {
    const extra = formatDashboardStatsExtra(stats);
    if (extra) {
      extraEl.textContent = extra;
      extraEl.hidden = false;
    } else {
      extraEl.textContent = '';
      extraEl.hidden = true;
    }
  }
}

async function refreshJobStatus() {
  const el = document.getElementById('job-status');
  if (!el) return;
  try {
    const st = await api('/api/job-status');
    lastJobStatus = st;
    renderJobProgress(st);
    updateJobControlButtons(st);
    renderApplyLogInsights(applyLogPreEl()?.dataset.logContent || '', st);
    if (st.harvestTick?.sequence > lastHarvestTickSeq) {
      lastHarvestTickSeq = st.harvestTick.sequence;
      load();
    }
    const { main, msgs } = formatHumanJobStatus(st);
    if (st.applyRates) renderApplyRateMeters(st.applyRates);
    renderDashboardStats(st.dashboardStats || st.conversion);
    initOnboardingPanel(st);
    el.textContent = main;
    el.title = formatJobStatusTooltip(st, { msgs });
    el.classList.toggle('job-status--busy', msgs.length > 0);
    el.classList.toggle('job-status--warn', Boolean(st.harvestLog?.lastError && !st.harvest?.running));

    if (applyChatWasRunning && !st.applyChat?.running) {
      const phase = st.applyChatProgress?.phase;
      await load();
      if (phase === 'done') {
        const msg =
          currentApplyView === 'applied'
            ? 'Отклик отправлен, список обновлён'
            : 'Отклик отправлен — карточка в разделе «Отклики»';
        showToast(msg, 'good');
      } else if (phase === 'error') {
        showToast('Отклик завершился с ошибкой — см. журнал', 'neutral');
      }
    }
    applyChatWasRunning = Boolean(st.applyChat?.running);

    if (harvestWasRunning && !st.harvest?.running) {
      const hp = st.harvestProgress;
      const msg = hp?.stats?.message || hp?.label || 'Сбор завершён';
      const added = hp?.stats?.added;
      const kind = added > 0 ? 'good' : 'neutral';
      const toastText =
        typeof added === 'number' && added > 0 ? `${msg} (+${added})` : msg;
      showToast(toastText, kind);
      void load();
    }
    harvestWasRunning = Boolean(st.harvest?.running);

    const batchAlive = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
    if (batchWasRunning && !batchAlive) {
      const br = st.batchLastReport;
      const bc = st.batchControl || {};
      const skipped = br?.skipped ?? bc.skipped ?? 0;
      const failed = br?.failed ?? bc.failed ?? 0;
      if (br?.finishedAt) {
        const msg = `Серия завершена: ${br.done}/${br.planned} успешно` +
          (skipped ? `, пропуск ${skipped}` : '') +
          (failed ? `, ошибок ${failed}` : '');
        showToast(msg, failed ? 'neutral' : skipped ? 'neutral' : 'good');
        if (skipped || failed) {
          setTimeout(() => openBatchReportModal(), 400);
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
    if (syncResponsesWasRunning && !side.syncResponses?.running) {
      try {
        await applyNegotiationsCacheToQueue();
      } catch (e) {
        showToast(e.message || 'Не удалось применить кэш откликов', 'neutral');
      }
    }
    syncResponsesWasRunning = Boolean(side.syncResponses?.running);
    syncChatsWasRunning = Boolean(side.syncChats?.running);
    if (syncChatsWasRunning && !side.syncChats?.running) {
      void loadItems();
      showToast('Чаты синхронизированы', 'good');
    }
    if (dailyRoutineWasRunning && !side.dailyRoutine?.running) {
      showToast('Утренний цикл завершён — проверьте вкладку «Отклики»', 'good');
      void loadItems();
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
    renderResumeRaiseScheduleStatus(st.resumeRaiseSchedule);

    if (!st.applyChat?.running && !st.batch?.running && applyLogPollTimer) {
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
  const countEl = document.getElementById('list-count');
  const filters = readFiltersFromUI();
  const hasLocalFilter =
    filters.search || filters.company || filters.minScore || filters.onlySalary;
  const shown = items.length;
  const total = cachedRawItems.length;

  if (!counts) {
    if (host) host.innerHTML = '<span class="list-breadcrumbs__item">Загрузка…</span>';
    if (countEl) countEl.textContent = 'Загрузка…';
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
      threshold: scoreThreshold,
      appliedFunnel: currentAppliedFunnel,
      hasLocalFilter: Boolean(hasLocalFilter),
    })
  );

  if (countEl) {
    countEl.hidden = true;
    countEl.textContent = `${shown} карточек`;
  }
}

function renderListFromCache(scrollState) {
  const filters = readFiltersFromUI();
  const items = applyClientFilters(cachedRawItems, filters);
  updateListCount(items, cachedCounts);
  listEl.innerHTML = '';
  if (!items.length) {
    if (currentApplyView === 'applied') {
      if (currentAppliedFunnel === 'stale') {
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
    } else if (currentApplyView === 'questionnaire') {
      listEl.appendChild(
        renderEmptyState('Нет вакансий с анкетой в этом разделе.', [
          {
            label: 'Probe анкет',
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
    } else if (cachedCounts?.hiddenByRole > 0 && !filters.search) {
      listEl.appendChild(
        renderEmptyState(`Все скрыты фильтрами роли (${cachedCounts.hiddenByRole}).`, [
          { label: `Скрытые (${cachedCounts.hiddenByRole})`, onClick: () => applyViewTabsEl?.querySelector('[data-apply-view="hidden"]')?.click() },
        ])
      );
    } else {
      listEl.appendChild(
        renderEmptyState('Очередь пуста. Сначала соберите вакансии с hh.ru.', [
          { label: COPY.harvestRun, primary: true, onClick: () => document.getElementById('btn-run-harvest')?.click() },
          { label: COPY.openSettings, onClick: () => document.getElementById('btn-open-settings')?.click() },
        ])
      );
    }
    restoreListScroll(scrollState);
    return;
  }
  const browseMode = currentBrowseMode();
  items.forEach((it) => {
    if (browseMode) listEl.appendChild(renderCardTile(it, scoreThreshold, renderCard, bindDismiss));
    else listEl.appendChild(renderCard(it));
  });
  listEl.querySelectorAll('.card, .card-tile').forEach((el) => {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
  });
  restoreListScroll(scrollState);
  void refreshQuestionnaireReprobeStats().then(() => maybeAutoReprobeQuestionnaires());
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

async function load(opts = {}) {
  const scrollState = opts.preserveScroll ? captureListScroll(opts.anchorCardId) : null;
  if (!opts.preserveScroll) {
    listEl.innerHTML = '<p class="empty">Загрузка…</p>';
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
    updateApplyViewTabCounts(counts);
    renderListFromCache(scrollState);
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

async function runBatch({ minScore, maxScore, label }) {
  const batchScope = batchScopeForCurrentView();
  if (!batchScope) {
    showToast(`${COPY.batch} недоступна в разделе «Отклики»`, 'neutral');
    return;
  }
  const limit = getBatchLimitForRun();
  const section = batchScopeUiLabel(batchScope);
  let confirmMsg = `${label}\nРаздел: «${section}»\nДо ${limit} откликов · PDF резюме + письмо из пула.`;
  if (batchScope === 'hidden') {
    confirmMsg =
      `Внимание: батч по скрытым вакансиям (Senior/Lead, 1С, разработчик и т.п.).\n\n${confirmMsg}`;
  } else if (batchScope === 'questionnaire') {
    confirmMsg +=
      '\n\nБатч по анкетам: вопросы сохраняются, ответы генерируются (CV/LLM), подстановка и повторная отправка (HH_BATCH_QUESTIONNAIRE_AUTO=1 по умолчанию).';
  } else if (batchScope === 'noQuestionnaire') {
    confirmMsg +=
      '\n\nЕсли при отклике на hh.ru появится анкета работодателя, отклик не будет отправлен: вопросы сохранятся, карточка перейдёт в раздел «Анкета», батч продолжит следующую вакансию.';
  } else if (batchScope === 'queue') {
    confirmMsg += '\n\nВ «Очереди» могут быть вакансии с анкетой — они тоже попадут в батч.';
  }
  confirmMsg += '\n\nНецелевые вакансии (не IT) пропускаются автоматически до открытия браузера.';
  confirmMsg += '\n\nПродолжить?';
  if (!confirm(confirmMsg)) return;
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
    if (minScore != null) body.minScore = minScore;
    if (maxScore != null) body.maxScore = maxScore;
    const res = await api('/api/hh-launch-apply-batch', { method: 'POST', body: JSON.stringify(body) });
    showToast(res.message || `${COPY.batch} запущена`, 'neutral');
    openApplyLogModal();
    startJobLogPoll();
    refreshJobStatus();
  } catch (e) {
    alert(e.message);
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
    showToast(res.message || `Probe: ${res.okCount}`, res.failed ? 'neutral' : 'good');
    await loadItems();
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
    showToast(res.message || `Probe: ${res.okCount}`, res.failed ? 'neutral' : 'good');
    await loadItems();
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
    await loadItems();
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
  await loadItems();
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
        await loadItems();
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
          await loadItems();
        }
        break;
      case 'sync-resume-from-source':
        if (
          !confirm(
            'Синхронизировать резюме с эталона (техподдержка)?\n\n' +
              'Заполнит «О себе» и описание опыта на DevOps и других вариантах, если они пустее эталона.\n\n' +
              'Откроется Chromium. Нужен config/resume-variants.json с hash.'
          )
        ) {
          return;
        }
        await launchBackgroundApi('/api/launch-sync-resume-from-source', 'Синхронизация резюме запущена');
        break;
      case 'sync-resume-variants':
        if (
          !confirm(
            'Обновить до 5 резюме на hh.ru?\n\nНужен config/resume-variants.json и Chromium (npm run devops:list-resumes).'
          )
        ) {
          return;
        }
        await launchBackgroundApi('/api/launch-sync-resume-variants', 'Обновление резюме на hh.ru');
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
          await loadItems();
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
  if (cb && st && typeof st.enabled === 'boolean' && document.activeElement !== cb) {
    cb.checked = st.enabled;
  }
  if (!el || !st) return;
  const slots = (st.slots || []).map((h) => `${h}:00`).join(', ');
  const pending = st.pendingToday?.length
    ? `осталось: ${st.pendingToday.map((p) => `${p.hour}:00`).join(', ')}`
    : 'слоты на сегодня закрыты';
  const last = st.lastRunAt ? ` · ${new Date(st.lastRunAt).toLocaleString('ru-RU')}` : '';
  el.textContent = `${st.enabled ? 'Авто вкл' : 'Авто выкл'} · ${slots} (${st.timezone || 'MSK'}) · ${pending}${last}`;
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
  document.getElementById('resume-raise-auto-enabled')?.addEventListener('change', async (e) => {
    try {
      await api('/api/resume-raise-schedule', {
        method: 'PATCH',
        body: JSON.stringify({ enabled: e.target.checked }),
      });
      showToast(e.target.checked ? 'Авто-подъём включён' : 'Авто-подъём выключен', 'neutral');
      refreshJobStatus();
    } catch (err) {
      alert(err.message);
      e.target.checked = !e.target.checked;
    }
  });
}

function initServiceActions() {
  initResumeRaiseScheduleUi();
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
  if (
    !confirm(
      'Запустить утренний цикл?\n\n' +
        '1) Синхр. откликов hh.ru (браузер)\n' +
        '2) Обновление статусов в очереди\n' +
        '3) Синхр. чатов (браузер)' +
        (withHarvest ? '\n4) Сбор вакансий (harvest)' : '') +
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
      body: JSON.stringify({ withHarvest: !!withHarvest }),
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
  if (filterCompanyEl) filterCompanyEl.value = '';
  if (filterMinScoreEl) filterMinScoreEl.value = '';
  if (filterSortEl) filterSortEl.value = 'score-desc';
  if (filterSalaryEl) filterSalaryEl.checked = false;
  renderListFromCache(null);
});

for (const el of [filterSearchEl, filterCompanyEl, filterMinScoreEl, filterSortEl, filterSalaryEl]) {
  el?.addEventListener('input', rerenderListDebounced);
  el?.addEventListener('change', rerenderListDebounced);
}

for (const el of document.querySelectorAll('[data-pref]')) {
  el.addEventListener('input', () => {
    if (el === scoreThresholdInputEl) {
      const n = Number(scoreThresholdInputEl.value);
      if (Number.isFinite(n) && n >= 0 && n <= 100) {
        scoreThreshold = n;
        updateScoreBandTabLabels();
      }
    }
    scheduleSaveSettings();
  });
  el.addEventListener('change', () => {
    if (el === scoreThresholdInputEl) {
      const n = Number(scoreThresholdInputEl.value);
      if (Number.isFinite(n) && n >= 0 && n <= 100) {
        scoreThreshold = n;
        updateScoreBandTabLabels();
      }
    }
    scheduleSaveSettings();
  });
}

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

function openDashboardSettings(tabId = 'apply', { focusId } = {}) {
  closeServiceDrawer();
  const settingsModal = document.getElementById('settings-modal');
  if (!settingsModal) return;
  let tab = tabId;
  if (!tab) {
    try {
      tab = sessionStorage.getItem('hh-settings-tab') || 'apply';
    } catch {
      tab = 'apply';
    }
  }
  settingsTabSetter?.(tab);
  settingsModal.hidden = false;
  openModalEl(settingsModal);
  if (focusId) {
    requestAnimationFrame(() => {
      const el = document.getElementById(focusId);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const input = el?.querySelector('input');
      if (input && typeof input.focus === 'function') input.focus({ preventScroll: true });
    });
  }
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

function initTopCtaBar() {
  const mirror = (fromId, toId) => {
    document.getElementById(fromId)?.addEventListener('click', () => {
      document.getElementById(toId)?.click();
    });
  };
  mirror('btn-top-harvest', 'btn-run-harvest');
  mirror('btn-top-batch-auto', 'btn-batch-auto');
  mirror('btn-daily-routine-menubar', 'btn-daily-routine');
  mirror('btn-run-harvest-menubar', 'btn-run-harvest');
  mirror('btn-batch-auto-menubar', 'btn-batch-auto');
  mirror('btn-batch-manual-menubar', 'btn-batch-manual');
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
    apply: document.getElementById('settings-panel-apply'),
    appearance: document.getElementById('settings-panel-appearance'),
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
  }

  settingsTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSettingsTab(btn.dataset.settingsTab));
  });

  settingsTabSetter = setSettingsTab;
  const closeSettings = () => {
    if (!settingsModal) return;
    settingsModal.hidden = true;
    closeModalEl(settingsModal);
  };
  document.getElementById('btn-open-settings')?.addEventListener('click', () => openDashboardSettings());
  settingsModal?.querySelector('[data-close-settings]')?.addEventListener('click', closeSettings);
  settingsModal?.querySelector('.modal-close--settings')?.addEventListener('click', closeSettings);

  initServiceDrawer();
  initTopCtaBar();
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
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    drawer.classList.add('service-drawer--open');
    panel.focus();
  });
}

function initServiceDrawer() {
  const open = () => openServiceDrawer();
  document.getElementById('btn-open-service')?.addEventListener('click', open);
  document.querySelectorAll('.btn-open-service-alt, [data-open-service]').forEach((el) => {
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

function initCommandPaletteAndShortcuts() {
  registerCommandPaletteActions([
    {
      id: 'daily-routine',
      label: 'Утренний цикл',
      hint: 'Синхронизация откликов и чатов',
      keywords: 'sync routine утро',
      run: () => document.getElementById('btn-daily-routine')?.click(),
    },
    {
      id: 'harvest',
      label: COPY.harvestRun || 'Запустить поиск',
      hint: 'Harvest вакансий',
      keywords: 'поиск harvest',
      run: () => document.getElementById('btn-run-harvest')?.click(),
    },
    {
      id: 'batch-auto',
      label: COPY.batchAuto,
      hint: 'Серия ≥ порога',
      keywords: 'batch auto серия',
      run: () => document.getElementById('btn-batch-auto')?.click(),
    },
    {
      id: 'settings',
      label: COPY.openSettings,
      keywords: 'настройки limits',
      run: () => openDashboardSettings('apply'),
    },
    {
      id: 'service',
      label: COPY.openService,
      keywords: 'сервис sync',
      run: () => openServiceDrawer(),
    },
    {
      id: 'funnel',
      label: 'Воронка и конверсия',
      keywords: 'stats funnel график',
      run: () => openFunnelModal(),
    },
    {
      id: 'log',
      label: COPY.openLog,
      keywords: 'журнал log',
      run: () => document.querySelector('.btn-log-apply')?.click(),
    },
    {
      id: 'shortcuts',
      label: 'Горячие клавиши',
      hint: '?',
      run: () => openShortcutsModal(),
    },
  ]);

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
initFunnelUi();
initJobProgressOpenLog();
document.getElementById('btn-batch-report')?.addEventListener('click', () => openBatchReportModal());
initCrmUi();
initBrandHardReload();
initLimitsStatusLink();
initShortcutsModal();
initCommandPaletteAndShortcuts();
initListKeyboardNav(listEl, () => [...listEl.querySelectorAll('.card, .card-tile')]);
loadDashboardSettings().then(() => load());
refreshJobStatus();
setInterval(refreshJobStatus, 2000);
probeBatchControlApi();
