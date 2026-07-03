/**
 * Утверждение писем по списку id записей очереди.
 */
import { loadQueue, updateVacancyRecord } from './store.mjs';
import { loadPreferences } from './preferences.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { pickBestPreparedVariant } from './cover-letter-prepare.mjs';
import { passesAutoApproveLetterScore } from './letter-batch-gate.mjs';
import { loadCandidateSkillsInventory } from './candidate-skills-inventory.mjs';
import { scanLetterInventoryHonesty } from './letter-inventory-honesty.mjs';

/**
 * @param {string[]} ids
 * @param {object} [opts]
 * @param {object} [opts.prefs]
 * @param {boolean} [opts.force=false] — утвердить лучший variant даже если auto-approve score не прошёл
 * @param {object} [opts.inventory] — инвентарь для ME honesty scan
 * @param {boolean} [opts.forceHonestyBypass=false] — пропустить me-honesty gate
 * @returns {{ approved: number, skipped: number, results: Array<{ id: string, ok: boolean, reason?: string }> }}
 */
export function approveLettersByIds(ids, opts = {}) {
  const prefs = opts.prefs ?? loadPreferences();
  const force = Boolean(opts.force);
  const inventory = opts.inventory ?? loadCandidateSkillsInventory();
  const idSet = new Set(ids.map(String));
  const queue = loadQueue({ force: true });

  /** @type {Array<{ id: string, ok: boolean, reason?: string }>} */
  const results = [];
  let approved = 0;
  let skipped = 0;

  for (const rec of queue) {
    if (!idSet.has(rec.id)) continue;
    if (String(rec.coverLetter?.approvedText || '').trim()) {
      results.push({ id: rec.id, ok: true, reason: 'already approved' });
      continue;
    }
    const variants = (rec.coverLetter?.variants || []).map(String).filter(Boolean);
    if (!variants.length) {
      skipped++;
      results.push({ id: rec.id, ok: false, reason: 'no variants' });
      continue;
    }
    const role = classifyVacancyResumeRole(rec);
    const bestText = pickBestPreparedVariant(variants, rec, role, prefs);
    const bestEv = bestText ? evaluateLetterQuality(rec, bestText, role, prefs) : null;
    const ok =
      force ||
      (prefs.batchAutoApproveBestLetter !== false &&
        bestEv?.pass &&
        passesAutoApproveLetterScore(bestEv, prefs));
    if (!ok || !bestText) {
      skipped++;
      results.push({
        id: rec.id,
        ok: false,
        reason: bestEv?.reason || 'quality check failed',
      });
      continue;
    }
    const honesty = scanLetterInventoryHonesty(bestText, inventory, opts);
    if (!honesty.pass && !opts.forceHonestyBypass) {
      skipped++;
      const detail = honesty.violations.map((v) => v.claim).join(', ');
      results.push({
        id: rec.id,
        ok: false,
        reason: `me-honesty: ${detail}`,
      });
      continue;
    }
    updateVacancyRecord(rec.id, {
      coverLetter: {
        ...(rec.coverLetter || {}),
        status: 'approved',
        approvedText: bestText,
        variants: [],
        updatedAt: new Date().toISOString(),
      },
    });
    approved++;
    results.push({ id: rec.id, ok: true });
  }

  for (const id of ids) {
    if (!results.some((r) => r.id === id)) {
      skipped++;
      results.push({ id, ok: false, reason: 'not in queue' });
    }
  }

  return { approved, skipped, results };
}
