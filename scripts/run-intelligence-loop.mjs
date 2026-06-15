#!/usr/bin/env node
/**
 * Запуск цикла обучения и запись сводки.
 *   npm run devops:intelligence-loop
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { runIntelligenceLoop } from '../lib/intelligence-loop.mjs';

const digest = runIntelligenceLoop({ label: 'cli' });
console.log(JSON.stringify(digest, null, 2));
