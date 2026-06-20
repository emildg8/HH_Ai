/**
 * Единый корень данных (HH_DATA_DIR) и пути Knowledge Store.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');

/** @returns {string} Абсолютный каталог данных (HH_DATA_DIR или ROOT/data). */
export function getDataRoot() {
  const raw = (process.env.HH_DATA_DIR || '').trim();
  if (raw) {
    return path.isAbsolute(raw) ? path.normalize(raw) : path.normalize(path.join(ROOT, raw));
  }
  return path.join(ROOT, 'data');
}

/** @param {string} [profileId] */
export function knowledgeDbForProfile(profileId) {
  const root = getDataRoot();
  const id = String(profileId || '').trim();
  if (!id || id === 'default') {
    const override = (process.env.HH_KNOWLEDGE_DB || '').trim();
    if (override) {
      return override === ':memory:' ? ':memory:' : path.normalize(override);
    }
    return path.join(root, 'hh-ai-knowledge.db');
  }
  return path.join(root, `hh-ai-knowledge-${id}.db`);
}

export const KNOWLEDGE_DB_FILE = knowledgeDbForProfile('default');
export const KNOWLEDGE_ARTIFACTS_DIR = path.join(getDataRoot(), 'knowledge', 'artifacts');
export const KNOWLEDGE_EXPORTS_DIR = path.join(getDataRoot(), 'knowledge', 'exports');
export const APPLY_INTELLIGENCE_LOG = path.join(getDataRoot(), 'logs', 'apply-intelligence.jsonl');
export const KNOWLEDGE_REBUILD_LOCK = path.join(getDataRoot(), 'knowledge-rebuild.lock');

/** Создать каталоги knowledge/logs при необходимости. */
export function ensureKnowledgeDirs() {
  const root = getDataRoot();
  for (const dir of [
    root,
    path.join(root, 'knowledge'),
    KNOWLEDGE_ARTIFACTS_DIR,
    KNOWLEDGE_EXPORTS_DIR,
    path.join(root, 'logs'),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
