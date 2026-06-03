/**
 * Unit-тесты демо-очереди (R-04b/c).
 */
import fs from 'fs';
import {
  readDemoQueueItems,
  getQueueMeta,
  isActiveQueueEmpty,
  copyDemoToQueueIfMissing,
  DEMO_QUEUE_SOURCE,
} from '../lib/demo-queue.mjs';

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const items = readDemoQueueItems();
assert(Array.isArray(items) && items.length > 0, 'readDemoQueueItems: ожидали массив с записями');
assert(fs.existsSync(DEMO_QUEUE_SOURCE), 'docs/demo/vacancies-demo.json должен существовать');

const meta = getQueueMeta();
assert(typeof meta.empty === 'boolean', 'getQueueMeta.empty — boolean');
assert(typeof meta.demoAvailable === 'boolean', 'getQueueMeta.demoAvailable — boolean');
assert(meta.demoAvailable === true, 'demoAvailable должен быть true');
assert(meta.demoCount === items.length, 'demoCount совпадает с demo file');
assert(typeof meta.queueFile === 'string' && meta.queueFile.length > 0, 'queueFile задан');

assert(typeof isActiveQueueEmpty() === 'boolean', 'isActiveQueueEmpty returns boolean');
assert(isActiveQueueEmpty() === meta.empty, 'isActiveQueueEmpty согласован с getQueueMeta');

const copy = copyDemoToQueueIfMissing();
assert(copy.ok === true || copy.skipped === true, 'copyDemoToQueueIfMissing → ok или skipped');
if (copy.skipped) {
  assert(['has_data', 'custom_queue_file'].includes(copy.reason), `skip reason: ${copy.reason}`);
}

if (errors.length) {
  console.error('FAIL test-demo-queue.mjs:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('OK: test-demo-queue.mjs');
