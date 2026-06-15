#!/usr/bin/env node
/**
 * Harvest all sources (волна 1): hh опционально, habr, telegram, ats
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { applyStoredProfile } from '../lib/profile-prefs.mjs';

loadEnv();
applyStoredProfile();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const withHh = process.argv.includes('--with-hh');
const withJobboards = process.argv.includes('--with-jobboards');

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

async function runOptional(script, args = []) {
  try {
    await run(script, args);
  } catch (e) {
    console.warn(`[harvest-all] пропуск ${script}:`, e.message);
  }
}

async function main() {
  console.log('=== harvest-all ===');
  if (withHh) await runOptional('harvest.mjs');
  await runOptional('harvest-habr.mjs');
  await runOptional('harvest-telegram-channels.mjs');
  await runOptional('harvest-ats.mjs');
  if (withJobboards) await runOptional('harvest-jobboards.mjs');
  console.log('=== готово ===');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
