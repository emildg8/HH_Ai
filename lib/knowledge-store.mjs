/**
 * SQLite Knowledge Store — единая точка доступа к БД знаний.
 */

import Database from 'better-sqlite3';
import {
  ensureKnowledgeDirs,
  knowledgeDbForProfile,
} from './data-root.mjs';
import { runKnowledgeMigrations, getKnowledgeSchemaVersion } from './knowledge-migrate.mjs';

/** @type {import('better-sqlite3').Database | null} */
let dbSingleton = null;
/** @type {string | null} */
let dbPathSingleton = null;

function applyPragmas(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
}

/**
 * @param {{ profileId?: string, dbPath?: string, memory?: boolean }} [opts]
 * @returns {import('better-sqlite3').Database}
 */
export function getKnowledgeDb(opts = {}) {
  const dbPath = opts.memory
    ? ':memory:'
    : opts.dbPath || knowledgeDbForProfile(opts.profileId);
  if (dbSingleton && dbPathSingleton === dbPath) return dbSingleton;
  if (dbSingleton) {
    try {
      dbSingleton.close();
    } catch {
      /* ignore */
    }
    dbSingleton = null;
    dbPathSingleton = null;
  }
  if (dbPath !== ':memory:') ensureKnowledgeDirs();
  const db = new Database(dbPath);
  applyPragmas(db);
  dbSingleton = db;
  dbPathSingleton = dbPath;
  return db;
}

/** @param {{ profileId?: string, dbPath?: string, memory?: boolean }} [opts] */
export function runMigrations(opts = {}) {
  const db = getKnowledgeDb(opts);
  return runKnowledgeMigrations(db);
}

/**
 * @template T
 * @param {(db: import('better-sqlite3').Database) => T} fn
 * @param {{ profileId?: string, dbPath?: string, memory?: boolean }} [opts]
 */
export function withKnowledgeTransaction(fn, opts = {}) {
  const db = getKnowledgeDb(opts);
  const tx = db.transaction(() => fn(db));
  return tx();
}

export function closeKnowledgeDb() {
  if (!dbSingleton) return;
  try {
    dbSingleton.close();
  } finally {
    dbSingleton = null;
    dbPathSingleton = null;
  }
}

export function knowledgeStoreStatus(opts = {}) {
  const db = getKnowledgeDb(opts);
  return {
    schemaVersion: getKnowledgeSchemaVersion(db),
    dbPath: dbPathSingleton,
  };
}

export function initKnowledgeStore(opts = {}) {
  ensureKnowledgeDirs();
  const version = runMigrations(opts);
  return { schemaVersion: version, dbPath: dbPathSingleton };
}
