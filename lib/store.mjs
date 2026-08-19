import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getQueueFile, DEFAULT_QUEUE_FILE } from './paths.mjs';

const QUEUE_LOCK_WAIT_MS = 10_000;
const QUEUE_LOCK_STALE_MS = 30_000;
const LOCK_SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(4));

function loadQueueFile(qf) {
  if (!fs.existsSync(qf)) return [];
  return JSON.parse(fs.readFileSync(qf, 'utf8'));
}

export function loadQueue() {
  return loadQueueFile(getQueueFile());
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function clearStaleQueueLock(lockPath) {
  let lock = null;
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    /* inspect mtime below */
  }

  if (processIsAlive(Number(lock?.pid))) return false;

  try {
    const ageMs = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (lock?.pid || ageMs >= QUEUE_LOCK_STALE_MS) {
      fs.unlinkSync(lockPath);
      return true;
    }
  } catch (error) {
    return error?.code === 'ENOENT';
  }
  return false;
}

function acquireQueueLock(qf) {
  const lockPath = `${qf}.lock`;
  const token = crypto.randomUUID();
  const deadline = Date.now() + QUEUE_LOCK_WAIT_MS;

  while (true) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, createdAt: Date.now() }), 'utf8');
      } finally {
        fs.closeSync(fd);
      }
      return () => {
        try {
          const current = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
          if (current.token === token) fs.unlinkSync(lockPath);
        } catch {
          /* lock was already removed */
        }
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (clearStaleQueueLock(lockPath)) continue;
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for queue lock: ${lockPath}`);
      }
      Atomics.wait(LOCK_SLEEP_ARRAY, 0, 0, 20);
    }
  }
}

function writeQueueFile(qf, items) {
  fs.mkdirSync(path.dirname(qf), { recursive: true });
  const tmp = `${qf}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, qf);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* renamed or never created */
    }
  }
}

function mutateQueue(mutator) {
  const qf = getQueueFile();
  fs.mkdirSync(path.dirname(qf), { recursive: true });
  const release = acquireQueueLock(qf);
  try {
    return mutator(loadQueueFile(qf), qf);
  } finally {
    release();
  }
}

export function saveQueue(items) {
  return mutateQueue((_current, qf) => writeQueueFile(qf, items));
}

/**
 * ID вакансий, уже присутствующих в активной очереди.
 * Если активный файл — отдельный (например недельный), дополнительно учитывается основной `vacancies-queue.json`,
 * чтобы не дублировать записи из прошлых прогонов.
 */
export function knownVacancyIds() {
  const ids = new Set(loadQueue().map((x) => x.vacancyId));
  const active = getQueueFile();
  if (path.resolve(active) !== path.resolve(DEFAULT_QUEUE_FILE) && fs.existsSync(DEFAULT_QUEUE_FILE)) {
    const main = JSON.parse(fs.readFileSync(DEFAULT_QUEUE_FILE, 'utf8'));
    for (const x of main) {
      if (x?.vacancyId) ids.add(x.vacancyId);
    }
  }
  return ids;
}

/**
 * Добавляет запись, если такого vacancyId ещё нет в очереди.
 */
export function addVacancyRecord(item) {
  return mutateQueue((q, qf) => {
    if (q.some((x) => x.vacancyId === item.vacancyId)) {
      return false;
    }
    q.push(item);
    writeQueueFile(qf, q);
    return true;
  });
}

export function updateVacancyRecord(recordId, patch) {
  return mutateQueue((q, qf) => {
    const i = q.findIndex((x) => x.id === recordId);
    if (i === -1) return false;
    q[i] = { ...q[i], ...patch, updatedAt: new Date().toISOString() };
    writeQueueFile(qf, q);
    return true;
  });
}

export function getVacancyRecord(recordId) {
  return loadQueue().find((x) => x.id === recordId);
}

export function removeVacancyRecord(recordId) {
  return mutateQueue((q, qf) => {
    const next = q.filter((x) => x.id !== recordId);
    if (next.length === q.length) return false;
    writeQueueFile(qf, next);
    return true;
  });
}
