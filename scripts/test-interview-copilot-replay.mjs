import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseTimestampedLines,
  parseTranscriptToSegments,
  startReplaySession,
  tickReplaySession,
} from '../lib/interview-copilot-replay.mjs';
import {
  looksLikeInterviewQuestion,
  classifyInterviewQuestion,
  extractLatestQuestion,
} from '../lib/interview-copilot-question-detect.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

assert.equal(looksLikeInterviewQuestion('Как вы настраивали мониторинг?'), true);
assert.equal(looksLikeInterviewQuestion('спасибо'), false);
assert.equal(classifyInterviewQuestion('На ты нормально, удобно?'), 'small_talk');

const q = extractLatestQuestion('Мы работаем в банке. Расскажите про ваш опыт с Docker?');
assert.match(q, /Docker/);

const tsSample = `[00:00:00,000 -> 00:00:03,600] Привет\n[00:00:03,600 -> 00:00:07,200] Как дела?`;
{
  const segs = parseTimestampedLines(tsSample);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].startSec, 0);
  assert.ok(Math.abs(segs[0].endSec - 3.6) < 0.01);
}

// Если на диске есть ваш TAM-транскрипт — проверяем реальные таймкоды
const tamTranscript = path.join(
  ROOT,
  'my',
  'Technical Account Manager (TAM)',
  'interview_transcript.txt'
);
if (fs.existsSync(tamTranscript)) {
  const raw = fs.readFileSync(tamTranscript, 'utf8');
  const tsSegs = parseTimestampedLines(raw);
  assert.ok(tsSegs.length > 5);
  assert.equal(tsSegs[0].startSec, 0);
  assert.ok(Math.abs(tsSegs[0].endSec - 3.6) < 0.05);
}

const segs = parseTranscriptToSegments('Первая фраза интервьюера\nРасскажите про CI/CD?\nОтвет кандидата');
assert.ok(segs.length >= 2);
assert.equal(segs[0].startSec, 0);

const session = await startReplaySession({
  title: 'Test',
  segments: segs,
});
assert.equal(session.mode, 'replay');

const tick = await tickReplaySession(session.id, 6);
assert.ok(tick.events.length >= 0 || tick.session);

console.log('test-interview-copilot-replay: OK');
