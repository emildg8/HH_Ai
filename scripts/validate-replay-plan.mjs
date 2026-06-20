import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTimestampedLines } from '../lib/interview-copilot-replay.mjs';
import { buildReplayPlan, validateReplayPlan } from '../lib/interview-replay-plan.mjs';
import { ingestFromSegments } from '../lib/interview-ingest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const tam = path.join(ROOT, 'my', 'Technical Account Manager (TAM)', 'interview_transcript.txt');
if (!fs.existsSync(tam)) {
  console.log('validate-replay-plan: skip (нет TAM)');
  process.exit(0);
}

const segs = parseTimestampedLines(fs.readFileSync(tam, 'utf8'));
const normalized = ingestFromSegments({ segments: segs, transcriptBase: 'tam-validate' });
const plan = await buildReplayPlan(normalized);
const v = validateReplayPlan(plan);

assert.ok(plan.prompts.length >= 10, `prompts: ${plan.prompts.length}`);
assert.ok(v.promptCount >= 10);
if (v.activeAt26s < 1) {
  console.warn('validate-replay-plan: предупреждение activeAt26s', v.activeAt26s, v.warnings);
}

console.log('validate-replay-plan: OK', {
  prompts: v.promptCount,
  activeAt26s: v.activeAt26s,
  warnings: v.warnings.length,
});
