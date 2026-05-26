/**
 * Карточки откликов только из кэша hh (нет в очереди harvest).
 */

import { loadNegotiationsCache, parseNegotiationStatusText, negotiationStatusToHhSiteState } from './hh-negotiations-sync.mjs';
import { hhSiteStateLabel } from './hh-vacancy-response-state.mjs';

/**
 * @param {Set<string>|string[]} [excludeVacancyIds] — уже показаны из очереди
 * @returns {object[]}
 */
export function buildHhNegotiationOnlyCards(excludeVacancyIds = []) {
  const exclude = new Set(
    [...excludeVacancyIds].map((id) => String(id).replace(/^hh-neg-/, ''))
  );
  const cache = loadNegotiationsCache();
  const out = [];
  for (const it of cache.items || []) {
    const vid = String(it.vacancyId || '').trim();
    if (!vid || exclude.has(vid)) continue;
    const st = it.status || parseNegotiationStatusText(it.statusRaw);
    const hhState = negotiationStatusToHhSiteState(st);
    out.push({
      id: `hh-neg-${vid}`,
      vacancyId: vid,
      title: it.title || `Вакансия ${vid}`,
      company: it.company || '',
      url: `https://hh.ru/vacancy/${vid}`,
      status: 'responded',
      geminiScore: null,
      negotiationOnly: true,
      hhApply: {
        hhSiteState: hhState,
        hhSiteStateLabel: hhSiteStateLabel(hhState),
        hhSiteStateSource: 'negotiations-cache-only',
        statusRaw: it.statusRaw,
        chatUrl: it.chatUrl || '',
        negotiationOnly: true,
        chatMessages: it.chatMessages || [],
        chatSummary: it.chatSummary || null,
      },
    });
  }
  return out;
}
