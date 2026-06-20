/**
 * Минимальный dual-write откликов в Knowledge Store (без артефактов).
 */

import crypto from 'node:crypto';
import { loadPreferences } from './preferences.mjs';
import { withKnowledgeTransaction } from './knowledge-store.mjs';
import { initKnowledgeStore } from './knowledge-store.mjs';

/**
 * @param {object} [prefs]
 */
export function isKnowledgeApplyRecordEnabled(prefs) {
  const p = prefs || loadPreferences();
  return Boolean(p?.applyIntelligence?.knowledgeStoreEnabled);
}

/**
 * @param {string} name
 */
export function employerIdFromName(name) {
  const slug = String(name || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'unknown';
}

/**
 * @param {string} text
 */
function hashText(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 16);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {object} rec
 */
function upsertEmployer(db, rec) {
  const name = String(rec?.company || 'unknown').trim() || 'unknown';
  const id = employerIdFromName(name);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO employers (id, name, hh_employer_id, created_at, updated_at)
     VALUES (@id, @name, @hh_employer_id, @created_at, @updated_at)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       hh_employer_id = COALESCE(excluded.hh_employer_id, employers.hh_employer_id),
       updated_at = excluded.updated_at`
  ).run({
    id,
    name,
    hh_employer_id: rec?.employerId || rec?.hhEmployerId || null,
    created_at: now,
    updated_at: now,
  });
  return id;
}

/**
 * @param {{
 *   prefs?: object,
 *   attemptId: string,
 *   rec: object,
 *   gateVerdict?: object,
 *   outcome: string,
 *   batchRunId?: string,
 *   error?: string,
 *   letterText?: string,
 *   dbPath?: string,
 * }} payload
 */
export function recordKnowledgeApplyAttempt(payload) {
  const prefs = payload.prefs || loadPreferences();
  if (!isKnowledgeApplyRecordEnabled(prefs)) return null;

  const storeOpts = payload.dbPath ? { dbPath: payload.dbPath } : {};
  initKnowledgeStore(storeOpts);
  const rec = payload.rec || {};
  const letter = String(payload.letterText || rec?.coverLetter?.approvedText || '').trim();
  const gate = payload.gateVerdict || {};
  const now = new Date().toISOString();
  const meta = {
    outcome: payload.outcome,
    batchRunId: payload.batchRunId || null,
    skipReason: gate.skipReason || null,
    gateEnabled: gate.gateEnabled,
    pInvitePct: gate.pInvitePct ?? null,
    error: payload.error ? String(payload.error).slice(0, 500) : null,
  };

  return withKnowledgeTransaction((db) => {
    const employerId = upsertEmployer(db, rec);
    db.prepare(
      `INSERT OR REPLACE INTO apply_attempts (
        id, employer_id, vacancy_id, record_id, applied_at, source,
        resume_variant, letter_hash, keyword_gap_score, letter_score10, gate_score, meta_json
      ) VALUES (
        @id, @employer_id, @vacancy_id, @record_id, @applied_at, @source,
        @resume_variant, @letter_hash, @keyword_gap_score, @letter_score10, @gate_score, @meta_json
      )`
    ).run({
      id: payload.attemptId,
      employer_id: employerId,
      vacancy_id: String(rec.vacancyId || rec.id || ''),
      record_id: String(rec.id || ''),
      applied_at: now,
      source: String(rec.source || 'hh'),
      resume_variant: gate.resumeRole || rec?.resumeRouting?.role || null,
      letter_hash: letter ? hashText(letter) : null,
      keyword_gap_score: gate.components?.keywordFit ?? null,
      letter_score10: gate.letter?.score10 ?? null,
      gate_score: gate.gateScore ?? null,
      meta_json: JSON.stringify(meta),
    });
    return { attemptId: payload.attemptId, employerId };
  }, storeOpts);
}
