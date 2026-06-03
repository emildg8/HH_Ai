/**
 * Снимок продуктовых метрик (A-MET-1) — без PII.
 *   node scripts/metrics-baseline.mjs
 *   node scripts/metrics-baseline.mjs --write
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DATA_DIR } from '../lib/paths.mjs';
import { loadQueue } from '../lib/store.mjs';
import { computeLetterNoEditKpi } from '../lib/letter-apply-kpi.mjs';
import { computeWeeklyInviteTrend } from '../lib/conversion-weekly.mjs';
import { getQueueMeta } from '../lib/demo-queue.mjs';

const OUT = path.join(DATA_DIR, 'metrics-baseline-last.json');
const write = process.argv.includes('--write');

const q = loadQueue();
const letter = computeLetterNoEditKpi();
const weekly = computeWeeklyInviteTrend(2);
const queueMeta = getQueueMeta();

const snapshot = {
  capturedAt: new Date().toISOString(),
  queueSize: q.length,
  queueEmpty: queueMeta.empty,
  letterNoEditPct: letter.noEditPct,
  letterNoEditSamples: letter.samples,
  invitePctCurrentWeek: weekly.currentInvitePct,
  inviteTrendDeltaPp: weekly.trendDelta,
  weeklyBuckets: weekly.weeks,
};

if (write) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[metrics-baseline] записано: ${OUT}`);
} else {
  console.log(JSON.stringify(snapshot, null, 2));
}
