#!/usr/bin/env node
/** Probe Habr search (dry-run по умолчанию). */
import { buildHabrSearchUrl, extractHabrVacancyLinks } from '../lib/habr-career-search.mjs';

const live = process.argv.includes('--live');
const url = buildHabrSearchUrl({ query: 'devops', page: 1 });

async function main() {
  console.log('[probe-habr]', url);
  if (!live) {
    console.log('OK (dry-run). Для сети: --live');
    return;
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'HH-Ai-probe' } });
  const html = await res.text();
  const links = extractHabrVacancyLinks(html);
  console.log(`links: ${links.length}`, links.slice(0, 5));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
