import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

/**
 * Порядок (последние файлы перекрывают предыдущие): .env → .env.local → config/secrets.local.env
 */
export function loadEnv() {
  const tryLoad = (rel) => {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  };
  tryLoad('.env');
  tryLoad('.env.local');
  tryLoad(path.join('config', 'secrets.local.env'));

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
}
