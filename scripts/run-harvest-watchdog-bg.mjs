/**
 * Фоновый watchdog harvest без окна консоли (Windows).
 * Всегда через run-with-instance (по умолчанию emil) — иначе HH_DATA_DIR=data/ (legacy).
 *   npm run devops:harvest:watchdog
 *   npm run devops:harvest:watchdog:silent  → VBS → этот файл
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnBackground } from '../lib/spawn-background.mjs';
import { resolveSystemNodeExe } from '../lib/system-node.mjs';
import { isProcessAlive } from '../lib/job-pids.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @returns {string} */
function resolveInstanceId() {
  const fromEnv = String(process.env.HH_INSTANCE_ID || process.env.HH_HARVEST_INSTANCE || '')
    .trim()
    .toLowerCase();
  if (fromEnv === 'emil' || fromEnv === 'anastasia') return fromEnv;
  return 'emil';
}

function main() {
  const instanceId = resolveInstanceId();
  const dataDirRel = instanceId === 'anastasia' ? 'data-anastasia' : 'data-emil';
  const dataDirAbs = path.join(ROOT, dataDirRel);
  const logFile = path.join(dataDirAbs, 'logs', 'harvest-watchdog-supervisor.log');
  const pidFile = path.join(dataDirAbs, 'harvest-watchdog.pid');

  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    if (Number.isFinite(pid) && pid > 0 && isProcessAlive(pid)) {
      console.log(`Watchdog уже запущен (pid=${pid}, instance=${instanceId}). Лог: ${dataDirRel}/logs/harvest-watchdog-latest.log`);
      return;
    }
  } catch {
    /* no pid */
  }

  const nodeExe = resolveSystemNodeExe();
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const logFd = fs.openSync(logFile, 'a');
  fs.writeSync(
    logFd,
    `\n======== SUPERVISOR ${new Date().toISOString()} instance=${instanceId} node=${nodeExe} ========\n`,
  );

  // Не spawn watchdog напрямую — иначе HH_DATA_DIR пустой → ROOT/data
  const child = spawnBackground(
    nodeExe,
    [
      'scripts/run-with-instance.mjs',
      `--instance=${instanceId}`,
      '--',
      'node',
      'scripts/devops-harvest-watchdog.mjs',
    ],
    {
      cwd: ROOT,
      detached: true,
      hideConsole: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env },
    },
  );
  fs.closeSync(logFd);
  child.unref();
  console.log(`Watchdog запущен скрыто, pid=${child.pid}, instance=${instanceId}, node=${nodeExe}`);
  console.log(`Логи: ${dataDirRel}/logs/harvest-watchdog-latest.log`);
}

main();
