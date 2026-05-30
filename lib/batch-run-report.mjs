/**
 * Итоговый отчёт батча — data/batch-last-report.json + строка в журнале.
 */

import fs from 'fs';
import path from 'path';
import { BATCH_LAST_REPORT_FILE } from './paths.mjs';
import { appendApplyChatLog } from './apply-chat-log.mjs';

/**
 * @param {{
 *   startedAt?: string,
 *   finishedAt?: string,
 *   planned: number,
 *   done: number,
 *   failed: number,
 *   skipped: number,
 *   offTargetSkipped?: number,
 *   stopReason?: string | null,
 *   batchScope?: string,
 *   resumeUsage?: Record<string, number>,
 *   skipReasons?: Record<string, number>,
 *   items?: Array<{ title?: string, status: string, resumeRole?: string, reason?: string }>,
 * }} report
 */
export function writeBatchRunReport(report) {
  const payload = {
    version: 1,
    finishedAt: report.finishedAt || new Date().toISOString(),
    startedAt: report.startedAt,
    planned: report.planned,
    done: report.done,
    failed: report.failed,
    skipped: report.skipped,
    offTargetSkipped: report.offTargetSkipped || 0,
    stopReason: report.stopReason || null,
    batchScope: report.batchScope || '',
    resumeUsage: report.resumeUsage || {},
    skipReasons: report.skipReasons || {},
    items: (report.items || []).slice(-50),
  };
  fs.mkdirSync(path.dirname(BATCH_LAST_REPORT_FILE), { recursive: true });
  fs.writeFileSync(BATCH_LAST_REPORT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const resumeLine = Object.entries(payload.resumeUsage)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  const summary =
    `[batch-report] ok=${payload.done} skip=${payload.skipped} fail=${payload.failed}` +
    (payload.offTargetSkipped ? ` off-target=${payload.offTargetSkipped}` : '') +
    (resumeLine ? ` · резюме: ${resumeLine}` : '');
  appendApplyChatLog(summary, { withTime: true });
  return payload;
}

export function readBatchRunReport() {
  try {
    if (!fs.existsSync(BATCH_LAST_REPORT_FILE)) return null;
    return JSON.parse(fs.readFileSync(BATCH_LAST_REPORT_FILE, 'utf8'));
  } catch {
    return null;
  }
}
