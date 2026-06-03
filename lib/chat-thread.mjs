/**
 * Нормализация потоков чата hh.ru и merge в очередь.
 */

import { classifyChatMessage, summarizeChatThread } from './chat-message-classify.mjs';
import { negotiationStatusToHhSiteState } from './hh-negotiations-sync.mjs';
import { buildHhApplySiteStatePatch, hhSiteStateLabel } from './hh-vacancy-response-state.mjs';
import { loadQueue, updateVacancyRecord } from './store.mjs';

const JUNK_LINE =
  /^(©|hh\.ru|Помощь|Соискателям|Работодателям|Москва|Санкт|Россия|Поддержка|Вакансии|Резюме|Ещё|Найти)/i;

/**
 * @param {string} url
 */
export function extractVacancyIdFromUrl(url) {
  const s = String(url || '');
  const m =
    s.match(/\/vacancy\/(\d+)/i) ||
    s.match(/vacancyId=(\d+)/i) ||
    s.match(/vacancy[/=](\d+)/i);
  return m ? m[1] : '';
}

/**
 * @param {string} url
 */
export function normalizeChatUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('http')) return s.split('?')[0];
  return `https://hh.ru${s.startsWith('/') ? '' : '/'}${s}`.split('?')[0];
}

/**
 * @param {string} url
 */
export function chatUrlKey(url) {
  const n = normalizeChatUrl(url);
  const m = n.match(/\/chat\/(\d+)/) || n.match(/\/negotiation[s]?\/(\d+)/i);
  return m ? m[1] : n;
}

/**
 * @param {object} thread
 * @param {object} rec
 */
export function matchThreadToRecord(thread, rec) {
  const tVid = String(thread.vacancyId || extractVacancyIdFromUrl(thread.chatUrl) || '');
  let rVid = String(rec.vacancyId || '');
  if (!rVid && rec.url) rVid = extractVacancyIdFromUrl(rec.url);
  if (tVid && rVid && tVid === rVid) return true;

  const tChat = chatUrlKey(thread.chatUrl);
  const rChat = chatUrlKey(rec.hhApply?.chatUrl);
  if (tChat && rChat && tChat === rChat) return true;

  const tNorm = normalizeChatUrl(thread.chatUrl);
  const rNorm = normalizeChatUrl(rec.hhApply?.chatUrl);
  if (tNorm && rNorm && tNorm === rNorm) return true;

  return false;
}

/**
 * @param {Array<{ text: string, isMine?: boolean }>} raw
 */
export function normalizeChatMessages(raw) {
  const out = [];
  for (const m of raw || []) {
    const text = String(m.text || '').trim();
    if (!text || text.length < 2) continue;
    if (JUNK_LINE.test(text)) continue;
    if (text.length > 500 && /©|Лицензия|Пользовательское соглашение/i.test(text)) continue;
    const isMine = Boolean(m.isMine);
    const kind = m.kind || classifyChatMessage({ text, isMine });
    out.push({
      text: text.slice(0, 4000),
      isMine,
      kind,
      at: m.at || new Date().toISOString(),
    });
  }
  return out;
}

/**
 * @param {ReturnType<typeof summarizeChatThread>} summary
 * @param {object[]} messages
 */
export function enrichChatSummary(summary, messages) {
  let lastEmployerIdx = -1;
  let lastMineIdx = -1;
  let lastQuestionIdx = -1;
  let lastInviteIdx = -1;

  messages.forEach((m, i) => {
    if (m.isMine || m.kind === 'mine') lastMineIdx = i;
    else {
      if (m.kind === 'question') lastQuestionIdx = i;
      if (m.kind === 'invite') lastInviteIdx = i;
      if (m.kind !== 'auto_reply') lastEmployerIdx = i;
    }
  });

  const questionNeedsReply = lastQuestionIdx >= 0 && lastMineIdx < lastQuestionIdx;
  const needsReply = questionNeedsReply;

  const inviteFollowUp =
    lastInviteIdx >= 0 &&
    lastMineIdx < lastInviteIdx &&
    !messages.slice(lastInviteIdx + 1).some((m) => !m.isMine && m.kind === 'question');

  const employerSubstantive = messages.filter(
    (m) => !m.isMine && m.kind !== 'mine' && m.kind !== 'auto_reply'
  );

  const inviteNudge =
    (summary.lastKind === 'invite' || lastInviteIdx >= 0) &&
    employerSubstantive.length <= 1 &&
    lastMineIdx < Math.max(lastInviteIdx, lastEmployerIdx);

  return {
    ...summary,
    needsReply,
    questionNeedsReply,
    inviteFollowUp,
    inviteNudge,
    lastEmployerKind: messages[lastEmployerIdx]?.kind || summary.lastKind,
  };
}

