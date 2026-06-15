/**
 * Intelligence mini-panel (bySource / byTier) + модалка digest.
 */

import { openModalEl, closeModalEl, getModalEl } from './modal-layout.mjs';
import { SOURCE_UI_LABELS, TIER_CLASS_LABEL } from './dashboard-copy-ru.mjs';

/** @type {object | null} */
let lastDigest = null;

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any> }} hooks
 */
export function initIntelligencePanel(hooks) {
  const host = document.getElementById('intelligence-sources');
  host?.addEventListener('click', () => {
    if (lastDigest) openIntelligenceDigestModal(lastDigest);
    else void refreshIntelligencePanel(hooks);
  });
  document.getElementById('btn-open-intelligence-digest')?.addEventListener('click', () => {
    if (lastDigest) openIntelligenceDigestModal(lastDigest);
    else void refreshIntelligencePanel(hooks).then(() => {
      if (lastDigest) openIntelligenceDigestModal(lastDigest);
    });
  });
  const closeBtn = getModalEl('intelligence-digest-modal')?.querySelector('.modal-close');
  closeBtn?.addEventListener('click', () => closeIntelligenceDigestModal());
}

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any> }} hooks
 */
export async function refreshIntelligencePanel(hooks) {
  const el = document.getElementById('intelligence-sources');
  if (!el) return;
  try {
    const d = await hooks.api('/api/intelligence-digest');
    lastDigest = d;
    const bySource = d.bySource || {};
    const entries = Object.entries(bySource);
    if (!entries.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const max = Math.max(...entries.map(([, s]) => Number(s.added) || 0), 1);
    const chips = entries
      .map(([src, s]) => {
        const label = SOURCE_UI_LABELS[src] || src;
        const invited = s.invited ? ` · ${s.invited} пригл.` : '';
        return `<button type="button" class="funnel-mini--sources__chip hh-badge hh-badge--chip source-badge--${src}" data-source-filter="${src}" title="${label}: ${s.added}">${label}: ${s.added}${invited}</button>`;
      })
      .join('');
    const tiers = d.byTier || {};
    const tierTotal = (tiers.A || 0) + (tiers.B || 0) + (tiers.C || 0) + (tiers.D || 0) || 1;
    const tierBars = ['A', 'B', 'C', 'D']
      .map((t) => {
        const n = tiers[t] || 0;
        const w = Math.max(4, (n / tierTotal) * 100);
        return `<div class="funnel-mini--sources__tier-step" title="${TIER_CLASS_LABEL[t] || `Оценка ${t}`}: ${n}">
          <span class="tier-badge tier-badge--${t}">${TIER_CLASS_LABEL[t] || t}</span>
          <span class="funnel-mini--sources__tier-bar" style="width:${w}%"></span>
          <span class="funnel-mini--sources__tier-num">${n}</span>
        </div>`;
      })
      .join('');
    el.innerHTML = `
      <div class="funnel-mini--sources__chips" role="group" aria-label="Источники в очереди">${chips}</div>
      <div class="funnel-mini--sources__tiers">${tierBars}</div>`;
    el.querySelectorAll('[data-source-filter]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const src = btn.getAttribute('data-source-filter');
        const sel = document.getElementById('sidebar-filter-source');
        if (sel && src) {
          sel.value = src;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  } catch {
    el.hidden = true;
  }
}

/** @param {object} d */
export function openIntelligenceDigestModal(d) {
  const modal = getModalEl('intelligence-digest-modal');
  const body = document.getElementById('intelligence-digest-body');
  const meta = document.getElementById('intelligence-digest-meta');
  if (!modal || !body) return;
  const suggestions = (d.suggestions || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const rows = Object.entries(d.bySource || {})
    .map(([src, s]) => {
      const label = SOURCE_UI_LABELS[src] || src;
      return `<tr><td>${escapeHtml(label)}</td><td>${s.added ?? 0}</td><td>${s.invited ?? 0}</td><td>${s.manual ?? 0}</td></tr>`;
    })
    .join('');
  if (meta) {
    const tiers = d.byTier || {};
    meta.textContent = `Оценки: ${TIER_CLASS_LABEL.A} ${tiers.A || 0} · ${TIER_CLASS_LABEL.B} ${tiers.B || 0} · ${TIER_CLASS_LABEL.C} ${tiers.C || 0} · ${TIER_CLASS_LABEL.D} ${tiers.D || 0}`;
  }
  body.innerHTML = `
    ${suggestions ? `<ul class="intelligence-digest__suggestions">${suggestions}</ul>` : ''}
    <table class="intelligence-digest__table">
      <thead><tr><th>Источник</th><th>В очереди</th><th>Приглаш.</th><th>Ручные</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Нет данных</td></tr>'}</tbody>
    </table>`;
  openModalEl(modal);
}

export function closeIntelligenceDigestModal() {
  closeModalEl(getModalEl('intelligence-digest-modal'));
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
