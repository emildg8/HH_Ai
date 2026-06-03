/**
 * Кандидаты в golden set из очереди (rejected + false positives).
 *
 *   node scripts/suggest-targeting-golden-from-rejected.mjs
 *   node scripts/suggest-targeting-golden-from-rejected.mjs --write --limit=5
 *   npm run devops:suggest-targeting-golden
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { ROOT } from '../lib/paths.mjs';
import { loadQueue } from '../lib/store.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import {
  loadTargetingGoldenSet,
  runTargetingGoldenRegression,
} from '../lib/targeting-golden-set.mjs';
import { falsePositiveBucketLabel } from '../lib/false-positive-analytics.mjs';

loadEnv();

const GOLDEN_FILE = path.join(ROOT, 'config', 'targeting-golden-set.json');
const CANDIDATES_FILE = path.join(ROOT, 'config', 'targeting-golden-set.candidates.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const limit = Math.max(1, Math.min(20, Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || 8)));

let prefs = {};
try {
  prefs = loadPreferences();
} catch {
  prefs = {};
}

const rejected = loadQueue().filter((x) => x.status === 'rejected' && !x.hidden);
const existing = loadTargetingGoldenSet();
const existingIds = new Set(existing.cases.map((c) => String(c.id || '')));

function slugId(rec, prefix) {
  const base = String(rec.title || rec.id || 'case')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${prefix}-${base}`.slice(0, 48);
}

function recordSlice(rec) {
  const out = {};
  if (rec.workFormatLine) out.workFormatLine = rec.workFormatLine;
  if (rec.descriptionPreview) {
    out.descriptionPreview = String(rec.descriptionPreview).slice(0, 280);
  }
  if (rec.geminiTags?.length) out.geminiTags = rec.geminiTags.slice(0, 6);
  return out;
}

/** @type {object[]} */
const candidates = [];
const seenTitles = new Set();

function pushCandidate(c) {
  const key = `${c.expect?.eligible}::${String(c.title || '').toLowerCase()}`;
  if (seenTitles.has(key)) return;
  if (existingIds.has(c.id)) return;
  seenTitles.add(key);
  candidates.push(c);
}

// False positives: вручную отклонили, но таргетинг eligible
for (const rec of rejected) {
  const a = assessVacancyForApply(rec, { userApproved: false, prefs });
  if (!a.eligible) continue;
  pushCandidate({
    id: slugId(rec, 'fp'),
    title: String(rec.title || '').slice(0, 120),
    record: recordSlice(rec),
    expect: { eligible: true },
    _meta: { source: 'false-positive', bucket: falsePositiveBucketLabel(rec) },
  });
  if (candidates.length >= limit * 2) break;
}

// True negatives: корректно отклонённые off-target (по skipReason)
const tnByReason = new Map();
for (const rec of rejected) {
  const a = assessVacancyForApply(rec, { userApproved: false, prefs });
  if (a.eligible) continue;
  const reason = String(a.skipReason || a.category || 'other').slice(0, 60);
  if (tnByReason.has(reason)) continue;
  tnByReason.set(reason, rec);
  pushCandidate({
    id: slugId(rec, 'tn'),
    title: String(rec.title || '').slice(0, 120),
    record: recordSlice(rec),
    expect: { eligible: false },
    _meta: { source: 'true-negative', skipReason: a.skipReason, category: a.category },
  });
}

const picked = candidates.slice(0, limit);
const out = {
  ok: true,
  rejectedScanned: rejected.length,
  suggested: picked.length,
  candidates: picked,
};

const candidatesDoc = {
  generatedAt: new Date().toISOString(),
  rejectedScanned: rejected.length,
  suggested: picked.length,
  candidates: picked.map(({ _meta, ...row }) => ({ ...row, meta: _meta })),
};
fs.writeFileSync(CANDIDATES_FILE, `${JSON.stringify(candidatesDoc, null, 2)}\n`, 'utf8');

if (!write) {
  console.log(JSON.stringify({ ...out, candidatesFile: CANDIDATES_FILE }, null, 2));
  process.exit(0);
}

if (picked.length === 0) {
  console.log(JSON.stringify({ ok: true, message: 'Нет новых кандидатов', suggested: 0 }, null, 2));
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
const cases = Array.isArray(raw.cases) ? raw.cases : [];
let added = 0;
for (const c of picked) {
  const { _meta, ...caseRow } = c;
  if (existingIds.has(caseRow.id)) continue;
  cases.push(caseRow);
  existingIds.add(caseRow.id);
  added++;
}
raw.cases = cases;
fs.writeFileSync(GOLDEN_FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

const regression = runTargetingGoldenRegression(prefs);
console.log(
  JSON.stringify(
    { ok: regression.ok, added, total: regression.total, passed: regression.passed, failures: regression.failures },
    null,
    2
  )
);
process.exit(regression.ok ? 0 : 1);
