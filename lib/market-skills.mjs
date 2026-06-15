/**
 * Рыночный бенчмарк навыков по роли (ручной импорт 2R + агрегат из очереди).
 * Advisory-слой: не влияет на assessKeywordGap / gapScore по умолчанию.
 */

import fs from 'fs';
import path from 'path';
import { ROOT, DATA_DIR, CV_DIR } from './paths.mjs';
import { extractJdKeywords, vacancyTextBlob } from './jd-keyword-extract.mjs';

const CONFIG_DIR = path.join(ROOT, 'config');
const MARKET_SKILLS_USER = path.join(CONFIG_DIR, 'market-skills.json');
const MARKET_SKILLS_EXAMPLE = path.join(CONFIG_DIR, 'market-skills.example.json');
export const MARKET_SKILLS_AGGREGATE_FILE = path.join(DATA_DIR, 'market-skills-aggregate.json');

/** @type {Record<string, string[]>} */
const SKILL_ALIASES = {
  kubernetes: ['k8s'],
  'ci/cd': ['cicd', 'ci cd'],
  postgresql: ['postgres'],
  'gitlab ci': ['gitlab'],
  prometheus: ['prom'],
  openshift: ['ocp'],
  мониторинг: ['observability', 'monitoring'],
};

function normSkillName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function skillInText(skillName, textLow) {
  const key = normSkillName(skillName);
  if (!key) return false;
  if (textLow.includes(key)) return true;
  for (const alias of SKILL_ALIASES[key] || []) {
    if (textLow.includes(alias)) return true;
  }
  return false;
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function roleConfigPath(role) {
  const id = String(role || 'devops').trim().toLowerCase();
  return path.join(CONFIG_DIR, `market-skills-${id}.json`);
}

/**
 * @param {object[]} manual
 * @param {object[]} aggregate
 */
function mergeSkillLists(manual, aggregate) {
  const byName = new Map();
  for (const raw of manual) {
    const name = String(raw?.name || '').trim();
    if (!name) continue;
    byName.set(normSkillName(name), {
      name,
      rank: Number(raw.rank) || byName.size + 1,
      frequency: raw.frequency,
      source: raw.source || 'manual',
    });
  }
  let rank = byName.size;
  for (const raw of aggregate) {
    const name = String(raw?.name || '').trim();
    if (!name) continue;
    const key = normSkillName(name);
    if (byName.has(key)) continue;
    rank += 1;
    byName.set(key, {
      name,
      rank: Number(raw.rank) || rank,
      frequency: raw.frequency,
      source: raw.source || 'aggregate',
    });
  }
  return [...byName.values()].sort((a, b) => a.rank - b.rank);
}

/**
 * @param {string} [role]
 */
export function loadMarketSkills(role = 'devops') {
  const roleId = String(role || process.env.HH_PROFILE || 'devops')
    .trim()
    .toLowerCase();

  let manual =
    readJsonSafe(MARKET_SKILLS_USER) ||
    readJsonSafe(roleConfigPath(roleId)) ||
    readJsonSafe(MARKET_SKILLS_EXAMPLE);

  if (manual && manual.role && normSkillName(manual.role) !== roleId) {
    const roleFile = readJsonSafe(roleConfigPath(roleId));
    if (roleFile) manual = roleFile;
  }

  const aggregateRoot = readJsonSafe(MARKET_SKILLS_AGGREGATE_FILE);
  const aggregateRole =
    aggregateRoot?.roles?.[roleId] ||
    (normSkillName(aggregateRoot?.role) === roleId ? aggregateRoot : null);

  const manualSkills = Array.isArray(manual?.skills) ? manual.skills : [];
  const aggregateSkills = Array.isArray(aggregateRole?.skills) ? aggregateRole.skills : [];
  const skills = mergeSkillLists(manualSkills, aggregateSkills);

  return {
    role: roleId,
    source: manual?.source || 'example',
    updatedAt: manual?.updatedAt || aggregateRole?.updatedAt || null,
    aggregateAt: aggregateRole?.updatedAt || aggregateRoot?.updatedAt || null,
    skills,
    skillCount: skills.length,
  };
}

/**
 * Синхронное чтение CV (.md / .txt) для intelligence-loop.
 */
export function readCvTextSync() {
  if (!fs.existsSync(CV_DIR)) return '';
  const parts = [];
  for (const name of fs.readdirSync(CV_DIR).sort()) {
    const lower = name.toLowerCase();
    if (!lower.endsWith('.md') && !lower.endsWith('.txt')) continue;
    const fp = path.join(CV_DIR, name);
    if (!fs.statSync(fp).isFile()) continue;
    parts.push(fs.readFileSync(fp, 'utf8'));
  }
  return parts.join('\n');
}

/**
 * @param {string} cvText
 * @param {object[]} skills
 * @param {{ topN?: number }} [opts]
 */
export function compareMarketVsCv(cvText, skills, opts = {}) {
  const topN = Number(opts.topN) > 0 ? Number(opts.topN) : skills.length;
  const slice = skills.slice(0, topN);
  const textLow = String(cvText || '').toLowerCase();
  const present = [];
  const missing = [];

  for (const s of slice) {
    const name = String(s.name || '').trim();
    if (!name) continue;
    if (skillInText(name, textLow)) present.push(name);
    else missing.push(name);
  }

  const total = slice.length || 1;
  const coveragePct = Math.round((present.length / total) * 100);
  return { present, missing, coveragePct, total, topN };
}

/**
 * @param {object} rec
 * @param {object[]} skills
 * @param {{ topN?: number }} [opts]
 */
export function compareMarketVsVacancy(rec, skills, opts = {}) {
  const topN = Number(opts.topN) > 0 ? Number(opts.topN) : 15;
  const slice = skills.slice(0, topN);
  const blob = vacancyTextBlob(rec).toLowerCase();
  const { mustHave, all } = extractJdKeywords(rec);
  const jdLabels = new Set([...mustHave, ...all].map((s) => normSkillName(s)));

  const overlap = [];
  const marketNotInJd = [];

  for (const s of slice) {
    const name = String(s.name || '').trim();
    if (!name) continue;
    const key = normSkillName(name);
    const inJd = jdLabels.has(key) || skillInText(name, blob);
    if (inJd) overlap.push(name);
    else marketNotInJd.push(name);
  }

  return {
    overlap,
    marketNotInJd,
    overlapCount: overlap.length,
    jdMustHave: mustHave,
    topN,
  };
}

/**
 * @param {string} role
 * @param {string} cvText
 * @param {object} [vacancy]
 */
export function buildMarketSkillsReport(role, cvText, vacancy = null) {
  const bundle = loadMarketSkills(role);
  const cvCompare = compareMarketVsCv(cvText, bundle.skills, { topN: 15 });
  const vacancyCompare = vacancy ? compareMarketVsVacancy(vacancy, bundle.skills) : null;
  return { bundle, cvCompare, vacancyCompare };
}
