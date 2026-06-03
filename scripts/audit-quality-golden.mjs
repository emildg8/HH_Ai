/**
 * Полный аудит golden set (таргетинг + письма).
 *   npm run audit:quality-golden
 */

import { runTargetingGoldenRegression } from '../lib/targeting-golden-set.mjs';
import { runLetterQualityGoldenRegression } from '../lib/letter-quality-golden-set.mjs';

const targeting = runTargetingGoldenRegression();
const letters = runLetterQualityGoldenRegression();
const ok = targeting.ok && letters.ok;

console.log(
  JSON.stringify(
    {
      ok,
      targeting: {
        passed: targeting.passed,
        total: targeting.total,
        failures: targeting.failures,
      },
      letters: {
        passed: letters.passed,
        total: letters.total,
        failures: letters.failures,
      },
    },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
