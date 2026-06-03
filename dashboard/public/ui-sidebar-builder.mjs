/**
 * Конструктор боковой панели: порядок (drag-and-drop) и видимость блоков.
 */

import { SIDEBAR_PANELS } from './dashboard-ux.mjs';
import {
  buildPanelOrderFromColumns,
  columnPanelOrder,
  getDragAfterElement,
} from './sidebar-layout.mjs';

export { buildPanelOrderFromColumns, getDragAfterElement };

/** @type {{ getUi: () => object, patchUi: (partial: object) => void, onPersist: () => void } | null} */
let hooks = null;
let dropCommittedThisDrag = false;

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

function readBuilderColumns() {
  const left = [...(builderList('left')?.querySelectorAll('.sidebar-builder__item') || [])]
    .map((el) => el.dataset.panelId)
    .filter(Boolean);
  const right = [...(builderList('right')?.querySelectorAll('.sidebar-builder__item') || [])]
    .map((el) => el.dataset.panelId)
    .filter(Boolean);
  return { left, right };
}

function commitBuilderOrder() {
  if (!hooks) return;
  const { left, right } = readBuilderColumns();
  const ui = hooks.getUi();
  const prev = { ...(ui.panelSides || {}) };
  /** @type {Record<string, string>} */
  const panelSides = {};
  for (const id of left) panelSides[id] = 'left';
  for (const id of right) panelSides[id] = 'right';
  for (const id of Object.keys(SIDEBAR_PANELS)) {
    if (panelSides[id]) continue;
    panelSides[id] = prev[id] === 'right' ? 'right' : 'left';
  }
  const panelOrder = buildPanelOrderFromColumns(left, right);
  hooks.patchUi({ panelOrder, panelSides }, { reorder: true });
  hooks.onPersist();
}

/**
 * @param {{ getUi: () => object, patchUi: (partial: object, opts?: { reorder?: boolean }) => void, onPersist: () => void }} h
 */
export function initSidebarBuilder(h) {
  hooks = h;
  const root = builderRoot();
  if (!root) return;
  renderSidebarBuilder();
  root.querySelectorAll('.sidebar-builder-list, .sidebar-builder-col').forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const list = listForDropTarget(e.currentTarget);
      if (!list) return;
      const col = list.closest('.sidebar-builder-col');
      col?.classList.add('sidebar-builder-col--over');
      const after = getDragAfterElement(list, e.clientY);
      const dragging = builderRoot()?.querySelector('.sidebar-builder__item--dragging');
      if (!dragging) return;
      if (after == null) list.appendChild(dragging);
      else list.insertBefore(dragging, after);
    });
    zone.addEventListener('dragleave', (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      e.currentTarget.classList?.remove('sidebar-builder-col--over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      clearDragOver();
      dropCommittedThisDrag = true;
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

  li.addEventListener('dragstart', (e) => {
    if (e.target instanceof HTMLInputElement) {
      e.preventDefault();
      return;
    }
    dropCommittedThisDrag = false;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    }
    li.classList.add('sidebar-builder__item--dragging');
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('sidebar-builder__item--dragging');
    clearDragOver();
    if (!dropCommittedThisDrag) commitBuilderOrder();
    dropCommittedThisDrag = false;
  });

  const input = li.querySelector('[data-sidebar-panel-toggle]');
  input?.addEventListener('change', () => {
    const current = hooks?.getUi();
    if (!current || !input) return;
    hooks.patchUi({ panels: { ...current.panels, [id]: input.checked } }, { reorder: false });
    hooks.onPersist();
  });
  return li;
}

export function renderSidebarBuilder() {
  const root = builderRoot();
  if (!root || !hooks) return;
  const ui = hooks.getUi();
  const leftList = builderList('left');
  const rightList = builderList('right');
  if (!leftList || !rightList) return;
  leftList.replaceChildren();
  rightList.replaceChildren();
  for (const id of columnPanelOrder(ui, 'left')) {
    const item = createBuilderItem(id, ui);
    if (item) leftList.appendChild(item);
  }
  for (const id of columnPanelOrder(ui, 'right')) {
    const item = createBuilderItem(id, ui);
    if (item) rightList.appendChild(item);
  }
}
