/**
 * Запуск фоновых задач из Telegram-бота.
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DATA_DIR } from '../paths.mjs';
import { spawnBackground } from '../spawn-background.mjs';
import { spawnSideJob } from '../side-job-runner.mjs';
import { setHarvestPid } from '../job-pids.mjs';
import { getJobStatus } from '../job-pids.mjs';
import { getBrowserBusyState } from '../browser-guard.mjs';
import { getBrowserLockInfo, clearStaleBrowserLock } from '../chromium-session.mjs';
import { requestHarvestStop } from '../harvest-control.mjs';
import { parseHarvestPeriodDays, harvestPeriodLabel } from '../hh-search-period.mjs';
import { loadDevOpsEnv } from '../load-devops-env.mjs';
import { loadPreferences } from '../preferences.mjs';
import { playwrightDisplayEnv } from '../playwright-display-mode.mjs';
import { writeDailyDigest } from '../daily-digest.mjs';

/**
 * @returns {{ ok: boolean, error?: string, message?: string, pid?: number }}
 */
export function launchDailyRoutine(opts = {}) {
  const busy = getBrowserBusyState();
  if (busy.busy) {
    return { ok: false, error: busy.message || 'Браузер занят' };
  }
  const extra = opts.withHarvest ? ['--with-harvest'] : [];
  const child = spawnSideJob('dailyRoutine', 'daily-routine.mjs', extra);
  return {
    ok: true,
    pid: child.pid,
    message: opts.withHarvest
      ? 'Утренний цикл + поиск запущен в фоне'
      : 'Утренний цикл запущен в фоне',
  };
}

/**
 * @param {number} [periodDays]
 * @returns {{ ok: boolean, error?: string, message?: string, pid?: number }}
 */
export function launchHarvest(periodDays = 7) {
  const period = parseHarvestPeriodDays(periodDays);
  const st = getJobStatus();
  if (st.harvest.running) {
    return { ok: false, error: `Поиск уже идёт (pid=${st.harvest.pid})` };
  }
  clearStaleBrowserLock();
  const lock = getBrowserLockInfo();
  if (lock.held) {
    return {
      ok: false,
      error: `Профиль браузера занят (${lock.owner}, pid=${lock.pid})`,
    };
  }
  const busy = getBrowserBusyState();
  if (busy.busy && busy.reason !== 'harvest') {
    return { ok: false, error: busy.message || 'Браузер занят другой задачей' };
  }

  const harvestScript = path.join(ROOT, 'scripts', 'run-devops-harvest.mjs');
  const logPath = path.join(DATA_DIR, 'harvest-run.log');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const logFd = fs.openSync(logPath, 'a');
  fs.writeSync(
    logFd,
    `\n======== HARVEST (telegram-bot) ${new Date().toISOString()} period=${harvestPeriodLabel(period)} ========\n`
  );
  loadDevOpsEnv();
  const harvestPrefs = loadPreferences();
  const pwHarvestEnv = playwrightDisplayEnv('harvest', harvestPrefs);
  const child = spawnBackground(process.execPath, [harvestScript], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ...pwHarvestEnv,
      HH_SEARCH_PERIOD: period === 0 ? '0' : String(period),
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(ROOT, '.playwright-browsers'),
    },
  });
  fs.closeSync(logFd);
  setHarvestPid(child.pid);
  child.on('exit', () => setHarvestPid(null));
  child.unref();

  return {
    ok: true,
    pid: child.pid,
    message: `Поиск запущен (${harvestPeriodLabel(period)}, pid ${child.pid})`,
  };
}

/** @returns {{ ok: boolean, message: string }} */
export function stopHarvestJob() {
  requestHarvestStop();
  return { ok: true, message: 'Команда остановки поиска отправлена' };
}

/** @param {{ sendTelegram?: boolean, periodDays?: number }} [opts] */
export async function refreshDigest(opts = {}) {
  const digest = await writeDailyDigest({ ...opts, sendTelegram: false });
  return { ok: true, text: digest.text, file: digest.file };
}
