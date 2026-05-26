/**
 * Импорт откликов из кэша hh в очередь (если vacancyId ещё нет).
 */

import { loadNegotiationsCache, parseNegotiationStatusText, negotiationStatusToHhSiteState } from './hh-negotiations-sync.mjs';
import { loadQueue, addVacancyRecord } from './store.mjs';
import { buildHhApplySiteStatePatch, hhSiteStateLabel } from './hh-vacancy-response-state.mjs';
/**
 * @returns {{ imported: number, skipped: number, total: number }}
 */
export function importNegotiationsToQueue() {
  const cache = loadNegotiationsCache();
  const queue = loadQueue();
  const byVid = new Set(
    queue.map((r) => {
      let v = String(r.vacancyId || '');
      if (!v && r.url) {
        const m = String(r.url).match(/vacancy\/(\d+)/);
        if (m) v = m[1];
      }
      return v;
    })
  );

  let imported = 0;
  let skipped = 0;

  for (const neg of cache.items || []) {
    const vid = String(neg.vacancyId || '').trim();
    if (!vid || byVid.has(vid)) {
      skipped++;
      continue;
    }
    const st = neg.status || parseNegotiationStatusText(neg.statusRaw);
    const hhState = negotiationStatusToHhSiteState(st);
    const id = `hh-import-${vid}`;
    const record = {
      id,
      vacancyId: vid,
      title: neg.title || `Вакансия ${vid}`,
      company: neg.company || '',
      url: `https://hh.ru/vacancy/${vid}`,
      status: 'responded',
      descriptionPreview: neg.statusRaw || '',
      hhApply: buildHhApplySiteStatePatch(
        {
          chatUrl: neg.chatUrl || '',
          negotiationOnly: true,
        },
        {
          state: hhState,
          label: hhSiteStateLabel(hhState),
          source: 'negotiations-import',
        }
      ),
      importedFromHh: true,
      createdAt: new Date().toISOString(),
    };
    if (addVacancyRecord(record)) {
      byVid.add(vid);
      imported++;
    } else {
      skipped++;
    }
  }

  return { imported, skipped, total: (cache.items || []).length };
}
