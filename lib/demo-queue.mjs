/**
 * Демо-очередь для первого запуска (R-04b / R-04c).
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DEFAULT_QUEUE_FILE, getQueueFile } from './paths.mjs';
import { loadQueue, saveQueue } from './store.mjs';

export const DEMO_QUEUE_SOURCE = path.join(ROOT, 'docs', 'demo', 'vacancies-demo.json');
export const QUEUE_EXAMPLE_FILE = path.join(ROOT, 'data', 'vacancies-queue.example.json');

/** @returns {object[] | null} */
export function readDemoQueueItems() {
  const src = fs.existsSync(DEMO_QUEUE_SOURCE)
    ? DEMO_QUEUE_SOURCE
    : fs.existsSync(QUEUE_EXAMPLE_FILE)
      ? QUEUE_EXAMPLE_FILE
      : null;
  if (!src) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** @returns {boolean} */
export function isActiveQueueEmpty() {
  const q = loadQueue();
  return !Array.isArray(q) || q.length === 0;
}

/**
 * @param {{ replace?: boolean }} [opts]
 * @returns {{ ok: boolean, count?: number, reason?: string }}
 */
export function loadDemoIntoActiveQueue(opts = {}) {
  const items = readDemoQueueItems();
  if (!items?.length) {
    throw new Error('Файл демо-очереди не найден (docs/demo/vacancies-demo.json)');
  }
  if (!opts.replace && !isActiveQueueEmpty()) {
    return { ok: false, reason: 'not_empty', count: loadQueue().length };
  }
  saveQueue(items);
  return { ok: true, count: items.length, source: 'demo' };
}

/** @returns {{ skipped?: boolean, reason?: string, count?: number, ok?: boolean }} */
export function copyDemoToQueueIfMissing() {
  const qf = getQueueFile();
  if (path.resolve(qf) !== path.resolve(DEFAULT_QUEUE_FILE)) {
    return { skipped: true, reason: 'custom_queue_file' };
  }
  if (fs.existsSync(qf)) {
    try {
      const q = JSON.parse(fs.readFileSync(qf, 'utf8'));
      if (Array.isArray(q) && q.length > 0) {
        return { skipped: true, reason: 'has_data', count: q.length };
      }
    } catch {
      /* перезапишем битый файл */
    }
  }
  return loadDemoIntoActiveQueue({ replace: true });
}

export function ensureQueueExampleFile() {
  if (fs.existsSync(QUEUE_EXAMPLE_FILE)) return false;
  const items = readDemoQueueItems();
  if (!items?.length) return false;
  fs.mkdirSync(path.dirname(QUEUE_EXAMPLE_FILE), { recursive: true });
  fs.writeFileSync(QUEUE_EXAMPLE_FILE, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
  return true;
}

/** @returns {{ empty: boolean, total: number, demoAvailable: boolean, demoCount: number, queueFile: string }} */
export function getQueueMeta() {
  const items = readDemoQueueItems();
  const q = loadQueue();
  return {
    empty: !Array.isArray(q) || q.length === 0,
    total: Array.isArray(q) ? q.length : 0,
    demoAvailable: Boolean(items?.length),
    demoCount: items?.length || 0,
    queueFile: path.basename(getQueueFile()),
  };
}
