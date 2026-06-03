import assert from 'node:assert/strict';
import { injectCompanyNameIfNeeded } from '../lib/cover-letter-company-name.mjs';

const rec = { company: 'СберТех' };
const t = injectCompanyNameIfNeeded('Готов обсудить задачи в вашей команде.', rec);
assert.match(t, /команде СберТех|в команде СберТех/i);

const t2 = injectCompanyNameIfNeeded('Интересна работа для вашей компании.', rec);
assert.match(t2, /для СберТех/i);

const same = injectCompanyNameIfNeeded('Откликаюсь в СберТех на роль DevOps.', rec);
assert.equal(same, 'Откликаюсь в СберТех на роль DevOps.');

console.log('test-cover-letter-company-name: OK');
