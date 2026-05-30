/**
 * Тест метрик правок письма.
 *   node scripts/test-cover-letter-metrics.mjs
 */

import assert from 'node:assert/strict';
import { computeLetterEditMetrics, formatLetterMetricsShort } from '../lib/cover-letter-metrics.mjs';

const identical = computeLetterEditMetrics('Привет мир', 'Привет мир');
assert.equal(identical?.editRatioPct, 0);
assert.equal(formatLetterMetricsShort(identical), 'без правок');

const edited = computeLetterEditMetrics(
  'Здравствуйте! Имею опыт DevOps и Kubernetes.',
  'Добрый день! Работал с Kubernetes и CI/CD в банке.'
);
assert.ok(edited && edited.editRatioPct > 20 && edited.editRatioPct <= 100);

const empty = computeLetterEditMetrics('', 'текст');
assert.equal(empty, null);

console.log('test-cover-letter-metrics: OK');
