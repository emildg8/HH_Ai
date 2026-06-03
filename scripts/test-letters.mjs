/**
 *   node scripts/test-letters.mjs
 */

import assert from 'node:assert/strict';
import { getLetterStructureRules } from '../lib/cover-letter-role-prompt.mjs';
import { classifyLetterIssueKind, listLetterIssues } from '../lib/cover-letter-issues.mjs';
import { computeLetterReadiness } from '../lib/letter-readiness.mjs';
import { evaluateLetterQuality } from '../lib/cover-letter-quality-scan.mjs';

assert.match(getLetterStructureRules('data'), /data|ETL/i);
assert.match(getLetterStructureRules('support'), /L2|поддержк/i);

const rec = {
  id: 't1',
  title: 'Data Engineer',
  status: 'approved',
  scoreOverall: 70,
  geminiSummary: 'ETL',
  coverLetter: {
    status: 'approved',
    approvedText: 'Здравствуйте! Готов обсудить.',
  },
};
const prefs = {};
assert.equal(classifyLetterIssueKind(rec, prefs), 'fixable');

const list = listLetterIssues([rec], prefs, { kind: 'issues' });
assert.ok(list.counts.fixable >= 1 || list.items.length >= 1);

const ready = computeLetterReadiness(rec, prefs, { userApproved: true });
assert.ok(ready.score >= 0 && ready.score <= 100);

const ev = evaluateLetterQuality(
  rec,
  'Здравствуйте! Откликаюсь на Data Engineer: SQL, ETL/DWH, сопровождение пайплайнов, 7000+ кейсов в банковском контуре. Готов обсудить стек и задачи команды.',
  'data',
  prefs
);
assert.equal(ev.pass, true);

console.log('test-letters: OK');
