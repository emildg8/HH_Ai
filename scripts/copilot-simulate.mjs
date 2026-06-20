/**
 * Симулятор собеседования: подаёт только реплики interviewer в live API.
 *   node scripts/copilot-simulate.mjs --file scripts/fixtures/interview-transcript-mini.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifySegmentRoles } from '../lib/interview-speaker-role.mjs';
import { runCopilotSimulate } from '../lib/interview-copilot-simulate-run.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

if (process.argv.includes('--dry-run')) {
  const file = path.resolve(ROOT, arg('--file', 'scripts/fixtures/interview-transcript-mini.json'));
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  let segments = raw.segments || [];
  if (!segments[0]?.role) segments = classifySegmentRoles(segments);
  const interviewer = segments.filter((s) => s.role === 'interviewer');
  const candidate = segments.filter((s) => s.role === 'candidate');
  console.log(`interviewer: ${interviewer.length}, candidate: ${candidate.length} (skipped)`);
  process.exit(0);
}

const result = await runCopilotSimulate({
  file: arg('--file', 'scripts/fixtures/interview-transcript-mini.json'),
  speed: Number(arg('--speed', '20')),
});

console.log(
  `done: questions=${result.questions.length} spoken=${result.spokenCount} guards=${result.guardCount} ready=${result.readyForLive}`
);
