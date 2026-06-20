/**
 * applyIntelligence prefs resolver.
 */
import assert from 'node:assert/strict';
import { resolveApplyIntelligence, DEFAULT_APPLY_INTELLIGENCE } from '../lib/apply-intelligence-prefs.mjs';

const prevGate = process.env.HH_APPLY_GATE;
const prevGlue = process.env.HH_CONVERSION_GLUE;

try {
  delete process.env.HH_APPLY_GATE;
  delete process.env.HH_CONVERSION_GLUE;

  const base = resolveApplyIntelligence({
    conversionGlueEnabled: true,
    observability: { enabled: true },
    applyIntelligence: DEFAULT_APPLY_INTELLIGENCE,
    dashboardMinScoreFilter: 55,
  });
  assert.equal(base.effectiveMinGate, 60);
  assert.equal(base.gateEnabled, true);
  assert.equal(base.glueOrchestrationEnabled, true);

  process.env.HH_APPLY_GATE = '0';
  const off = resolveApplyIntelligence({
    conversionGlueEnabled: true,
    observability: { enabled: true },
    applyIntelligence: DEFAULT_APPLY_INTELLIGENCE,
  });
  assert.equal(off.gateEnabled, false);

  const weights = base.weights;
  const sum =
    weights.keywordFit +
    weights.resumeFit +
    weights.letterQuality +
    weights.employerHistory +
    weights.freshness +
    weights.hrStackMatch;
  assert.ok(Math.abs(sum - 1) < 0.02, 'weights ~1');

  console.log('test-apply-intelligence-prefs: OK');
} finally {
  if (prevGate === undefined) delete process.env.HH_APPLY_GATE;
  else process.env.HH_APPLY_GATE = prevGate;
  if (prevGlue === undefined) delete process.env.HH_CONVERSION_GLUE;
  else process.env.HH_CONVERSION_GLUE = prevGlue;
}
