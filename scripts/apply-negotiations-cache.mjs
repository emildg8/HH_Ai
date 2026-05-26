/**
 * Применить data/hh-negotiations-cache.json к очереди (без браузера).
 */
import fs from 'fs';
import {
  loadNegotiationsCache,
  mergeNegotiationsIntoQueue,
  parseNegotiationStatusText,
} from '../lib/hh-negotiations-sync.mjs';
import { computeConversionStats } from '../lib/conversion-stats.mjs';
import { HH_NEGOTIATIONS_CACHE_FILE } from '../lib/paths.mjs';

const cache = loadNegotiationsCache();
for (const it of cache.items || []) {
  it.status = parseNegotiationStatusText(it.statusRaw);
}
fs.writeFileSync(
  HH_NEGOTIATIONS_CACHE_FILE,
  `${JSON.stringify({ ...cache, items: cache.items }, null, 2)}\n`,
  'utf8'
);

const r = mergeNegotiationsIntoQueue(cache);
console.log('Обновлено карточек:', r.updated, '/', r.total);
console.log(JSON.stringify(computeConversionStats(), null, 2));
