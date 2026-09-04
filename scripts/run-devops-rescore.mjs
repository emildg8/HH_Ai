/**
 * Дооценка очереди DevOps (без нового поиска на hh.ru)
 *   npm run devops:rescore
 *   npm run devops:rescore -- --all-pending --limit=50
 */
import { loadProfile } from '../lib/load-profile.mjs';

loadProfile();
await import('./rescore-queue.mjs');
