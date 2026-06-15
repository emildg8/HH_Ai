/**
 * Агрегация частоты навыков из файлов очереди (без 2R).
 *   npm run devops:aggregate-market-skills
 *   npm run devops:aggregate-market-skills -- --role=devops
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR, ROOT } from '../lib/paths.mjs';
import { loadAnalyticsUnionRecords } from '../lib/queue-aggregate.mjs';
import { extractSkillsFromBlob, vacancyTextBlob } from '../lib/jd-keyword-extract.mjs';
import { MARKET_SKILLS_AGGREGATE_FILE } from '../lib/market-skills.mjs';

function arg(name) {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : '';
}

function isDevOpsLike(rec) {
  const t = `${rec?.title || ''} ${vacancyTextBlob(rec)}`.toLowerCase();
  return /devops|sre|platform engineer|инженер devops|devops-инженер|платформ|kubernetes|k8s|ci\/cd/.test(
    t
  );
}

function aggregateRole(records, roleId) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  let scanned = 0;

  for (const rec of records) {
    if (roleId === 'devops' && !isDevOpsLike(rec)) continue;
    scanned += 1;
    const skills = extractSkillsFromBlob(vacancyTextBlob(rec));
    for (const name of skills) {
      const key = name.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const max = Math.max(...counts.values(), 1);
  const skills = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      rank: i + 1,
      frequency: Math.round((count / max) * 100) / 100,
      count,
    }));

  return {
    role: roleId,
    source: 'queue-aggregate',
    updatedAt: new Date().toISOString().slice(0, 10),
    scannedVacancies: scanned,
    skills,
  };
}

function main() {
  const role = (arg('role') || process.env.HH_PROFILE || 'devops').trim().toLowerCase();
  const union = loadAnalyticsUnionRecords();
  const roleData = aggregateRole(union.records, role);

  let root = { updatedAt: new Date().toISOString(), roles: {} };
  if (fs.existsSync(MARKET_SKILLS_AGGREGATE_FILE)) {
    try {
      root = JSON.parse(fs.readFileSync(MARKET_SKILLS_AGGREGATE_FILE, 'utf8'));
      if (!root.roles) root.roles = {};
    } catch {
      root = { updatedAt: new Date().toISOString(), roles: {} };
    }
  }
  root.updatedAt = new Date().toISOString();
  root.roles[role] = roleData;

  fs.mkdirSync(path.dirname(MARKET_SKILLS_AGGREGATE_FILE), { recursive: true });
  fs.writeFileSync(MARKET_SKILLS_AGGREGATE_FILE, `${JSON.stringify(root, null, 2)}\n`, 'utf8');

  console.log(
    `[aggregate-market-skills] role=${role} scanned=${roleData.scannedVacancies} skills=${roleData.skills.length}`
  );
  console.log(`  → ${path.relative(ROOT, MARKET_SKILLS_AGGREGATE_FILE)}`);
  if (roleData.skills.length) {
    console.log(`  top: ${roleData.skills.slice(0, 8).map((s) => s.name).join(', ')}`);
  }
}

main();
