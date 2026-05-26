import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { getJobStatus, isProcessAlive } from './job-pids.mjs';
import { killPid } from './batch-control.mjs';

export const HARVEST_CONTROL_FILE = path.join(DATA_DIR, 'harvest-control.json');

const COMMANDS = new Set(['running', 'paused', 'stop', 'idle']);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readHarvestControl() {
  try {
    const raw = fs.readFileSync(HARVEST_CONTROL_FILE, 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeHarvestControl(data) {
  ensureDataDir();
  fs.writeFileSync(HARVEST_CONTROL_FILE, `${JSON.stringify(data)}\n`, 'utf8');
}

export function initHarvestControl(meta = {}) {
  writeHarvestControl({
    command: 'running',
    harvestPid: process.pid,
    updatedAt: new Date().toISOString(),
    runId: `harvest-${Date.now()}`,
    ...meta,
  });
}

export function patchHarvestControl(patch) {
  const cur = readHarvestControl() || {};
  writeHarvestControl({
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export function getHarvestCommand() {
  const cmd = readHarvestControl()?.command;
  return COMMANDS.has(cmd) ? cmd : 'idle';
}

export function setHarvestCommand(command) {
  if (!COMMANDS.has(command)) return;
  patchHarvestControl({ command });
}

export function shouldStopHarvest() {
  return getHarvestCommand() === 'stop';
}

export function isHarvestPaused() {
  return getHarvestCommand() === 'paused';
}

export function requestHarvestPause() {
  if (getHarvestCommand() === 'running') setHarvestCommand('paused');
}

export function requestHarvestResume() {
  if (getHarvestCommand() === 'paused') setHarvestCommand('running');
}

export function requestHarvestStop() {
  setHarvestCommand('stop');
  const st = getJobStatus();
  if (st.harvest.pid && isProcessAlive(st.harvest.pid)) {
    killPid(st.harvest.pid);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @returns {'continue'|'stop'}
 */
export async function waitAtHarvestBoundary(onPaused) {
  while (true) {
    const cmd = getHarvestCommand();
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

export function finishHarvestControl({ reason } = {}) {
  patchHarvestControl({
    command: reason === 'stop' ? 'stop' : 'idle',
    harvestPid: null,
    finishedAt: new Date().toISOString(),
  });
}

export function getHarvestControlSummary() {
  const c = readHarvestControl();
  const st = getJobStatus();
  const harvestRunning = Boolean(st.harvest.running);
  const cmd = harvestRunning ? getHarvestCommand() : c?.command === 'paused' ? 'paused' : 'idle';
  return {
    harvestRunning,
    command: cmd,
    harvestPid: st.harvest.pid ?? c?.harvestPid ?? null,
    runId: c?.runId ?? null,
    updatedAt: c?.updatedAt ?? null,
  };
}
