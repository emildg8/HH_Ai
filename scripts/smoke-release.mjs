/**
 * Smoke-тест публичного zip: export → npm install → verify.
 *   npm run smoke:release
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const OUT = path.join(ROOT, 'dist', 'hh-ai-public-smoke');
const PII_PATTERNS = [
  /sk-or-v1-[a-zA-Z0-9._-]{20,}/,
  /emilianjob@ya\.ru/i,
  /emilianjob@yandex\.ru/i,
  /\+7\s*\(985\)\s*421-59-98/,
  /@emildg8\b/i,
  /emil-shahvaladov/i,
  /D:\\Dev\\HH\\hh-ru-apply/i,
];

function fail(msg) {
  console.error(`[smoke:release] FAIL: ${msg}`);
  process.exit(1);
}

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

function checkNoPii(root) {
  const skipFiles = new Set([
    'scripts/export-public.mjs',
    'scripts/smoke-release.mjs',
    'scripts/verify-local.mjs',
  ]);
  for (const f of walk(root)) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (skipFiles.has(rel)) continue;
    const ext = path.extname(f).toLowerCase();
    if (!['.mjs', '.js', '.json', '.md', '.txt', '.html', '.css', '.env', '.example'].some((e) => f.endsWith(e) || ext === e)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const re of PII_PATTERNS) {
      if (re.test(text)) fail(`PII в ${path.relative(root, f)}: ${re}`);
    }
  }
}

function main() {
  console.log('[smoke:release] export…');
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  const exp = spawnSync(process.execPath, ['scripts/export-public.mjs', `--out=${OUT}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (exp.status !== 0) fail('export-public');

  checkNoPii(OUT);
  console.log('[smoke:release] PII check OK');

  for (const must of ['package.json', 'docs/QUICKSTART.md', 'scripts/install.ps1', 'scripts/install.sh', 'EXPORT-README.md']) {
    if (!fs.existsSync(path.join(OUT, must))) fail(`нет ${must}`);
  }
  console.log('[smoke:release] структура OK');

  console.log('[smoke:release] npm install (может занять минуту)…');
  const npm = spawnSync('npm', ['install', '--ignore-scripts'], { cwd: OUT, stdio: 'inherit', shell: true });
  if (npm.status !== 0) fail('npm install');

  console.log('[smoke:release] syntax check…');
  for (const dir of ['scripts', 'lib']) {
    for (const name of fs.readdirSync(path.join(OUT, dir))) {
      if (!name.endsWith('.mjs')) continue;
      const r = spawnSync(process.execPath, ['--check', path.join(OUT, dir, name)], { encoding: 'utf8' });
      if (r.status !== 0) fail(`syntax ${dir}/${name}`);
    }
  }

  console.log('[smoke:release] ВСЁ OK');
}

main();
