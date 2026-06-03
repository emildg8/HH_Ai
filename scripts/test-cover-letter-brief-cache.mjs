import assert from 'node:assert/strict';
import {
  matchingBriefCacheKey,
  getCachedMatchingBrief,
  buildMatchingBriefPatch,
} from '../lib/cover-letter-brief-cache.mjs';

const rec = { id: 'v1', title: 'DevOps' };
const desc = 'Linux Docker CI/CD';
const brief = { companyHook: 'инфра', topRequirements: ['k8s'] };

const key = matchingBriefCacheKey(rec, desc);
assert.equal(key, matchingBriefCacheKey(rec, desc));
assert.equal(getCachedMatchingBrief(rec, desc), null);

const withCache = {
  ...rec,
  coverLetter: buildMatchingBriefPatch(rec, desc, brief).coverLetter,
};
assert.deepEqual(getCachedMatchingBrief(withCache, desc), brief);
assert.equal(getCachedMatchingBrief(withCache, desc + ' x'), null);

console.log('test-cover-letter-brief-cache: OK');
