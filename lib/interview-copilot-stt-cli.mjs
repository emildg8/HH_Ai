/**
 * Whisper CLI fallback для STT.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export function runWhisperCliOnWav(wavPath) {
  return new Promise((resolve, reject) => {
    const outBase = wavPath.replace(/\.wav$/i, '');
    const args = [
      wavPath,
      '--language',
      'Russian',
      '--model',
      process.env.WHISPER_MODEL || 'base',
      '--output_dir',
      path.dirname(wavPath),
      '--output_format',
      'txt',
      '--verbose',
      'False',
    ];
    const p = spawn('whisper', args, { shell: false });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`whisper exit ${code}`));
      const txtPath = `${outBase}.txt`;
      try {
        resolve(fs.readFileSync(txtPath, 'utf8').trim());
      } catch {
        resolve('');
      }
    });
  });
}
