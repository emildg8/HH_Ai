/**
 * Ежедневная рутина из CLI (без дашборда).
 *   npm run devops:daily-routine
 *   npm run devops:daily-routine -- --with-harvest
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const withHarvest = process.argv.includes('--with-harvest');

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, HH_HEADLESS: process.env.HH_HEADLESS || '1' },
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

async function main() {
  console.log('=== Ежедневная рутина ===\n');
  await runNode('sync-hh-responses.mjs');
  await runNode('apply-negotiations-cache.mjs');
  await runNode('sync-hh-chats.mjs');
  if (withHarvest) {
    await runNode('harvest.mjs');
  }
  console.log('\nГотово. Откройте дашборд → «Без анкет» → батч.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
