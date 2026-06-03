/**
 * Ежедневная рутина из CLI (без дашборда).
 *   npm run devops:daily-routine
 *   npm run devops:daily-routine -- --with-harvest
 *   npm run devops:daily-routine -- --with-rescore
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';
import { setSideJobPid } from '../lib/browser-guard.mjs';
import { assertBrowserFreeForSideJob } from '../lib/browser-guard.mjs';

loadEnv();
applyStoredProfile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const withHarvest = process.argv.includes('--with-harvest');
const withRescore =
  process.argv.includes('--with-rescore') || (withHarvest && !process.argv.includes('--no-rescore'));

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
  setSideJobPid('dailyRoutine', process.pid);
  try {
    assertBrowserFreeForSideJob('утренний цикл');
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  console.log('=== Ежедневная рутина ===\n');
  await runNode('sync-hh-responses.mjs');
  await runNode('apply-negotiations-cache.mjs');
  await runNode('sync-hh-chats.mjs');
  await runNode('prune-responded-queue.mjs');
  if (withHarvest) {
    await runNode('harvest.mjs');
  }
  if (withRescore) {
    await runNode('rescore-queue.mjs', ['--only-placeholder-llm', '--limit=40']);
    await runNode('questionnaire-prep-batch.mjs');
  }
  try {
    const { writeDailyDigest } = await import('../lib/daily-digest.mjs');
    const digest = await writeDailyDigest({ sendTelegram: String(process.env.HH_DAILY_DIGEST_TELEGRAM ?? '0').trim() === '1' });
    console.log('\n[daily-digest]', digest.text.split('\n').slice(0, 6).join('\n'));
  } catch (e) {
    console.warn('[daily-digest] пропуск:', e.message || e);
  }
  if (String(process.env.HH_REMOTE_STATS_PUSH ?? '0').trim() === '1') {
    try {
      const { isRemotePushConfigured } = await import('../lib/remote-stats.mjs');
      if (isRemotePushConfigured()) {
        await runNode('push-remote-stats.mjs');
      }
    } catch (e) {
      console.warn('[remote:push-stats] пропуск:', e.message || e);
    }
  }
  console.log('\nГотово. Откройте дашборд → «Без анкет» → батч.');
  setSideJobPid('dailyRoutine', null);
}

main().catch((e) => {
  setSideJobPid('dailyRoutine', null);
  console.error(e.message || e);
  process.exit(1);
});
