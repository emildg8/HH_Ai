/**
 * Загрузка видео репетиции и транскрибация whisper → data/interview-transcripts/
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { DATA_DIR, ROOT } from './paths.mjs';
import { loadTranscriptSegments } from './interview-copilot-replay.mjs';
import { loadInterviewPrepContext } from './interview-prep-context.mjs';
import { ingestFromSegments, computeSourceId, hashContent } from './interview-ingest.mjs';
import { ensureReplayPlan, probeVideoDurationSec, validateReplayPlan } from './interview-replay-plan.mjs';

export const REPLAY_UPLOAD_DIR = path.join(DATA_DIR, 'replay-uploads');
export const TRANSCRIPT_DIR = path.join(DATA_DIR, 'interview-transcripts');
const MODEL = process.env.WHISPER_MODEL || 'base';
export const REPLAY_UPLOAD_MAX_BYTES =
  Number(process.env.HH_REPLAY_UPLOAD_MAX_BYTES) || 4_000_000_000;

export function getInterviewVideoDir() {
  return process.env.HH_INTERVIEW_DIR || path.join(ROOT, 'my');
}

export { loadInterviewPrepContext } from './interview-prep-context.mjs';

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

function encodeInterviewVideoId(absPath, rootDir) {
  const rel = path.relative(rootDir, absPath);
  return Buffer.from(rel, 'utf8').toString('base64url');
}

/**
 * @param {string} videoId — base64url относительного пути в HH_INTERVIEW_DIR
 */
export function resolveInterviewDirVideo(videoId) {
  const root = path.resolve(getInterviewVideoDir());
  if (!videoId) return null;
  let rel;
  try {
    rel = Buffer.from(String(videoId), 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!rel || rel.includes('..')) return null;
  const fp = path.resolve(root, rel);
  if (fp !== root && !fp.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) return null;
  return fp;
}

/**
 * Список видео из HH_INTERVIEW_DIR для репетиции без загрузки в браузере.
 */
export function listInterviewVideosForReplay() {
  const root = path.resolve(getInterviewVideoDir());
  if (!fs.existsSync(root)) {
    return { dir: root, items: [], missing: true };
  }
  const items = collectVideos(root).map((fp) => {
    const st = fs.statSync(fp);
    return {
      id: encodeInterviewVideoId(fp, root),
      name: path.basename(fp),
      rel: path.relative(root, fp),
      sizeMb: Math.round(st.size / 1024 / 1024),
    };
  });
  return { dir: root, items, missing: false };
}

function runWhisper(videoPath, outDir) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      'whisper',
      [
        videoPath,
        '--language',
        'Russian',
        '--model',
        MODEL,
        '--output_dir',
        outDir,
        '--output_format',
        'json',
        '--verbose',
        'False',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], shell: false }
    );
    let err = '';
    p.stderr?.on('data', (c) => {
      err += c;
    });
    p.on('error', (e) => {
      if (e.code === 'ENOENT') {
        reject(
          new Error(
            'whisper не найден в PATH. Установите OpenAI Whisper (pip install openai-whisper) или запустите npm run devops:transcribe-interviews вручную.'
          )
        );
      } else reject(e);
    });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `whisper завершился с кодом ${code}`));
    });
  });
}

function safeBaseName(fileName) {
  const raw = path.basename(String(fileName || 'replay'), path.extname(fileName || ''));
  const cleaned = raw.replace(/[^\w.\-()а-яА-ЯёЁ ]+/g, '_').trim().slice(0, 60);
  return cleaned || 'replay';
}

/**
 * Потоковая запись загрузки на диск (без буфера всего файла в RAM).
 * @param {import('http').IncomingMessage} req
 * @param {string} fileName
 */
