/**
 * Транскрибация видео собеседований (whisper) → data/interview-transcripts/
 *   npm run devops:transcribe-interviews
 *   HH_INTERVIEW_DIR=D:\Dev\HH\hh\Интервью
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { DATA_DIR } from '../lib/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INTERVIEW_DIR = process.env.HH_INTERVIEW_DIR || 'D:\\Dev\\HH\\hh\\Интервью';
const OUT_DIR = path.join(DATA_DIR, 'interview-transcripts');
const MODEL = process.env.WHISPER_MODEL || 'base';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

function collectVideos(dir) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      const fp = path.join(d, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) walk(fp);
      else if (/\.(mp4|mkv|webm|mov|m4a|wav)$/i.test(name)) out.push(fp);
    }
  };
  walk(dir);
  return out.sort();
}

async function main() {
  const videos = collectVideos(INTERVIEW_DIR);
  if (!videos.length) {
    console.error('Нет видео в', INTERVIEW_DIR);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[transcribe] ${videos.length} файлов, модель ${MODEL}`);

  const manifest = [];

  for (const video of videos) {
    const base = path.basename(video, path.extname(video));
    const txtOut = path.join(OUT_DIR, `${base}.txt`);
    const jsonOut = path.join(OUT_DIR, `${base}.json`);

    if (fs.existsSync(txtOut) && fs.statSync(txtOut).size > 100) {
      console.log('[skip]', base);
      manifest.push({ file: video, transcript: txtOut, skipped: true });
      continue;
    }

    console.log('\n[whisper]', base);
    await run('whisper', [
      video,
      '--language',
      'Russian',
      '--model',
      MODEL,
      '--output_dir',
      OUT_DIR,
      '--output_format',
      'txt',
      '--verbose',
      'False',
    ], { shell: false });

    manifest.push({ file: video, transcript: txtOut, json: jsonOut, skipped: false });
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify({ at: new Date().toISOString(), dir: INTERVIEW_DIR, items: manifest }, null, 2)}\n`,
    'utf8'
  );
  console.log('\n[transcribe] Готово:', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
