/**
 *   node scripts/audit-targeting-golden.mjs
 *   npm run audit:targeting-golden
 */

import { runTargetingGoldenRegression } from '../lib/targeting-golden-set.mjs';

const report = runTargetingGoldenRegression();
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      passed: report.passed,
      total: report.total,
      failures: report.failures,
    },
    null,
    2
  )
);
process.exit(report.ok ? 0 : 1);
