/**
 * Проставить rejectSource / rejectRuleId у уже отклонённых записей по feedback.jsonl.
 *   node scripts/backfill-reject-source.mjs
 *   node scripts/backfill-reject-source.mjs --apply
 */
import fs from 'fs';
import { FEEDBACK_FILE } from '../lib/paths.mjs';
import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import {
  REJECT_SOURCE,
  rejectSourceFromFeedbackSource,
  rejectSourcePatchForManual,
} from '../lib/reject-source.mjs';
import { matchRejectRule, DEFAULT_REJECT_RULES } from '../lib/reject-role-patterns.mjs';

const apply = process.argv.includes('--apply');

function loadAllFeedback() {
  if (!fs.existsSync(FEEDBACK_FILE)) return [];
  return fs
    .readFileSync(FEEDBACK_FILE, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function latestRejectByRecord(feedback) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const entry of feedback) {
    if (entry.action !== 'reject' || !entry.recordId) continue;
    map.set(String(entry.recordId), entry);
  }
  return map;
}

function main() {
  const feedback = loadAllFeedback();
  const latest = latestRejectByRecord(feedback);
  const queue = loadQueue();
  const rejected = queue.filter((x) => x.status === 'rejected');

  let auto = 0;
  let manual = 0;
  let skipped = 0;

  for (const rec of rejected) {
    if (rec.rejectSource) {
      skipped++;
      continue;
    }
    const entry = latest.get(rec.id);
    let patch;
    if (entry) {
      const kind = rejectSourceFromFeedbackSource(entry.source);
      patch =
        kind === REJECT_SOURCE.manual
          ? rejectSourcePatchForManual(entry.ruleId || matchRejectRule(rec, DEFAULT_REJECT_RULES)?.rule?.id)
          : {
              rejectSource: kind,
              rejectRuleId: entry.ruleId || matchRejectRule(rec, DEFAULT_REJECT_RULES)?.rule?.id || null,
              rejectedAt: entry.at || new Date().toISOString(),
            };
      if (kind === REJECT_SOURCE.manual) manual++;
      else auto++;
    } else {
      patch = rejectSourcePatchForManual(matchRejectRule(rec, DEFAULT_REJECT_RULES)?.rule?.id);
      manual++;
    }
    if (apply) updateVacancyRecord(rec.id, patch);
  }

  console.log(
    apply
      ? `backfill-reject-source: обновлено ${auto + manual} (авто: ${auto}, вручную: ${manual}, пропущено: ${skipped})`
      : `backfill-reject-source: dry-run — будет ${auto + manual} (авто: ${auto}, вручную: ${manual}, пропущено: ${skipped}). Добавьте --apply`
  );
}

main();
