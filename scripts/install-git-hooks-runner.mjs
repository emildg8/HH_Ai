import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const script = path.join(root, 'scripts', win ? 'install-git-hooks.ps1' : 'install-git-hooks.sh');
const r = win
  ? spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { stdio: 'inherit' })
  : spawnSync('bash', [script], { stdio: 'inherit' });
process.exit(r.status ?? 1);
