/**
 * Модалка добавления URL вакансии (multi-source ingest).
 */

import { openModalEl, closeModalEl, getModalEl } from './modal-layout.mjs';
import { SOURCE_LABELS, APPLY_MODE_LABELS } from './source-badges.mjs';

let debounceTimer = null;

/**
 * @param {{
 *   api: (path: string, opts?: object) => Promise<any>,
 *   showToast: (msg: string, kind?: string) => void,
 *   onAdded?: () => void | Promise<void>,
 * }} hooks
 */
export function initIngestUrlModal(hooks) {
  const modal = getModalEl('ingest-url-modal');
  const urlInput = document.getElementById('ingest-url-input');
  const bulkInput = document.getElementById('ingest-url-bulk');
  const previewEl = document.getElementById('ingest-url-preview');
  const resultEl = document.getElementById('ingest-url-result');
  const submitBtn = document.getElementById('btn-ingest-url-submit');

  const updatePreview = async () => {
    const raw = String(urlInput?.value || '').trim().split(/\s+/)[0] || '';
    if (!previewEl) return;
    if (!raw) {
      previewEl.hidden = true;
      previewEl.textContent = '';
      return;
    }
    try {
      const p = await hooks.api(`/api/parse-url?url=${encodeURIComponent(raw)}`);
      previewEl.hidden = false;
      const src = SOURCE_LABELS[p.source] || p.source || '—';
      const mode = APPLY_MODE_LABELS[p.applyMode] || p.applyMode || '—';
      previewEl.textContent = `Источник: ${src} · отклик: ${mode}`;
    } catch {
      previewEl.hidden = false;
      previewEl.textContent = 'Не удалось разобрать URL';
    }
  };

  urlInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void updatePreview(), 280);
  });

  submitBtn?.addEventListener('click', () => void submitIngest(hooks));
  bulkInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submitIngest(hooks);
  });

  modal?.querySelector('.modal-close')?.addEventListener('click', () => closeIngestUrlModal());
}

export function openIngestUrlModal(prefill = '') {
  const modal = getModalEl('ingest-url-modal');
  const urlInput = document.getElementById('ingest-url-input');
  const bulkInput = document.getElementById('ingest-url-bulk');
  const resultEl = document.getElementById('ingest-url-result');
  if (resultEl) {
    resultEl.hidden = true;
    resultEl.textContent = '';
  }
  if (urlInput) urlInput.value = prefill || '';
  if (bulkInput) bulkInput.value = '';
  openModalEl(modal);
  urlInput?.focus();
}

export function closeIngestUrlModal() {
  closeModalEl(getModalEl('ingest-url-modal'));
}

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any>, showToast: (msg: string, kind?: string) => void, onAdded?: () => void | Promise<void> }} hooks
 */
async function submitIngest(hooks) {
  const urlInput = document.getElementById('ingest-url-input');
  const bulkInput = document.getElementById('ingest-url-bulk');
  const resultEl = document.getElementById('ingest-url-result');
  const submitBtn = document.getElementById('btn-ingest-url-submit');
  const single = String(urlInput?.value || '').trim();
  const bulk = String(bulkInput?.value || '').trim();
  const body = bulk ? { text: bulk } : single ? { url: single } : null;
  if (!body) {
    hooks.showToast('Введите URL', 'neutral');
    return;
  }
  if (submitBtn) submitBtn.disabled = true;
  try {
    const res = await hooks.api('/api/ingest-url', { method: 'POST', body: JSON.stringify(body) });
    const added = res.added ?? (res.results || []).filter((r) => r.added).length;
    const lines = (res.results || []).map((r) =>
      r.added ? `✓ ${r.url || r.id}` : `— ${r.reason || 'пропуск'}`
    );
    if (resultEl) {
      resultEl.hidden = false;
      resultEl.textContent = lines.length ? lines.join('\n') : added ? 'Добавлено' : 'Без изменений';
    }
    hooks.showToast(added ? `Добавлено: ${added}` : 'Ничего не добавлено', added ? 'good' : 'neutral');
    if (added) await hooks.onAdded?.();
  } catch (err) {
    hooks.showToast(err?.message || String(err), 'bad');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}
