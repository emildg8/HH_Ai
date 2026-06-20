/**
 * Аудит гигиены репозитория → data/hygiene-report.json (local, gitignore).
 *   npm run hygiene:audit
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const REPORT = path.join(ROOT, 'data', 'hygiene-report.json');

function listFiles(dir, acc = [], prefix = '') {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) listFiles(full, acc, rel);
    else acc.push(rel.replace(/\\/g, '/'));
  }
  return acc;
}

function grepDeprecated(dir) {
  const out = [];
  for (const rel of listFiles(dir)) {
    if (!rel.endsWith('.mjs') && !rel.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(dir, rel), 'utf8');
    if (/@deprecated/i.test(text)) out.push(rel);
  }
  return out;
}

function main() {
  const serverPath = path.join(ROOT, 'scripts/dashboard-server.mjs');
  const serverLines = fs.existsSync(serverPath)
    ? fs.readFileSync(serverPath, 'utf8').split(/\r?\n/).length
    : 0;

  const docsDir = path.join(ROOT, 'docs');
  const allDocs = listFiles(docsDir).filter((f) => f.endsWith('.md'));
  const manifestPath = path.join(docsDir, 'docs-manifest.json');
  const manifestListed = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).documents.map((d) =>
        d.path.replace(/^docs\//, '')
      )
    : [];

  const unlisted = allDocs.filter((d) => !manifestListed.includes(d));

  const report = {
    generatedAt: new Date().toISOString(),
    dashboardServerLines: serverLines,
    deprecatedLib: grepDeprecated(path.join(ROOT, 'lib')),
    deprecatedDashboard: grepDeprecated(path.join(ROOT, 'dashboard/public')),
    docsTotal: allDocs.length,
    docsUnlistedInManifest: unlisted,
    demoQueueExists: fs.existsSync(path.join(ROOT, 'docs/demo/vacancies-demo.json')),
    publicReleaseDocs: [
      'docs/PUBLIC-RELEASE.md',
      'docs/QUICKSTART.md',
      'docs/FIRST-RUN.md',
    ].map((rel) => ({ path: rel, exists: fs.existsSync(path.join(ROOT, rel)) })),
  };

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[hygiene:audit] OK →', path.relative(ROOT, REPORT));
  console.log(`  dashboard-server: ${serverLines} lines`);
  console.log(`  @deprecated lib: ${report.deprecatedLib.length}`);
  console.log(`  docs unlisted: ${unlisted.length}`);
  if (unlisted.length) {
    for (const u of unlisted.slice(0, 8)) console.log(`    - ${u}`);
    if (unlisted.length > 8) console.log(`    … +${unlisted.length - 8}`);
  }
}

main();
