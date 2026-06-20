/**
 * Debrief → winning_patterns в Knowledge Store (минимальный COPILOT-INT hook).
 */

import { loadPreferences } from './preferences.mjs';
import { employerIdFromName } from './knowledge-apply-record.mjs';
import { getKnowledgeDb, initKnowledgeStore, withKnowledgeTransaction } from './knowledge-store.mjs';

/**
 * @param {object} [prefs]
 */
function isKnowledgeEnabled(prefs) {
  return Boolean((prefs || loadPreferences())?.applyIntelligence?.knowledgeStoreEnabled);
}

/**
 * @param {object | null | undefined} debrief
 * @param {{ prefs?: object, storeOpts?: object }} [opts]
 */
export function recordDebriefPattern(debrief, opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  if (!isKnowledgeEnabled(prefs) || !debrief) return { recorded: false, reason: 'disabled' };

  const company = String(debrief.company || '').trim();
  if (!company) return { recorded: false, reason: 'no_company' };

  const unexpected = String(debrief.unexpectedQuestion || '').trim();
  const lastQ = String(debrief.lastQuestion || '').trim();
  const patternValue = unexpected || lastQ;
  if (!patternValue) return { recorded: false, reason: 'empty_pattern' };

  initKnowledgeStore(opts.storeOpts || {});
  const employerId = employerIdFromName(company);
  const now = new Date().toISOString();
  const rating = debrief.selfRating;
  const patternType = rating != null && Number(rating) >= 7 ? 'debrief_positive' : 'debrief_question';

  withKnowledgeTransaction((db) => {
    db.prepare(
      `INSERT INTO employers (id, name, created_at, updated_at)
       VALUES (@id, @name, @now, @now)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
    ).run({ id: employerId, name: company, now });

    db.prepare(
      `INSERT INTO winning_patterns (employer_id, pattern_type, pattern_value, invite_count, decline_count, confidence, last_seen_at)
       VALUES (@employer_id, @pattern_type, @pattern_value, 0, 0, @confidence, @now)`
    ).run({
      employer_id: employerId,
      pattern_type: patternType,
      pattern_value: patternValue.slice(0, 500),
      confidence: 0.5,
      now,
    });
  }, opts.storeOpts || {});

  return { recorded: true, employerId, patternType };
}
