import assert from 'node:assert/strict';
import { classifySegmentRole, classifySegmentRoles } from '../lib/interview-speaker-role.mjs';

assert.equal(classifySegmentRole('Да, конечно, на ты удобно.'), 'candidate');
assert.equal(classifySegmentRole('Расскажите про ваш опыт с Docker?'), 'interviewer');
assert.equal(
  classifySegmentRole(
    'У меня был опыт настройки мониторинга в банке, мы внедряли Zabbix и Grafana для нескольких сотен серверов, плюс алерты в Telegram.',
    { prevRole: 'interviewer', prevHadQuestion: true }
  ),
  'candidate'
);

const segs = classifySegmentRoles([
  { startSec: 0, endSec: 3, text: 'На ты нормально?' },
  { startSec: 3, endSec: 5, text: 'Да, конечно.' },
  { startSec: 5, endSec: 12, text: 'Расскажите про инциденты в проде?' },
]);
assert.equal(segs[0].role, 'interviewer');
assert.equal(segs[1].role, 'candidate');
assert.equal(segs[2].role, 'interviewer');

console.log('test-interview-speaker-role: OK');
