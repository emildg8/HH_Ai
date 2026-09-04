/**
 * Проверка промптов и окружения перед массовой генерацией писем.
 *   npm run devops:audit-letters
 */

import { loadProfile } from '../lib/load-profile.mjs';

loadProfile();

import { loadQueue } from '../lib/store.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { auditCoverLetterPrompts } from '../lib/cover-letter-prompt-audit.mjs';

const q = loadQueue();
const sample =
  q.find((x) => x.status === 'pending' && String(x.descriptionForLlm || x.descriptionPreview || '').length > 200) ||
  q[0];

if (!sample) {
  console.error('Очередь пуста');
  process.exit(1);
}

const cvBundle = await loadCvBundle();
const report = auditCoverLetterPrompts(sample, cvBundle);

console.log('=== Аудит промптов сопроводительных ===\n');
console.log(`Тестовая вакансия: ${sample.title || sample.id}\n`);

for (const line of report.info) console.log(`  ✓ ${line}`);
if (report.issues.length) {
  console.log('');
  for (const line of report.issues) console.log(`  ⚠ ${line}`);
}
console.log('\nРазмеры блоков промпта:');
console.log(`  фокус вакансии: ${report.stats.vacancyFocusChars} симв.`);
console.log(`  факты CV:       ${report.stats.cvFactsChars} симв.`);
console.log(`  эталоны стиля:  ${report.stats.styleChars} симв.`);

const pending = q.filter((x) => x.status === 'pending');
const need = pending.filter((x) => x.coverLetter?.status !== 'approved');
console.log(`\nОчередь: pending=${pending.length}, без утверждённого письма=${need.length}`);

process.exit(report.ok ? 0 : 1);
