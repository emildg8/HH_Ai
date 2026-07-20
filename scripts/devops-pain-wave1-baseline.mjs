#!/usr/bin/env node
/**
 * Baseline counts for pain-wave1.
 *   node scripts/run-with-instance.mjs --instance=emil -- node scripts/devops-pain-wave1-baseline.mjs
 */
import fs from 'fs';
import path from 'path';
import { loadQueue } from '../lib/store.mjs';
import { getDataDir } from '../lib/paths.mjs';

const q = loadQueue({ force: true });
const counts = {
  pending: 0,
  skipped: 0,
  applied: 0,
  responded: 0,
  approved: 0,
  rejected: 0,
  invitedSite: 0,
  other: 0,
  total: q.length,
};
for (const r of q) {
  const s = String(r.status || 'other');
  if (Object.prototype.hasOwnProperty.call(counts, s)) counts[s]++;
  else counts.other++;
  if (String(r.hhApply?.hhSiteState || '') === 'invited') counts.invitedSite++;
}
const dir = path.join(getDataDir(), 'baselines', 'pain-wave1-2026-07-20');
fs.mkdirSync(dir, { recursive: true });
const payload = {
  at: new Date().toISOString(),
  instance: process.env.HH_INSTANCE_ID || process.env.HH_PROFILE || '?',
  dataDir: getDataDir(),
  counts,
};
fs.writeFileSync(path.join(dir, 'queue-counts.json'), `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
