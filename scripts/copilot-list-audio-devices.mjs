#!/usr/bin/env node
/**
 * Список аудио-устройств для copilot (Windows ffmpeg).
 *   npm run devops:copilot-devices
 */

import { spawnSync } from 'child_process';

function run(args) {
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8', shell: false });
  return (r.stderr || r.stdout || '').trim();
}

console.log('=== WASAPI (loopback / системный звук) ===');
console.log('Используйте COPILOT_WASAPI_DEVICE=default или имя из списка ffmpeg wasapi.\n');
console.log(run(['-list_devices', 'true', '-f', 'wasapi', '-i', 'dummy']) || '(ffmpeg не найден)');

if (process.platform === 'win32') {
  console.log('\n=== DirectShow (микрофон) ===');
  console.log('COPILOT_MIC_DEVICE=audio=Имя микрофона\n');
  console.log(run(['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']) || '(нет dshow)');
}

console.log('\nПример .env:');
console.log('COPILOT_MIC=1');
console.log('COPILOT_MIC_DEVICE=audio=Микрофон (Realtek(R) Audio)');
console.log('COPILOT_WASAPI_DEVICE=default');
