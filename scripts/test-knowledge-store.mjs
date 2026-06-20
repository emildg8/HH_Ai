/**
 * Unit: Knowledge Store — миграции, WAL, транзакции.
 *   node scripts/test-knowledge-store.mjs
 */
import assert from 'node:assert/strict';
import {
  getKnowledgeDb,
  runMigrations,
  withKnowledgeTransaction,
  closeKnowledgeDb,
  knowledgeStoreStatus,
} from '../lib/knowledge-store.mjs';

process.env.HH_KNOWLEDGE_DB = ':memory:';

try {
  const version = runMigrations({ memory: true });
  assert.equal(version, 2, `schema version=${version}, ожидалось 2`);

  const db = getKnowledgeDb({ memory: true });
  const journal = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
  assert.ok(['wal', 'memory'].includes(journal), `journal_mode=${journal}`);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);
  for (const t of ['employers', 'apply_attempts', 'apply_outcomes', 'employer_hr_profile', 'winning_patterns']) {
    assert.ok(tables.includes(t), `нет таблицы ${t}`);
  }

  withKnowledgeTransaction((conn) => {
    conn.prepare(
      "INSERT INTO employers (id, name, created_at, updated_at) VALUES ('acme', 'Acme', '2026-01-01', '2026-01-01')"
    ).run();
    conn.prepare(
      `INSERT INTO apply_attempts (id, employer_id, vacancy_id, applied_at, source, gate_score)
       VALUES ('a1', 'acme', 'v1', '2026-01-02', 'hh', 72)`
    ).run();
  }, { memory: true });

  const count = db.prepare('SELECT COUNT(*) AS c FROM apply_attempts').get().c;
  assert.equal(count, 1);

  const status = knowledgeStoreStatus({ memory: true });
  assert.equal(status.schemaVersion, 2);

  console.log('OK: test-knowledge-store.mjs');
} finally {
  closeKnowledgeDb();
}
