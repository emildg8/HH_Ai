import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

/**
 * Порядок (последние файлы перекрывают предыдущие): .env → .env.local → config/secrets.local.env
 * Для .env / .env.local / secrets используем override: true, чтобы значения из файлов проекта
 * не терялись из‑за случайных переменных окружения родительского процесса (иначе dotenv их не перезаписывает).
 */
export function loadEnv() {
  const tryLoad = (rel, override) => {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) dotenv.config({ path: p, override });
  };
  tryLoad('.env', true);
  tryLoad('.env.local', true);
  tryLoad(path.join('config', 'secrets.local.env'), true);

  const orm = (process.env.OPENROUTER_MODEL || '').trim();
  if (orm && /qwen3\.6-plus-preview/i.test(orm)) {
    process.env.OPENROUTER_MODEL = 'openrouter/free';
  }

  const stripQuotes = (v) => {
    if (!v || !/^["']/.test(v)) return v;
    return v.replace(/^["'\s]+|["'\s]+$/g, '');
  };
  if (process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = stripQuotes(process.env.GEMINI_API_KEY);
  }
  const orKeys = ['OpenRouter_API_KEY', 'OPENROUTER_API_KEY'];
  for (const name of orKeys) {
    if (process.env[name]) process.env[name] = stripQuotes(process.env[name]);
  }

  // В Cursor sandbox путь к временным браузерам может меняться между процессами.
  // Фиксируем постоянный каталог внутри проекта, чтобы дочерние скрипты (spawn) всегда
  // находили один и тот же Chromium.
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(ROOT, '.playwright-browsers');
}
