#!/usr/bin/env node
/**
 * Базовая линия воронки перед планом.
 *   npm run devops:intelligence-baseline
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { writeIntelligenceBaseline } from '../lib/intelligence-loop.mjs';

const baseline = writeIntelligenceBaseline();
console.log('[baseline] записано data/intelligence-baseline.json');
console.log(JSON.stringify(baseline.buckets, null, 2));
