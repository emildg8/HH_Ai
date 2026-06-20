/**
 * Миграции SQLite Knowledge Store (migrations/knowledge/*.sql).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const KNOWLEDGE_MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations', 'knowledge');

/** @param {import('better-sqlite3').Database} db */
export function getKnowledgeSchemaVersion(db) {
  try {
    const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get();
    return Number(row?.value || 0);
  } catch {
    return 0;
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {number} новая версия схемы
 */
export function runKnowledgeMigrations(db) {
  const files = fs
    .readdirSync(KNOWLEDGE_MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/i.test(f))
    .sort();
  let current = getKnowledgeSchemaVersion(db);
  for (const file of files) {
    const ver = Number.parseInt(file.slice(0, 3), 10);
    if (!Number.isFinite(ver) || ver <= current) continue;
    const sql = fs.readFileSync(path.join(KNOWLEDGE_MIGRATIONS_DIR, file), 'utf8');
    db.exec(sql);
    db.prepare(
      "INSERT INTO schema_meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(String(ver));
    current = ver;
  }
  return current;
}
