import assert from 'node:assert/strict';
import { recordResumeRoleForAnalytics, daysSinceApply, isStaleFollowUp } from '../lib/resume-role-actual.mjs';
import { resetResumeRoutingCache } from '../lib/resume-routing.mjs';

resetResumeRoutingCache();

assert.equal(
  recordResumeRoleForAnalytics({
    title: 'Data Engineer',
    hhApply: { resumeRole: 'data', resumeTitleSelected: 'DevOps-инженер' },
  }),
  'data'
);

assert.equal(
  recordResumeRoleForAnalytics({
    title: 'Support L2',
    hhApply: { resumeTitleSelected: 'DevOps-инженер' },
  }),
  'devops'
);

const weekAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();
assert.ok(
  isStaleFollowUp({
    hhApply: { responseSubmitted: true, lastAt: weekAgo, hhSiteState: 'awaiting' },
  })
);
assert.equal(
  isStaleFollowUp({
    hhApply: { responseSubmitted: true, lastAt: weekAgo, hhSiteState: 'invited' },
  }),
  false
);

assert.equal(daysSinceApply({ hhApply: { lastAt: weekAgo } }), 8);

console.log('test-resume-role-actual: OK');
