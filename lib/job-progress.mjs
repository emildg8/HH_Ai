import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';

export const HARVEST_PROGRESS_FILE = path.join(DATA_DIR, 'harvest-progress.json');
export const BATCH_PROGRESS_FILE = path.join(DATA_DIR, 'batch-progress.json');
export const APPLY_CHAT_PROGRESS_FILE = path.join(DATA_DIR, 'apply-chat-progress.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * @param {number} current
 * @param {number} total
 * @param {number} startedAt ms
 */
export function estimateEtaSeconds(current, total, startedAt) {
  if (!total || current <= 0 || current >= total) return null;
  const elapsed = (Date.now() - startedAt) / 1000;
  if (elapsed < 1) return null;
  const perUnit = elapsed / current;
  return Math.max(1, Math.round((total - current) * perUnit));
}

function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  if (seconds < 60) return `~${seconds} с`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `~${m} мин ${s} с` : `~${m} мин`;
}

/**
 * @param {object} payload
 */
function writeProgress(file, payload) {
  ensureDataDir();
  fs.writeFileSync(file, `${JSON.stringify(payload)}\n`, 'utf8');
}

export function readJobProgress(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createHarvestProgressTracker() {
  const startedAt = Date.now();
  let keywordsTotal = 0;
  let urlsTotal = 0;

  const publish = (fields) => {
    const phase = fields.phase || 'collecting';
    let percent = 0;
    let current = 0;
    let total = 0;
    let label = fields.label || '';

    if (phase === 'starting') {
      percent = 0;
      label = label || 'Запуск браузера…';
    } else if (phase === 'collecting') {
      current = fields.keywordIndex ?? 0;
      total = fields.keywordsTotal ?? keywordsTotal;
      keywordsTotal = total;
      percent = total > 0 ? Math.round((current / total) * 18) : 2;
      label = label || `Поиск по ключам ${current}/${total}`;
    } else if (phase === 'scoring') {
      current = fields.urlIndex ?? 0;
      total = fields.urlsTotal ?? urlsTotal;
      urlsTotal = total;
      const slice = total > 0 ? current / total : 0;
      percent = Math.round(18 + slice * 82);
      label = label || `Обработка вакансий ${current}/${total}`;
    } else if (phase === 'done') {
      percent = 100;
      label = label || 'Сбор завершён';
    } else if (phase === 'paused') {
      current = fields.urlIndex ?? fields.keywordIndex ?? current;
      total = fields.urlsTotal ?? fields.keywordsTotal ?? urlsTotal ?? keywordsTotal;
      percent = fields.percent ?? (total > 0 ? Math.round((current / total) * 90) : 0);
      label = label || 'Сбор на паузе';
    } else if (phase === 'error') {
      label = label || fields.error || 'Ошибка';
    }

    const etaSeconds =
      phase === 'scoring' && total > 0
        ? estimateEtaSeconds(current, total, fields.scoringStartedAt || startedAt)
        : phase === 'collecting' && total > 0
          ? estimateEtaSeconds(current, total, startedAt)
          : null;

    const payload = {
      job: 'harvest',
      phase,
      percent: fields.percent ?? percent,
      current,
      total,
      label,
      etaSeconds,
      etaLabel: formatEta(etaSeconds),
      startedAt: new Date(startedAt).toISOString(),
      updatedAt: new Date().toISOString(),
      stats: fields.stats || {},
    };
    writeProgress(HARVEST_PROGRESS_FILE, payload);
    return payload;
  };

  return {
    starting: (label) => publish({ phase: 'starting', label }),
    collecting: (keywordIndex, keywordsTotal, stats = {}) =>
      publish({ phase: 'collecting', keywordIndex, keywordsTotal, stats }),
    scoring: (urlIndex, urlsTotal, stats = {}, scoringStartedAt) =>
      publish({
        phase: 'scoring',
        urlIndex,
        urlsTotal,
        stats,
        scoringStartedAt: scoringStartedAt || Date.now(),
      }),
    paused: (label, stats = {}) =>
      publish({
        phase: 'paused',
        label: label || 'Сбор на паузе — «Продолжить» в дашборде',
        stats: { ...stats, paused: true },
      }),
    done: (stats = {}) => publish({ phase: 'done', percent: 100, stats }),
    error: (error, stats = {}) =>
      publish({ phase: 'error', error: String(error), stats, percent: 0 }),
  };
}

export function createBatchProgressTracker({ total, minScore, maxScore }) {
  const startedAt = Date.now();
  let planned = total;

  const publish = (fields) => {
    const current = fields.current ?? 0;
    planned = fields.total ?? planned;
    const percent = planned > 0 ? Math.min(100, Math.round((current / planned) * 100)) : 0;
    const etaSeconds = estimateEtaSeconds(Math.floor(current), planned, startedAt);
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const payload = {
      job: 'batch',
      phase: fields.phase || 'running',
      percent: fields.percent ?? percent,
      current,
      total: planned,
      label: fields.label || `Отклик ${current}/${planned}`,
      detailStep: fields.detailStep ?? fields.stats?.detailStep ?? null,
      lastLogLine: fields.lastLogLine ?? fields.stats?.lastLogLine ?? null,
      inProgress: Boolean(fields.inProgress ?? fields.stats?.inProgress),
      etaSeconds,
      etaLabel: formatEta(etaSeconds),
      elapsedSec,
      startedAt: new Date(startedAt).toISOString(),
      updatedAt: new Date().toISOString(),
      minScore,
      maxScore,
      stats: fields.stats || {},
    };
    writeProgress(BATCH_PROGRESS_FILE, payload);
    return payload;
  };

  return {
    start: (label) => publish({ phase: 'running', current: 0, label }),
    step: (current, label, stats) => publish({ phase: 'running', current, label, stats }),
    paused: (current, label, stats = {}) =>
      publish({
        phase: 'paused',
        current,
        label: label || 'Пауза — нажмите «Продолжить»',
        stats: { ...stats, paused: true },
      }),
    /** Текущая вакансия в работе: current = (index-1) + subProgress (0..1). */
    runningVacancy: (index, plannedTotal, label, stats = {}) => {
      const sub = Math.min(0.95, Math.max(0, Number(stats.subProgress) || 0));
      const current = Math.max(0, index - 1) + sub;
      publish({
        phase: 'running',
        current,
        total: plannedTotal,
        label,
        inProgress: true,
        stats: { ...stats, inProgress: true },
      });
    },
    done: (stats) => publish({ phase: 'done', percent: 100, current: planned, stats }),
    error: (error, stats) =>
      publish({ phase: 'error', error: String(error), stats, percent: 0 }),
  };
}

export function writeHarvestError(error, stats = {}) {
  writeProgress(HARVEST_PROGRESS_FILE, {
    job: 'harvest',
    phase: 'error',
    percent: 0,
    label: String(error),
    error: String(error),
    updatedAt: new Date().toISOString(),
    stats,
  });
}

export function writeBatchError(error, stats = {}) {
  writeProgress(BATCH_PROGRESS_FILE, {
    job: 'batch',
    phase: 'error',
    percent: 0,
    label: String(error),
    error: String(error),
    updatedAt: new Date().toISOString(),
    stats,
  });
}

export function clearHarvestProgress() {
  try {
    fs.unlinkSync(HARVEST_PROGRESS_FILE);
  } catch {
    /* ignore */
  }
}

export function createApplyChatProgressTracker(recordId, title = '') {
  const startedAt = Date.now();
  const publish = (fields) => {
    const phase = fields.phase || 'running';
    const label = fields.label || '';
    const payload = {
      job: 'apply-chat',
      recordId,
      title: title.slice(0, 80),
      phase,
      percent: fields.percent ?? (phase === 'done' ? 100 : phase === 'error' ? 0 : 50),
      label,
      step: fields.step || null,
      startedAt: new Date(startedAt).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeProgress(APPLY_CHAT_PROGRESS_FILE, payload);
    return payload;
  };
  return {
    update: (step, label, percent) => publish({ phase: 'running', step, label, percent }),
    done: (label) => publish({ phase: 'done', label, percent: 100 }),
    error: (error) => publish({ phase: 'error', label: String(error), percent: 0 }),
  };
}

export function clearApplyChatProgress() {
  try {
    fs.unlinkSync(APPLY_CHAT_PROGRESS_FILE);
  } catch {
    /* ignore */
  }
}

export function clearBatchProgress() {
  try {
    fs.unlinkSync(BATCH_PROGRESS_FILE);
  } catch {
    /* ignore */
  }
}
