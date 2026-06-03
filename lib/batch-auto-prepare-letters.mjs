/**
 * Автоподготовка утверждённых писем перед батчем (без LLM).
 */

import { bulkImproveApprovedLetters } from './cover-letter-quality-scan.mjs';
import { updateVacancyRecord } from './store.mjs';

/**
 * @param {{ candidates: object[], prefs?: object, log?: (msg: string) => void }} opts
 */
export function autoPrepareLettersForBatch(opts = {}) {
  const { candidates = [], prefs = {}, log } = opts;
  if (prefs.batchAutoPrepareLetters === false) {
    return { improved: 0, scanned: 0, skipped: true };
  }
  const summary = bulkImproveApprovedLetters(candidates, prefs, {
    limit: 500,
    onUpdate: (id, coverLetter) => updateVacancyRecord(id, { coverLetter }),
  });
  if (summary.improved > 0 && typeof log === 'function') {
    log(`Автоподготовка писем: ${summary.improved} (просмотрено ${summary.scanned})`);
  }
  return { ...summary, skipped: false };
}
