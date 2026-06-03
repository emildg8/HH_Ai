/**
 * Регрессия качества писем по config/letter-quality-golden-set.json
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { evaluateLetterQuality } from './cover-letter-quality-scan.mjs';
import { loadPreferences } from './preferences.mjs';

const GOLDEN_FILE = path.join(ROOT, 'config', 'letter-quality-golden-set.json');

/**
 * @returns {{ version?: number, cases: object[] }}
 */
export function loadLetterQualityGoldenSet() {
  if (!fs.existsSync(GOLDEN_FILE)) {
    return { cases: [] };
  }
  const raw = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
  return {
    version: raw.version,
    cases: Array.isArray(raw.cases) ? raw.cases : [],
  };
}

/**
 * @param {object} [prefs]
 */
export function runLetterQualityGoldenRegression(prefs) {
  let p = prefs;
  if (!p) {
    try {
      p = loadPreferences();
    } catch {
      p = {};
    }
  }
  const { cases } = loadLetterQualityGoldenSet();
  /** @type {Array<{ id: string, reason: string, expected: object, got: object }>} */
  const failures = [];

  for (const c of cases) {
    const rec = {
      title: c.title || 'Вакансия',
      ...(c.record && typeof c.record === 'object' ? c.record : {}),
    };
    let letter = String(c.letter ?? '');
    const repeat = Number(c.letterRepeat);
    if (Number.isFinite(repeat) && repeat > 1) {
      letter = letter.repeat(Math.min(500, repeat));
    }
    const role = c.role || 'devops';
    const ev = evaluateLetterQuality(rec, letter, role, p);
    const exp = c.expect || {};
    const mismatch = [];
    if (exp.pass !== undefined && ev.pass !== exp.pass) {
      mismatch.push(`pass expected ${exp.pass} got ${ev.pass}`);
    }
    if (exp.rawPass !== undefined && ev.rawPass !== exp.rawPass) {
      mismatch.push(`rawPass expected ${exp.rawPass} got ${ev.rawPass}`);
    }
    if (exp.fixable !== undefined && ev.fixable !== exp.fixable) {
      mismatch.push(`fixable expected ${exp.fixable} got ${ev.fixable}`);
    }
    if (mismatch.length) {
      failures.push({
        id: String(c.id || c.title),
        reason: mismatch.join('; '),
        expected: exp,
        got: {
          pass: ev.pass,
          rawPass: ev.rawPass,
          fixable: ev.fixable,
          evalReason: ev.reason,
        },
      });
    }
  }

  return {
    ok: failures.length === 0,
    total: cases.length,
    passed: cases.length - failures.length,
    failures,
    ranAt: new Date().toISOString(),
  };
}
