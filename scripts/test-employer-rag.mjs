/**
 * employer-rag: блок контекста для промптов LLM.
 */
import assert from 'node:assert/strict';
import { buildEmployerRagBlock, loadEmployerRagBlock } from '../lib/employer-rag.mjs';

const invitedDossier = {
  company: 'КОММИТАС',
  score: 40,
  live: { applied: 1, invited: 1, ghost: 0, declined: 0 },
  hints: [{ kind: 'positive', text: 'Было приглашение — повышенный приоритет в gate.' }],
};

const ghostDossier = {
  company: 'Ghost Corp',
  score: 5,
  live: { applied: 3, invited: 0, ghost: 3, declined: 0 },
  hints: [{ kind: 'ghost', text: 'Часто тишина после отклика — снизить приоритет или добавить в чёрный список.' }],
};

const invitedBlock = buildEmployerRagBlock(invitedDossier);
assert.match(invitedBlock, /КОММИТАС/);
assert.match(invitedBlock, /HR score 40/);
assert.match(invitedBlock, /позитивный исход/);

const ghostBlock = buildEmployerRagBlock(ghostDossier);
assert.match(ghostBlock, /тишина/);
assert.match(ghostBlock, /hook/);

assert.equal(buildEmployerRagBlock(null), '');
assert.equal(buildEmployerRagBlock({ company: 'X', live: { applied: 0 } }), '');

const records = [
  {
    company: 'КОММИТАС',
    status: 'responded',
    hhApply: { responseSubmitted: true, hhSiteState: 'invited' },
  },
];
const prefs = { applyIntelligence: { knowledgeStoreEnabled: true } };
const loaded = loadEmployerRagBlock('КОММИТАС', { records, prefs });
assert.match(loaded, /КОММИТАС/);

assert.equal(
  loadEmployerRagBlock('КОММИТАС', { records, prefs: { applyIntelligence: { knowledgeStoreEnabled: false } } }),
  ''
);

console.log('test-employer-rag: OK');
