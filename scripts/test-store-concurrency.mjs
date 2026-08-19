import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const workerIndex = process.argv.indexOf('--worker');
if (workerIndex >= 0) {
  const prefix = process.argv[workerIndex + 1];
  const count = Number(process.argv[workerIndex + 2]);
  const { addVacancyRecord } = await import('../lib/store.mjs');
  for (let i = 0; i < count; i++) {
    const id = `${prefix}-${i}`;
    assert.equal(addVacancyRecord({ id, vacancyId: id, status: 'pending' }), true);
  }
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-store-concurrency-'));
const queueFile = path.join(dir, 'queue.json');
const workerCount = 4;
const recordsPerWorker = 60;
fs.writeFileSync(queueFile, '[]\n', 'utf8');

function runWorker(prefix) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), '--worker', prefix, String(recordsPerWorker)],
      {
        env: { ...process.env, HH_VACANCIES_QUEUE_FILE: queueFile },
        stdio: ['ignore', 'ignore', 'pipe'],
      }
    );
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`worker ${prefix} failed (code=${code}, signal=${signal}): ${stderr}`));
    });
  });
}

try {
  await Promise.all(Array.from({ length: workerCount }, (_, i) => runWorker(`worker-${i}`)));
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  assert.equal(queue.length, workerCount * recordsPerWorker);
  assert.equal(new Set(queue.map((item) => item.vacancyId)).size, queue.length);
  assert.equal(fs.existsSync(`${queueFile}.lock`), false);
  console.log('test-store-concurrency: OK');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
