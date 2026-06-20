/**
 * Быстрый STT через faster-whisper (scripts/copilot-stt-chunk.py).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWhisperCliOnWav } from './interview-copilot-stt-cli.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PY = path.join(ROOT, 'scripts', 'copilot-stt-chunk.py');

let pythonWarned = false;

function runPythonStt(wavPath) {
  return new Promise((resolve, reject) => {
    const py = process.env.COPILOT_PYTHON || 'python';
    const p = spawn(py, [PY, wavPath], {
      cwd: ROOT,
      env: { ...process.env },
      shell: false,
    });
    let out = '';
    let err = '';
    p.stdout?.on('data', (d) => {
      out += d;
    });
    p.stderr?.on('data', (d) => {
      err += d;
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(err || `python exit ${code}`));
      try {
        const data = JSON.parse(out.trim() || '{}');
        resolve(String(data.text || '').trim());
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * @param {string} wavPath
 */
export async function transcribeWavFast(wavPath) {
  if (!fs.existsSync(wavPath)) return '';
  const mode = (process.env.COPILOT_STT || 'fast').toLowerCase();
  if (mode === 'cli' || mode === 'whisper') {
    return runWhisperCliOnWav(wavPath);
  }
  try {
    return await runPythonStt(wavPath);
  } catch (e) {
    if (!pythonWarned) {
      pythonWarned = true;
      console.error('[stt-fast] fallback whisper CLI:', e.message);
    }
    return runWhisperCliOnWav(wavPath);
  }
}
