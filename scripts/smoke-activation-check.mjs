#!/usr/bin/env node
/**
 * Post-install activation: demo queue + dashboard /api/queue-meta.
 *   node scripts/smoke-activation-check.mjs <exportRoot> [port]
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 3858);

function copyIfMissing(src, dest) {
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function waitMeta(base, ms = 25_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(`${base}/api/queue-meta`);
      if (res.ok) {
        const j = await res.json();
        if (j.total >= 5) return j;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

async function main() {
  for (const [src, dest] of [
    ['.env.example', '.env'],
    ['config/presets/no-llm.env', 'config/secrets.local.env'],
    ['config/profiles/devops.env.example', 'config/profiles/devops.env'],
    ['config/cover-letter.example.txt', 'config/cover-letter.txt'],
    ['config/cover-letter-style-examples.example.txt', 'config/cover-letter-style-examples.txt'],
    ['config/resume-routing.example.json', 'config/resume-routing.json'],
    ['config/resume-raise-schedule.example.json', 'config/resume-raise-schedule.json'],
    ['config/resume-variants.example.json', 'config/resume-variants.json'],
    ['dashboard/public/local-dashboard-defaults.example.mjs', 'dashboard/public/local-dashboard-defaults.mjs'],
  ]) {
    copyIfMissing(path.join(root, src), path.join(root, dest));
  }
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'CV'), { recursive: true });

  const demo = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { copyDemoToQueueIfMissing, getQueueMeta } from './lib/demo-queue.mjs'; copyDemoToQueueIfMissing(); const m = getQueueMeta(); if (m.total < 5) process.exit(1);",
    ],
    { cwd: root, stdio: 'inherit' }
  );
  const demoCode = await new Promise((resolve) => demo.on('close', resolve));
  if (demoCode !== 0) process.exit(1);

  const child = spawn(process.execPath, ['scripts/dashboard-server.mjs', `--port=${port}`], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, DASHBOARD_PORT: String(port), HH_QA_CLEAN: '1' },
  });

  try {
    await new Promise((r) => setTimeout(r, 2500));
    const meta = await waitMeta(`http://127.0.0.1:${port}`);
    if (!meta) {
      console.error('[smoke-activation] /api/queue-meta not ready');
      process.exit(1);
    }
    console.log(`[smoke-activation] OK total=${meta.total}`);
  } finally {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
