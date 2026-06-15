import assert from 'node:assert/strict';
import { scoreSource, listTopTierRecords } from '../lib/source-quality.mjs';

const recA = {
  id: '1',
  source: 'ats',
  title: 'DevOps',
  company: 'Fin',
  status: 'pending',
  createdAt: new Date().toISOString(),
};
const recC = {
  id: '2',
  source: 'telegram',
  title: 'DevOps аутстафф',
  company: 'Staffing LLC',
  status: 'pending',
  createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
};

assert.equal(scoreSource(recA).sourceQualityTier, 'A');
assert.equal(scoreSource(recC).sourceQualityTier, 'C');

const top = listTopTierRecords([recC, recA], { limit: 1 });
assert.equal(top[0].id, '1');

console.log('test-source-quality: OK');
