/**
 * Ночной аудит: golden set + baseline + снимок false positives.
 *   npm run nightly:quality-audit
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { DATA_DIR } from '../lib/paths.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { runTargetingGoldenRegression } from '../lib/targeting-golden-set.mjs';
import { runLetterQualityGoldenRegression } from '../lib/letter-quality-golden-set.mjs';
import { computeQualityBaseline } from '../lib/quality-baseline.mjs';
import {
  summarizeFalsePositives,
  recordFalsePositiveSnapshot,
} from '../lib/false-positive-analytics.mjs';
import { loadQueue } from '../lib/store.mjs';

loadEnv();

const OUT = path.join(DATA_DIR, 'nightly-quality-audit-last.json');

let prefs = {};
try {
  prefs = loadPreferences();
} catch {
  prefs = {};
}

const golden = runTargetingGoldenRegression(prefs);
const baseline = computeQualityBaseline(prefs);
const rejected = loadQueue().filter((x) => x.status === 'rejected' && !x.hidden);
const fp = summarizeFalsePositives(rejected, prefs);
recordFalsePositiveSnapshot(fp);

const report = {
  ranAt: new Date().toISOString(),
  goldenTargeting,
  goldenLetters,
  baseline,
  falsePositives: {
    total: fp.totalFalsePositives,
    rate: fp.falsePositiveRate,
    top: fp.top?.slice(0, 5),
  },
  ok: goldenTargeting.ok && goldenLetters.ok,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      ok: report.ok,
      out: OUT,
      targeting: `${goldenTargeting.passed}/${goldenTargeting.total}`,
      letters: `${goldenLetters.passed}/${goldenLetters.total}`,
    },
    null,
    2
  )
);
process.exit(report.ok ? 0 : 1);
