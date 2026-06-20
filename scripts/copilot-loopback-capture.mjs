/**
 * Захват loopback (+ опционально mic) → fast STT → live API.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeWavFast } from '../lib/interview-copilot-stt-fast.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.DASHBOARD_PORT || '3849';
const BASE = `http://127.0.0.1:${PORT}`;
const CHUNK_SEC = Number(process.env.COPILOT_CHUNK_SEC || 2);
const TMP = path.join(ROOT, 'data', 'copilot-capture-tmp');
const LOG = path.join(ROOT, 'data', 'copilot-capture.log');

let sessionId = process.env.COPILOT_SESSION_ID || null;
let running = true;
let lastLoopbackText = '';

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}\n`;
  try {
    fs.appendFileSync(LOG, msg);
  } catch {
    /* */
  }
  console.log(line);
}

async function api(pathname, body) {
  const r = await fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { shell: false });
    let err = '';
    p.stderr?.on('data', (d) => {
      err += d;
    });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || `${cmd} exit ${code}`))));
  });
}

async function captureWav(wavPath, device, durationSec = CHUNK_SEC) {
  await runCmd('ffmpeg', [
    '-y',
    '-f',
    'wasapi',
    '-i',
    device,
    '-t',
    String(durationSec),
    '-ar',
    '16000',
    '-ac',
    '1',
    wavPath,
  ]);
}

async function captureMicWav(wavPath) {
  const mic = process.env.COPILOT_MIC_DEVICE;
  if (!mic) return false;
  try {
    await runCmd('ffmpeg', [
      '-y',
      '-f',
      'dshow',
      '-i',
      mic,
      '-t',
      String(CHUNK_SEC),
      '-ar',
      '16000',
      '-ac',
      '1',
      wavPath,
    ]);
    return true;
  } catch (e) {
    log(`[mic] ${e.message}`);
    return false;
  }
}

function liveStartBody() {
  return {
    title: process.env.COPILOT_TITLE || 'Собеседование',
    company: process.env.COPILOT_COMPANY || '',
    vacancyId: process.env.COPILOT_VACANCY_ID || null,
    recordId: process.env.COPILOT_RECORD_ID || null,
    interviewStage: process.env.COPILOT_INTERVIEW_STAGE || 'tech',
    prepContext: process.env.COPILOT_PREP_CONTEXT || '',
    scriptOnlyOverlay: process.env.COPILOT_SCRIPT_ONLY !== '0',
  };
}

function similar(a, b) {
  const x = String(a || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const y = String(b || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!x || !y) return 0;
  const shorter = x.length < y.length ? x : y;
  const longer = x.length >= y.length ? x : y;
  return shorter.length / longer.length > 0.7 && longer.includes(shorter.slice(0, 12));
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(path.dirname(LOG), { recursive: true });

  const loopDevice = process.env.COPILOT_WASAPI_DEVICE || 'default';
  const useMic = process.env.COPILOT_MIC === '1';

  if (!sessionId) {
    const start = await api('/api/interview-copilot/live/start', liveStartBody());
    sessionId = start.session?.id;
    log(`[copilot-capture] session ${sessionId} stt=${process.env.COPILOT_STT || 'fast'}`);
  }

  process.on('SIGINT', () => {
    running = false;
  });
  process.on('SIGTERM', () => {
    running = false;
  });

  let n = 0;
  while (running) {
    const wav = path.join(TMP, `chunk-${n++}.wav`);
    try {
      await captureWav(wav, loopDevice);
      const text = await transcribeWavFast(wav);
      if (text) {
        lastLoopbackText = text;
        const r = await api('/api/interview-copilot/stt-chunk', { sessionId, text });
        if (r.updated) log(`[Q] ${(r.question || '').slice(0, 80)}`);
      }

      if (useMic) {
        if (!process.env.COPILOT_MIC_DEVICE) {
          log('[mic] COPILOT_MIC=1, но COPILOT_MIC_DEVICE не задан — укажите audio=… из ffmpeg -list_devices dshow');
        }
        const micWav = path.join(TMP, `mic-${n}.wav`);
        const ok = await captureMicWav(micWav);
        if (ok) {
          const micText = await transcribeWavFast(micWav);
          if (micText && !similar(micText, lastLoopbackText)) {
            await api('/api/interview-copilot/spoken-chunk', {
              sessionId,
              text: micText,
              source: 'mic',
            }).catch(() => {});
          }
          try {
            fs.unlinkSync(micWav);
          } catch {
            /* */
          }
        }
      }
    } catch (e) {
      log(`[copilot-capture] ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500));
    } finally {
      try {
        fs.unlinkSync(wav);
      } catch {
        /* */
      }
    }
  }

  if (sessionId) {
    await api('/api/interview-copilot/live/stop', { sessionId }).catch(() => {});
  }
  log('[copilot-capture] stopped');
}

main().catch((e) => {
  log(`[copilot-capture] fatal ${e.message}`);
  process.exit(1);
});
