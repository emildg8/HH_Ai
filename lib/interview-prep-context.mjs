/**
 * Контекст подготовки из папки записи (INTERVIEW_SUMMARY*.md).
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';

export function getInterviewDataDir() {
  return process.env.HH_INTERVIEW_DIR || path.join(ROOT, 'my');
}

/**
 * @param {string} dir
 */
export function loadInterviewPrepContext(dir) {
  if (!dir || !fs.existsSync(dir)) return '';
  for (const name of ['INTERVIEW_SUMMARY.md', 'INTERVIEW_SUMMARY_1PAGE.md']) {
    const fp = path.join(dir, name);
    if (fs.existsSync(fp)) {
      return fs.readFileSync(fp, 'utf8').trim().slice(0, 6000);
    }
  }
  return '';
}

/**
 * @param {string} transcriptBase
 */
export function findPrepContextForTranscriptBase(transcriptBase) {
  const base = String(transcriptBase || '').trim();
  if (!base) return '';
  const root = path.resolve(getInterviewDataDir());
  if (!fs.existsSync(root)) return '';

  let found = '';
  const walk = (d) => {
    if (found) return;
    for (const name of fs.readdirSync(d)) {
      const fp = path.join(d, name);
      const st = fs.statSync(fp);
      if (st.isDirectory()) {
        walk(fp);
        continue;
      }
      if (path.basename(fp, path.extname(fp)) !== base) continue;
      if (!/\.(mp4|mkv|webm|mov|m4a|wav)$/i.test(name)) continue;
      found = loadInterviewPrepContext(path.dirname(fp));
      return;
    }
  };
  walk(root);
  return found;
}
