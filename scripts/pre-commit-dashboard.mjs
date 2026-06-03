/**
 * Pre-commit: при staged-изменениях в dashboard/public — npm run check:dashboard
 */
import { spawnSync } from 'child_process';
import { ROOT } from '../lib/paths.mjs';

const diff = spawnSync('git', ['diff', '--cached', '--name-only'], {
  cwd: ROOT,
  encoding: 'utf8',
});
const files = (diff.stdout || '')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

if (!files.some((f) => f.startsWith('dashboard/public/'))) {
  process.exit(0);
}

console.log('[pre-commit] dashboard/public изменён — check:dashboard');
const r = spawnSync(process.execPath, ['scripts/check-dashboard-modules.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
});
process.exit(r.status === 0 ? 0 : 1);
