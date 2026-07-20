/**
 * Гигиена очереди: низкий fit → skipped; pending+already_applied → applied.
 *   npm run devops:queue-hygiene:emil -- --dry-run
 *   npm run devops:queue-hygiene:emil -- --apply --min-score=50
 */
import fs from 'fs';
import path from 'path';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import { hygieneSkipLowFitPending } from '../lib/queue-hygiene-low-fit.mjs';
import { getDataDir } from '../lib/paths.mjs';

loadDevOpsEnv();

const dryRun = !process.argv.includes('--apply');
const minRaw = (process.argv.find((a) => a.startsWith('--min-score=')) || '').slice(12);
const minScore = minRaw ? Number(minRaw) : 50;
const writeBaseline = !process.argv.includes('--no-baseline');

const r = hygieneSkipLowFitPending({
  dryRun,
  minScore,
  log: console.log,
});

const report = {
  at: new Date().toISOString(),
  instance: process.env.HH_INSTANCE_ID || process.env.HH_PROFILE || '?',
  dryRun: r.dryRun,
  minScore: r.minScore,
  changed: r.changed,
  skipped: r.skipped,
  backfilled: r.backfilled,
  pendingLeft: r.pendingLeft,
  total: r.total,
  samples: r.samples,
  skipIds: r.skipIds,
  driftIds: r.driftIds,
};

console.log(JSON.stringify({ ...report, skipIds: undefined, driftIds: undefined }, null, 2));
console.log(`[queue-hygiene] skipIds=${r.skipIds.length} driftIds=${r.driftIds.length}`);

if (writeBaseline) {
  const dir = path.join(getDataDir(), 'baselines', 'pain-wave1-2026-07-20');
  fs.mkdirSync(dir, { recursive: true });
  const name = dryRun ? 'hygiene-would-skip-ids.json' : 'hygiene-apply-report.json';
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[queue-hygiene] wrote ${path.join(dir, name)}`);
}

if (dryRun) {
  console.log('[queue-hygiene] Для записи: добавьте --apply');
}
