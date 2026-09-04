/**
 * DevOps-очередь: просмотр отклонённых и массовое отклонение похожих.
 *   npm run devops:reject-similar -- --list
 *   npm run devops:reject-similar -- --apply
 */
import { loadProfile } from '../lib/load-profile.mjs';

loadProfile();
await import('./reject-similar.mjs');
