/**
 * Список аудио-устройств для суфлёра.
 */

import { spawnSync } from 'child_process';

let cache = null;
const CACHE_MS = 30_000;

function runFfmpeg(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', shell: false });
  return (r.stderr || r.stdout || '').trim();
}

function parseDeviceLines(text, kind) {
  const devices = [];
  if (!text) return devices;
  for (const line of text.split(/\r?\n/)) {
    if (kind === 'wasapi') {
      const m = line.match(/^\s*\[wasapi[^\]]*\]\s+"([^"]+)"/i);
      if (m) devices.push({ id: m[1], label: m[1] });
    } else {
      const m = line.match(/^\s*"([^"]+)"\s+\(audio\)/i);
      if (m) devices.push({ id: `audio=${m[1]}`, label: m[1] });
    }
  }
  return devices;
}

export function listCopilotAudioDevices({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_MS) return cache.data;

  let ffmpegOk = false;
  try {
    ffmpegOk = /ffmpeg version/i.test(runFfmpeg(['-version']));
  } catch {
    ffmpegOk = false;
  }

  const wasapi = [{ id: 'default', label: 'По умолчанию (системный звук)' }];
  const mic = [];

  if (ffmpegOk) {
    for (const d of parseDeviceLines(runFfmpeg(['-list_devices', 'true', '-f', 'wasapi', '-i', 'dummy']), 'wasapi')) {
      if (!wasapi.some((x) => x.id === d.id)) wasapi.push(d);
    }
    if (process.platform === 'win32') {
      for (const d of parseDeviceLines(runFfmpeg(['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']), 'dshow')) {
        mic.push(d);
      }
    }
  }

  const data = { wasapi, mic, ffmpeg: ffmpegOk };
  cache = { at: now, data };
  return data;
}
