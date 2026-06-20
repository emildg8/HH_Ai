import fs from 'fs';
import path from 'path';
import { callMeetingLlm, chunkText } from './meeting-llm.mjs';
import {
  mergeTranscriptSegments,
  segmentsToPlainText,
  segmentsToTimedText,
} from './transcript-segment-merge.mjs';
import { writeDocxFromMarkdown } from './md-export.mjs';

const REFINE_SYSTEM = `Ты редактор стенограммы деловой встречи на русском языке.
Исправляй только ошибки распознавания речи: имена, фамилии, названия компаний (Иннотех, T1, Dion, Сервионика, ВТБ), термины (TКRС, KPI, HR BP, грейд, DevOps, Confluence).
Не меняй смысл, не добавляй факты, не сокращай содержание.
Сохраняй таймкоды в формате [HH:MM:SS,mmm -> HH:MM:SS,mmm] в начале каждого абзаца.
Вывод: только исправленный текст с таймкодами, без комментариев.`;

/**
 * @param {string} timedText — merged timed chunks
 * @param {(msg:string)=>void} [log]
 */
export async function refineTimedTranscript(timedText, log = console.log) {
  const parts = chunkText(timedText, 10000);
  const refined = [];
  for (let i = 0; i < parts.length; i++) {
    log(`[refine] chunk ${i + 1}/${parts.length}`);
    const out = await callMeetingLlm({
      system: REFINE_SYSTEM,
      user: `Исправь фрагмент стенограммы:\n\n${parts[i]}`,
      maxTokens: 3500,
      temperature: 0.15,
    });
    refined.push(out.trim());
  }
  return refined.join('\n\n');
}

/**
 * @param {string} outDir
 * @param {{startSec:number,endSec:number,text:string}[]} segments
 */
export async function refineTranscriptPipeline(outDir, segments, { suffix = '-v2' } = {}) {
  const merged = mergeTranscriptSegments(segments);
  const mergedTimed = segmentsToTimedText(merged);
  const mergedPlain = segmentsToPlainText(merged);

  const mergedTimedPath = path.join(outDir, `transcript${suffix}-merged-timed.txt`);
  fs.writeFileSync(mergedTimedPath, `${mergedTimed}\n`, 'utf8');

  const refinedTimed = await refineTimedTranscript(mergedTimed);
  const refinedTimedPath = path.join(outDir, `transcript${suffix}-refined-timed.txt`);
  const refinedPlainPath = path.join(outDir, `transcript${suffix}-refined.txt`);

  fs.writeFileSync(refinedTimedPath, `${refinedTimed.trim()}\n`, 'utf8');

  const plainFromRefined = refinedTimed
    .split(/\n+/)
    .map((line) => line.replace(/^\[\d{2}:\d{2}:\d{2}[.,]\d{3}\s*->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}]\s*/, '').trim())
    .filter(Boolean)
    .join('\n\n');
  fs.writeFileSync(refinedPlainPath, `${plainFromRefined}\n`, 'utf8');

  const md = `# Транскрипт встречи (v2, с правкой)\n\n## Текст\n\n${plainFromRefined}\n\n---\n\n## С таймкодами\n\n\`\`\`\n${refinedTimed.trim()}\n\`\`\`\n`;
  const mdPath = path.join(outDir, `transcript${suffix}-refined.md`);
  fs.writeFileSync(mdPath, md, 'utf8');
  await writeDocxFromMarkdown(md, path.join(outDir, `transcript${suffix}-refined.docx`));

  return {
    merged,
    mergedTimedPath,
    refinedTimedPath,
    refinedPlainPath,
    refinedPlain: plainFromRefined,
    mergedPlain,
  };
}

export function loadSegmentsFromJson(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return data.segments || [];
}
