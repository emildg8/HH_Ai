import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTimestampedLines } from '../lib/interview-copilot-replay.mjs';
import {
  buildQuestionTimeline,
  activePromptIndexAt,
  classifyIntent,
} from '../lib/interview-question-timeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

assert.equal(classifyIntent('На ты нормально, удобно?', 'high'), 'respond');
assert.equal(classifyIntent('давай, я представлюсь', 'high'), 'ack');

const tam = path.join(ROOT, 'my', 'Technical Account Manager (TAM)', 'interview_transcript.txt');
if (fs.existsSync(tam)) {
  const segs = parseTimestampedLines(fs.readFileSync(tam, 'utf8'));
  const first30 = segs.filter((s) => s.startSec <= 30);
  const timeline = buildQuestionTimeline(first30, { timingConfidence: 'high' });
  assert.ok(timeline.length >= 2, `ожидали ≥2 точек к 30с, получили ${timeline.length}`);
  const idx26 = activePromptIndexAt(timeline, 26);
  assert.ok(idx26 >= 1, `к 26с индекс ${idx26}, ожидали ≥1`);
}

console.log('test-interview-question-timeline: OK');
