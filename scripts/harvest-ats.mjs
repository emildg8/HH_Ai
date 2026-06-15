#!/usr/bin/env node
/**
 * Harvest ATS компаний из config/ats-companies.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { harvestAtsCompany } from '../lib/ats/registry.mjs';
import { ingestVacancyPayload } from '../lib/vacancy-ingest.mjs';

loadEnv();
applyStoredProfile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const cfgPath = path.join(ROOT, 'config', 'ats-companies.json');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const companies = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  let added = 0;
  for (const c of companies) {
    console.log(`[ats] ${c.company} (${c.ats})`);
    try {
      const jobs = await harvestAtsCompany(c);
      for (const job of jobs) {
        if (dryRun) {
          console.log('  dry', job.title, job.url);
          continue;
        }
        const r = await ingestVacancyPayload(job);
        if (r.added) {
          added++;
          console.log('  +', job.title);
        }
      }
    } catch (e) {
      console.warn('  skip:', e.message || e);
    }
  }
  console.log(`[ats] добавлено: ${added}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
