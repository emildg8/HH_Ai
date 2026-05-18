#!/usr/bin/env node
/**
 * Playwright Codegen с тем же persistent-профилем, что у npm run login / hh-apply-chat.
 * Сессия hh.ru подтянется автоматически (cookies в профиле).
 *
 * Важно: закройте другие окна Chromium с этим профилем (login, «Отклик в браузере»),
 * иначе профиль залочен и codegen не стартует.
 *
 *   npm run codegen-hh
 *   npm run codegen-hh -- https://hh.ru/vacancy/123 --target javascript -o ./tmp/recorded.mjs
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { sessionProfilePath } from '../lib/paths.mjs';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const playwrightBin = path.join(root, 'node_modules', '.bin', 'playwright');

if (!fs.existsSync(playwrightBin)) {
  console.error('Не найден playwright в node_modules. Выполните: npm install');
  process.exit(1);
}

const profile = sessionProfilePath();
if (!fs.existsSync(profile)) {
  console.error('Профиль ещё не создан. Сначала: npm run login\n', profile);
  process.exit(1);
}

console.log('Профиль сессии:', profile);
console.log(
  'Подсказка: закройте все окна Chromium из npm run login / «Отклик в браузере», иначе профиль залочен (ProcessSingleton).\n'
);

const userArgs = process.argv.slice(2);
const hasUrl = userArgs.some((a) => /^https?:\/\//.test(a));

const args = [
  'codegen',
  `--user-data-dir=${profile}`,
  '--lang=ru-RU',
  ...userArgs,
];
if (!hasUrl) args.push('https://hh.ru');

const child = spawn(playwrightBin, args, {
  stdio: 'inherit',
  cwd: root,
  shell: false,
});

child.on('exit', (code, signal) => {
  process.exit(code == null ? (signal ? 1 : 0) : code);
});
