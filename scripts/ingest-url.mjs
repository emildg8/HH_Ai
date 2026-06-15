#!/usr/bin/env node
/**
 * CLI: одна ссылка или текст с URL → очередь.
 *   node scripts/ingest-url.mjs https://career.habr.com/vacancies/123
 *   node scripts/ingest-url.mjs --text "см. https://hh.ru/vacancy/123456"
 */

import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { ingestUrl, ingestUrlsFromText } from '../lib/vacancy-ingest.mjs';

loadEnv();
applyStoredProfile();

const textIdx = process.argv.indexOf('--text');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  let results;
  if (textIdx !== -1) {
    const text = process.argv.slice(textIdx + 1).join(' ') || '';
    results = await ingestUrlsFromText(text, { skipScore: dryRun });
  } else {
    const url = process.argv.slice(2).find((a) => !a.startsWith('--'));
    if (!url) {
      console.error('Usage: ingest-url.mjs <url> | --text "..."');
      process.exit(1);
    }
    results = [await ingestUrl(url, { skipScore: dryRun })];
  }

  for (const r of results) {
    console.log(r.added ? 'OK' : 'SKIP', r.url || '', r.reason || r.record?.title || '');
  }
  const added = results.filter((r) => r.added).length;
  console.log(`\nДобавлено: ${added}/${results.length}`);
  process.exit(added > 0 || results.every((r) => r.reason === 'duplicate_external_key') ? 0 : 1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
