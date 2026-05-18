/**
 * Сбор DevOps-вакансий: config/devops.env + harvest.mjs
 *   npm run devops:harvest
 *   npm run devops:harvest -- --skip-llm
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadDevOpsEnv();
await import('./harvest.mjs');
