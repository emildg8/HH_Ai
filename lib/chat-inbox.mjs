/**
 * Inbox чатов: агрегация потоков из очереди и кэша переговоров.
 */

import { loadQueue, getVacancyRecord } from './store.mjs';
import { buildHhNegotiationOnlyCards } from './hh-negotiation-cards.mjs';
import { classifyChatFollowUp } from './chat-follow-up.mjs';
import { recordVacancyId } from './chat-thread.mjs';

/** @typedef {'needs_reply' | 'invite_nudge' | 'declined' | 'all'} ChatInboxFilter */

/**
 * @param {object} rec
 */
function inboxRowFromRecord(rec) {
  const h = rec.hhApply || {};
  const summary = h.chatSummary || {};
  const messages = h.chatMessages || [];
  const followUp = classifyChatFollowUp(rec);
  return {
    id: rec.id,
    vacancyId: recordVacancyId(rec),
    title: rec.title || '—',
    company: rec.company || '',
    chatUrl: h.chatUrl || rec.url || '',
    messageCount: messages.length,
    chatSummary: summary,
    chatSyncedAt: h.chatSyncedAt || null,
    chatReplyDraft: h.chatReplyDraft?.reply || '',
    hhSiteState: h.hhSiteState,
    negotiationStatus: h.negotiationStatus || (h.hhSiteState === 'declined' ? 'declined' : ''),
    followUpKind: followUp?.kind || null,
    followUpLabel: followUp?.label || null,
    lastPreview: messages.length ? String(messages[messages.length - 1].text || '').slice(0, 160) : '',
    priority: followUp?.priority ?? 0,
  };
}

/**
 * @param {object} row
 * @param {ChatInboxFilter} filter
 */
function rowHasInboxPresence(row) {
  return (
    row.messageCount > 0 ||
    Boolean(row.chatUrl) ||
    row.hhSiteState === 'declined' ||
    row.negotiationStatus === 'declined' ||
    Boolean(row.chatSummary && Object.keys(row.chatSummary).length)
  );
}

function matchesFilter(row, filter) {
  if (filter === 'all') return rowHasInboxPresence(row);
  if (filter === 'needs_reply') {
    return row.chatSummary?.needsReply || row.chatSummary?.questionNeedsReply || row.followUpKind === 'question';
  }
  if (filter === 'invite_nudge') {
    return row.chatSummary?.inviteNudge || row.followUpKind === 'invite_nudge';
  }
  if (filter === 'declined') {
    return (
      row.hhSiteState === 'declined' ||
      row.negotiationStatus === 'declined' ||
      row.chatSummary?.lastKind === 'decline'
    );
  }
  return true;
}

function recordEligibleForInbox(rec) {
  const h = rec.hhApply || {};
  if (h.chatMessages?.length || h.chatUrl || (h.chatSummary && Object.keys(h.chatSummary).length)) return true;
  if (h.hhSiteState === 'declined' || h.negotiationStatus === 'declined') return true;
  return false;
}

function collectInboxRows() {
  const rows = [];
  const seen = new Set();

  for (const rec of loadQueue()) {
    if (!recordEligibleForInbox(rec)) continue;
    rows.push(inboxRowFromRecord(rec));
    seen.add(rec.id);
  }

  const negCards = buildHhNegotiationOnlyCards();
  for (const card of negCards) {
    if (seen.has(card.id)) continue;
    const rec = {
      id: card.id,
      title: card.title,
      company: card.company,
      vacancyId: card.vacancyId,
      url: card.url,
      hhApply: card.hhApply,
      negotiationOnly: true,
    };
    if (!recordEligibleForInbox(rec)) continue;
    rows.push(inboxRowFromRecord(rec));
    seen.add(card.id);
  }

  rows.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ta = Date.parse(a.chatSyncedAt || '') || 0;
    const tb = Date.parse(b.chatSyncedAt || '') || 0;
    return tb - ta;
  });

  return rows;
}

export function countByFilter() {
  const rows = collectInboxRows();
  return {
    all: rows.filter((r) => matchesFilter(r, 'all')).length,
    needs_reply: rows.filter((r) => matchesFilter(r, 'needs_reply')).length,
    invite_nudge: rows.filter((r) => matchesFilter(r, 'invite_nudge')).length,
    declined: rows.filter((r) => matchesFilter(r, 'declined')).length,
  };
}

/**
 * @param {{ filter?: ChatInboxFilter, limit?: number }} [opts]
 */
export function buildChatInbox(opts = {}) {
  const filter = opts.filter || 'all';
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 100));
  const rows = collectInboxRows().filter((r) => matchesFilter(r, filter));
  return {
    filter,
    total: rows.length,
    items: rows.slice(0, limit),
    counts: countByFilter(),
  };
}

/**
 * @param {string} id
 */
export function getChatThreadDetail(id) {
  let rec = getVacancyRecord(id);
  if (!rec && String(id).startsWith('hh-neg-')) {
    const card = buildHhNegotiationOnlyCards().find((c) => c.id === id);
    if (card) {
      rec = {
        id: card.id,
        title: card.title,
        company: card.company,
        vacancyId: card.vacancyId,
        url: card.url,
        hhApply: card.hhApply,
      };
    }
  }
  if (!rec) return null;
  const h = rec.hhApply || {};
  return {
    ...inboxRowFromRecord(rec),
    messages: (h.chatMessages || []).map((m) => ({
      ...m,
      who:
        m.isMine || m.kind === 'mine'
          ? 'Вы'
          : m.kind === 'question'
            ? 'Вопрос'
            : m.kind === 'invite'
              ? 'Приглашение'
              : m.kind === 'decline'
                ? 'Отказ'
                : 'HR',
    })),
  };
}
