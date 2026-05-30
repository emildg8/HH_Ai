/**
 * Быстрая проверка публичного среза (без секретов).
 *   npm run qa:public
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const steps = [{ name: 'smoke:release', cmd: ['run', 'smoke:release'] }];

function main() {
  console.log('\n[qa:public] HH Ai — проверка публичного релиза\n');

  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  console.log(`  Версия VERSION: ${version}`);

  for (const s of steps) {
    console.log(`\n→ ${s.name}`);
    const r =
      s.cmd[0] === 'run'
        ? spawnSync('npm', s.cmd, { cwd: ROOT, stdio: 'inherit', shell: true })
        : spawnSync(process.execPath, s.cmd, { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`\n[qa:public] FAIL: ${s.name}`);
      process.exit(r.status ?? 1);
    }
  }

  console.log('\n[qa:public] OK — можно выкладывать zip / тег\n');
  console.log('  Получатель: docs/FIRST-RUN.md → install.ps1 → login → dashboard\n');
}

main();
