/**
 * Сгенерировать ответы анкеты для всех карточек с вопросами (без Playwright).
 *
 *   npm run devops:questionnaire-prep-batch
 *   npm run devops:questionnaire-prep-batch -- --force
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { loadQueue } from '../lib/store.mjs';
import { getQueueFile } from '../lib/paths.mjs';
import {
  prepQuestionnaireAnswersBatch,
  filterQuestionnairePrepCandidates,
} from '../lib/questionnaire-pipeline.mjs';

const force = process.argv.includes('--force');

const items = loadQueue();
const candidates = filterQuestionnairePrepCandidates(
  items.filter((x) => x.status === 'pending' || x.status === 'approved')
);

console.log(`Очередь: ${getQueueFile()}`);
console.log(`Карточек с анкетой для подготовки: ${candidates.length}${force ? ' (force)' : ''}`);

if (!candidates.length) {
  console.log('Нечего генерировать — сначала «Загрузить с hh.ru» или батч, чтобы появились вопросы.');
  process.exit(0);
}

const r = await prepQuestionnaireAnswersBatch(candidates, {
  force,
  log: (m) => console.log(m),
});

console.log(
  `Готово: ${r.ok} сгенерировано, ${r.skipped} пропущено, ${r.failed} ошибок` +
    (r.needsRelabel ? `, ${r.needsRelabel} ждут probe` : '')
);
if (r.errors?.length) {
  for (const e of r.errors.slice(0, 15)) {
    console.log(`  · ${e.title || e.id}: ${e.error}`);
  }
}
process.exit(r.failed > 0 ? 1 : 0);
