/**
 * Dual-write apply_attempts в Knowledge Store.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeKnowledgeDb, getKnowledgeDb, runMigrations } from '../lib/knowledge-store.mjs';
import {
  employerIdFromName,
  isKnowledgeApplyRecordEnabled,
  recordKnowledgeApplyAttempt,
} from '../lib/knowledge-apply-record.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDb = path.join(os.tmpdir(), `hh-knowledge-apply-${process.pid}.db`);

try {
  if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
} catch {
  /* ignore */
}

closeKnowledgeDb();
runMigrations({ dbPath: tmpDb });

assert.equal(employerIdFromName('Acme Cloud LLC'), 'acme-cloud-llc');
assert.equal(isKnowledgeApplyRecordEnabled({ applyIntelligence: { knowledgeStoreEnabled: true } }), true);
assert.equal(isKnowledgeApplyRecordEnabled({ applyIntelligence: { knowledgeStoreEnabled: false } }), false);
assert.equal(recordKnowledgeApplyAttempt({ prefs: {}, attemptId: 'x', rec: {}, outcome: 'ok' }), null);

const rec = {
  id: 'rec-1',
  vacancyId: '12345',
  company: 'Test Corp',
  source: 'hh',
  coverLetter: { approvedText: 'Hello DevOps team' },
};
const gate = {
  gateScore: 72,
  pInvitePct: 14,
  gateEnabled: true,
  resumeRole: 'devops',
  letter: { score10: 8 },
  components: { keywordFit: 55 },
};

const out = recordKnowledgeApplyAttempt({
  prefs: { applyIntelligence: { knowledgeStoreEnabled: true } },
  attemptId: 'attempt-test-1',
  rec,
  gateVerdict: gate,
  outcome: 'ok',
  batchRunId: 'batch-1',
  letterText: rec.coverLetter.approvedText,
  dbPath: tmpDb,
});

assert.equal(out?.attemptId, 'attempt-test-1');
assert.equal(out?.employerId, 'test-corp');

const db = getKnowledgeDb({ dbPath: tmpDb });
const row = db.prepare('SELECT * FROM apply_attempts WHERE id = ?').get('attempt-test-1');
assert.equal(row.record_id, 'rec-1');
assert.equal(row.gate_score, 72);
assert.equal(row.letter_score10, 8);
const meta = JSON.parse(row.meta_json);
assert.equal(meta.outcome, 'ok');
assert.equal(meta.batchRunId, 'batch-1');

closeKnowledgeDb();
try {
  fs.unlinkSync(tmpDb);
} catch {
  /* ignore */
}

console.log('test-knowledge-apply-record: OK');
