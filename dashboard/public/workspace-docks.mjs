/**
 * Док-панели (слева/справа): размер, свёрнутый режим (иконки), полное скрытие.
 * Сетка workspace-stage пересчитывается в JS — иначе min-width в CSS ломает layout.
 */

import { isMobileViewport } from './ui-mobile.mjs';

const STORAGE_KEY = 'hh-dashboard-docks-v3';
const LEGACY_KEYS = ['hh-dashboard-docks-v2', 'hh-dashboard-docks-v1'];
const MIN_W = 160;
const MINI_W = 52;
const EDGE_W = 12;
const SPLIT_W = `${EDGE_W}px`;
const CLICK_THRESHOLD = 4;
const DOCK_HINT_KEY = 'hh-dashboard-dock-splitter-hint';
/** @type {number} */
let lastExpandAt = 0;
/** @type {number} */
let suppressHoverExpandUntil = 0;
/** @type {Record<'left'|'right', boolean>} */
const hoverExpandArmed = { left: false, right: false };
const MAX_W_RATIO = 0.36;
const MIN_CENTER_W = 320;
const DEFAULT_LEFT = 240;
const DEFAULT_RIGHT = 272;

/** @typedef {{ width: number, collapsed: boolean, hidden: boolean, pinned: boolean }} DockSideState */
/** @typedef {{ left: DockSideState, right: DockSideState }} DockState */

/** @returns {DockState} */
export function defaultState() {
  return {
    left: { width: DEFAULT_LEFT, collapsed: false, hidden: false, pinned: true },
    right: { width: DEFAULT_RIGHT, collapsed: false, hidden: false, pinned: true },
  };
}

function clampWidth(w) {
  const max = Math.floor(window.innerWidth * MAX_W_RATIO);
  return Math.min(max, Math.max(MIN_W, Math.round(w)));
}

/** @returns {DockState} */
export function loadDockState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    const d = defaultState();
    for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
      const s = p[side];
      if (!s || typeof s !== 'object') continue;
      if (Number.isFinite(s.width)) d[side].width = clampWidth(s.width);
      if (typeof s.collapsed === 'boolean') d[side].collapsed = s.collapsed;
      if (typeof s.hidden === 'boolean') d[side].hidden = s.hidden;
      if (typeof s.pinned === 'boolean') d[side].pinned = s.pinned;
      if (d[side].collapsed && !d[side].hidden) {
        d[side].hidden = true;
        d[side].collapsed = false;
      }
    }
    return sanitizeDockState(d);
  } catch {
    return defaultState();
  }
}

/** @param {DockState} state */
export function saveDockState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** @returns {DockState} */
export function sanitizeDockState(state) {
  const maxSide = Math.floor(window.innerWidth * MAX_W_RATIO);
  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    const s = state[side];
    if (s.hidden || s.collapsed) continue;
    s.width = clampWidth(Math.min(s.width, maxSide));
  }
  let leftW = state.left.hidden ? 0 : state.left.collapsed ? MINI_W : state.left.width;
  let rightW = state.right.hidden ? 0 : state.right.collapsed ? MINI_W : state.right.width;
  const used = leftW + rightW + EDGE_W * 2;
  if (used > window.innerWidth - MIN_CENTER_W) {
    const excess = used - (window.innerWidth - MIN_CENTER_W);
    for (const side of ['left', 'right']) {
      if (state[side].hidden || state[side].collapsed) continue;
      state[side].width = clampWidth(state[side].width - Math.ceil(excess / 2));
    }
    leftW = state.left.hidden ? 0 : state.left.collapsed ? MINI_W : state.left.width;
    rightW = state.right.hidden ? 0 : state.right.collapsed ? MINI_W : state.right.width;
  }
  return state;
}

function cap(side) {
  return side === 'left' ? 'Left' : 'Right';
}

/**
 * @param {DockState} state
 * @returns {string}
 */
export function buildStageColumns(state) {
  const cols = [];
  if (!state.left.hidden) {
    cols.push(state.left.collapsed ? `${MINI_W}px` : `${state.left.width}px`);
  }
  cols.push(SPLIT_W);
  cols.push('minmax(0, 1fr)');
  cols.push(SPLIT_W);
  if (!state.right.hidden) {
    cols.push(state.right.collapsed ? `${MINI_W}px` : `${state.right.width}px`);
  }
  return cols.join(' ');
}

/**
 * @param {DockState} state
 */
