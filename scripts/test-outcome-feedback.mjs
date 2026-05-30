/**
 * Тест блока обратной связи для LLM (приглашения / отказы).
 *   node scripts/test-outcome-feedback.mjs
 */

import assert from 'node:assert/strict';
import { buildOutcomeFeedbackBlock } from '../lib/outcome-feedback.mjs';
import { computeFeedbackStats } from '../lib/feedback-context.mjs';

const block = buildOutcomeFeedbackBlock(
  [
    {
      action: 'invited',
      title: 'DevOps Engineer',
      letterExcerpt: 'Здравствуйте, готов обсудить опыт с Kubernetes',
    },
    {
      action: 'declined',
      title: 'Junior QA',
      reason: 'отказ работодателя',
    },
  ],
  { maxInvited: 2, maxDeclined: 2 }
);

assert.match(block, /приглашения/i);
assert.match(block, /DevOps Engineer/i);
assert.match(block, /отказы/i);
assert.match(block, /Junior QA/i);

const empty = buildOutcomeFeedbackBlock([]);
assert.equal(empty, '');

const stats = computeFeedbackStats({ maxLines: 5 });
assert.ok(stats && typeof stats.total === 'number');
assert.ok(typeof stats.invited === 'number');

console.log('test-outcome-feedback: OK');
