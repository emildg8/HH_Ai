/**
 * STT для live copilot: whisper CLI на временных wav-чанках.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { runWhisperCliOnWav } from './interview-copilot-stt-cli.mjs';
import { transcribeWavFast } from './interview-copilot-stt-fast.mjs';
const TMP_DIR = path.join(DATA_DIR, 'copilot-stt-tmp');

function runWhisperOnWav(wavPath) {
  return runWhisperCliOnWav(wavPath);
}
/**
 * PCM 16-bit mono → wav file → whisper.
 * @param {Buffer} pcmBuffer
 * @param {number} sampleRate
 */
export async function transcribePcmChunk(pcmBuffer, sampleRate = 16000) {
  if (!pcmBuffer?.length) return '';
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const id = `chunk-${Date.now()}`;
  const wavPath = path.join(TMP_DIR, `${id}.wav`);
  writeWav(wavPath, pcmBuffer, sampleRate);
  try {
    return await transcribeWavFast(wavPath);
  } catch {
    return '';
  } finally {
    try {
      fs.unlinkSync(wavPath);
      fs.unlinkSync(wavPath.replace(/\.wav$/, '.txt'));
    } catch {
      /* */
    }
  }
}

/**
 * @param {string} text — уже распознанный текст (обход STT)
 */
export function transcribeTextDirect(text) {
  return String(text || '').trim();
}

function writeWav(filePath, pcm, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
}
