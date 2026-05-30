import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { getJobStatus, isProcessAlive } from './job-pids.mjs';

export const BATCH_CONTROL_FILE = path.join(DATA_DIR, 'batch-control.json');
export const BATCH_STATE_FILE = path.join(DATA_DIR, 'batch-state.json');

const COMMANDS = new Set(['running', 'paused', 'stop', 'idle']);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readBatchControl() {
  try {
    const raw = fs.readFileSync(BATCH_CONTROL_FILE, 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeBatchControl(data) {
  ensureDataDir();
  fs.writeFileSync(BATCH_CONTROL_FILE, `${JSON.stringify(data)}\n`, 'utf8');
}

export function readBatchResumeState() {
  try {
    const raw = fs.readFileSync(BATCH_STATE_FILE, 'utf8').trim();
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return resumeStateFromControlFile();
}

/** Восстановить снимок батча из batch-control.json, если batch-state.json потерян. */
export function resumeStateFromControlFile() {
  const c = readBatchControl();
  if (!c?.params || !Array.isArray(c.processedIds)) return null;
  if (c.command !== 'idle' && c.command !== 'paused') return null;
  if (c.batchPid && isProcessAlive(c.batchPid)) return null;
  const planned = Number(c.planned ?? c.params?.limit ?? 0) || 0;
  const done = Number(c.done ?? 0) || 0;
  if (planned > 0 && done >= planned) return null;
  return {
    params: c.params,
    done,
    failed: Number(c.failed ?? 0) || 0,
    skipped: Number(c.skipped ?? 0) || 0,
    letterIdx: Number(c.letterIdx ?? 0) || 0,
    processedIds: c.processedIds,
    planned,
    resumable: true,
    reason: 'stop',
    savedAt: c.updatedAt || new Date().toISOString(),
  };
}

export function saveBatchResumeState(state) {
  ensureDataDir();
  fs.writeFileSync(BATCH_STATE_FILE, `${JSON.stringify(state)}\n`, 'utf8');
}

export function clearBatchResumeState() {
  try {
    fs.unlinkSync(BATCH_STATE_FILE);
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} params
 */
export function initBatchControl(params) {
  const prev = readBatchControl();
  writeBatchControl({
    command: 'running',
    batchPid: process.pid,
    activeChildPid: null,
    updatedAt: new Date().toISOString(),
    params: { ...params },
    done: 0,
    failed: 0,
    skipped: 0,
    letterIdx: params.letterIdx ?? 0,
    processedIds: [],
    planned: params.planned ?? params.limit ?? 0,
    resumed: Boolean(params.resumed),
    runId: prev?.runId && params.resumed ? prev.runId : `batch-${Date.now()}`,
  });
}

export function patchBatchControl(patch) {
  const cur = readBatchControl() || {};
  writeBatchControl({
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export function getBatchCommand() {
  const c = readBatchControl();
  const cmd = c?.command;
  return COMMANDS.has(cmd) ? cmd : 'idle';
}

export function setBatchCommand(command) {
  if (!COMMANDS.has(command)) return;
  patchBatchControl({ command });
}

export function setActiveChildPid(pid) {
  patchBatchControl({ activeChildPid: pid || null });
}

export function shouldStopBatch() {
  return getBatchCommand() === 'stop';
}

export function isBatchPaused() {
  return getBatchCommand() === 'paused';
}

export function killPid(pid, { force = true } = {}) {
  if (!pid || !isProcessAlive(pid)) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T ${force ? '/F' : ''}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

/** Остановить текущий дочерний отклик (Playwright). */
export function killActiveApplyChild() {
  const c = readBatchControl();
  if (c?.activeChildPid) killPid(c.activeChildPid);
  setActiveChildPid(null);
}

/**
 * Запросить остановку батча (дашборд / CLI).
 */
export function requestBatchStop({ killChild = true } = {}) {
  setBatchCommand('stop');
  if (killChild) killActiveApplyChild();
  const c = readBatchControl();
  if (c?.batchPid && isProcessAlive(c.batchPid)) {
    /* процесс батча сам завершится на следующей проверке */
  }
}

export function requestBatchPause() {
  const cmd = getBatchCommand();
  if (cmd === 'running') setBatchCommand('paused');
}

export function requestBatchResume() {
  const cmd = getBatchCommand();
  if (cmd === 'paused') {
    patchBatchControl({
      command: 'running',
      pauseReason: null,
      pauseHints: null,
      pauseReasonAt: null,
    });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Ждать между вакансиями: пауза или стоп.
 * @returns {'continue'|'stop'}
 */
export async function waitAtBatchBoundary(onPaused) {
  while (true) {
    const cmd = getBatchCommand();
    if (cmd === 'stop') return 'stop';
    if (cmd === 'running' || cmd === 'idle') return 'continue';
    if (cmd === 'paused') {
      onPaused?.();
      await sleep(800);
      continue;
    }
    return 'continue';
  }
}

export function syncBatchCounters({ done, failed, skipped, letterIdx, processedIds }) {
  patchBatchControl({
    done,
    failed,
    skipped,
    letterIdx,
    processedIds,
  });
}

/**
 * @param {object} state
 */
export function persistBatchForResume(state) {
  saveBatchResumeState({
    ...state,
    resumable: true,
    savedAt: new Date().toISOString(),
  });
}

export function finishBatchControl({ reason, done, failed, skipped, planned, params }) {
  const c = readBatchControl();
  if (reason === 'stop' || reason === 'pause') {
    persistBatchForResume({
      params: params || c?.params,
      done,
      failed,
      skipped,
      letterIdx: c?.letterIdx ?? 0,
      processedIds: c?.processedIds ?? [],
      planned,
      reason,
    });
  } else if (reason === 'complete') {
    clearBatchResumeState();
  }
  patchBatchControl({
    command: reason === 'pause' ? 'paused' : 'idle',
    batchPid: null,
    activeChildPid: null,
    done,
    failed,
    skipped,
  });
}

export function canResumeFromState() {
  const s = readBatchResumeState();
  return Boolean(s?.resumable && s?.params && Array.isArray(s.processedIds));
}

/** Сохранить batch-state.json из control-файла (если ещё нет). */
export function ensureBatchResumeStateFile() {
  try {
    if (fs.existsSync(BATCH_STATE_FILE)) return readBatchResumeState();
  } catch {
    /* ignore */
  }
  const s = resumeStateFromControlFile();
  if (s) saveBatchResumeState(s);
  return s;
}

export function getBatchControlSummary() {
  const c = readBatchControl();
  const resume = ensureBatchResumeStateFile();
  const job = getJobStatus();
  const batchAlive =
    job.batch.running || (c?.batchPid ? isProcessAlive(c.batchPid) : false);
  return {
    command: c?.command || 'idle',
    batchPid: c?.batchPid ?? null,
    batchRunning: batchAlive,
    activeChildPid: c?.activeChildPid ?? null,
    done: c?.done ?? resume?.done ?? 0,
    failed: c?.failed ?? resume?.failed ?? 0,
    skipped: c?.skipped ?? resume?.skipped ?? 0,
    planned: c?.planned ?? resume?.planned ?? 0,
    canResume: canResumeFromState() && !batchAlive,
    resumeReason: resume?.reason ?? null,
    pauseReason: c?.pauseReason ?? null,
    pauseHints: c?.pauseHints ?? null,
    pauseReasonAt: c?.pauseReasonAt ?? null,
    params: c?.params ?? resume?.params ?? null,
  };
}
