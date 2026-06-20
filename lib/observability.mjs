/**
 * Канонический emit наблюдаемости: JSONL, correlation ids, маршрутизация по type.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isObservabilityEnabled } from './apply-intelligence-prefs.mjs';
import { DATA_DIR } from './paths.mjs';

export const OBS_EVENT_SCHEMA_VERSION = 1;

const LOGS_DIR = path.join(DATA_DIR, 'logs');

/** @type {Record<string, string>} */
const ROUTE_FILES = {
  conversion: path.join(DATA_DIR, 'conversion-events.jsonl'),
  applyIntelligence: path.join(LOGS_DIR, 'apply-intelligence.jsonl'),
  llm: path.join(LOGS_DIR, 'llm-usage.jsonl'),
  letter: path.join(DATA_DIR, 'letter-metrics.jsonl'),
  copilot: path.join(LOGS_DIR, 'copilot-events.jsonl'),
  job: path.join(LOGS_DIR, 'job-events.jsonl'),
};

/** Префикс type → файл (см. docs/OBSERVABILITY.md). */
const TYPE_PREFIX_ROUTES = [
  ['glue.', 'conversion'],
  ['gate.', 'conversion'],
  ['apply.', 'conversion'],
  ['outcome.', 'conversion'],
  ['vacancy.', 'conversion'],
  ['negotiation.', 'conversion'],
  ['rag.', 'applyIntelligence'],
  ['l4.', 'applyIntelligence'],
  ['knowledge.', 'applyIntelligence'],
  ['llm.', 'llm'],
  ['letter.', 'letter'],
  ['copilot.', 'copilot'],
  ['job.', 'job'],
];

/**
 * @param {string} [prefix]
 */
export function newCorrelationId(prefix = 'corr') {
  const tail = crypto.randomBytes(4).toString('hex');
  return `${prefix}-${tail}`;
}

/**
 * @param {string} type
 */
export function resolveObsRoute(type) {
  const t = String(type || '');
  for (const [prefix, route] of TYPE_PREFIX_ROUTES) {
    if (t.startsWith(prefix)) return route;
  }
  return 'conversion';
}

/**
 * @param {string} route
 */
export function resolveObsFile(route) {
  const override = process.env.HH_CONVERSION_EVENTS_FILE;
  if (override && route === 'conversion') {
    return path.resolve(override);
  }
  return ROUTE_FILES[route] || ROUTE_FILES.conversion;
}

/**
 * @param {string} type
 * @param {Record<string, unknown>} payload
 * @param {{ correlationId?: string, batchRunId?: string, attemptId?: string, jobRunId?: string, vacancyId?: string, employerId?: string, recordId?: string, phase?: string, ms?: number, route?: string, skipEnabledCheck?: boolean }} [opts]
 */
export function emitObsEvent(type, payload = {}, opts = {}) {
  if (!opts.skipEnabledCheck && !isObservabilityEnabled()) {
    return { skipped: true, reason: 'observability_disabled' };
  }

  const route = opts.route || resolveObsRoute(type);
  const file = resolveObsFile(route);
  const line = {
    v: OBS_EVENT_SCHEMA_VERSION,
    ts: new Date().toISOString(),
    type: String(type),
    correlationId: opts.correlationId || newCorrelationId('evt'),
    payload: payload && typeof payload === 'object' ? payload : { value: payload },
  };
  if (opts.batchRunId) line.batchRunId = opts.batchRunId;
  if (opts.attemptId) line.attemptId = opts.attemptId;
  if (opts.jobRunId) line.jobRunId = opts.jobRunId;
  if (opts.vacancyId) line.vacancyId = String(opts.vacancyId);
  if (opts.employerId) line.employerId = String(opts.employerId);
  if (opts.recordId) line.recordId = String(opts.recordId);
  if (opts.phase) line.phase = String(opts.phase);
  if (Number.isFinite(opts.ms)) line.ms = opts.ms;

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, 'utf8');
  } catch {
    return { skipped: true, reason: 'write_failed' };
  }
  return { ok: true, file, type: line.type, correlationId: line.correlationId };
}

/**
 * @param {{ limit?: number, correlationId?: string, batchRunId?: string, typePrefix?: string }} [opts]
 */
export function readConversionEvents(opts = {}) {
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 50));
  const file = resolveObsFile('conversion');
  if (!fs.existsSync(file)) {
    return { file, events: [], total: 0 };
  }
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\n/).filter(Boolean);
  let events = lines.map((l) => JSON.parse(l));
  if (opts.correlationId) {
    events = events.filter((e) => e.correlationId === opts.correlationId);
  }
  if (opts.batchRunId) {
    events = events.filter((e) => e.batchRunId === opts.batchRunId);
  }
  if (opts.typePrefix) {
    const p = String(opts.typePrefix);
    events = events.filter((e) => String(e.type || '').startsWith(p));
  }
  const total = events.length;
  if (events.length > limit) {
    events = events.slice(-limit);
  }
  return { file, events, total };
}

/**
 * Минимальная валидация строки JSONL (v1).
 * @param {object} row
 */
export function validateObsEventRow(row) {
  const errors = [];
  if (row.v !== OBS_EVENT_SCHEMA_VERSION) errors.push('v');
  if (!row.ts || !Number.isFinite(Date.parse(row.ts))) errors.push('ts');
  if (!row.type || typeof row.type !== 'string') errors.push('type');
  if (!row.correlationId || typeof row.correlationId !== 'string') errors.push('correlationId');
  if (!row.payload || typeof row.payload !== 'object') errors.push('payload');
  return errors;
}
