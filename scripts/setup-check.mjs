/**
 * Проверка настройки перед первым запуском.
 *   npm run setup:check
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import { ROOT, CV_DIR, getQueueFile } from '../lib/paths.mjs';
import { listProfiles } from '../lib/load-profile.mjs';
import { sessionProfilePath } from '../lib/paths.mjs';

loadEnv();
loadDevOpsEnv();

const ok = [];
const warn = [];
const todo = [];

function pass(msg) {
  ok.push(msg);
  console.log(`  ✓  ${msg}`);
}
function warning(msg) {
  warn.push(msg);
  console.log(`  ⚠  ${msg}`);
}
function action(msg) {
  todo.push(msg);
  console.log(`  →  ${msg}`);
}

function readEnvFile(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}

function hasOpenRouterKey() {
  const blob = [readEnvFile('.env'), readEnvFile('config/secrets.local.env')].join('\n');
  return /(?:OpenRouter_API_KEY|OPENROUTER_API_KEY)\s*=\s*sk-or-v1-/i.test(blob);
}

function hasCustomLlm() {
  const blob = [readEnvFile('.env'), readEnvFile('config/secrets.local.env')].join('\n');
  return /HH_CUSTOM_LLM_BASE_URL\s*=\s*https?:\/\//i.test(blob) || /OLLAMA_BASE_URL\s*=/i.test(blob);
}

function profileEnvPath() {
  const id = (process.env.HH_PROFILE || 'devops').trim();
  const p = path.join(ROOT, 'config', 'profiles', `${id}.env`);
  if (fs.existsSync(p)) return p;
  const legacy = path.join(ROOT, 'config', `${id}.env`);
  if (fs.existsSync(legacy)) return legacy;
  return p;
}

function readProfileEnv() {
  const p = profileEnvPath();
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function main() {
  console.log('\n[setup:check] Проверка настройки HH Ai\n');

  if (fs.existsSync(path.join(ROOT, 'node_modules'))) pass('npm install выполнен');
  else action('npm install');

  if (fs.existsSync(path.join(ROOT, '.env'))) pass('.env существует');
  else action('copy .env.example .env');

  if (fs.existsSync(path.join(ROOT, 'config', 'secrets.local.env'))) pass('config/secrets.local.env существует');
  else action('copy config/secrets.example.env config/secrets.local.env');

  const profilePath = profileEnvPath();
  if (fs.existsSync(profilePath)) pass(`Профиль: ${path.relative(ROOT, profilePath)}`);
  else action(`npm run profile:init -- --id=devops --title=DevOps`);

  const prof = readProfileEnv();
  if (/HH_PROFILE_RESUME_TITLE\s*=\s*\S+/i.test(prof)) pass('HH_PROFILE_RESUME_TITLE задан');
  else action('В профиле укажите HH_PROFILE_RESUME_TITLE=название резюме на hh.ru');

  if (/HH_PROFILE_RESUME_HASH\s*=\s*[a-f0-9]{8,}/i.test(prof)) pass('HH_PROFILE_RESUME_HASH задан');
  else warning('HH_PROFILE_RESUME_HASH пуст — npm run devops:list-resumes после login');

  if (fs.existsSync(path.join(ROOT, 'config', 'cover-letter.txt'))) pass('config/cover-letter.txt есть');
  else action('copy config/cover-letter.example.txt config/cover-letter.txt');

  const cvFiles = fs.existsSync(CV_DIR)
    ? fs.readdirSync(CV_DIR).filter((n) => /\.(md|txt|pdf)$/i.test(n))
    : [];
  if (cvFiles.length) pass(`CV/: ${cvFiles.length} файл(ов) — LLM увидит резюме`);
  else warning('CV/ пуст — положите resume.md или .pdf для оценки и писем');

  const llmMax = Number(process.env.HH_LLM_MAX_PER_RUN ?? prof.match(/HH_LLM_MAX_PER_RUN\s*=\s*(\d+)/)?.[1] ?? NaN);
  const orKey = hasOpenRouterKey();
  const customLlm = hasCustomLlm();

  if (orKey) pass('OpenRouter API key найден');
  else if (customLlm) pass('Настроен локальный LLM (Ollama/LM Studio)');
  else if (llmMax === 0) pass('Режим без LLM (HH_LLM_MAX_PER_RUN=0) — локальная оценка');
  else warning('LLM не настроен — см. docs/CONFIG-GUIDE.md (пресеты в config/presets/)');

  const sessionDir = sessionProfilePath();
  if (fs.existsSync(sessionDir)) pass('Профиль Chromium (сессия) есть');
  else action('npm run login — войти на hh.ru');

  const queue = getQueueFile();
  if (fs.existsSync(queue)) {
    try {
      const n = JSON.parse(fs.readFileSync(queue, 'utf8')).length;
      pass(`Очередь: ${path.relative(ROOT, queue)} (${n} записей)`);
    } catch {
      warning(`Очередь ${queue} — не удалось прочитать JSON`);
    }
  } else pass(`Очередь будет создана при harvest: ${path.relative(ROOT, queue)}`);

  const profiles = listProfiles();
  if (profiles.length > 1) pass(`Профилей: ${profiles.map((p) => p.id).join(', ')}`);
  else pass(`Активный профиль: ${process.env.HH_PROFILE || 'devops'}`);

  console.log('\n--- Итог ---');
  if (todo.length === 0 && warn.length === 0) {
    console.log('Готово к работе: npm run dashboard → harvest → отклики');
  } else {
    if (todo.length) console.log(`Сделать: ${todo.length} пункт(ов) выше`);
    if (warn.length) console.log(`Рекомендации: ${warn.length}`);
    console.log('\nПодробно: docs/CONFIG-GUIDE.md');
  }
  console.log('');
  process.exit(todo.length ? 1 : 0);
}

main();
