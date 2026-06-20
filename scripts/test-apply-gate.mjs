/**
 * PreApplyGate — unit cases + prefs resolver.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  previewApplyGate,
  GATE_SKIP_REASON,
  estimatePInvitePct,
  mapCategoryToSkipReason,
} from '../lib/apply-gate.mjs';
import {
  resolveApplyIntelligence,
  resolveApplyIntelligenceForEmployer,
  DEFAULT_APPLY_INTELLIGENCE,
} from '../lib/apply-intelligence-prefs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'apply-gate-cases.json');

const prefs = {
  conversionGlueEnabled: true,
  observability: { enabled: true },
  applyIntelligence: { ...DEFAULT_APPLY_INTELLIGENCE, enabled: true, minGateScore: 60 },
  dashboardMinScoreFilter: 50,
  batchLetterMinScore10: 5,
  minKeywordGapScore: 20,
  requireRemote: false,
  allowHybrid: true,
};

const cvText =
  'DevOps SRE Kubernetes Docker Linux CI/CD мониторинг Grafana Ansible Terraform PostgreSQL Jira';

assert.equal(mapCategoryToSkipReason('work-format'), GATE_SKIP_REASON.WORK_FORMAT);
assert.ok(estimatePInvitePct(80) >= 10 && estimatePInvitePct(80) <= 42);

const ai = resolveApplyIntelligence(prefs);
assert.equal(ai.effectiveMinGate, 60);
assert.equal(ai.gateEnabled, true);

const dreamPrefs = {
  ...prefs,
  applyIntelligence: {
    ...prefs.applyIntelligence,
    dreamEmployers: ['Acme Cloud'],
    minGateScoreDream: 40,
  },
};
const dreamAi = resolveApplyIntelligenceForEmployer('Acme Cloud', dreamPrefs);
assert.equal(dreamAi.isDreamEmployer, true);
assert.equal(dreamAi.effectiveMinGate, 50);

const cases = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
for (const c of cases) {
  const rec = { ...c };
  delete rec.expect;
  const verdict = await previewApplyGate(rec, {
    prefs,
    cvText,
    allRecords: [],
    requireLetter: c.expect?.requireLetter ?? Boolean(rec.coverLetter?.approvedText),
  });
  assert.equal(typeof verdict.gateScore, 'number', `${c.id}: gateScore`);
  assert.equal(typeof verdict.pInvitePct, 'number', `${c.id}: pInvitePct`);
  if (c.expect.pass) {
    assert.equal(verdict.pass, true, `${c.id}: expected pass`);
    if (c.expect.minGateScore) {
      assert.ok(verdict.gateScore >= c.expect.minGateScore, `${c.id}: min gate`);
    }
  } else {
    assert.equal(verdict.pass, false, `${c.id}: expected block`);
    if (c.expect.skipReason) {
      assert.equal(verdict.skipReason, c.expect.skipReason, `${c.id}: skipReason`);
    }
  }
}

console.log(`test-apply-gate: OK (${cases.length} cases)`);
