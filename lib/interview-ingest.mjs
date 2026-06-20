/**
 * Единый импорт транскриптов из всех источников → нормализованный объект.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  loadTranscriptSegments,
  parseTimestampedLines,
  parseTranscriptToSegments,
} from './interview-copilot-replay.mjs';

/**
 * @param {string} text
 */
export function hashContent(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16);
}

/**
 * @param {string[]} parts
 */
export function computeSourceId(parts) {
  return hashContent(parts.filter(Boolean).join('|'));
}

/**
 * @param {string} filePath
 * @param {string} [raw]
 */
export function detectSourceKind(filePath, raw) {
  const fp = String(filePath || '').toLowerCase();
  const body = raw ?? (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '');
  if (fp.includes('interview_script.json') || fp.endsWith('synergy-script.json')) {
    return 'synergy-script';
  }
  if (fp.endsWith('.transcript.json') || fp.includes('meeting')) return 'meeting-json';
  if (fp.endsWith('.json')) return 'cached-json';
  if (parseTimestampedLines(body).length) return 'sidecar';
  if (/interview_transcript|\.srt$/i.test(fp)) return 'sidecar';
  return 'plain-txt';
}

/**
 * @param {string} kind
 * @param {string} raw
 */
export function detectTimingConfidence(kind, raw) {
  if (kind === 'synergy-script') return 'high';
  if (kind === 'sidecar' || kind === 'meeting-json' || kind === 'cached-json') {
    if (parseTimestampedLines(raw).length) return 'high';
    try {
      const data = JSON.parse(raw);
      const segs = data.segments || data.transcription?.segments;
      if (Array.isArray(segs) && segs.length && segs[0].start != null) return 'high';
      if (data.words?.length) return 'high';
    } catch {
      /* */
    }
    return 'medium';
  }
  return 'low';
}

/**
 * @param {string} synergyPath
 */
export function loadSynergyScriptSegments(synergyPath) {
  if (!fs.existsSync(synergyPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(synergyPath, 'utf8'));
    const phases = data.phases || data.script || [];
    const out = [];
    for (const phase of phases) {
      const minute = Number(phase.minute ?? phase.startMinute ?? 0);
      const questions = phase.questions || phase.items || [];
      if (typeof phase.text === 'string' && phase.text.trim()) {
        out.push({
          startSec: minute * 60,
          endSec: minute * 60 + 30,
          text: phase.text.trim(),
        });
      }
      for (const q of questions) {
        const text = typeof q === 'string' ? q : q.question || q.text || '';
        if (!text.trim()) continue;
        out.push({
          startSec: minute * 60,
          endSec: minute * 60 + 45,
          text: text.trim(),
        });
      }
    }
    return out.sort((a, b) => a.startSec - b.startSec);
  } catch {
    return [];
  }
}

/**
 * @param {string} filePath
 * @param {object} [meta]
 */
export function ingestFromFile(filePath, meta = {}) {
  const abs = path.resolve(filePath);
  const raw = fs.readFileSync(abs, 'utf8');
  const kind = meta.sourceKind || detectSourceKind(abs, raw);
  let segments;

  if (kind === 'synergy-script') {
    segments = loadSynergyScriptSegments(abs);
  } else {
    segments = loadTranscriptSegments(abs);
    if (!segments.length && kind === 'plain-txt') {
      segments = parseTranscriptToSegments(raw, 5);
    }
  }

  const timingConfidence = meta.timingConfidence || detectTimingConfidence(kind, raw);
  const transcriptHash = hashContent(raw.slice(0, 120_000));
  const sourceId = meta.sourceId || computeSourceId([abs, transcriptHash]);
  const transcriptEndSec = segments.length
    ? Math.max(...segments.map((s) => s.endSec ?? s.startSec + 3))
    : 0;

  return {
    sourceKind: kind,
    sourceId,
    transcriptHash,
    sourcePath: abs,
    transcriptBase: meta.transcriptBase || path.basename(abs, path.extname(abs)),
    segments,
    timingConfidence,
    transcriptEndSec,
    hasVideo: Boolean(meta.hasVideo),
    videoPath: meta.videoPath || null,
    videoDurationSec: meta.videoDurationSec ?? null,
    prepContext: meta.prepContext || '',
    meta: {
      title: meta.title || '',
      company: meta.company || '',
      vacancyId: meta.vacancyId ?? null,
    },
  };
}

/**
 * @param {{ segments: object[], transcriptBase?: string }} opts
 * @param {object} [meta]
 */
export function ingestFromSegments(opts, meta = {}) {
  const segments = opts.segments || [];
  const raw = JSON.stringify(segments);
  const transcriptHash = hashContent(raw);
  const sourceId =
    meta.sourceId || computeSourceId([opts.transcriptBase || 'inline', transcriptHash]);

  return {
    sourceKind: meta.sourceKind || 'cached-json',
    sourceId,
    transcriptHash,
    sourcePath: meta.sourcePath || null,
    transcriptBase: opts.transcriptBase || 'inline',
    segments,
    timingConfidence: meta.timingConfidence || 'medium',
    transcriptEndSec: segments.length
      ? Math.max(...segments.map((s) => s.endSec ?? s.startSec + 3))
      : 0,
    hasVideo: Boolean(meta.hasVideo),
    videoPath: meta.videoPath || null,
    videoDurationSec: meta.videoDurationSec ?? null,
    prepContext: meta.prepContext || '',
    meta: {
      title: meta.title || '',
      company: meta.company || '',
      vacancyId: meta.vacancyId ?? null,
    },
  };
}
