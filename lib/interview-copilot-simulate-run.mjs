/**
 * Прогон транскрипта через live Q→A (только interviewer → spoken для candidate).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR, ROOT } from './paths.mjs';
import { classifySegmentRoles } from './interview-speaker-role.mjs';
import { setCopilotMode, clearCopilotMode } from './interview-copilot-mode.mjs';
import { startLiveCopilot, stopLiveCopilot } from './interview-copilot-live.mjs';
import { processLiveChunk } from './interview-copilot-qa.mjs';
import { recordSpokenAnswer } from './interview-copilot-spoken.mjs';
import { getCopilotSession } from './interview-copilot-session.mjs';
import { resolveVacancyRecord } from './vacancy-record-resolve.mjs';

const TRANSCRIPT_DIR = path.join(DATA_DIR, 'interview-transcripts');

function loadTranscriptSegments(transcriptBase, filePath) {
  if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
    let segments = raw.segments || [];
    if (!segments[0]?.role) segments = classifySegmentRoles(segments);
    return { segments, title: raw.title, company: raw.company, prepContext: raw.prepContext };
  }
  const base = String(transcriptBase || '').trim();
  const json = path.join(TRANSCRIPT_DIR, `${base}.json`);
  const fixture = path.join(ROOT, 'scripts', 'fixtures', `${base}.json`);
  const fp = fs.existsSync(json) ? json : fs.existsSync(fixture) ? fixture : null;
  if (!fp) throw new Error(`транскрипт не найден: ${base}`);
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let segments = raw.segments || [];
  if (!segments[0]?.role) segments = classifySegmentRoles(segments);
  return { segments, title: raw.title, company: raw.company, prepContext: raw.prepContext };
}

/**
 * @param {object} opts
 */
export async function runCopilotSimulate(opts = {}) {
  const { segments, title, company, prepContext } = loadTranscriptSegments(
    opts.transcriptBase,
    opts.file
  );
  const rec = resolveVacancyRecord(opts.recordId || opts.vacancyId);
  const speed = Math.max(1, Number(opts.speed) || 50);

  const session = await startLiveCopilot({
    title: opts.title || title || rec?.title || 'Прогон',
    company: opts.company || company || rec?.company || '',
    vacancyId: opts.vacancyId || rec?.vacancyId,
    recordId: opts.recordId || rec?.id,
    prepContext: opts.prepContext || prepContext || '',
    interviewStage: opts.interviewStage || 'tech',
    scriptOnlyOverlay: true,
    prepPack: opts.prepPack || rec?.interviewPrep || null,
  });
  setCopilotMode('simulate', session.id);

  const questions = [];
  for (const seg of segments) {
    if (seg.role === 'candidate') {
      recordSpokenAnswer(session, {
        questionText: session.lastQuestion || '',
        spokenText: seg.text,
        source: 'simulate',
      });
      continue;
    }
    const wait = Math.max(0, ((seg.startSec || 0) * 1000) / speed);
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const r = await processLiveChunk(session, seg.text);
    if (r.updated && r.question) questions.push(r.question.slice(0, 120));
  }

  const snap = getCopilotSession(session.id, { strict: true });
  const guardCount = snap?.guardFlags?.length || 0;
  const spokenCount = snap?.spokenTurns?.length || 0;
  const sessionId = session.id;

  if (!opts.keepSession) {
    stopLiveCopilot(sessionId);
    clearCopilotMode();
  }

  return {
    ok: true,
    sessionId,
    questions,
    guardCount,
    spokenCount,
    readyForLive: guardCount === 0,
    interviewerSegments: segments.filter((s) => s.role === 'interviewer').length,
    candidateSegments: segments.filter((s) => s.role === 'candidate').length,
  };
}
