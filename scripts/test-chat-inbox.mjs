/**
 * Unit-тесты inbox чатов (без Playwright).
 */
import {
  matchThreadToRecord,
  enrichChatSummary,
  applyOutcomesFromChat,
  normalizeChatMessages,
} from '../lib/chat-thread.mjs';
import { summarizeChatThread } from '../lib/chat-message-classify.mjs';
import { classifyChatFollowUp, defaultInviteNudgeText } from '../lib/chat-follow-up.mjs';
import { shouldRunChatFollowUpSchedule } from '../lib/chat-follow-up-schedule.mjs';
import { buildChatSendPatch } from '../lib/chat-reply-send.mjs';
import { checkChatSendRateLimit, recordChatSendLaunch, countChatSendLastHour } from '../lib/chat-send-rate.mjs';
import { parseNegotiationStatusText } from '../lib/hh-negotiations-sync.mjs';

function recordEligibleForInbox(rec) {
  const h = rec.hhApply || {};
  if (h.chatMessages?.length || h.chatUrl || (h.chatSummary && Object.keys(h.chatSummary).length)) return true;
  if (h.hhSiteState === 'declined' || h.negotiationStatus === 'declined') return true;
  return false;
}

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const rec = {
  id: 'v1',
  vacancyId: '12345',
  title: 'DevOps',
  hhApply: { chatUrl: 'https://hh.ru/chat/999' },
};

assert(matchThreadToRecord({ vacancyId: '12345', chatUrl: 'https://hh.ru/chat/1' }, rec), 'match by vacancyId');
assert(
  matchThreadToRecord({ chatUrl: 'https://hh.ru/chat/999' }, rec),
  'match by chatUrl key'
);
assert(
  !matchThreadToRecord({ vacancyId: '99999', chatUrl: 'https://hh.ru/chat/888' }, rec),
  'no false match'
);

const msgs = normalizeChatMessages([
  { text: 'Приглашаем на собеседование', isMine: false },
  { text: 'Спасибо!', isMine: true },
]);
const summary = enrichChatSummary(summarizeChatThread(msgs), msgs);
assert(summary.lastKind === 'invite' || msgs[0].kind === 'invite', 'invite kind');

const qMsgs = normalizeChatMessages([
  { text: 'Какой у вас опыт с Kubernetes?', isMine: false },
]);
const qSummary = enrichChatSummary(summarizeChatThread(qMsgs), qMsgs);
assert(qSummary.needsReply && qSummary.questionNeedsReply, 'question needs reply');

const answered = normalizeChatMessages([
  { text: 'Какой опыт?', isMine: false },
  { text: '5 лет', isMine: true },
]);
const aSummary = enrichChatSummary(summarizeChatThread(answered), answered);
assert(!aSummary.questionNeedsReply, 'answered clears needsReply');

const declined = applyOutcomesFromChat(
  {},
  enrichChatSummary(summarizeChatThread(normalizeChatMessages([{ text: 'К сожалению, отказ', isMine: false }])), [
    { text: 'К сожалению, отказ', isMine: false, kind: 'decline' },
  ])
);
assert(declined.hhSiteState === 'declined', 'decline from chat');

const nudgeRec = {
  title: 'SRE',
  hhApply: {
    hhSiteState: 'invited',
    chatMessages: [{ text: 'Приглашаем', isMine: false, kind: 'invite' }],
    chatSummary: { lastKind: 'invite', inviteNudge: true },
  },
  appliedAt: new Date(Date.now() - 5 * 864e5).toISOString(),
};
const fu = classifyChatFollowUp(nudgeRec, { inviteNudgeAfterDays: 2 });
assert(fu?.kind === 'invite_nudge', 'invite nudge follow-up');

const nudgeText = defaultInviteNudgeText(nudgeRec);
assert(nudgeText.includes('SRE'), 'nudge text has title');

const sched = shouldRunChatFollowUpSchedule(new Date('2020-01-01T07:30:00Z'));
assert(typeof sched.run === 'boolean', 'schedule returns run flag');

const patch = buildChatSendPatch(
  { id: 'x', hhApply: { chatMessages: [], chatSummary: { needsReply: true } } },
  'Тестовый ответ'
);
assert(patch.hhApply.chatLastSentAt, 'send patch sets lastSentAt');
assert(!patch.hhApply.chatSummary.needsReply, 'send patch clears needsReply');

assert(checkChatSendRateLimit() === null || typeof checkChatSendRateLimit() === 'string', 'rate limit check');
recordChatSendLaunch();
assert(countChatSendLastHour() >= 1, 'record chat send launch');

assert(
  recordEligibleForInbox({
    id: 'x',
    hhApply: { hhSiteState: 'declined', chatMessages: [] },
  }),
  'declined without messages still in inbox'
);
assert(
  !recordEligibleForInbox({ id: 'y', hhApply: { hhSiteState: 'viewed' } }),
  'viewed without chat data not in inbox'
);

assert(
  parseNegotiationStatusText('Отказ Технический директор (CTO)') === 'declined',
  'отказ in statusRaw (кириллица, без \\b)'
);

if (errors.length) {
  console.error('FAIL test-chat-inbox:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('test-chat-inbox: OK');
