/**
 * Follow-up по чатам: вопрос без ответа, приглашение без диалога.
 */

import { daysSinceApply } from './resume-role-actual.mjs';

/** @typedef {{ kind: 'question' | 'invite_nudge', label: string, priority: number, days?: number }} ChatFollowUp */

const INVITE_NUDGE_DEFAULT_DAYS = 2;

/**
 * @param {object} rec
 * @param {{ inviteNudgeAfterDays?: number }} [opts]
 * @returns {ChatFollowUp | null}
 */
export function classifyChatFollowUp(rec, opts = {}) {
  const h = rec?.hhApply || {};
  const summary = h.chatSummary || {};
  const messages = h.chatMessages || [];
  const inviteDays = Math.max(1, Number(opts.inviteNudgeAfterDays) || INVITE_NUDGE_DEFAULT_DAYS);

  if (summary.needsReply || summary.questionNeedsReply) {
    return {
      kind: 'question',
      label: 'Есть вопрос — нужен ответ',
      priority: 90,
    };
  }

  const invited =
    h.hhSiteState === 'invited' ||
    summary.lastKind === 'invite' ||
    h.negotiationStatus === 'invited' ||
    summary.inviteNudge;

  if (invited) {
    const employerMsgs = messages.filter((m) => !m.isMine && m.kind !== 'mine' && m.kind !== 'auto_reply');
    const myAfterInvite = messages.some((m, i) => {
      if (!(m.isMine || m.kind === 'mine')) return false;
      return messages.slice(0, i).some((x) => x.kind === 'invite');
    });

    const days = daysSinceApply(rec);
    const staleInvite =
      summary.inviteNudge ||
      summary.inviteFollowUp ||
      (employerMsgs.length <= 1 && !myAfterInvite && days != null && days >= inviteDays);

    if (staleInvite) {
      return {
        kind: 'invite_nudge',
        label: 'Пригласили — напомните о себе',
        priority: 70,
        days: days ?? undefined,
      };
    }
  }

  return null;
}

/**
 * @param {object[]} records
 * @param {object} [opts]
 */
export function listChatFollowUps(records, opts = {}) {
  const out = [];
  for (const rec of records) {
    const fu = classifyChatFollowUp(rec, opts);
    if (fu) out.push({ id: rec.id, title: rec.title, company: rec.company, ...fu });
  }
  out.sort((a, b) => b.priority - a.priority);
  return out;
}

/** @param {object} rec */
export function defaultInviteNudgeText(rec) {
  const title = rec?.title || 'вакансию';
  return (
    `Добрый день! Спасибо за приглашение по «${title}». ` +
    `Готов(а) обсудить детали и ответить на вопросы — подскажите удобное время для созвона.`
  );
}
