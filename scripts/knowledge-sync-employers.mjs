#!/usr/bin/env node
/**
 * Синхронизация профилей работодателей из очереди в Knowledge Store.
 *   npm run devops:knowledge-sync-employers
 */
import { loadEnv } from '../lib/load-env.mjs';
import { syncEmployerProfilesToKnowledge } from '../lib/employer-dossier.mjs';
import { closeKnowledgeDb } from '../lib/knowledge-store.mjs';

loadEnv();

try {
  const result = syncEmployerProfilesToKnowledge();
  if (result.skipped) {
    console.log(`[employers] пропуск: ${result.skipped}`);
    process.exit(0);
  }
  console.log(`[employers] синхронизировано ${result.synced} из ${result.total} профилей`);
} finally {
  closeKnowledgeDb();
}
