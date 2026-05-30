import assert from 'node:assert/strict';
import { titleMatchesPreferred } from '../lib/hh-resume-upload.mjs';
import { classifyVacancyResumeRole, resolveResumeForVacancy, resetResumeRoutingCache } from '../lib/resume-routing.mjs';

resetResumeRoutingCache();

function titleMatchesPreferredLocal(title, preferredRaw) {
  const t = String(title || '').toLowerCase();
  const p = String(preferredRaw || '').toLowerCase().trim();
  if (!p || !t) return false;
  if (t.includes(p)) return true;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(title);
}

const support =
  'Специалист технической поддержки L2, L3. Руководитель службы поддержки';
assert.equal(titleMatchesPreferred(support, 'DevOps'), false);
assert.equal(titleMatchesPreferred('DevOps-инженер', 'DevOps'), true);
assert.equal(titleMatchesPreferred('Middle DevOps engineer', 'DevOps'), true);
assert.equal(titleMatchesPreferred('MLOps (Senior)', 'DevOps'), true);
assert.equal(titleMatchesPreferred('Observability engineer', 'DevOps'), true);

const cases = [
  ['Data Engineer (SRE)', 'data'],
  ['Data Science Engineer', 'data'],
  ['Observability engineer', 'devops'],
  ['MLOps (Senior)', 'devops'],
  ['SRE-инженер (Ядро)', 'devops'],
  ['Middle DevOps Engineer', 'devops'],
  ['Системный инженер/DevOps', 'devops'],
  ['Системный инженер в интегратор (проектирование, модернизация)', 'devops'],
  ['Инженер технической поддержки L2', 'support'],
  ['Инженер поддержки (трайб IT4IT)', 'support'],
  ['QA Engineer / Тестировщик', 'devops'],
  ['DevOps-инженер (DWH)', 'devops'],
];

for (const [title, wantRole] of cases) {
  const role = classifyVacancyResumeRole({ title });
  assert.equal(role, wantRole, `${title} → ${role}, expected ${wantRole}`);
}

assert.equal(
  resolveResumeForVacancy({ title: 'Data Engineer (SRE)' }).title,
  'Data Engineer'
);

console.log('test-hh-resume-match: OK');
