/**
 * Инициализация Knowledge Store (каталоги + миграции SQLite).
 *   node scripts/knowledge-init.mjs
 */
import { loadEnv } from '../lib/load-env.mjs';
import { initKnowledgeStore, closeKnowledgeDb } from '../lib/knowledge-store.mjs';
import { KNOWLEDGE_DB_FILE } from '../lib/data-root.mjs';

loadEnv();

try {
  const { schemaVersion, dbPath } = initKnowledgeStore();
  console.log(`Knowledge Store: schema v${schemaVersion}, db=${dbPath || KNOWLEDGE_DB_FILE}`);
} finally {
  closeKnowledgeDb();
}
