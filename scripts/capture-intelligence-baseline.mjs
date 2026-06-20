#!/usr/bin/env node
/**
 * Базовая линия воронки перед планом.
 *   npm run devops:intelligence-baseline
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { writeIntelligenceBaseline } from '../lib/intelligence-loop.mjs';

const labelArg = process.argv.find((a) => a.startsWith('--label='));
const noteArg = process.argv.find((a) => a.startsWith('--note='));

const baseline = writeIntelligenceBaseline({
  label: labelArg ? labelArg.slice(8) : 'baseline',
  note: noteArg ? noteArg.slice(7) : '',
});
console.log('[baseline] записано data/intelligence-baseline.json');
console.log(JSON.stringify(baseline.buckets, null, 2));
