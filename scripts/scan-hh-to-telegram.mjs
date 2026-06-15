#!/usr/bin/env node
/**
 * hh.ru search → уведомление в Telegram (НЕ ingest из каналов).
 * Каноническое имя; scan-telegram.mjs — обратная совместимость.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'scan-telegram.mjs');
const child = spawn(process.execPath, [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
