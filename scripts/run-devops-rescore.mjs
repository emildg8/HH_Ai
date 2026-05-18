/**
 * Дооценка очереди DevOps (без нового поиска на hh.ru)
 *   npm run devops:rescore
 *   npm run devops:rescore -- --all-pending --limit=50
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadDevOpsEnv();
await import('./rescore-queue.mjs');
