/**
 * DevOps-очередь: просмотр отклонённых и массовое отклонение похожих.
 *   npm run devops:reject-similar -- --list
 *   npm run devops:reject-similar -- --apply
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadDevOpsEnv();
await import('./reject-similar.mjs');
