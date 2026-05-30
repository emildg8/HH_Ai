/**
 * Док-панели (слева/справа): размер, свёрнутый режим (иконки), полное скрытие.
 * Сетка workspace-stage пересчитывается в JS — иначе min-width в CSS ломает layout.
 */

const STORAGE_KEY = 'hh-dashboard-docks-v3';
const LEGACY_KEYS = ['hh-dashboard-docks-v2', 'hh-dashboard-docks-v1'];
const MIN_W = 160;
const MINI_W = 52;
const SPLIT_W = '5px';
const MAX_W_RATIO = 0.36;
const MIN_CENTER_W = 320;
const DEFAULT_LEFT = 240;
const DEFAULT_RIGHT = 272;

/** @typedef {{ width: number, collapsed: boolean, hidden: boolean, pinned: boolean }} DockSideState */
/** @typedef {{ left: DockSideState, right: DockSideState }} DockState */

/** @returns {DockState} */
function defaultState() {
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
  const splitCount =
    (state.left.hidden || state.left.collapsed ? 0 : 1) +
    (state.right.hidden || state.right.collapsed ? 0 : 1);
  const used = leftW + rightW + splitCount * 5;
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
function buildStageColumns(state) {
  const cols = [];
  if (!state.left.hidden) {
    cols.push(state.left.collapsed ? `${MINI_W}px` : `${state.left.width}px`);
    if (!state.left.collapsed) cols.push(SPLIT_W);
  }
  cols.push('minmax(0, 1fr)');
  if (!state.right.hidden) {
    if (!state.right.collapsed) cols.push(SPLIT_W);
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

  stage.style.gridTemplateColumns = buildStageColumns(state);

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
  if (leftSplit) {
    leftSplit.style.display = state.left.hidden || state.left.collapsed ? 'none' : '';
  }
  if (rightSplit) {
    rightSplit.style.display = state.right.hidden || state.right.collapsed ? 'none' : '';
  }

  syncDockChrome(state);
  syncMenubarToggles(state);
  syncCollapseButtons(state);
}

/** @param {DockState} state */
function syncDockChrome(state) {
  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    const s = state[side];
    const pinBtn = document.querySelector(`[data-dock-pin="${side}"]`);
    if (pinBtn) {
      pinBtn.classList.toggle('dock__btn--active', s.pinned);
      pinBtn.setAttribute('aria-pressed', s.pinned ? 'true' : 'false');
      pinBtn.title = s.pinned ? 'Открепить' : 'Закрепить панель';
    }
  }
}

/** @param {DockState} state */
function syncCollapseButtons(state) {
  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    const s = state[side];
    const label = s.hidden ? 'Панель скрыта' : s.collapsed ? 'Развернуть меню' : 'Свернуть меню';
    document.querySelectorAll(`[data-dock-collapse="${side}"]`).forEach((btn) => {
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.classList.toggle('dock__btn--panel-open', !s.collapsed && !s.hidden);
    });
  }
}

/** @param {DockState} state */
function syncMenubarToggles(state) {
  document.querySelectorAll('[data-dock-toggle]').forEach((btn) => {
    const side = btn.dataset.dockToggle;
    if (side !== 'left' && side !== 'right') return;
    const off = state[side].hidden;
    btn.classList.toggle('workspace-menubar__dock-toggle--off', off);
    btn.setAttribute('aria-pressed', off ? 'false' : 'true');
    btn.title = off
      ? side === 'left'
        ? 'Показать левую панель'
        : 'Показать правую панель'
      : side === 'left'
        ? 'Скрыть левую панель'
        : 'Скрыть правую панель';
  });
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

/** @param {'left'|'right'} side */
function toggleMenubarDock(state, side) {
  state[side].hidden = !state[side].hidden;
  if (!state[side].hidden && state[side].width < MIN_W) {
    state[side].width = side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT;
  }
  applyDockState(state);
  saveDockState(state);
}

/** @param {'left'|'right'} side */
function togglePinned(state, side) {
  state[side].pinned = !state[side].pinned;
  if (state[side].pinned && state[side].collapsed && !state[side].hidden) {
    setMini(state, side, false);
    return;
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

function initHoverExpand(state, side) {
  const dock = document.getElementById(`dock-${side}`);
  if (!dock) return;
  let hideTimer = null;
  const scheduleMini = () => {
    if (state[side].pinned || state[side].collapsed || state[side].hidden) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!state[side].pinned) setMini(state, side, true);
    }, 700);
  };
  dock.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  dock.addEventListener('mouseleave', scheduleMini);
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

export function initWorkspaceDocks() {
  const state = loadDockState();
  applyDockState(state);

  document.querySelectorAll('[data-dock-collapse]').forEach((btn) => {
    const side = btn.dataset.dockCollapse;
    if (side !== 'left' && side !== 'right') return;
    btn.addEventListener('click', () => toggleMini(state, side));
  });

  document.querySelectorAll('[data-dock-pin]').forEach((btn) => {
    const side = btn.dataset.dockPin;
    if (side !== 'left' && side !== 'right') return;
    btn.addEventListener('click', () => togglePinned(state, side));
  });

  document.querySelectorAll('[data-dock-toggle]').forEach((btn) => {
    const side = btn.dataset.dockToggle;
    if (side !== 'left' && side !== 'right') return;
    btn.addEventListener('click', () => toggleMenubarDock(state, side));
  });

  initDockMiniNav(state);

  for (const side of /** @type {('left'|'right')[]} */ (['left', 'right'])) {
    const splitter = document.getElementById(`splitter-${side}`);
    splitter?.addEventListener('mousedown', (e) => {
      if (state[side].collapsed || state[side].hidden) return;
      e.preventDefault();
      startResize(state, side, e.clientX);
    });
    splitter?.addEventListener('dblclick', () => {
      state[side].width = side === 'left' ? DEFAULT_LEFT : DEFAULT_RIGHT;
      applyDockState(state);
      saveDockState(state);
    });
    initHoverExpand(state, side);
  }

  window.addEventListener('resize', () => {
    sanitizeDockState(state);
    applyDockState(state);
    saveDockState(state);
  });

  return state;
}
