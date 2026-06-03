/**
 * Глобальные горячие клавиши дашборда.
 */

import {
  openCommandPalette,
  closeCommandPalette,
  isCommandPaletteOpen,
} from './command-palette.mjs';

/** @typedef {{
 *   openShortcutsHelp?: () => void,
 *   isDraftModalOpen?: () => boolean,
 *   onDraftApprove?: () => void,
 *   onDraftDecline?: () => void,
 *   onDraftSave?: () => void,
 *   onDraftSelectVariant?: (index: number) => void,
 *   onDraftPrevVariant?: () => void,
 *   onDraftNextVariant?: () => void,
 *   onExportFocused?: () => void,
 *   onToggleDockLeft?: () => void,
 *   onToggleDockRight?: () => void,
 *   onToggleLetterIssuesFilter?: () => void,
 * }} ShortcutHandlers */

/**
 * @param {EventTarget | null} t
 */
function isEditableTarget(t) {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (t.isContentEditable) return true;
  return false;
}

/**
 * @param {ShortcutHandlers} handlers
 */
export function initKeyboardShortcuts(handlers = {}) {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const inEditable = isEditableTarget(e.target);
    const draftOpen = handlers.isDraftModalOpen?.() ?? false;

    if (e.key === 'Escape') {
      if (isCommandPaletteOpen()) {
        e.preventDefault();
        closeCommandPalette();
      }
      return;
    }

    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isCommandPaletteOpen()) closeCommandPalette();
      else openCommandPalette();
      return;
    }

    if (!inEditable && e.key === '/' && !mod) {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    if (e.key === '?' && !mod && !inEditable) {
      e.preventDefault();
      handlers.openShortcutsHelp?.();
      return;
    }

    if (draftOpen && mod) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlers.onDraftApprove?.();
        return;
      }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handlers.onDraftSave?.();
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onDraftDecline?.();
        return;
      }
    }

    if (draftOpen && !inEditable && !mod) {
      const digit = Number(e.key);
      if (digit >= 1 && digit <= 9) {
        e.preventDefault();
        handlers.onDraftSelectVariant?.(digit - 1);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlers.onDraftPrevVariant?.();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlers.onDraftNextVariant?.();
      }
    }

    if (mod && e.shiftKey && e.key.toLowerCase() === 'e' && !inEditable) {
      e.preventDefault();
      handlers.onExportFocused?.();
      return;
    }

    if (!inEditable && !draftOpen && !mod && e.altKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      handlers.onToggleLetterIssuesFilter?.();
      return;
    }

    if (!inEditable && !draftOpen && !mod && !e.altKey) {
      if (e.key === '[') {
        e.preventDefault();
        handlers.onToggleDockLeft?.();
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        handlers.onToggleDockRight?.();
      }
    }
  });
}
