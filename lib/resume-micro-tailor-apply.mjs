/**
 * Запись «О себе» на hh.ru перед откликом (лимит правок в день).
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';
import { loadCvBundle } from './cv-load.mjs';
import { assessKeywordGap } from './resume-keyword-gap.mjs';
import { buildMicroAboutText } from './resume-micro-tailor.mjs';
import { applyResumeVariantContent } from './hh-resume-editor.mjs';

const LOG_FILE = path.join(ROOT, 'data', 'resume-micro-tailor-log.json');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return { days: {} };
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
  } catch {
    return { days: {} };
  }
}

function writeLog(data) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * @param {string} [day]
 */
export function countMicroTailorEditsToday(day = todayKey()) {
  const log = readLog();
  return Number(log.days?.[day]?.count || 0);
}

/**
 * @param {object} [prefs]
 */
export function canMicroTailorToday(prefs) {
  const p = prefs || loadPreferences();
  const max = Number(p.resumeEditMaxPerDay ?? 15);
  return countMicroTailorEditsToday() < max;
}

function recordEdit(vacancyId) {
  const day = todayKey();
  const log = readLog();
  if (!log.days[day]) log.days[day] = { count: 0, ids: [] };
  log.days[day].count += 1;
  if (vacancyId) log.days[day].ids.push(String(vacancyId));
  writeLog(log);
}

/**
 * @param {import('playwright').Page} page
 * @param {object} rec
 * @param {string} resumeHash
 * @param {{ log?: (msg: string) => void, prefs?: object, force?: boolean }} [opts]
 */
export async function applyMicroAboutBeforeApply(page, rec, resumeHash, opts = {}) {
  const log = opts.log || (() => {});
  const prefs = opts.prefs || loadPreferences();
  const hash = String(resumeHash || '').trim();
  if (!hash) return { skipped: true, reason: 'нет hash резюме' };
  if (!canMicroTailorToday(prefs) && !opts.force) {
    return { skipped: true, reason: 'лимит правок резюме на сегодня' };
  }

  let cvText = '';
  try {
    const bundle = await loadCvBundle();
    cvText = bundle?.text || '';
  } catch {
    /* */
  }
  const gap = assessKeywordGap(rec, cvText);
  const minGap = Number(prefs.minKeywordGapScore ?? 40);
  const needsTailor = opts.force || gap.gapScore < minGap || gap.missing.length >= 2;
  if (!needsTailor) {
    return { skipped: true, reason: `ключи ок (${gap.gapScore}%)`, gap };
  }

  log(`[micro-tailor] «О себе» под вакансию (gap ${gap.gapScore}%, нет: ${gap.missing.slice(0, 3).join(', ') || '—'})`);
  const aboutMe = await buildMicroAboutText(rec);
  const r = await applyResumeVariantContent(page, hash, { aboutMe, log });
  if (r.aboutMe?.ok) {
    recordEdit(rec.id || rec.vacancyId);
    return { ok: true, aboutMe, gap };
  }
  return { ok: false, reason: r.aboutMe?.reason || 'не удалось сохранить', gap };
}
