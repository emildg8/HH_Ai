#!/usr/bin/env node
/**
 * Harvest международных досок (волна 2): Dice, Welcome to the Jungle
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { harvestJobboard } from '../lib/jobboards/registry.mjs';
import { ingestVacancyPayload } from '../lib/vacancy-ingest.mjs';

loadEnv();
applyStoredProfile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const cfgPath = path.join(ROOT, 'config', 'jobboard-searches.json');
const dryRun = process.argv.includes('--dry-run');
const risky = process.argv.includes('--risky');

async function main() {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  let added = 0;
  for (const board of cfg.boards || []) {
    if (board.risky && !risky) {
      console.log(`[jobboard] skip risky ${board.id}`);
      continue;
    }
    console.log(`[jobboard] ${board.id}`);
    const jobs = await harvestJobboard(board.id, board);
    for (const job of jobs) {
      if (dryRun) {
        console.log('  dry', job.url);
        continue;
      }
      const r = await ingestVacancyPayload(job);
      if (r.added) {
        added++;
        console.log('  +', job.url);
      }
    }
  }
  console.log(`[jobboard] добавлено: ${added}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
