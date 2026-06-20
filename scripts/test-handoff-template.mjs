/**
 * HANDOFF-TEMPLATE.md — обязательные секции.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const p = path.join(ROOT, 'docs', 'HANDOFF-TEMPLATE.md');
assert.ok(fs.existsSync(p));
const text = fs.readFileSync(p, 'utf8');

for (const h of [
  '## С чего начать',
  '## Сделано',
  '## Проверено',
  '## Не трогать',
  '## Следующий шаг',
]) {
  assert.ok(text.includes(h), `HANDOFF-TEMPLATE: нет ${h}`);
}

console.log('test-handoff-template: OK');
