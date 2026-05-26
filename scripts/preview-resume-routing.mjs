/**
 * Просмотр подбора резюме по очереди.
 *   npm run devops:preview-resume-routing
 *   npm run devops:preview-resume-routing -- --id=<uuid>
 */

import fs from 'fs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import { getQueueFile } from '../lib/paths.mjs';
import { classifyVacancyResumeRole, resolveResumeForVacancy } from '../lib/resume-routing.mjs';

loadDevOpsEnv();

const idArg = process.argv.find((a) => a.startsWith('--id='));
const onlyId = idArg ? idArg.slice(5).trim() : '';

const queue = JSON.parse(fs.readFileSync(getQueueFile(), 'utf8'));
const items = onlyId ? queue.filter((x) => x.id === onlyId) : queue.filter((x) => x.status === 'pending');

const byRole = { devops: 0, data: 0, support: 0 };

console.log(`\n[resume-routing] ${getQueueFile()} · pending: ${items.length}\n`);

for (const rec of items.slice(0, 80)) {
  const pick = resolveResumeForVacancy(rec);
  byRole[pick.role] = (byRole[pick.role] || 0) + 1;
  console.log(`${pick.role.padEnd(8)} → ${pick.label.padEnd(14)} | ${(rec.title || '').slice(0, 55)}`);
}

if (items.length > 80) console.log(`… ещё ${items.length - 80} (показаны первые 80)`);

console.log('\nИтого по ролям:', byRole);
console.log('Конфиг: config/resume-routing.json\n');
