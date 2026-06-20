/**
 * Employer Dossier — профиль работодателя из очереди + Knowledge Store.
 */

import {
  buildEmployerProfiles,
  getEmployerScoreFromStats,
} from './employer-intelligence.mjs';
import { employerIdFromName } from './knowledge-apply-record.mjs';
import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { loadPreferences } from './preferences.mjs';
import { getKnowledgeDb, initKnowledgeStore, withKnowledgeTransaction } from './knowledge-store.mjs';

/**
 * @param {object} [prefs]
 */
function isKnowledgeEnabled(prefs) {
  return Boolean(prefs?.applyIntelligence?.knowledgeStoreEnabled);
}

/**
 * @param {string} companyOrId
 */
export function resolveEmployerId(companyOrId) {
  const raw = String(companyOrId || '').trim();
  if (!raw) return 'unknown';
  if (/^[a-z0-9-]+$/.test(raw) && !raw.includes(' ')) return raw;
  return employerIdFromName(raw);
}

/**
 * @param {object[]} records
 * @param {{ prefs?: object, storeOpts?: object, init?: boolean }} [opts]
 */
export function syncEmployerProfilesToKnowledge(records, opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  if (!isKnowledgeEnabled(prefs)) return { synced: 0, skipped: 'knowledgeStoreDisabled' };

  const list = records || loadAnalyticsUnionRecords().records;
  const profiles = buildEmployerProfiles(list);
  if (!profiles.length) return { synced: 0, total: 0 };

  if (opts.init !== false) initKnowledgeStore(opts.storeOpts || {});

  const now = new Date().toISOString();
  let synced = 0;

  withKnowledgeTransaction((db) => {
    const upsertEmployer = db.prepare(
      `INSERT INTO employers (id, name, created_at, updated_at)
       VALUES (@id, @name, @now, @now)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
    );
    const upsertProfile = db.prepare(
      `INSERT INTO employer_hr_profile (employer_id, ghost_rate, invite_rate, signals_json)
       VALUES (@employer_id, @ghost_rate, @invite_rate, @signals_json)
       ON CONFLICT(employer_id) DO UPDATE SET
         ghost_rate = excluded.ghost_rate,
         invite_rate = excluded.invite_rate,
         signals_json = excluded.signals_json`
    );

    for (const p of profiles) {
      if (!p.applied) continue;
      const id = employerIdFromName(p.company);
      upsertEmployer.run({ id, name: p.company, now });
      upsertProfile.run({
        employer_id: id,
        ghost_rate: p.applied ? p.ghost / p.applied : 0,
        invite_rate: p.applied ? p.invited / p.applied : 0,
        signals_json: JSON.stringify({
          applied: p.applied,
          invited: p.invited,
          declined: p.declined,
          ghost: p.ghost,
          dialogue: p.dialogue,
          score: p.score,
          syncedAt: now,
        }),
      });
      synced += 1;
    }
  }, opts.storeOpts || {});

  return { synced, total: profiles.length };
}

/**
 * @param {object | null | undefined} live
 * @param {object | null | undefined} signals
 */
function buildDossierHints(live, signals) {
  const hints = [];
  const applied = live?.applied ?? signals?.applied ?? 0;
  const ghost = live?.ghost ?? signals?.ghost ?? 0;
  const invited = live?.invited ?? signals?.invited ?? 0;

  if (applied >= 2 && ghost >= invited && ghost >= 2) {
    hints.push({
      kind: 'ghost',
      text: 'Часто тишина после отклика — снизить приоритет или добавить в чёрный список.',
    });
  }
  if (applied >= 1 && invited >= 1) {
    hints.push({
      kind: 'positive',
      text: 'Было приглашение — повышенный приоритет в gate.',
    });
  }
  if (applied === 0) {
    hints.push({
      kind: 'cold',
      text: 'Нет истории откликов — gate опирается только на общие эвристики.',
    });
  }
  return hints;
}

/**
 * @param {string} companyOrId
 * @param {{ records?: object[], prefs?: object, storeOpts?: object }} [opts]
 */
export function getEmployerDossier(companyOrId, opts = {}) {
  const id = resolveEmployerId(companyOrId);
  const list = opts.records || loadAnalyticsUnionRecords().records;
  const profiles = buildEmployerProfiles(list);
  const live = profiles.find(
    (p) =>
      employerIdFromName(p.company) === id ||
      p.company.toLowerCase() === String(companyOrId || '').trim().toLowerCase()
  );

  /** @type {object | null} */
  let stored = null;
  /** @type {object[]} */
  let attempts = [];

  const prefs = opts.prefs || loadPreferences();
  if (isKnowledgeEnabled(prefs)) {
    try {
      initKnowledgeStore(opts.storeOpts || {});
      const db = getKnowledgeDb(opts.storeOpts || {});
      stored = db
        .prepare(
          `SELECT e.id, e.name, p.ghost_rate, p.invite_rate, p.signals_json,
                  p.overrides_json, p.playbooks_json
           FROM employers e
           LEFT JOIN employer_hr_profile p ON p.employer_id = e.id
           WHERE e.id = ?`
        )
        .get(id);
      attempts = db
        .prepare(
          `SELECT id, vacancy_id, record_id, applied_at, gate_score, letter_score10, meta_json
           FROM apply_attempts
           WHERE employer_id = ?
           ORDER BY applied_at DESC
           LIMIT 10`
        )
        .all(id);
    } catch {
      /* knowledge optional */
    }
  }

  if (!live && !stored) return null;

  const signals = stored?.signals_json ? JSON.parse(stored.signals_json) : null;
  const company = live?.company || stored?.name || String(companyOrId || '').trim();

  return {
    id,
    company,
    score: live?.score ?? signals?.score ?? getEmployerScoreFromStats(live || signals || {}),
    live: live || null,
    stored: stored
      ? {
          ghostRate: stored.ghost_rate,
          inviteRate: stored.invite_rate,
          signals,
          overrides: stored.overrides_json ? JSON.parse(stored.overrides_json) : null,
          playbooks: stored.playbooks_json ? JSON.parse(stored.playbooks_json) : null,
        }
      : null,
    recentAttempts: attempts,
    hints: buildDossierHints(live, signals),
  };
}

/**
 * @param {{ records?: object[], limit?: number }} [opts]
 */
export function listEmployerDossiers(opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 25));
  const list = opts.records || loadAnalyticsUnionRecords().records;
  return buildEmployerProfiles(list)
    .filter((p) => p.applied > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((p) => employerListRowFromProfile(p));
}

/**
 * @param {{ company: string, score: number, applied: number, invited: number, ghost: number, declined: number }} p
 */
export function employerListRowFromProfile(p) {
  const id = employerIdFromName(p.company);
  return {
    id,
    company: p.company,
    score: p.score,
    applied: p.applied,
    invited: p.invited,
    ghost: p.ghost,
    declined: p.declined,
    inviteRatePct: p.applied ? Math.round((p.invited / p.applied) * 100) : 0,
  };
}

/**
 * @param {{ records?: object[], limit?: number }} [opts]
 * @returns {Map<string, ReturnType<typeof employerListRowFromProfile>>}
 */
export function buildEmployerDossierIndex(opts = {}) {
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 200));
  /** @type {Map<string, ReturnType<typeof employerListRowFromProfile>>} */
  const index = new Map();
  for (const row of listEmployerDossiers({ ...opts, limit })) {
    index.set(row.company.toLowerCase(), row);
    index.set(row.id, row);
  }
  return index;
}

/**
 * @param {string | null | undefined} company
 * @param {Map<string, ReturnType<typeof employerListRowFromProfile>>} index
 */
export function employerIntelForCompany(company, index) {
  const key = String(company || '').trim().toLowerCase();
  if (!key || !index) return null;
  return index.get(key) || null;
}
