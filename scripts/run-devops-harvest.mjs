/**
 * Сбор DevOps-вакансий: config/devops.env + harvest.mjs
 *   npm run devops:harvest
 *   npm run devops:harvest -- --skip-llm
 */
import { loadProfile } from '../lib/load-profile.mjs';

loadProfile();
await import('./harvest.mjs');
