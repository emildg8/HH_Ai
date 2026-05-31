/**
 * Конструктор боковой панели: порядок (drag-and-drop) и видимость блоков.
 */

import {
  SIDEBAR_PANELS,
  SIDEBAR_BUILDER_PANEL_IDS,
  normalizePanelOrder,
  defaultPanelSides,
} from './dashboard-ux.mjs';

/** @type {{ getUi: () => object, patchUi: (partial: object) => void, onPersist: () => void } | null} */
let hooks = null;

function builderRoot() {
  return document.getElementById('sidebar-panel-builder');
}

function builderList(side) {
  return builderRoot()?.querySelector(`[data-builder-list="${side}"]`) || null;
}

function listForDropTarget(target) {
  if (!target) return null;
  if (target.classList?.contains('sidebar-builder-list')) return target;
  return target.closest('.sidebar-builder-col')?.querySelector('.sidebar-builder-list') || null;
}

function clearDragOver() {
  builderRoot()?.querySelectorAll('.sidebar-builder-col--over').forEach((el) => {
    el.classList.remove('sidebar-builder-col--over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  const list = listForDropTarget(e.currentTarget);
  if (!list) return;
  const col = list.closest('.sidebar-builder-col');
  col?.classList.add('sidebar-builder-col--over');
  const after = getDragAfterElement(list, e.clientY);
  const dragging = builderRoot()?.querySelector('.sidebar-builder__item--dragging');
  if (!dragging) return;
  if (after == null) list.appendChild(dragging);
  else list.insertBefore(dragging, after);
}

/**
 * @param {{ getUi: () => { panels: Record<string, boolean>, panelOrder: string[], panelSides?: Record<string, string> }, patchUi: (p: object) => void, onPersist: () => void }} h
 */
export function initSidebarBuilder(h) {
  hooks = h;
  const root = builderRoot();
  if (!root) return;
  renderSidebarBuilder();
  root.querySelectorAll('.sidebar-builder-list, .sidebar-builder-col').forEach((zone) => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragleave', (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      e.currentTarget.classList?.remove('sidebar-builder-col--over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      clearDragOver();
      commitBuilderOrder();
    });
  });
}

function createBuilderItem(id, ui) {
  const meta = SIDEBAR_PANELS[id];
  if (!meta) return null;
  const li = document.createElement('li');
  li.className = 'sidebar-builder__item';
  li.draggable = true;
  li.dataset.panelId = id;
  li.innerHTML =
    `<span class="sidebar-builder__handle" aria-hidden="true" title="Перетащите">⠿</span>` +
    `<label class="sidebar-builder__label">` +
    `<input type="checkbox" data-sidebar-panel-toggle="${id}" ${ui.panels[id] !== false ? 'checked' : ''} />` +
    `<span class="sidebar-builder__text">${meta.label}</span>` +
    `</label>`;
  li.addEventListener('dragstart', () => {
    li.classList.add('sidebar-builder__item--dragging');
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('sidebar-builder__item--dragging');
    clearDragOver();
    commitBuilderOrder();
  });
  const input = li.querySelector('[data-sidebar-panel-toggle]');
  input?.addEventListener('change', () => {
    const current = hooks?.getUi();
    if (!current || !input) return;
    hooks.patchUi({ panels: { ...current.panels, [id]: input.checked } });
    hooks.onPersist();
  });
  return li;
}

export function renderSidebarBuilder() {
  const root = builderRoot();
  if (!root || !hooks) return;
  const ui = hooks.getUi();
  const sides = { ...defaultPanelSides(), ...ui.panelSides };
  const order = normalizePanelOrder(ui.panelOrder).filter((id) => SIDEBAR_BUILDER_PANEL_IDS.includes(id));
  for (const id of SIDEBAR_BUILDER_PANEL_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  const leftList = builderList('left');
  const rightList = builderList('right');
  if (!leftList || !rightList) return;
  leftList.replaceChildren();
  rightList.replaceChildren();
  for (const id of order) {
    const meta = SIDEBAR_PANELS[id];
    const item = createBuilderItem(id, ui);
    if (!item || !meta) continue;
    const side = sides[id] === 'right' ? 'right' : 'left';
    (side === 'right' ? rightList : leftList).appendChild(item);
  }
}

/** @param {HTMLElement} container @param {number} y */
function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.sidebar-builder__item:not(.sidebar-builder__item--dragging)')];
  return items.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function commitBuilderOrder() {
  if (!hooks) return;
  const left = [...(builderList('left')?.querySelectorAll('.sidebar-builder__item') || [])]
    .map((el) => el.dataset.panelId)
    .filter(Boolean);
  const right = [...(builderList('right')?.querySelectorAll('.sidebar-builder__item') || [])]
    .map((el) => el.dataset.panelId)
    .filter(Boolean);
  const ui = hooks.getUi();
  const prev = { ...defaultPanelSides(), ...ui.panelSides };
  /** @type {Record<string, string>} */
  const panelSides = {};
  for (const id of SIDEBAR_BUILDER_PANEL_IDS) {
    if (left.includes(id)) panelSides[id] = 'left';
    else if (right.includes(id)) panelSides[id] = 'right';
    else panelSides[id] = prev[id] === 'right' ? 'right' : 'left';
  }
  hooks.patchUi({
    panelOrder: normalizePanelOrder(['brand', ...left, ...right]),
    panelSides,
  });
  hooks.onPersist();
}
