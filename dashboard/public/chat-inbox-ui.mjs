/**
 * UI inbox чатов (CH-UI-1 / CH-UI-2).
 */

import { openModalEl, closeModalEl } from './modal-layout.mjs';

const MODAL_ID = 'chat-inbox-modal';
/** @type {string} */
let activeFilter = 'all';
/** @type {string | null} */
let activeThreadId = null;
/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

/** @type {{ api: Function, showToast: Function, onOpenThread?: (id: string) => void }} */
let hooks = {
  api: async () => ({}),
  showToast: () => {},
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function modalEl() {
  return document.getElementById(MODAL_ID);
}

function setBadge(count) {
  const n = Math.max(0, Number(count) || 0);
  document.querySelectorAll('[data-chat-inbox-badge]').forEach((el) => {
    el.textContent = n > 0 ? String(n) : '';
    el.hidden = n <= 0;
  });
  const trackBtn = document.querySelector('.workflow-nav__step[data-workflow="track"]');
  if (trackBtn) {
    trackBtn.dataset.chatUnread = n > 0 ? String(n) : '';
    trackBtn.title = n > 0 ? `Следить · ${n} чат(ов) ждут ответа` : 'Отправленные отклики';
  }
}

async function refreshBadge() {
  try {
    const data = await hooks.api('/api/chat-inbox?filter=needs_reply&limit=1');
    const n = data?.counts?.needs_reply ?? 0;
    setBadge(n);
    return n;
  } catch {
    return 0;
  }
}

function renderThreadList(items) {
  const list = document.getElementById('chat-inbox-list');
  if (!list) return;
  if (!items?.length) {
    list.innerHTML = '<p class="chat-inbox-empty">Нет чатов в этом фильтре. Синхронизируйте чаты hh.ru.</p>';
    return;
  }
  list.innerHTML = items
    .map((it) => {
      const active = it.id === activeThreadId ? ' chat-inbox-item--active' : '';
      const badge = it.chatSummary?.needsReply || it.chatSummary?.questionNeedsReply ? ' · ждёт ответ' : '';
      return `<button type="button" class="chat-inbox-item${active}" data-thread-id="${escapeHtml(it.id)}">
        <span class="chat-inbox-item__title">${escapeHtml(it.title || '—')}</span>
        <span class="chat-inbox-item__meta">${escapeHtml(it.company || '')}${escapeHtml(badge)}</span>
        <span class="chat-inbox-item__preview">${escapeHtml(it.lastPreview || '')}</span>
      </button>`;
    })
    .join('');
  list.querySelectorAll('[data-thread-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-thread-id');
      if (id) void openThread(id);
    });
  });
}

function renderThreadDetail(thread) {
  const detail = document.getElementById('chat-inbox-detail');
  const draftEl = document.getElementById('chat-inbox-draft');
  if (!detail || !thread) return;
  const msgs = (thread.messages || [])
    .map(
      (m) =>
        `<div class="chat-inbox-msg ${m.isMine || m.kind === 'mine' ? 'chat-inbox-msg--mine' : ''}">` +
        `<span class="chat-inbox-msg__who">${escapeHtml(m.who || '')}</span>` +
        `<p class="chat-inbox-msg__text">${escapeHtml(m.text || '')}</p></div>`
    )
    .join('');
  detail.innerHTML =
    `<header class="chat-inbox-detail__head">` +
    `<strong>${escapeHtml(thread.title || '—')}</strong>` +
    (thread.chatUrl
      ? ` <a class="btn btn-ghost btn-sm" href="${escapeHtml(thread.chatUrl)}" target="_blank" rel="noopener">На hh.ru</a>`
      : '') +
    `</header>` +
    `<div class="chat-inbox-msgs">${msgs || '<p class="chat-inbox-empty">Сообщений пока нет</p>'}</div>`;
  if (draftEl) {
    draftEl.value = thread.chatReplyDraft || '';
  }
}

async function loadInbox() {
  const data = await hooks.api(`/api/chat-inbox?filter=${encodeURIComponent(activeFilter)}&limit=80`);
  renderThreadList(data.items || []);
  if (activeThreadId) {
    const still = (data.items || []).some((x) => x.id === activeThreadId);
    if (!still) {
      activeThreadId = null;
      const detail = document.getElementById('chat-inbox-detail');
      if (detail) detail.innerHTML = '<p class="chat-inbox-empty">Выберите диалог слева</p>';
    }
  }
  if (data.counts) setBadge(data.counts.needs_reply ?? 0);
  return data;
}

async function openThread(id) {
  activeThreadId = id;
  const data = await hooks.api(`/api/chat-inbox?id=${encodeURIComponent(id)}`);
  if (!data.thread) throw new Error('Поток не найден');
  renderThreadDetail(data.thread);
  document.querySelectorAll('.chat-inbox-item').forEach((el) => {
    el.classList.toggle('chat-inbox-item--active', el.getAttribute('data-thread-id') === id);
  });
  hooks.onOpenThread?.(id);
}

async function markSent() {
  if (!activeThreadId) return;
  const draftEl = document.getElementById('chat-inbox-draft');
  const text = draftEl?.value?.trim() || '';
  await hooks.api('/api/chat-mark-sent', {
    method: 'POST',
    body: JSON.stringify({ id: activeThreadId, text }),
  });
  hooks.showToast('Отмечено как отправлено', 'good');
  await loadInbox();
  if (activeThreadId) await openThread(activeThreadId);
  await refreshBadge();
}

export async function openChatInboxModal(opts = {}) {
  const modal = modalEl();
  if (!modal) return;
  if (opts.threadId) activeThreadId = opts.threadId;
  if (opts.filter) activeFilter = opts.filter;
  openModalEl(modal);
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollTimer = setInterval(() => {
    if (modal.hidden) return;
    void loadInbox().catch(() => {});
  }, 30_000);
  try {
    await loadInbox();
    if (activeThreadId) await openThread(activeThreadId);
  } catch (e) {
    hooks.showToast(e.message || 'Не удалось загрузить чаты', 'bad');
  }
}

export function closeChatInboxModal() {
  closeModalEl(modalEl());
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * @param {{ api: Function, showToast: Function, onOpenThread?: (id: string) => void }} h
 */
export function initChatInboxUi(h) {
  hooks = { ...hooks, ...h };
  const modal = modalEl();
  if (!modal) return;

  modal.querySelectorAll('[data-close-chat-inbox]').forEach((el) => {
    el.addEventListener('click', () => closeChatInboxModal());
  });

  document.getElementById('btn-open-chat-inbox')?.addEventListener('click', () => {
    void openChatInboxModal();
  });

  document.querySelectorAll('[data-open-chat-inbox]').forEach((el) => {
    el.addEventListener('click', () => void openChatInboxModal());
  });

  modal.querySelectorAll('[data-chat-inbox-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFilter = btn.getAttribute('data-chat-inbox-filter') || 'all';
      modal.querySelectorAll('[data-chat-inbox-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      void loadInbox();
    });
  });

  document.getElementById('btn-chat-inbox-mark-sent')?.addEventListener('click', () => {
    void markSent().catch((e) => hooks.showToast(e.message, 'bad'));
  });

  document.getElementById('btn-chat-inbox-refresh')?.addEventListener('click', () => {
    void loadInbox().catch((e) => hooks.showToast(e.message, 'bad'));
  });

  void refreshBadge();
  setInterval(() => void refreshBadge(), 60_000);
}

export { refreshBadge as refreshChatInboxBadge, openThread as openChatInboxThread };
