/**
 * Оптимизация заголовка и «О себе» (промпт 2 из career-prompts).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FILE = path.join(__dirname, '..', 'config', 'career-prompts.json');

/**
 * @param {string} cvText
 */
export function buildProfileOptimizePrompt(cvText) {
  let tpl = 'Заголовок и «О себе» для DevOps. CV: {{cv}}';
  try {
    const cfg = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf8'));
    tpl = cfg.prompts?.profileOptimize || tpl;
  } catch {
    /* default */
  }
  return tpl.replace('{{cv}}', String(cvText || '').slice(0, 6000));
}
