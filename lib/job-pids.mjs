import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';

const HARVEST_PID = path.join(DATA_DIR, 'harvest.pid');
const BATCH_PID = path.join(DATA_DIR, 'apply-batch.pid');

function readPid(file) {
  try {
    const n = Number(fs.readFileSync(file, 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writePid(file, pid) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, String(pid), 'utf8');
}

function clearPid(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

export function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function setHarvestPid(pid) {
  if (pid) writePid(HARVEST_PID, pid);
  else clearPid(HARVEST_PID);
}

export function setBatchPid(pid) {
  if (pid) writePid(BATCH_PID, pid);
  else clearPid(BATCH_PID);
}

export function getJobStatus() {
  const harvestPid = readPid(HARVEST_PID);
  const batchPid = readPid(BATCH_PID);
  return {
    harvest: { pid: harvestPid, running: isProcessAlive(harvestPid) },
    batch: { pid: batchPid, running: isProcessAlive(batchPid) },
    applyChat: { pid: null, running: false },
  };
}
