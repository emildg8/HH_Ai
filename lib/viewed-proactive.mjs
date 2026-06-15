/**
 * Проактивное сообщение при просмотре без ответа 3+ дней.
 */

import { daysSinceApply } from './resume-role-actual.mjs';

/**
 * @param {object[]} records
 * @param {{ minDays?: number, limit?: number }} [opts]
 */
export function listViewedProactiveCandidates(records, opts = {}) {
  const minDays = Number(opts.minDays ?? 3);
  const limit = Number(opts.limit ?? 20);
  const out = [];

  for (const rec of records || []) {
    const st = String(rec?.hhApply?.hhSiteState || '').toLowerCase();
    if (st !== 'viewed') continue;
    const days = daysSinceApply(rec);
    if (days == null || days < minDays) continue;
    const msgs = rec?.hhApply?.chatMessages || [];
    const employerReplied = msgs.some((m) => !m.isMine && m.kind !== 'mine');
    if (employerReplied) continue;
    out.push({
      id: rec.id,
      title: rec.title,
      company: rec.company,
      days,
      url: rec.url,
      suggestedText: buildViewedProactiveText(rec),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @param {object} rec
 */
export function buildViewedProactiveText(rec) {
  const title = String(rec?.title || 'вакансию').trim();
  const company = String(rec?.company || '').trim();
  const where = company ? ` в ${company}` : '';
  return `Добрый день! Вижу, что резюме по позиции «${title}»${where} просмотрели. Готов кратко созвониться или ответить на вопросы по опыту (Linux, Docker, мониторинг, релизы). Если актуально — подскажите удобный формат связи.`;
}
