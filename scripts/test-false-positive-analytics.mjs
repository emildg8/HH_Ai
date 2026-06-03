import assert from 'node:assert/strict';
import fs from 'fs';
import {
  summarizeFalsePositives,
  falsePositiveBucketLabel,
  computeFalsePositiveTrend,
  isFalsePositiveGuardrailTriggered,
  learningSuggestionsFromFalsePositives,
  FALSE_POSITIVE_SNAPSHOTS_FILE,
} from '../lib/false-positive-analytics.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';

assert.equal(falsePositiveBucketLabel({ title: 'Senior DevOps' }), 'senior/lead');
assert.equal(falsePositiveBucketLabel({ title: 'Java-разработчик' }), 'dev вне профиля');

const rejected = [
  {
    id: 'r1',
    status: 'rejected',
    title: 'Senior DevOps Engineer',
    workFormatLine: 'Формат работы: удалённо',
  },
  {
    id: 'r2',
    status: 'rejected',
    title: 'Менеджер по продажам',
    workFormatLine: 'Формат работы: удалённо',
  },
];

const summary = summarizeFalsePositives(rejected, {});
assert.ok(summary.totalRejected === 2);
const eligibleCount = rejected.filter(
  (r) => assessVacancyForApply(r, { userApproved: false }).eligible
).length;
assert.equal(summary.totalFalsePositives, eligibleCount);

const trend = computeFalsePositiveTrend(summary);
assert.ok('direction' in trend);

assert.equal(isFalsePositiveGuardrailTriggered(25, { batchFalsePositiveMax: 20 }), true);
assert.equal(isFalsePositiveGuardrailTriggered(5, { batchFalsePositiveMax: 20 }), false);
assert.equal(isFalsePositiveGuardrailTriggered(100, { batchFalsePositiveMax: 0 }), false);

const suggestions = learningSuggestionsFromFalsePositives(summary, {}, 3);
assert.ok(Array.isArray(suggestions));

if (fs.existsSync(FALSE_POSITIVE_SNAPSHOTS_FILE)) {
  /* ok if from prior run */
}

console.log('test-false-positive-analytics: OK');
