#!/usr/bin/env node
/**
 * Harvest Habr Карьера → очередь.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { loadSearchKeywords } from '../lib/load-keywords.mjs';
import { buildHabrSearchUrl, extractHabrVacancyLinks } from '../lib/habr-career-search.mjs';
import { parseHabrVacancyHtml } from '../lib/habr-career-parse.mjs';
import { ingestVacancyPayload } from '../lib/vacancy-ingest.mjs';

loadEnv();
applyStoredProfile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const KEYWORDS_FILE = path.join(ROOT, 'config', 'search-keywords.txt');
const dryRun = process.argv.includes('--dry-run');
const maxPages = Number(process.env.HH_HABR_MAX_PAGES || 2) || 2;

function habrQueries() {
  try {
    const keys = loadSearchKeywords(KEYWORDS_FILE).slice(0, 3);
    return keys.length ? keys : ['devops'];
  } catch {
    return ['devops'];
  }
}

async function main() {
  let added = 0;
  for (const query of habrQueries()) {
    for (let page = 1; page <= maxPages; page++) {
      const url = buildHabrSearchUrl({ page, query });
      console.log(`[habr] ${url}`);
      const res = await fetch(url, { headers: { 'User-Agent': 'HH-Ai/3.2' } });
      if (!res.ok) throw new Error(`Habr HTTP ${res.status}`);
      const html = await res.text();
      const links = extractHabrVacancyLinks(html);
      for (const link of links.slice(0, 40)) {
        if (dryRun) {
          console.log('  dry', link);
          continue;
        }
        const cardRes = await fetch(link, { headers: { 'User-Agent': 'HH-Ai/3.2' } });
        const cardHtml = await cardRes.text();
        const parsed = parseHabrVacancyHtml(cardHtml, link);
        const r = await ingestVacancyPayload(parsed);
        if (r.added) {
          added++;
          console.log('  +', parsed.title);
        }
      }
    }
  }
  console.log(`[habr] добавлено: ${added}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
