/**
 * Smoke: инфраструктура Knowledge Store (зависимости, миграции, каталоги).
 *   node scripts/check-knowledge-infra.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDataRoot, ensureKnowledgeDirs } from '../lib/data-root.mjs';
import { KNOWLEDGE_MIGRATIONS_DIR } from '../lib/knowledge-migrate.mjs';
import { initKnowledgeStore, closeKnowledgeDb } from '../lib/knowledge-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const errors = [];

try {
  await import('better-sqlite3');
} catch {
  errors.push('better-sqlite3 не установлен (npm install)');
}

if (!fs.existsSync(path.join(root, 'lib', 'data-root.mjs'))) errors.push('нет lib/data-root.mjs');
if (!fs.existsSync(KNOWLEDGE_MIGRATIONS_DIR)) errors.push('нет migrations/knowledge/');

const migrations = fs.readdirSync(KNOWLEDGE_MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
if (migrations.length < 2) errors.push(`миграций < 2 (найдено ${migrations.length})`);

process.env.HH_KNOWLEDGE_DB = ':memory:';
try {
  const { schemaVersion } = initKnowledgeStore({ memory: true });
  if (schemaVersion < 2) errors.push(`schema v${schemaVersion} < 2`);
} catch (e) {
  errors.push(`initKnowledgeStore: ${e.message}`);
} finally {
  closeKnowledgeDb();
}

ensureKnowledgeDirs();
const artifacts = path.join(getDataRoot(), 'knowledge', 'artifacts');
if (!fs.existsSync(artifacts)) errors.push('не создан knowledge/artifacts');

if (errors.length) {
  console.error('FAIL check-knowledge-infra:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('OK: check-knowledge-infra.mjs');
