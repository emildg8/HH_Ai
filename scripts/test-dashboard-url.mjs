/**
 * Unit: deep links дашборда.
 */
import assert from 'node:assert/strict';
import { dashboardBaseUrl, dashboardDeepLink } from '../lib/dashboard-url.mjs';

const prev = { ...process.env };
process.env.DASHBOARD_PORT = '3999';
process.env.DASHBOARD_HOST = '127.0.0.1';

assert.equal(dashboardBaseUrl(), 'http://127.0.0.1:3999');
assert.ok(dashboardDeepLink('apply').includes('settings=apply'));
assert.ok(dashboardDeepLink('apply', { batchReport: '1' }).includes('batchReport=1'));

Object.assign(process.env, prev);
console.log('OK test-dashboard-url.mjs');
