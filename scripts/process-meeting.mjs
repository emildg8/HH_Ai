/**
 * Обработка записи встречи v2: GPU-транскрибация → LLM-правка → 9 выжимок (3×3) с экспертизой.
 *   npm run meeting:process -- --video "..." --v2 --force
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { generateAllSummaries } from '../lib/meeting-summary.mjs';
import { loadSegmentsFromJson, refineTranscriptPipeline } from '../lib/transcript-refine.mjs';
import { getOpenRouterApiKey } from '../lib/openrouter-score.mjs';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_PATH =
  'D:\\Dev\\apps\\hh-ai\\my\\Интервью\\bandicam 2026-06-16 17-03-12-248.mp4';

function parseArgs(argv) {
  const out = {
    video: '',
    model: process.env.WHISPER_MODEL || 'large-v3',
    v2: false,
    force: false,
    skipTranscribe: false,
    summariesOnly: false,
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--video' && argv[i + 1]) out.video = argv[++i];
    else if (argv[i] === '--model' && argv[i + 1]) out.model = argv[++i];
    else if (argv[i] === '--v2') out.v2 = true;
    else if (argv[i] === '--force') out.force = true;
    else if (argv[i] === '--skip-transcribe') out.skipTranscribe = true;
    else if (argv[i] === '--summaries-only') out.summariesOnly = true;
  }
  if (!out.video) out.video = VIDEO_PATH;
  if (!out.v2) out.v2 = true;
  return out;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: false });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function transcribe(videoPath, outDir, model, force) {
  const py = path.join(__dirname, 'transcribe-meeting.py');
  const args = ['--v2', videoPath, outDir, model];
  if (force) args.unshift('--force');
  await run('python', [py, ...args]);
}

async function main() {
  const args = parseArgs(process.argv);
  const videoPath = path.resolve(args.video);
  if (!fs.existsSync(videoPath)) {
    console.error('Видео не найдено:', videoPath);
    process.exit(1);
  }

  const outDir = path.dirname(videoPath);
  const title = path.basename(videoPath, path.extname(videoPath));
  const base = path.basename(videoPath, path.extname(videoPath));
  const suffix = '-v2';
  const jsonPath = path.join(outDir, `${base}.transcript${suffix}.json`);
  const summariesDir = path.join(outDir, 'summaries-v2');

  console.log('[meeting] video:', videoPath);
  console.log('[meeting] LLM:', getOpenRouterApiKey() ? 'OpenRouter' : 'custom/fallback');

  if (!args.summariesOnly && !args.skipTranscribe) {
    console.log('[meeting] transcribe model:', args.model);
    await transcribe(videoPath, outDir, args.model, args.force);
  }

  if (!fs.existsSync(jsonPath)) {
    console.error('Нет JSON транскрипта:', jsonPath);
    process.exit(1);
  }

  let refinedPlain;
  const refinedPath = path.join(outDir, `transcript${suffix}-refined.txt`);

  if (args.summariesOnly && fs.existsSync(refinedPath)) {
    refinedPlain = fs.readFileSync(refinedPath, 'utf8');
    console.log('[meeting] summaries-only, using cached refined transcript');
  } else {
    const segments = loadSegmentsFromJson(jsonPath);
    console.log('[meeting] segments:', segments.length, '→ refine');
    const refined = await refineTranscriptPipeline(outDir, segments, { suffix });
    refinedPlain = refined.refinedPlain;
    console.log('[meeting] refined chars:', refinedPlain.length);
  }

  console.log('[meeting] generating 9 summaries...');
  const summaryFiles = await generateAllSummaries(title, refinedPlain, summariesDir, console.log);

  const manifest = {
    at: new Date().toISOString(),
    video: videoPath,
    outDir,
    summariesDir,
    transcriptJson: jsonPath,
    refinedTxt: refinedPath,
    summaryCount: summaryFiles.length,
    files: {
      transcript: fs.readdirSync(outDir).filter((n) => n.includes('transcript') && n.includes('v2')),
      summaries: fs.readdirSync(summariesDir).sort(),
    },
  };
  fs.writeFileSync(path.join(outDir, 'meeting-manifest-v2.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(summariesDir, 'manifest.json'), `${JSON.stringify(summaryFiles, null, 2)}\n`, 'utf8');

  console.log('\n[meeting] Готово:', summariesDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