export function applyDockState(state) {
  const shell = document.getElementById('app-shell');
  const stage = document.querySelector('.workspace-stage');
  const leftDock = document.getElementById('dock-left');
  const rightDock = document.getElementById('dock-right');
  const leftSplit = document.getElementById('splitter-left');
  const rightSplit = document.getElementById('splitter-right');
  if (!shell || !stage) return;

  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    const s = state[side];
    shell.dataset[`dock${cap(side)}Collapsed`] = s.collapsed ? '1' : '0';
    shell.dataset[`dock${cap(side)}Hidden`] = s.hidden ? '1' : '0';
    shell.dataset[`dock${cap(side)}Pinned`] = s.pinned ? '1' : '0';
    shell.style.setProperty(
      `--dock-${side}-w`,
      s.hidden ? '0px' : s.collapsed ? `${MINI_W}px` : `${s.width}px`
    );
  }

  const mobile = isMobileViewport() || shell.classList.contains('workspace-shell--mobile');
  if (mobile) {
    stage.style.gridTemplateColumns = 'minmax(0, 1fr)';
  } else {
    stage.style.gridTemplateColumns = buildStageColumns(state);
  }

  if (leftDock) {
    leftDock.style.display = state.left.hidden ? 'none' : '';
    leftDock.classList.toggle('dock--mini', !state.left.hidden && state.left.collapsed);
    leftDock.classList.toggle('dock--hidden', state.left.hidden);
    leftDock.classList.toggle('dock--unpinned', !state.left.pinned);
  }
  if (rightDock) {
    rightDock.style.display = state.right.hidden ? 'none' : '';
    rightDock.classList.toggle('dock--mini', !state.right.hidden && state.right.collapsed);
    rightDock.classList.toggle('dock--hidden', state.right.hidden);
    rightDock.classList.toggle('dock--unpinned', !state.right.pinned);
  }
  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    const splitter = side === 'left' ? leftSplit : rightSplit;
    if (!splitter) continue;
    const hidden = state[side].hidden;
    splitter.style.display = mobile ? 'none' : '';
    splitter.classList.toggle('dock-splitter--panel-hidden', hidden);
    splitter.setAttribute(
      'title',
      hidden
        ? 'Наведите или нажмите, чтобы показать панель'
        : 'Нажмите, чтобы скрыть · перетащите для ширины'
    );
    splitter.setAttribute(
      'aria-label',
      hidden
        ? side === 'left'
          ? 'Показать левую панель'
          : 'Показать правую панель'
        : side === 'left'
          ? 'Скрыть левую панель или изменить ширину'
          : 'Скрыть правую панель или изменить ширину'
    );
  }
}

/** @type {DockState | null} */
let liveState = null;

/** @param {'left'|'right'} side */
export function toggleDockPanel(side) {
  if (!liveState) return;
  if (liveState[side].hidden || liveState[side].collapsed) expandDock(liveState, side);
  else hideDock(liveState, side);
}

/** @param {(msg: string, variant?: string) => void} [showToast] */
export function showDockPanelsHint(showToast) {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(DOCK_HINT_KEY) === '1') return;
  if (typeof document !== 'undefined') {
    const shell = document.getElementById('app-shell');
    if (isMobileViewport() || shell?.classList.contains('workspace-shell--mobile')) return;
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(DOCK_HINT_KEY, '1');
  showToast?.(
    'Подсказка: полоска между панелью и списком скрывает меню — наведите на неё, чтобы вернуть',
    'neutral'
  );
}

/** @param {DockState} state @param {'left'|'right'} side */
function hideDock(state, side) {
  state[side].hidden = true;
  state[side].collapsed = false;
  hoverExpandArmed[side] = false;
  suppressHoverExpandUntil = Date.now() + 450;
  applyDockState(state);
  saveDockState(state);
}

/** @param {DockState} state @param {'left'|'right'} side */
function expandDock(state, side) {
  state[side].hidden = false;
  state[side].collapsed = false;
  if (state[side].width < MIN_W) {
    state[side].width = side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT;
  }
  lastExpandAt = Date.now();
  applyDockState(state);
  saveDockState(state);
}

/** @param {DockState} state @param {'left'|'right'} side @param {boolean} mini */
function setMini(state, side, mini) {
  state[side].collapsed = mini;
  state[side].hidden = false;
  if (!mini && state[side].width < MIN_W) {
    state[side].width = side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT;
  }
  applyDockState(state);
  saveDockState(state);
}

/** @param {'left'|'right'} side */
function toggleMini(state, side) {
  if (state[side].hidden) {
    state[side].hidden = false;
    state[side].collapsed = false;
  } else {
    state[side].collapsed = !state[side].collapsed;
  }
  applyDockState(state);
  saveDockState(state);
}

