import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadDevOpsEnv();
await import('./audit-cover-letter-prompts.mjs');
