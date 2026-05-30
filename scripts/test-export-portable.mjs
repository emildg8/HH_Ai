/**
 * Проверка portable-артефактов в публичном экспорте.
 *   node scripts/test-export-portable.mjs
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT } from '../lib/paths.mjs';

const OUT = path.join(ROOT, 'dist', 'hh-ai-public-test-portable');

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
const exp = spawnSync(process.execPath, ['scripts/export-public.mjs', `--out=${OUT}`], {
  cwd: ROOT,
  stdio: 'inherit',
});
assert.equal(exp.status, 0, 'export-public failed');

for (const rel of [
  'scripts/install-portable.ps1',
  'scripts/install.ps1',
  'start-dashboard.bat',
  'EXPORT-README.md',
  'docs/PUBLIC-RELEASE.md',
]) {
  assert.ok(fs.existsSync(path.join(OUT, rel)), `missing ${rel}`);
}

const readme = fs.readFileSync(path.join(OUT, 'EXPORT-README.md'), 'utf8');
assert.match(readme, /install-portable/i);

const bat = fs.readFileSync(path.join(OUT, 'start-dashboard.bat'), 'utf8');
assert.match(bat, /npm run dashboard/i);

console.log('test-export-portable: OK');
