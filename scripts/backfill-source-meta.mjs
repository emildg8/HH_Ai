#!/usr/bin/env node
/**
 * Backfill source / externalKey / applyMode / sourceQualityTier для legacy-записей.
 *   node scripts/backfill-source-meta.mjs
 *   node scripts/backfill-source-meta.mjs --dry-run
 */

import { loadQueue, saveQueue } from '../lib/store.mjs';
import { enrichRecordWithSourceMeta } from '../lib/vacancy-ingest.mjs';

const dryRun = process.argv.includes('--dry-run');

function main() {
  const q = loadQueue();
  let patched = 0;
  const next = q.map((rec) => {
    const patch = enrichRecordWithSourceMeta(rec);
    const changed =
      rec.source !== patch.source ||
      rec.externalKey !== patch.externalKey ||
      rec.applyMode !== patch.applyMode ||
      rec.sourceQualityTier !== patch.sourceQualityTier;
    if (changed) patched++;
    return changed ? { ...rec, ...patch, updatedAt: new Date().toISOString() } : rec;
  });
  if (!dryRun && patched > 0) saveQueue(next);
  console.log(`[backfill-source-meta] обновлено: ${patched}/${q.length}${dryRun ? ' (dry-run)' : ''}`);
}

main();
