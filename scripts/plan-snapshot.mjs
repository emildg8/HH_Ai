#!/usr/bin/env node
/**
 * Снимок состояния плана (воронка + сводка).
 *   npm run devops:plan-snapshot
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { capturePlanSnapshot } from '../lib/intelligence-loop.mjs';

const { path: snapPath, digest } = capturePlanSnapshot('plan');
console.log('[snapshot]', snapPath);
console.log('Корзины:', digest.buckets);
console.log('Ставки:', digest.rates);
