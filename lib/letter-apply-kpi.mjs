/**
 * KPI «% откликов без правки письма» (K-01).
 */

import { loadQueue } from './store.mjs';
import { computeLetterEditMetrics } from './cover-letter-metrics.mjs';

/** @returns {{ samples: number, noEdit: number, noEditPct: number | null }} */
export function computeLetterNoEditKpi() {
  const q = loadQueue();
  let samples = 0;
  let noEdit = 0;
  for (const rec of q) {
    const approved = rec.coverLetter?.approvedText;
    if (!approved) continue;
    const submitted = rec.hhApply?.responseSubmitted || rec.status === 'responded';
    if (!submitted) continue;
    const gen =
      rec.coverLetter?.generatedText ||
      (Array.isArray(rec.coverLetter?.variants) ? rec.coverLetter.variants[0] : '');
    if (!gen) continue;
    samples++;
    const m = computeLetterEditMetrics(String(gen), String(approved));
    if (m && m.editRatioPct <= 5) noEdit++;
  }
  return {
    samples,
    noEdit,
    noEditPct: samples > 0 ? Math.round((noEdit / samples) * 100) : null,
  };
}
