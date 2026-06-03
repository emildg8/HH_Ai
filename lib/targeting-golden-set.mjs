/**
 * Регрессия таргетинга по config/targeting-golden-set.json
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { assessVacancyForApply } from './vacancy-targeting.mjs';
import { loadPreferences } from './preferences.mjs';

const GOLDEN_FILE = path.join(ROOT, 'config', 'targeting-golden-set.json');

/**
 * @returns {{ version?: number, cases: object[] }}
 */
export function loadTargetingGoldenSet() {
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
export function runTargetingGoldenRegression(prefs) {
  let p = prefs;
  if (!p) {
    try {
      p = loadPreferences();
    } catch {
      p = {};
    }
  }
  const { cases } = loadTargetingGoldenSet();
  /** @type {Array<{ id: string, title: string, expected: boolean, got: boolean, category?: string }>} */
  const failures = [];

  for (const c of cases) {
    const rec = {
      title: c.title,
      ...(c.record && typeof c.record === 'object' ? c.record : {}),
    };
    const a = assessVacancyForApply(rec, {
      userApproved: c.userApproved === true,
      prefs: p,
    });
    const expected = Boolean(c.expect?.eligible);
    if (a.eligible !== expected) {
      failures.push({
        id: String(c.id || c.title),
        title: String(c.title || ''),
        expected,
        got: a.eligible,
        category: a.category,
        skipReason: a.skipReason,
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
