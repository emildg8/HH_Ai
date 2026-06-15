/**
 * Доступ к скрытым панелям и режимам без перегрузки основного UI.
 */

import { panelHostSlot, resolveHostElement } from './sidebar-layout.mjs';

/**
 * @param {object} ui
 * @param {string} panelId
 * @param {boolean} visible
 */
export function withPanelVisible(ui, panelId, visible) {
  return {
    ...ui,
    panels: { ...ui.panels, [panelId]: visible },
  };
}

/**
 * @param {object} ui
 * @param {string} panelId
 * @param {Document} [doc]
 */
export function scrollToPanel(ui, panelId, doc = document) {
  const slot = panelHostSlot(panelId);
  const host = slot ? resolveHostElement(slot, doc) : null;
  const el =
    doc.querySelector(`.sidebar-panel[data-panel="${panelId}"]`) ||
    host?.querySelector?.(`[data-panel="${panelId}"]`) ||
    host;
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
