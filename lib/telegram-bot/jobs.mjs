/**
 * Запуск фоновых задач из Telegram-бота.
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DATA_DIR, HH_APPLY_CHAT_LOG_FILE } from '../paths.mjs';
import { spawnBackground } from '../spawn-background.mjs';
import { spawnSideJob } from '../side-job-runner.mjs';
import { setHarvestPid, setBatchPid, getJobStatus } from '../job-pids.mjs';
import { getBrowserBusyState } from '../browser-guard.mjs';
import { getBrowserLockInfo, clearStaleBrowserLock } from '../chromium-session.mjs';
import { requestHarvestStop } from '../harvest-control.mjs';
import { parseHarvestPeriodDays, harvestPeriodLabel } from '../hh-search-period.mjs';
import { loadDevOpsEnv } from '../load-devops-env.mjs';
import { loadPreferences } from '../preferences.mjs';
import { playwrightDisplayEnv } from '../playwright-display-mode.mjs';
import { writeDailyDigest } from '../daily-digest.mjs';
import { checkApplyRateLimits } from '../hh-apply-rate.mjs';
import { getDashboardBatchSizeCap } from '../dashboard-preferences.mjs';
import { normalizeBatchScope, batchScopeUiLabel } from '../batch-scope.mjs';
import {
  canResumeFromState,
  clearBatchResumeState,
  getBatchControlSummary,
  requestBatchPause,
  requestBatchResume,
  requestBatchStop,
} from '../batch-control.mjs';

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

/**
 * @param {{ limit?: number, minScore?: number, batchScope?: string, resume?: boolean }} [opts]
 * @returns {{ ok: boolean, error?: string, message?: string, pid?: number }}
 */
export function launchApplyBatch(opts = {}) {
  const rateErr = checkApplyRateLimits();
  if (rateErr) return { ok: false, error: rateErr };

  const batchSt = getJobStatus();
  if (batchSt.batch.running) {
    return { ok: false, error: `Серия откликов уже идёт (pid=${batchSt.batch.pid})` };
  }

  if (opts.resume) {
    if (!canResumeFromState()) {
      return { ok: false, error: 'Нет сохранённой серии для продолжения' };
    }
  } else {
    clearStaleBrowserLock();
    const busy = getBrowserBusyState();
    if (busy.busy) {
      return { ok: false, error: busy.message || 'Браузер занят' };
    }
    clearBatchResumeState();
  }

  const batchScript = path.join(ROOT, 'scripts', 'hh-apply-batch.mjs');
  if (!fs.existsSync(batchScript)) {
    return { ok: false, error: 'hh-apply-batch.mjs не найден' };
  }

  const batchCap = getDashboardBatchSizeCap();
  const limit = Math.min(batchCap, Math.max(1, Number(opts.limit) || batchCap));
  const minScore = opts.minScore != null ? Math.max(0, Number(opts.minScore) || 0) : 50;
  const batchScope = normalizeBatchScope(opts.batchScope || 'noQuestionnaire');
  const resume = Boolean(opts.resume);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const logFd = fs.openSync(HH_APPLY_CHAT_LOG_FILE, 'a');
  const header = `\n======== BATCH (telegram-bot) ${new Date().toISOString()} scope=${batchScope} minScore=${minScore} limit=${limit} resume=${resume} ========\n`;
  fs.writeSync(logFd, header);

  const args = [batchScript, '--use-pool-letters', '--tailor-resume'];
  if (resume) {
    args.push('--resume');
  } else {
    args.push(`--limit=${limit}`);
    if (minScore > 0) args.push(`--min-score=${minScore}`);
    args.push(`--batch-scope=${batchScope}`);
  }

  loadDevOpsEnv();
  const batchPrefs = loadPreferences();
  const pwBatchEnv = playwrightDisplayEnv('batch', batchPrefs);
  const child = spawnBackground(process.execPath, args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ...pwBatchEnv,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(ROOT, '.playwright-browsers'),
      HH_FAST: String(process.env.HH_FAST ?? '1'),
    },
  });
  fs.closeSync(logFd);
  setBatchPid(child.pid);
  child.on('exit', () => setBatchPid(null));
  child.unref();

  return {
    ok: true,
    pid: child.pid,
    message: resume
      ? `Серия продолжена (pid ${child.pid})`
      : `Серия «${batchScopeUiLabel(batchScope)}» запущена: до ${limit} откликов${minScore ? `, ≥${minScore}` : ''} (pid ${child.pid})`,
  };
}

/**
 * @param {'pause' | 'resume' | 'stop'} action
 * @returns {{ ok: boolean, error?: string, message?: string, pid?: number }}
 */
export function controlApplyBatch(action) {
  const st = getJobStatus();
  if (action === 'pause') {
    if (!st.batch.running) return { ok: false, error: 'Серия не запущена' };
    requestBatchPause();
    return { ok: true, message: 'Пауза после текущей вакансии' };
  }
  if (action === 'resume') {
    const ctrl = getBatchControlSummary();
    if (ctrl.batchRunning && ctrl.command === 'paused') {
      requestBatchResume();
      return { ok: true, message: 'Серия продолжена' };
    }
    if (ctrl.batchRunning) return { ok: false, error: 'Серия уже выполняется' };
    return launchApplyBatch({ resume: true });
  }
  if (action === 'stop') {
    if (!st.batch.running) return { ok: false, error: 'Серия не запущена' };
    requestBatchStop({ killChild: true });
    return { ok: true, message: 'Остановка серии…' };
  }
  return { ok: false, error: 'Неизвестное действие' };
}

/**
 * @returns {{ ok: boolean, error?: string, message?: string, pid?: number }}
 */
export function launchSyncChats() {
  const busy = getBrowserBusyState();
  if (busy.busy) {
    return { ok: false, error: busy.message || 'Браузер занят' };
  }
  const child = spawnSideJob('syncChats', 'sync-hh-chats.mjs');
  return { ok: true, pid: child.pid, message: `Синхронизация чатов запущена (pid ${child.pid})` };
}

/** @param {{ sendTelegram?: boolean, periodDays?: number }} [opts] */
export async function refreshDigest(opts = {}) {
  const digest = await writeDailyDigest({ ...opts, sendTelegram: false });
  return { ok: true, text: digest.text, file: digest.file };
}
