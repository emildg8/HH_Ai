/**
 *   npm run audit:letter-quality-golden
 */

import { runLetterQualityGoldenRegression } from '../lib/letter-quality-golden-set.mjs';

const report = runLetterQualityGoldenRegression();
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
