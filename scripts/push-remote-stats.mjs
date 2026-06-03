/**
 * Отправка snapshot на удалённый webhook (HTTP или SCP).
 *   npm run remote:push-stats
 *
 * Wispbyte (без SSH): HH_REMOTE_STATS_URL + HH_REMOTE_API_TOKEN
 * VPS с SSH: VDSINA_HOST + VDSINA_SSH_KEY_PATH
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

import {
  buildRemoteStatsPayload,
  loadRemoteHttpPushConfig,
  loadVdsinaSshConfig,
  writeRemoteStatsSnapshot,
} from '../lib/remote-stats.mjs';

async function pushViaHttp(payload) {
  const { statsUrl, apiToken } = loadRemoteHttpPushConfig();
  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
  const res = await fetch(statsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  console.log(`[remote:push-stats] OK → ${statsUrl} (${payload.at})`);
}

function pushViaScp(payload) {
  const { host, user, appDir, keyPath } = loadVdsinaSshConfig();
  if (!host) {
    console.error('[remote:push-stats] Задайте HH_REMOTE_STATS_URL (Wispbyte) или VDSINA_HOST (SSH)');
    process.exit(1);
  }

  const tmp = path.join(os.tmpdir(), `hh-remote-stats-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');

  const remote = `${user}@${host}:${appDir}/data/stats-snapshot.json`;
  const scpArgs = ['-o', 'StrictHostKeyChecking=accept-new'];
  if (keyPath) scpArgs.push('-i', keyPath);
  scpArgs.push(tmp, remote);

  const r = spawnSync('scp', scpArgs, { encoding: 'utf8', shell: process.platform === 'win32' });
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* ignore */
  }

  if (r.status !== 0) {
    console.error('[remote:push-stats] scp failed:', r.stderr || r.stdout || r.status);
    process.exit(1);
  }
  console.log(`[remote:push-stats] OK → ${remote} (${payload.at})`);
}

async function main() {
  const payload = writeRemoteStatsSnapshot();
  const { statsUrl } = loadRemoteHttpPushConfig();
  if (statsUrl) {
    await pushViaHttp(payload);
    return;
  }
  pushViaScp(payload);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