export function streamReplayUploadToFile(req, fileName) {
  fs.mkdirSync(REPLAY_UPLOAD_DIR, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const ext = path.extname(fileName || '') || '.mp4';
  const base = `replay-${id}-${safeBaseName(fileName)}`;
  const videoPath = path.join(REPLAY_UPLOAD_DIR, `${base}${ext}`);

  return new Promise((resolve, reject) => {
    let len = 0;
    let failed = false;
    const ws = fs.createWriteStream(videoPath);

    const fail = (err) => {
      if (failed) return;
      failed = true;
      req.removeAllListeners('data');
      req.removeAllListeners('end');
      ws.destroy();
      fs.unlink(videoPath, () => {});
      reject(err);
    };

    req.on('data', (chunk) => {
      len += chunk.length;
      if (len > REPLAY_UPLOAD_MAX_BYTES) {
        const limitMb = Math.round(REPLAY_UPLOAD_MAX_BYTES / 1024 / 1024);
        fail(
          new Error(
            `Файл слишком большой (лимит ~${limitMb} МБ). Положите запись в «${getInterviewVideoDir()}» и выберите «С диска».`
          )
        );
        return;
      }
      if (!ws.write(chunk)) req.pause();
    });
    ws.on('drain', () => req.resume());
    req.on('end', () => ws.end());
    req.on('error', fail);
    ws.on('error', fail);
    ws.on('finish', () => {
      if (failed) return;
      resolve({ id, base, videoPath, fileName: `${base}${ext}`, bytes: len });
    });
  });
}

/**
 * @param {Buffer} buffer
 * @param {string} fileName
 */
export function saveReplayUpload(buffer, fileName) {
  fs.mkdirSync(REPLAY_UPLOAD_DIR, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const ext = path.extname(fileName || '') || '.mp4';
  const base = `replay-${id}-${safeBaseName(fileName)}`;
  const videoPath = path.join(REPLAY_UPLOAD_DIR, `${base}${ext}`);
  fs.writeFileSync(videoPath, buffer);
  return { id, base, videoPath, fileName: `${base}${ext}` };
}

/**
 * Транскрибировать видео и вернуть сегменты с таймкодами.
 * @param {string} videoPath
 * @param {{ base?: string, force?: boolean }} [opts]
 */
export async function transcribeVideoToSegments(videoPath, opts = {}) {
  const base = opts.base || path.basename(videoPath, path.extname(videoPath));
  fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

  const jsonOut = path.join(TRANSCRIPT_DIR, `${base}.json`);
  const txtOut = path.join(TRANSCRIPT_DIR, `${base}.txt`);

  if (!opts.force && fs.existsSync(jsonOut) && fs.statSync(jsonOut).size > 50) {
    const segments = loadTranscriptSegments(jsonOut);
    return { base, segments, transcriptPath: jsonOut, cached: true };
  }

  await runWhisper(videoPath, TRANSCRIPT_DIR);

  if (!fs.existsSync(jsonOut)) {
    throw new Error('Whisper не создал JSON-транскрипт. Проверьте формат видео и логи whisper.');
  }

  const segments = loadTranscriptSegments(jsonOut);
  if (!segments.length) {
    throw new Error('Транскрипт пуст — на записи не распознан речевой текст.');
  }

  if (!fs.existsSync(txtOut)) {
    fs.writeFileSync(txtOut, segments.map((s) => s.text).join('\n'), 'utf8');
  }

  return { base, segments, transcriptPath: jsonOut, cached: false };
}

/**
 * Загрузить буфер видео, транскрибировать, вернуть метаданные для репетиции.
 * @param {Buffer} buffer
 * @param {string} fileName
 */
export async function prepareReplayFromUpload(buffer, fileName) {
  const saved = saveReplayUpload(buffer, fileName);
  return finishReplayPrepare(saved);
}

/**
 * Потоковая загрузка + транскрибация.
 * @param {import('http').IncomingMessage} req
 * @param {string} fileName
 */
export async function prepareReplayFromStream(req, fileName) {
  const saved = await streamReplayUploadToFile(req, fileName);
  return finishReplayPrepare(saved);
}

/**
 * Транскрибация видео, уже лежащего на диске (HH_INTERVIEW_DIR).
 * @param {string} videoId
 */
export async function prepareReplayFromLocalVideo(videoId) {
  const videoPath = resolveInterviewDirVideo(videoId);
  if (!videoPath) {
    throw new Error('Видео не найдено в папке интервью');
  }
  const root = path.resolve(getInterviewVideoDir());
  const base = path.basename(videoPath, path.extname(videoPath));

  const jsonOut = path.join(TRANSCRIPT_DIR, `${base}.json`);
  let segments;
  let cached = false;

  // Если рядом с видео лежат готовые таймкоды (TAM/сторонние транскрипты),
  // импортируем их сразу и не запускаем whisper.
  if (!fs.existsSync(jsonOut) || fs.statSync(jsonOut).size <= 50) {
    const videoDir = path.dirname(videoPath);
    const sidecarCandidates = [
      path.join(videoDir, 'interview_transcript.txt'),
      path.join(videoDir, 'interview_transcript.srt'),
      path.join(videoDir, `${base}.txt`),
      path.join(videoDir, `${base}.srt`),
    ];
    const sidecar = sidecarCandidates.find((fp) => fs.existsSync(fp) && fs.statSync(fp).isFile());
    if (sidecar) {
      segments = loadTranscriptSegments(sidecar);
      if (segments.length) {
        fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
        fs.writeFileSync(jsonOut, `${JSON.stringify({ segments }, null, 2)}\n`, 'utf8');
        cached = true;
      } else {
        segments = undefined;
      }
    }
  }

  if (!segments) {
    ({ segments, cached } = await transcribeVideoToSegments(videoPath, { base }));
  }

  const prepContext = loadInterviewPrepContext(path.dirname(videoPath));
  const title = path.basename(path.dirname(videoPath));

  return attachReplayPlanMeta(
    {
      transcriptBase: base,
      segmentCount: segments.length,
      videoUrl: `/api/interview-copilot/replay/interview-video?id=${encodeURIComponent(videoId)}`,
      cached,
      source: 'local',
      localName: path.relative(root, videoPath),
      prepContext,
      title,
    },
    { segments, videoPath, prepContext, title }
  );
}

async function attachReplayPlanMeta(result, { segments, videoPath, prepContext, title, company }) {
  const sourceId = computeSourceId([
    result.transcriptBase,
    videoPath || result.videoFile || '',
    hashContent(JSON.stringify(segments.slice(0, 8))),
  ]);
  const videoDurationSec = videoPath ? await probeVideoDurationSec(videoPath) : null;
  const normalized = ingestFromSegments(
    { segments, transcriptBase: result.transcriptBase },
    {
      sourceId,
      prepContext: prepContext || '',
      title: title || '',
      company: company || '',
      videoPath: videoPath || null,
      videoDurationSec,
      hasVideo: Boolean(videoPath),
    }
  );
  normalized.meta = { title: title || '', company: company || '' };
  const plan = await ensureReplayPlan(normalized);
  const validation = validateReplayPlan(plan);
  return {
    ...result,
    prepContext: prepContext || '',
    title: title || result.title || '',
    sourceId: plan.sourceId,
    promptCount: plan.prompts.length,
    pregenDone: plan.pregen?.done ?? 0,
    timingConfidence: plan.timingConfidence,
    transcriptEndSec: plan.transcriptEndSec,
    validation,
  };
}

async function finishReplayPrepare(saved, meta = {}) {
  const { base, segments, cached } = await transcribeVideoToSegments(saved.videoPath, {
    base: saved.base,
  });
  const baseResult = {
    transcriptBase: base,
    segmentCount: segments.length,
    videoFile: saved.fileName,
    cached,
    source: 'upload',
    videoUrl: `/api/interview-copilot/replay/video?file=${encodeURIComponent(saved.fileName)}`,
  };
  return attachReplayPlanMeta(baseResult, {
    segments,
    videoPath: saved.videoPath,
    prepContext: meta.prepContext || '',
    title: meta.title || '',
    company: meta.company || '',
  });
}

/**
 * @param {string} fileName — имя файла внутри REPLAY_UPLOAD_DIR
 */
export function resolveReplayVideoPath(fileName) {
  const safe = path.basename(String(fileName || ''));
  if (!safe || safe.includes('..')) return null;
  const fp = path.join(REPLAY_UPLOAD_DIR, safe);
  if (!fp.startsWith(REPLAY_UPLOAD_DIR + path.sep)) return null;
  if (!fs.existsSync(fp)) return null;
  return fp;
}
