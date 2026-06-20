/**
 * Employer dossier: sync + read API helpers.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeKnowledgeDb, runMigrations } from '../lib/knowledge-store.mjs';
import {
  buildEmployerDossierIndex,
  employerIntelForCompany,
  getEmployerDossier,
  listEmployerDossiers,
  resolveEmployerId,
  syncEmployerProfilesToKnowledge,
} from '../lib/employer-dossier.mjs';
import { buildEmployerChipMeta } from '../dashboard/public/card-status.mjs';
import { employerIdFromName } from '../lib/knowledge-apply-record.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDb = path.join(os.tmpdir(), `hh-employer-dossier-${process.pid}.db`);

try {
  if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
} catch {
  /* ignore */
}

closeKnowledgeDb();
runMigrations({ dbPath: tmpDb });

const prefs = { applyIntelligence: { knowledgeStoreEnabled: true } };
const storeOpts = { dbPath: tmpDb };
const staleAt = new Date(Date.now() - 20 * 86_400_000).toISOString();

const records = [
  {
    company: 'КОМИТАС',
    status: 'responded',
    hhApply: { responseSubmitted: true, hhSiteState: 'invited' },
  },
  {
    company: 'Ghost Corp',
    status: 'responded',
    hhApply: { responseSubmitted: true, hhSiteState: 'viewed', lastAt: staleAt },
  },
  {
    company: 'Ghost Corp',
    status: 'responded',
    hhApply: { responseSubmitted: true, hhSiteState: 'viewed', lastAt: staleAt },
  },
];

assert.equal(resolveEmployerId('комитас'), employerIdFromName('комитас'));

const listed = listEmployerDossiers({ records, limit: 5 });
assert.ok(listed.length >= 2, 'listEmployerDossiers');
assert.ok(listed[0].score >= listed[1].score, 'sorted by score');

const sync = syncEmployerProfilesToKnowledge(records, { prefs, storeOpts, init: false });
assert.equal(sync.synced, 2);

const dossier = getEmployerDossier('КОМИТАС', { records, prefs, storeOpts });
assert.ok(dossier, 'dossier exists');
assert.equal(dossier.company, 'КОМИТАС');
assert.ok(dossier.score >= 0);
assert.ok(Array.isArray(dossier.hints));
assert.ok(dossier.stored?.inviteRate > 0);

const ghost = getEmployerDossier('ghost-corp', { records, prefs, storeOpts });
assert.ok(ghost?.hints.some((h) => h.kind === 'ghost'), 'ghost hint');

const index = buildEmployerDossierIndex({ records, limit: 10 });
const komitasRow = listed.find((x) => x.company === 'КОМИТАС');
assert.ok(komitasRow, 'komitas row');
assert.ok(index.get(komitasRow.company.toLowerCase()), 'index by company');
assert.equal(employerIntelForCompany('КОМИТАС', index)?.score, komitasRow.score);

const chip = buildEmployerChipMeta(listed.find((x) => x.company === 'КОМИТАС'));
assert.ok(chip?.label.includes('HR'), 'employer chip label');
assert.match(chip?.label || '', /invite 100%/);

console.log('test-employer-dossier: OK');
closeKnowledgeDb();
