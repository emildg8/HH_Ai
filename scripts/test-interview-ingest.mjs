import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectSourceKind, detectTimingConfidence, hashContent } from '../lib/interview-ingest.mjs';
import { parseTimestampedLines } from '../lib/interview-copilot-replay.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const ts = `[00:00:00,000 -> 00:00:03,600] Тест`;
assert.equal(detectSourceKind('x.txt', ts), 'sidecar');
assert.equal(detectTimingConfidence('sidecar', ts), 'high');
assert.ok(hashContent('abc').length >= 8);

const tam = path.join(ROOT, 'my', 'Technical Account Manager (TAM)', 'interview_transcript.txt');
if (fs.existsSync(tam)) {
  const raw = fs.readFileSync(tam, 'utf8');
  assert.ok(parseTimestampedLines(raw).length > 100);
}

console.log('test-interview-ingest: OK');
