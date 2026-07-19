import assert from 'node:assert/strict';
import { interpretBatchApplyChildResult } from '../lib/batch-skip-reason.mjs';

assert.deepEqual(interpretBatchApplyChildResult({ exitCode: 0, skipReason: '' }), {
  status: 'success',
  exitCode: 0,
  skipReason: '',
});

assert.deepEqual(interpretBatchApplyChildResult({ exitCode: 5, skipReason: 'анкета: 3 вопр.' }), {
  status: 'questionnaire',
  exitCode: 5,
  skipReason: 'анкета: 3 вопр.',
});

assert.deepEqual(interpretBatchApplyChildResult({ exitCode: 1, skipReason: 'не выбрано резюме' }), {
  status: 'error',
  exitCode: 1,
  skipReason: 'не выбрано резюме',
  message: 'hh-apply-chat exit 1: не выбрано резюме',
});

console.log('test-batch-apply-result: OK');
