/**
 * Убрать из очереди вакансии с уже отправленным откликом / статусом hh.ru.
 *   npm run devops:prune-responded-queue
 *   npm run devops:prune-responded-queue -- --dry-run
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { pruneRespondedFromActiveQueue } from '../lib/queue-prune.mjs';
import { getQueueFile } from '../lib/paths.mjs';

const dryRun = process.argv.includes('--dry-run');

const r = pruneRespondedFromActiveQueue({
  dryRun,
  log: (m) => console.log(m),
});

console.log(`Файл: ${getQueueFile()}`);
console.log(
  dryRun
    ? `[dry-run] Будет убрано из очереди: ${r.changed} из ${r.total}`
    : `Убрано из очереди (статус responded): ${r.changed} из ${r.total}`
);
if (r.titles.length) {
  for (const t of r.titles.slice(0, 30)) console.log(`  · ${t}`);
  if (r.titles.length > 30) console.log(`  … и ещё ${r.titles.length - 30}`);
}
