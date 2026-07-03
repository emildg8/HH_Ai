/**
 * QA hunt-track resume drafts — load config and build CV text for fit checks.
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import {
  getEmploymentConditionsDefaults,
  resolveSalaryRangeForHh,
} from './resume-employment-conditions.mjs';

const CONFIG_FILE = path.join(ROOT, 'config', 'hunt-track-resume-drafts-qa.json');

let cachedConfig = null;

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @returns {object | null}
 */
export function loadQaDraftsConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = readJsonSafe(CONFIG_FILE);
  return cachedConfig;
}

/**
 * @param {string} trackId
 * @returns {object | null}
 */
export function getQaDraft(trackId) {
  const id = String(trackId || '').trim();
  if (!id) return null;
  const cfg = loadQaDraftsConfig();
  return cfg?.drafts?.[id] ?? null;
}

/**
 * @param {string} trackId
 * @returns {object}
 */
export function getDraftForQaTrack(trackId) {
  const draft = getQaDraft(trackId);
  if (!draft) throw new Error(`Unknown QA hunt track draft: ${trackId}`);
  return draft;
}

/**
 * @param {string[]} list
 * @returns {string[]}
 */
function normalizeSkillNames(list) {
  const out = [];
  const seen = new Set();
  for (const raw of list || []) {
    const skill = String(raw || '').trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

/**
 * @param {string} skill
 */
function isPlaywrightPetSkill(skill) {
  const value = String(skill || '').toLowerCase();
  if (!value.includes('playwright')) return false;
  return value.includes('pet') || value.includes('2026');
}

/**
 * @param {string} a
 * @param {string} b
 */
function skillsMatchLoose(a, b) {
  const left = String(a || '').toLowerCase().trim();
  const right = String(b || '').toLowerCase().trim();
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

/**
 * @param {string} trackId
 * @returns {Array<{index:number, employerKey:string, text:string}>}
 */
export function getQaExperienceEntriesForTrack(trackId) {
  const draft = getDraftForQaTrack(trackId);
  if (Array.isArray(draft?.experienceEntries) && draft.experienceEntries.length) {
    return draft.experienceEntries
      .map((entry) => ({
        index: Number(entry?.index ?? 0),
        employerKey: String(entry?.employerKey || ''),
        text: String(entry?.text || '').trim(),
      }))
      .filter((entry) => entry.text);
  }
  const legacy = String(draft?.experienceEntry0 || '').trim();
  return legacy ? [{ index: 0, employerKey: 'nda-bank', text: legacy }] : [];
}

/**
 * @param {string} trackId
 * @returns {string}
 */
export function getQaExperienceEntry0ForTrack(trackId) {
  const entries = getQaExperienceEntriesForTrack(trackId);
  return String(entries[0]?.text || '').trim();
}

/**
 * @param {string} trackId
 * @returns {string[]}
 */
export function getQaSkillsForTrackApply(trackId) {
  const draft = getDraftForQaTrack(trackId);
  const explicitSkills = normalizeSkillNames(draft?.skillsApply || []);
  const highlights = Array.isArray(draft?.skillsHighlight) ? draft.skillsHighlight : [];

  const skillSafety = highlights
    .map((row) => ({
      name: String(row?.name || '').trim(),
      resumeSafe: row?.resumeSafe !== false,
    }))
    .filter((row) => row.name);

  const hasSafetyHints = skillSafety.length > 0;
  const explicitlyResumeSafePlaywright = skillSafety.some(
    (row) => row.resumeSafe && row.name.toLowerCase().includes('playwright')
  );

  if (explicitSkills.length) {
    return explicitSkills.filter((skill) => {
      if (isPlaywrightPetSkill(skill) && !explicitlyResumeSafePlaywright) return false;
      if (!hasSafetyHints) return true;
      const matched = skillSafety.find((row) => skillsMatchLoose(row.name, skill));
      if (!matched) return true;
      return matched.resumeSafe;
    });
  }

  return normalizeSkillNames(
    skillSafety.filter((row) => row.resumeSafe).map((row) => row.name)
  ).filter((skill) => {
    if (isPlaywrightPetSkill(skill)) {
      return explicitlyResumeSafePlaywright;
    }
    return true;
  });
}

/**
 * @param {string} canonical
 * @param {string[]} gotSkills
 */
export function skillVerifiedOnHh(canonical, gotSkills) {
  const got = (gotSkills || []).map((s) => String(s || '').toLowerCase());
  const key = String(canonical || '').toLowerCase();
  const aliases = {
    'ci/cd': ['ci/cd', 'gitlab ci', 'jenkins', 'devops', 'git'],
    'gitlab ci': ['gitlab ci', 'jenkins', 'ci/cd', 'devops'],
    playwright: ['playwright', 'автоматизация тестирования'],
  };
  const probes = aliases[key] || [key];
  return probes.some((probe) => got.some((item) => item.includes(probe) || probe.includes(item)));
}

/**
 * @param {object} draft
 * @returns {string}
 */
export function buildDraftCvText(draft) {
  if (!draft) return '';
  const parts = [];
  if (draft.aboutMe) parts.push(String(draft.aboutMe).trim());
  if (Array.isArray(draft.experienceEntries)) {
    for (const entry of draft.experienceEntries) {
      if (entry?.text) parts.push(String(entry.text).trim());
    }
  }
  if (Array.isArray(draft.skillsApply) && draft.skillsApply.length) {
    parts.push(draft.skillsApply.join(', '));
  }
  return parts.filter(Boolean).join('\n\n');
}

/**
 * Условия занятости для QA-трека (зарплата, удалёнка, командировки).
 * @param {string} trackId
 */
export function buildConditionsPayloadForQaTrack(trackId) {
  const draft = getDraftForQaTrack(trackId);
  const cfg = loadQaDraftsConfig();
  const defaults = {
    ...getEmploymentConditionsDefaults(),
    ...(cfg?.meta?.employmentConditionsDefaults || {}),
  };
  const rawSalary = draft?.salaryRange;
  return {
    salaryRange: resolveSalaryRangeForHh(rawSalary),
    workFormat: draft?.workFormat || { remote: true, labelRu: 'Удалённая работа' },
    employmentTypeRu: defaults.employmentTypeRu,
    commuteTimeRu: defaults.commuteTimeRu,
    businessTripsMode: defaults.businessTripsMode,
    businessTripsLabelRu: defaults.businessTripsLabelRu,
  };
}
