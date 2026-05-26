/**
 * Обновить текст вопросов с hh.ru для карточек с заглушками («Текстовое поле N»).
 *
 *   npm run devops:questionnaire-reprobe-batch
 *   npm run devops:questionnaire-reprobe-batch -- --limit=5
 */

import { spawn } from 'child_process';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { fileURLToPath } from 'url';
import { loadQueue } from '../lib/store.mjs';
import { getQueueFile, ROOT } from '../lib/paths.mjs';
import { filterQuestionnaireReprobeCandidates } from '../lib/questionnaire-pipeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const probeScript = path.join(ROOT, 'scripts', 'probe-questionnaire.mjs');

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Math.max(1, Number(limitArg.slice(8)) || 8) : 8;

const items = filterQuestionnaireReprobeCandidates(
  loadQueue().filter((x) => x.status === 'pending' || x.status === 'approved')
);

console.log(`Очередь: ${getQueueFile()}`);
console.log(`К probe: ${items.length}, лимит за запуск: ${limit}`);

if (!items.length) {
  console.log('Нет карточек с needsProbe / заглушками.');
  process.exit(0);
}

function runProbe(id) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [probeScript, `--id=${id}`], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let err = '';
    child.stderr?.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, err }));
  });
}

let ok = 0;
let failed = 0;

for (const rec of items.slice(0, limit)) {
  console.log(`\n[reprobe] ${rec.title || rec.id}`);
  const { code, err } = await runProbe(rec.id);
  if (code === 0) {
    ok++;
    console.log('[reprobe] OK');
  } else {
    failed++;
    console.log(`[reprobe] exit ${code}: ${(err || '').trim().slice(0, 300)}`);
  }
}

console.log(`\nИтого: ${ok} обновлено, ${failed} ошибок`);
if (items.length > limit) {
  console.log(`Осталось ${items.length - limit} — повторите команду или увеличьте --limit=`);
}
process.exit(failed > 0 && ok === 0 ? 1 : 0);
