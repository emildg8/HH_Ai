/**
 * Классификация исхода отклика для воронки и обучения.
 */

import { HH_SITE_STATES } from './hh-vacancy-response-state.mjs';
import { daysSinceApply } from './resume-role-actual.mjs';

const TEMPLATE_REJECT =
  /не подход|не соответств|отказ|к сожалению|рассмотрим других|не готовы предложить|не можем предложить|не подойд/i;

const OFFER_HINT =
  /оффер|предлагаем вам|готовы сделать предложение|приглашаем на работу|выход на работу/i;

const SLOT_HINT =
  /собеседован|интервью|созвон|встреч|звонок в|назначен|календар/i;

/**
 * @param {object} rec
 */
export function classifyRecordOutcome(rec) {
  const st = String(rec?.hhApply?.hhSiteState || '').toLowerCase();
  const messages = rec?.hhApply?.chatMessages || [];
  const lastEmployer = [...messages].reverse().find((m) => !m.isMine && m.kind !== 'mine');
  const lastText = String(lastEmployer?.text || '').toLowerCase();
  const days = daysSinceApply(rec);

  if (st === 'archived' || st === HH_SITE_STATES.ARCHIVED) {
    return { bucket: 'A', class: 'archived_filled', label: 'Архив / закрыли' };
  }

  if (OFFER_HINT.test(lastText)) {
    return { bucket: 'F', class: 'offer_received', label: 'Оффер' };
  }

  if (st === HH_SITE_STATES.INVITED || SLOT_HINT.test(lastText)) {
    return { bucket: 'E', class: 'slot_scheduled', label: 'Слот собеседования' };
  }

  const employerMsgs = messages.filter((m) => !m.isMine && m.kind !== 'mine');
  const hasDialogue = employerMsgs.length > 0 || messages.some((m) => m.kind === 'question');

  if (st === HH_SITE_STATES.DECLINED || TEMPLATE_REJECT.test(lastText)) {
    if (hasDialogue && !TEMPLATE_REJECT.test(lastText)) {
      return { bucket: 'D', class: 'dialogue_active', label: 'Диалог' };
    }
    return { bucket: 'C', class: 'template_ai_reject', label: 'Шаблонный отказ' };
  }

  if ((st === 'viewed' || st === 'awaiting') && days != null && days >= 14 && !hasDialogue) {
    return { bucket: 'B', class: 'ghost_employer', label: 'Тишина / ghost' };
  }

  if (lastEmployer?.kind === 'auto_reply' || lastEmployer?.kind === 'question') {
    return { bucket: 'D', class: 'employer_ai_screen', label: 'ИИ / бот работодателя' };
  }

  if (hasDialogue) {
    return { bucket: 'D', class: 'human_hr', label: 'Диалог с HR' };
  }

  if (st === 'viewed') {
    return { bucket: 'D', class: 'viewed_pending', label: 'Просмотрели, ждём' };
  }

  if (rec.hhApply?.responseSubmitted || rec.status === 'responded') {
    return { bucket: 'D', class: 'awaiting_response', label: 'Отклик отправлен' };
  }

  return { bucket: '—', class: 'pending', label: 'В очереди' };
}

/**
 * @param {object[]} records
 */
export function classifyAllRecords(records) {
  const summary = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, other: 0 };
  const items = [];
  for (const rec of records || []) {
    const outcome = classifyRecordOutcome(rec);
    items.push({ id: rec.id, title: rec.title, company: rec.company, ...outcome });
    if (summary[outcome.bucket] != null) summary[outcome.bucket]++;
    else summary.other++;
  }
  return { summary, items };
}
