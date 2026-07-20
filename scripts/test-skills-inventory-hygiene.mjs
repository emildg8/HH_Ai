/**
 * Гигиена inventory Emil: drift, resumeSafe, skillsApply ⊆ letterSafe∪aliases∪stack.
 *   node scripts/test-skills-inventory-hygiene.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import drafts from '../config/hunt-track-resume-drafts.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'candidate-skills-inventory.json');
const emilPath = path.join(root, 'data-emil', 'candidate-skills-inventory.json');

function sha(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

assert.ok(fs.existsSync(dataPath), 'data/inventory');
assert.ok(fs.existsSync(emilPath), 'data-emil/inventory');
assert.equal(sha(dataPath), sha(emilPath), 'data ≡ data-emil (запусти devops-sync-skills-inventory)');

const inv = JSON.parse(fs.readFileSync(emilPath, 'utf8'));
assert.ok(inv.meta?.changelog?.length, 'changelog');
assert.ok(Array.isArray(inv.skills) && inv.skills.length >= 11, 'skills >= 11');

const letterSafe = inv.skills.filter((s) => s.letterSafe === true);
assert.ok(letterSafe.length <= 32, `letterSafe cap ~28–32, got ${letterSafe.length}`);

const resumeSafe = inv.skills.filter((s) => s.resumeSafe === true);
assert.equal(resumeSafe.length, 0, 'в этой волне resumeSafe должен остаться 0 (без HT/CV-wave)');

const universe = new Set();
for (const s of inv.skills) {
  for (const raw of [s.name, s.skill, ...(s.aliases || [])]) {
    const n = String(raw || '').toLowerCase().trim();
    if (n) universe.add(n);
  }
}
for (const p of inv.projects || []) {
  if (!p.letterSafe) continue;
  for (const raw of p.stack || []) {
    const n = String(raw || '').toLowerCase().trim();
    if (n) universe.add(n);
  }
}

function covered(name) {
  const n = String(name || '').toLowerCase().trim();
  if (!n) return true;
  if (universe.has(n)) return true;
  return [...universe].some((u) => u.includes(n) || n.includes(u));
}

const missingApply = [];
for (const [track, draft] of Object.entries(drafts.drafts || {})) {
  for (const skill of draft.skillsApply || []) {
    if (!covered(skill)) missingApply.push(`${track}:${skill}`);
  }
}
assert.deepEqual(missingApply, [], `skillsApply not in inventory letterSafe/aliases/stack: ${missingApply.join(', ')}`);

const soft = inv.projects.find((p) => p.id === 'softline-support-lead');
assert.ok(soft?.stack?.includes('Docker'), 'Softline stack: Docker (внутренние сервисы)');
assert.ok(
  /на Docker|Docker-сервис|внутренние сервисы/i.test(soft?.star?.action || ''),
  'Softline STAR: внутренние Docker-сервисы'
);
const contour = inv.projects.find((p) => p.id === 'softline-aplana-contour-integration');
assert.ok(contour?.letterSafe, 'STAR softline-aplana-contour-integration');
assert.ok(/интегрир|выкуп|ЦОД|без простоя/i.test(JSON.stringify(contour?.star || {})), 'contour STAR facts');
assert.ok(!/lion\.aplana/i.test(JSON.stringify(inv)), 'без name-drop lion.aplana в inventory');
const mfa = inv.skills.find((s) => s.name === 'MFA');
assert.ok(mfa?.letterSafe && mfa?.tracks?.includes('infra'), 'MFA letterSafe infra');
assert.equal(mfa?.resumeSafe, false, 'MFA resumeSafe остаётся false');
assert.ok(
  inv.antiPatterns?.some((a) => /стендов заказчиков|ФНС|ЦБ/i.test(a)),
  'antiPattern про стенды заказчиков Softline'
);

const sbp = inv.projects.find((p) => p.id === 'bank-sbp-l2');
assert.ok(sbp?.letterSafe, 'bank-sbp-l2');
assert.match(JSON.stringify(sbp?.star || {}), /мерчант|QR/i, 'bank-sbp STAR: мерчант/QR');
assert.ok(inv.aboutMeByTrack?.l2l3 && inv.aboutMeByTrack?.devops, 'aboutMeByTrack');

const docker = inv.skills.find((s) => s.name === 'Docker');
assert.ok(docker?.letterSafe && docker?.note, 'Docker note про Softline internal vs заказчики');

console.log('test-skills-inventory-hygiene OK');
console.log(`  skills ${inv.skills.length}, letterSafe ${letterSafe.length}, resumeSafe ${resumeSafe.length}`);
