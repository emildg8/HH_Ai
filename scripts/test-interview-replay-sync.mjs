import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTimestampedLines, startReplaySession, tickReplaySession } from '../lib/interview-copilot-replay.mjs';
import { buildReplayPlan } from '../lib/interview-replay-plan.mjs';
import { ingestFromSegments } from '../lib/interview-ingest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const tam = path.join(ROOT, 'my', 'Technical Account Manager (TAM)', 'interview_transcript.txt');
if (fs.existsSync(tam)) {
  const segs = parseTimestampedLines(fs.readFileSync(tam, 'utf8')).slice(0, 50);
  const normalized = ingestFromSegments({ segments: segs, transcriptBase: 'tam-sync-test' });
  const plan = await buildReplayPlan(normalized);
  const session = await startReplaySession({
    transcriptBase: 'tam-sync-test',
    replayPlan: plan,
    sourceId: plan.sourceId,
    title: 'TAM test',
  });

  let tick0 = await tickReplaySession(session.id, 0);
  assert.ok(tick0.events.length >= 1, 'на 0с должен быть ответ');
  const id0 = session.lastPromptId;

  await tickReplaySession(session.id, 26);
  assert.notEqual(session.lastPromptId, id0, 'к 26с prompt должен смениться');

  await tickReplaySession(session.id, 5);
  assert.ok(session.lastPromptId, 'после seek назад состояние валидно');
}

console.log('test-interview-replay-sync: OK');
