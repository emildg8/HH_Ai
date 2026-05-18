import fs from 'fs';
import path from 'path';
import { getQueueFile, DEFAULT_QUEUE_FILE, DATA_DIR } from './paths.mjs';

export function loadQueue() {
  const qf = getQueueFile();
  if (!fs.existsSync(qf)) return [];
  return JSON.parse(fs.readFileSync(qf, 'utf8'));
}

export function saveQueue(items) {
  const qf = getQueueFile();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${qf}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, qf);
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
  const q = loadQueue();
  if (q.some((x) => x.vacancyId === item.vacancyId)) {
    return false;
  }
  q.push(item);
  saveQueue(q);
  return true;
}

export function updateVacancyRecord(recordId, patch) {
  const q = loadQueue();
  const i = q.findIndex((x) => x.id === recordId);
  if (i === -1) return false;
  q[i] = { ...q[i], ...patch, updatedAt: new Date().toISOString() };
  saveQueue(q);
  return true;
}

export function getVacancyRecord(recordId) {
  return loadQueue().find((x) => x.id === recordId);
}

export function removeVacancyRecord(recordId) {
  const q = loadQueue();
  const next = q.filter((x) => x.id !== recordId);
  if (next.length === q.length) return false;
  saveQueue(next);
  return true;
}