/**
 * @param {object} hhApply
 * @param {object} summary
 */
export function applyOutcomesFromChat(hhApply, summary) {
  const next = { ...(hhApply || {}) };
  const cur = next.hhSiteState;

  let fromChat = null;
  if (summary.lastKind === 'decline' || summary.lastEmployerKind === 'decline') {
    fromChat = 'declined';
  } else if (summary.lastKind === 'invite' || summary.inviteFollowUp || summary.inviteNudge) {
    fromChat = 'invited';
  }

  if (fromChat && (!cur || fromChat === 'declined' || (fromChat === 'invited' && cur !== 'declined'))) {
    const patch = buildHhApplySiteStatePatch(next, {
      state: fromChat,
      label: hhSiteStateLabel(fromChat),
      source: 'chat-sync',
    });
    Object.assign(next, patch);
  }

  if (summary.lastKind === 'decline') {
    next.negotiationStatus = 'declined';
  } else if (summary.lastKind === 'invite') {
    next.negotiationStatus = 'invited';
  }

  return next;
}

/**
 * @param {object} thread
 * @param {object} rec
 */
export function buildChatPatchFromThread(thread, rec) {
  const messages = normalizeChatMessages(thread.messages);
  const baseSummary = summarizeChatThread(messages);
  const chatSummary = enrichChatSummary(baseSummary, messages);
  let hhApply = applyOutcomesFromChat(rec.hhApply || {}, chatSummary);
  hhApply = {
    ...hhApply,
    chatMessages: messages.slice(-30),
    chatSummary,
    chatUrl: thread.chatUrl || hhApply.chatUrl || rec.hhApply?.chatUrl,
    chatSyncedAt: thread.syncedAt || new Date().toISOString(),
  };
  return { hhApply };
}

/**
 * @param {object[]} threads
 * @param {{ items?: object[] }} [cache]
 */
export function mergeChatThreadsIntoQueue(threads, cache = {}) {
  const queue = loadQueue();
  let updated = 0;
  const matchedIds = new Set();

  for (const rec of queue) {
    const thread = threads.find((t) => matchThreadToRecord(t, rec));
    if (!thread) continue;
    const patch = buildChatPatchFromThread(thread, rec);
    updateVacancyRecord(rec.id, patch);
    matchedIds.add(rec.id);
    updated++;
  }

  const cacheItems = cache.items || [];
  for (const it of cacheItems) {
    const vid = String(it.vacancyId || '');
    if (!vid) continue;
    const thread = threads.find(
      (t) =>
        String(t.vacancyId || extractVacancyIdFromUrl(t.chatUrl)) === vid ||
        (t.chatUrl && it.chatUrl && chatUrlKey(t.chatUrl) === chatUrlKey(it.chatUrl))
    );
    if (!thread) continue;
    const messages = normalizeChatMessages(thread.messages);
    const chatSummary = enrichChatSummary(summarizeChatThread(messages), messages);
    it.chatMessages = messages.slice(-30);
    it.chatSummary = chatSummary;
    it.chatSyncedAt = thread.syncedAt;
    if (thread.chatUrl) it.chatUrl = thread.chatUrl;
    const st =
      chatSummary.lastKind === 'decline' ? 'declined' : chatSummary.lastKind === 'invite' ? 'invited' : it.status;
    if (st && st !== it.status) {
      it.status = st;
      it.hhSiteState = negotiationStatusToHhSiteState(st);
    }
  }

  return { updated, total: queue.length, threads: threads.length, matchedIds: [...matchedIds] };
}

/**
 * @param {object} rec
 */
export function recordVacancyId(rec) {
  let vid = String(rec.vacancyId || '');
  if (!vid && rec.url) vid = extractVacancyIdFromUrl(rec.url);
  if (!vid && rec.id?.startsWith('hh-neg-')) vid = rec.id.slice('hh-neg-'.length);
  return vid;
}
