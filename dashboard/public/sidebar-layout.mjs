/**
 * Раскладка боковых панелей: слоты DOM, порядок по колонкам, видимость.
 */

import {
  SIDEBAR_PANELS,
  SIDEBAR_BUILDER_PANEL_IDS,
  SIDEBAR_PANEL_ORDER_DEFAULT,
  normalizePanelOrder,
  panelSideFor,
  defaultPanelSides,
} from './dashboard-ux.mjs';

/** @typedef {{ panels: string[], query: string }} SlotMeta */

/** @type {Record<string, SlotMeta>} */
export const PANEL_HOST_SLOTS = {
  onboard: { panels: ['onboard'], query: '.dock-section--onboard' },
  status: { panels: ['status'], query: '.dock-section--status' },
  actions: { panels: ['actionsPrimary'], query: '.dock-section--actions' },
  harvest: { panels: ['harvestPeriod'], query: '.dock-section--harvest' },
  nav: { panels: ['nav'], query: '.dock-section--nav' },
  filters: { panels: ['filters'], query: '.dock-section--filters' },
  resumeRaise: { panels: ['resumeRaise'], query: '[data-panel="resumeRaise"]' },
  kpi: { panels: ['kpi'], query: '[data-panel="kpi"]' },
  falsePositives: { panels: ['falsePositives'], query: '[data-panel="falsePositives"]' },
  syncExtended: { panels: ['syncExtended'], query: '[data-panel="syncExtended"]' },
  serviceResume: { panels: ['serviceResume'], query: '[data-panel="serviceResume"]' },
  serviceRoutine: { panels: ['serviceRoutine'], query: '[data-panel="serviceRoutine"]' },
  jobFooter: { panels: ['jobFooter'], query: '[data-panel="jobFooter"]' },
};

/** @param {string} panelId */
export function panelHostSlot(panelId) {
  for (const [slot, meta] of Object.entries(PANEL_HOST_SLOTS)) {
    if (meta.panels.includes(panelId)) return slot;
  }
  return null;
}

/** @param {string} slot @param {Document} [doc] */
export function resolveHostElement(slot, doc = document) {
  const meta = PANEL_HOST_SLOTS[slot];
  if (!meta) return null;
  return doc.querySelector(meta.query);
}

/** @param {object} ui @param {'left'|'right'} side */
export function orderedSlotsForSide(ui, side) {
  const order = normalizePanelOrder(ui.panelOrder);
  const slots = [];
  const seen = new Set();
  const consider = (panelId) => {
    const slot = panelHostSlot(panelId);
    if (!slot || seen.has(slot)) return;
    if (panelSideFor(ui, panelId) !== side) return;
    seen.add(slot);
    slots.push(slot);
  };
  for (const id of order) consider(id);
  for (const id of SIDEBAR_BUILDER_PANEL_IDS) consider(id);
  for (const id of SIDEBAR_PANEL_ORDER_DEFAULT) consider(id);
  return slots;
}

/** @param {string[]} left @param {string[]} right */
export function buildPanelOrderFromColumns(left, right) {
  return normalizePanelOrder([...left, ...right]);
}

/** @param {HTMLElement} container @param {number} y */
export function getDragAfterElement(container, y) {
  const items = [...container.querySelectorAll('.sidebar-builder__item:not(.sidebar-builder__item--dragging)')];
  for (const child of items) {
    const box = child.getBoundingClientRect();
    if (y < box.top + box.height / 2) return child;
  }
  return null;
}

/** @param {object} ui @param {'left'|'right'} side */
export function columnPanelOrder(ui, side) {
  const sides = { ...defaultPanelSides(), ...ui.panelSides };
  const order = normalizePanelOrder(ui.panelOrder).filter((id) => SIDEBAR_BUILDER_PANEL_IDS.includes(id));
  for (const id of SIDEBAR_BUILDER_PANEL_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  return order.filter((id) => (sides[id] === 'right' ? 'right' : 'left') === side);
}

/** @param {object} ui @param {string} slot */
function slotVisible(ui, slot) {
  const meta = PANEL_HOST_SLOTS[slot];
  if (!meta) return false;
  return meta.panels.some((id) => ui.panels[id] !== false);
}

/** @param {object} ui @param {Document} doc */
function applyPanelVisibility(ui, doc) {
  doc.querySelectorAll('.sidebar-panel[data-panel]').forEach((el) => {
    const id = el.dataset.panel;
    if (!id) return;
    const slot = panelHostSlot(id);
    const host = slot ? resolveHostElement(slot, doc) : null;
    if (host && host !== el && host.contains(el)) {
      el.hidden = false;
      return;
    }
    const visible = ui.panels[id] !== false;
    el.dataset.panelHidden = visible ? '0' : '1';
    el.hidden = !visible;
  });
}

function syncSectionShells(doc) {
  doc.querySelectorAll('#sidebar-scroll .dock-section').forEach((section) => {
    if (section.dataset.panel) return;
    const inner = section.querySelectorAll('.sidebar-panel[data-panel]');
    if (!inner.length) return;
    const any = [...inner].some((p) => p.dataset.panelHidden !== '1' && !p.hidden);
    section.hidden = !any;
  });
}

/** @param {object} ui @param {string} slot @param {HTMLElement} host */
function applySlotVisibility(ui, slot, host) {
  const visible = slotVisible(ui, slot);
  host.hidden = !visible;
  host.dataset.panelHidden = visible ? '0' : '1';
  host.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

/**
 * Применить порядок, сторону и видимость блоков.
 * @param {object} ui
 * @param {Document} [doc]
 */
export function applySidebarLayout(ui, doc = document) {
  const scroll = doc.getElementById('sidebar-scroll');
  const rightBody = doc.querySelector('#dock-right .dock__body');
  const footer = doc.querySelector('#dock-right .sidebar-footer');
  if (!scroll || !rightBody) return;

  for (const slot of orderedSlotsForSide(ui, 'left')) {
    const host = resolveHostElement(slot, doc);
    if (!host) continue;
    scroll.appendChild(host);
    applySlotVisibility(ui, slot, host);
  }

  const rightAnchor = footer?.parentElement === rightBody ? footer : null;
  for (const slot of orderedSlotsForSide(ui, 'right')) {
    if (slot === 'jobFooter') continue;
    const host = resolveHostElement(slot, doc);
    if (!host) continue;
    if (!(rightAnchor && host.nextElementSibling === rightAnchor)) {
      rightBody.insertBefore(host, rightAnchor);
    }
    applySlotVisibility(ui, slot, host);
  }

  if (footer) {
    if (slotVisible(ui, 'jobFooter') && panelSideFor(ui, 'jobFooter') === 'right') {
      rightBody.appendChild(footer);
      footer.hidden = false;
      footer.dataset.panelHidden = '0';
    } else {
      footer.hidden = true;
      footer.dataset.panelHidden = '1';
    }
  }

  applyPanelVisibility(ui, doc);
  syncSectionShells(doc);
}
