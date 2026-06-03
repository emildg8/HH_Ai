/**
 * Кандидаты в letter-quality golden из очереди (слабые approved).
 *   npm run devops:suggest-letter-golden
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { ROOT } from '../lib/paths.mjs';
import { loadQueue } from '../lib/store.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { evaluateLetterQuality } from '../lib/cover-letter-quality-scan.mjs';
import { classifyVacancyResumeRole } from '../lib/resume-routing.mjs';
import { loadLetterQualityGoldenSet, runLetterQualityGoldenRegression } from '../lib/letter-quality-golden-set.mjs';

loadEnv();

const args = process.argv.slice(2);
const write = args.includes('--write');
const OUT = path.join(ROOT, 'config', 'letter-quality-golden-set.candidates.json');
const GOLDEN_FILE = path.join(ROOT, 'config', 'letter-quality-golden-set.json');
const limit = Math.max(1, Math.min(30, Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || 12)));
const existing = loadLetterQualityGoldenSet();
const existingIds = new Set(existing.cases.map((c) => String(c.id || '')));

let prefs = {};
try {
  prefs = loadPreferences();
} catch {
  prefs = {};
}

/** @type {object[]} */
const candidates = [];

for (const rec of loadQueue()) {
  if (rec.hidden) continue;
  const letter = String(rec?.coverLetter?.approvedText || '').trim();
  if (!letter || rec.coverLetter?.status !== 'approved') continue;
  const role = classifyVacancyResumeRole(rec);
  const ev = evaluateLetterQuality(rec, letter, role, prefs);
  if (ev.pass && ev.rawPass && !ev.fixable) continue;

  const id = `q-${String(rec.id || candidates.length).slice(0, 24)}`;
  const expect = {};
  if (ev.rawPass !== undefined) expect.rawPass = ev.rawPass;
  if (ev.pass !== undefined) expect.pass = ev.pass;
  if (ev.fixable !== undefined) expect.fixable = ev.fixable;

  candidates.push({
    id,
    title: String(rec.title || '').slice(0, 80),
    record: {
      title: rec.title,
      geminiSummary: rec.geminiSummary ? String(rec.geminiSummary).slice(0, 200) : undefined,
    },
    letter: letter.slice(0, 1200),
    role,
    expect,
    _meta: { vacancyId: rec.id, reason: ev.reason, letterScore10: ev.letterScore10 },
  });
  if (candidates.length >= limit) break;
}

const doc = {
  generatedAt: new Date().toISOString(),
  suggested: candidates.length,
  candidates: candidates.map(({ _meta, ...c }) => ({ ...c, meta: _meta })),
};
fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');

if (!write) {
  console.log(JSON.stringify({ ok: true, out: OUT, suggested: candidates.length }, null, 2));
  process.exit(0);
}

if (candidates.length === 0) {
  console.log(JSON.stringify({ ok: true, message: 'Нет новых кандидатов', suggested: 0 }, null, 2));
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
const cases = Array.isArray(raw.cases) ? raw.cases : [];
let added = 0;
for (const c of candidates) {
  const { _meta, ...caseRow } = c;
  if (existingIds.has(caseRow.id)) continue;
  cases.push(caseRow);
  existingIds.add(caseRow.id);
  added++;
}
raw.cases = cases;
fs.writeFileSync(GOLDEN_FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

const regression = runLetterQualityGoldenRegression(prefs);
console.log(
  JSON.stringify(
    {
      ok: regression.ok,
      added,
      out: GOLDEN_FILE,
      passed: regression.passed,
      total: regression.total,
      failures: regression.failures,
    },
    null,
    2
  )
);
process.exit(regression.ok ? 0 : 1);
