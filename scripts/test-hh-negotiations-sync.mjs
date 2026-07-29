/**
 * Unit-тесты parseNegotiationStatusParsed / resolveInviteKind / hhSiteState (без Playwright).
 *   node scripts/test-hh-negotiations-sync.mjs
 */

import {
  INVITE_KINDS,
  parseNegotiationStatusParsed,
  resolveInviteKind,
  negotiationStatusToHhSiteState,
  inviteKindLabelRu,
} from '../lib/hh-invite-kind.mjs';
import { parseNegotiationStatusText } from '../lib/hh-negotiations-sync.mjs';
import { HH_SITE_STATES } from '../lib/hh-vacancy-response-state.mjs';
import { statusPatchFromNegotiation } from '../lib/work-format-truth.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Вкладка «Собеседование» без «приглаш» в первых 40 символах — awaiting, не invited
const tabStage = parseNegotiationStatusParsed('Собеседование');
assert(tabStage.status === 'awaiting', 'tab Собеседование → awaiting');
assert(tabStage.inviteKind === INVITE_KINDS.HH_TAB_STAGE, 'tab Собеседование → hh_tab_stage');
assert(
  negotiationStatusToHhSiteState(tabStage.status, tabStage.inviteKind) === HH_SITE_STATES.AWAITING,
  'hh_tab_stage → awaiting site state'
);
assert(parseNegotiationStatusText('Собеседование') === 'awaiting', 'parseNegotiationStatusText tab compat');

// Явное приглашение в статусе
const silent = parseNegotiationStatusParsed('Приглашение на собеседование');
assert(silent.status === 'invited', 'Приглашение → invited');
assert(silent.inviteKind === INVITE_KINDS.SILENT_INVITE, 'Приглашение → silent_invite');
assert(
  negotiationStatusToHhSiteState(silent.status, silent.inviteKind) === HH_SITE_STATES.INVITED,
  'silent_invite → invited site state'
);

// Просмотрен
const viewed = parseNegotiationStatusParsed('Просмотрен');
assert(viewed.status === 'viewed', 'Просмотрен → viewed');
assert(viewed.inviteKind === INVITE_KINDS.NONE, 'Просмотрен → none inviteKind');

// Отказ CTO — регрессия кириллического «отказ»
assert(parseNegotiationStatusText('Отказ Технический директор (CTO)') === 'declined', 'Отказ CTO → declined');
assert(parseNegotiationStatusText('Отказ 11:44') === 'declined', 'Отказ + время → declined');
assert(
  parseNegotiationStatusText(
    'Отказ Инженер сопровождения банковского ПО СПБ Биржа вчера Был онлайн сегодня'
  ) === 'declined',
  'Отказ + длинный raw → declined'
);
assert(
  negotiationStatusToHhSiteState('declined', INVITE_KINDS.NONE) === HH_SITE_STATES.DECLINED,
  'declined → hhSiteState declined'
);

// Чат с invite от работодателя перебивает silent_invite
const chatResolved = resolveInviteKind({
  negotiationStatusRaw: 'Приглашение на собеседование',
  negotiationStatus: 'invited',
  chatMessages: [{ text: 'Ждём вас на созвоне', isMine: false, kind: 'invite' }],
});
assert(chatResolved.inviteKind === INVITE_KINDS.REAL_HR_INVITE, 'chat invite → real_hr_invite');
assert(chatResolved.inviteEvidence.source === 'chat', 'chat evidence source');
assert(
  negotiationStatusToHhSiteState('invited', chatResolved.inviteKind) === HH_SITE_STATES.INVITED,
  'real_hr_invite → invited site state'
);

// Анкета пройдена
const qResolved = resolveInviteKind({
  negotiationStatusRaw: 'Собеседование',
  questionnaire: { status: 'completed' },
});
assert(qResolved.inviteKind === INVITE_KINDS.QUESTIONNAIRE_COMPLETED, 'questionnaire completed kind');
assert(
  negotiationStatusToHhSiteState('awaiting', qResolved.inviteKind) === HH_SITE_STATES.AWAITING,
  'questionnaire_completed → awaiting site state'
);

// UI-метки
assert(inviteKindLabelRu(INVITE_KINDS.REAL_HR_INVITE).includes('HR'), 'label real_hr_invite');
assert(inviteKindLabelRu(INVITE_KINDS.HH_TAB_STAGE).includes('Собеседование'), 'label hh_tab_stage');

assert(
  statusPatchFromNegotiation('pending', 'declined').status === 'declined',
  'pending + отказ hh → status declined'
);
assert(
  statusPatchFromNegotiation('applied', 'declined').status === 'declined',
  'applied + отказ → declined'
);
assert(
  statusPatchFromNegotiation('pending', 'viewed').status === 'applied',
  'pending + viewed → applied'
);
assert(
  Object.keys(statusPatchFromNegotiation('declined', 'declined')).length === 0,
  'уже declined — без лишнего patch'
);

console.log('OK: test-hh-negotiations-sync.mjs');