function startResize(state, side, startX) {
  if (state[side].collapsed || state[side].hidden) return;
  const startW = state[side].width;
  const stage = document.querySelector('.workspace-stage');
  const onMove = (e) => {
    const dx = side === 'left' ? e.clientX - startX : startX - e.clientX;
    state[side].width = clampWidth(startW + dx);
    if (stage) stage.style.gridTemplateColumns = buildStageColumns(state);
    document.getElementById('app-shell')?.style.setProperty(`--dock-${side}-w`, `${state[side].width}px`);
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('workspace-resizing');
    applyDockState(state);
    saveDockState(state);
  };
  document.body.classList.add('workspace-resizing');
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function clickEl(id) {
  document.getElementById(id)?.click();
}

function initDockMiniNav(state) {
  document.querySelectorAll('[data-dock-mini]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.dockMini;
      const side = btn.closest('.dock-mini')?.dataset.dockMiniSide;
      if (action === 'toggle') {
        if (side === 'left' || side === 'right') toggleMini(state, side);
        return;
      }
      if (action === 'status') {
        document.getElementById('crm-status-limits')?.click();
        return;
      }
      if (action === 'routine') {
        clickEl('btn-daily-routine');
        return;
      }
      if (action === 'harvest') {
        clickEl('btn-run-harvest');
        return;
      }
      if (action === 'batch-auto') {
        clickEl('btn-batch-auto');
        return;
      }
      if (action === 'batch-manual') {
        clickEl('btn-batch-manual');
        return;
      }
      if (action === 'settings') {
        document.getElementById('btn-open-settings')?.click();
        return;
      }
      if (action === 'service') {
        document.getElementById('btn-open-service')?.click();
        return;
      }
      if (action === 'funnel') {
        document.querySelector('.crm-kpi')?.click();
        return;
      }
      if (action === 'job') {
        const jp = document.getElementById('job-progress');
        if (jp && !jp.hidden) jp.click();
        else document.querySelector('.btn-log-apply')?.click();
        return;
      }
      if (action === 'log') {
        document.querySelector('.btn-log-apply')?.click();
        return;
      }
      const viewBtn = document.querySelector(`[data-apply-view="${action}"]`);
      if (viewBtn) viewBtn.click();
    });
  });
}

export function syncDockMiniActiveView(applyView) {
  document.querySelectorAll('.dock-mini--left [data-dock-mini]').forEach((btn) => {
    const action = btn.dataset.dockMini;
    btn.classList.toggle('dock-mini__btn--active', action === applyView);
  });
}

/** @param {'left'|'right'} side */
function canHoverExpand(side) {
  if (Date.now() < suppressHoverExpandUntil) return false;
  return hoverExpandArmed[side];
}

/** @param {DockState} state @param {'left'|'right'} side */
function initSplitter(state, side) {
  const splitter = document.getElementById(`splitter-${side}`);
  if (!splitter) return;

  splitter.addEventListener('mouseleave', () => {
    if (state[side].hidden) hoverExpandArmed[side] = true;
  });

  splitter.addEventListener('mouseenter', () => {
    if (isMobileViewport()) return;
    if (!state[side].hidden) return;
    if (!canHoverExpand(side)) return;
    expandDock(state, side);
    hoverExpandArmed[side] = false;
  });

  splitter.addEventListener('mousedown', (e) => {
    if (isMobileViewport()) return;
    if (e.button !== 0) return;
    if (state[side].hidden) {
      e.preventDefault();
      expandDock(state, side);
      return;
    }
    if (state[side].collapsed) {
      e.preventDefault();
      expandDock(state, side);
      return;
    }

    const startX = e.clientX;
    let resizing = false;

    const onMove = (ev) => {
      if (!resizing && Math.abs(ev.clientX - startX) > CLICK_THRESHOLD) {
        resizing = true;
        startResize(state, side, startX);
        document.removeEventListener('mousemove', onMove);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!resizing && Date.now() - lastExpandAt > 280) hideDock(state, side);
    };

    e.preventDefault();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  splitter.addEventListener('dblclick', () => {
    if (state[side].hidden || state[side].collapsed) return;
    state[side].width = side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT;
    applyDockState(state);
    saveDockState(state);
  });

  splitter.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (state[side].hidden) expandDock(state, side);
    else hideDock(state, side);
  });
}

export function initWorkspaceDocks() {
  const state = loadDockState();
  liveState = state;
  applyDockState(state);

  initDockMiniNav(state);

  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    initSplitter(state, side);
  }

  window.addEventListener('resize', () => {
    sanitizeDockState(state);
    applyDockState(state);
    saveDockState(state);
  });

  window.addEventListener('hh-docks-refresh', () => {
    sanitizeDockState(state);
    applyDockState(state);
  });

  window.addEventListener('hh-mobile-sheet-open', (e) => {
    const side = e.detail?.side;
    if (side !== 'left' && side !== 'right') return;
    if (state[side].hidden || state[side].collapsed) expandDock(state, side);
  });

  return state;
}
