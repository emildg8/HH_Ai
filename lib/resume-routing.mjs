/**
 * Подбор резюме hh.ru под вакансию: DevOps/SRE, Data Engineer, поддержка.
 * Конфиг: config/resume-routing.json (+ опционально resume-routing.local.json)
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { titleLooksTamRole, titleLooksSupportRole } from './role-classify.mjs';

const CONFIG_PATHS = [
  path.join(ROOT, 'config', 'resume-routing.local.json'),
  path.join(ROOT, 'config', 'resume-routing.json'),
];

/** @type {{ defaultRole: string, resumes: Record<string, { label: string, titleOnHh: string, titleMatch: string, hash: string }> } | null} */
let cachedConfig = null;

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @returns {{ defaultRole: string, resumes: Record<string, { label: string, titleOnHh: string, titleMatch: string, hash: string }> }}
 */
export function loadResumeRoutingConfig() {
  if (cachedConfig) return cachedConfig;

  let base = null;
  for (const p of CONFIG_PATHS) {
    const data = readJsonIfExists(p);
    if (data?.resumes) {
      base = data;
      break;
    }
  }
  if (!base) {
    base = {
      defaultRole: 'devops',
      resumes: {
        devops: {
          label: 'DevOps / SRE',
          titleOnHh: process.env.HH_PROFILE_RESUME_TITLE || 'DevOps',
          titleMatch: process.env.HH_PROFILE_RESUME_TITLE || 'DevOps',
          hash: process.env.HH_PROFILE_RESUME_HASH || '',
        },
      },
    };
  }

  const envOverride = {
    devops: process.env.HH_RESUME_HASH_DEVOPS || process.env.HH_PROFILE_RESUME_HASH,
    data: process.env.HH_RESUME_HASH_DATA,
    support: process.env.HH_RESUME_HASH_SUPPORT,
    tam: process.env.HH_RESUME_HASH_TAM,
  };
  for (const [role, hash] of Object.entries(envOverride)) {
    if (!hash || !base.resumes[role]) continue;
    base.resumes[role].hash = String(hash).trim();
  }

  cachedConfig = base;
  return base;
}

/**
 * @param {object} rec
 */
function vacancyTextBlob(rec) {
  return [
    rec?.title,
    rec?.company,
    rec?.searchQuery,
    rec?.descriptionPreview,
    rec?.descriptionForLlm,
    rec?.geminiSummary,
    ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {string} title
 */
function isSupportLeadVacancyTitle(title) {
  const t = String(title || '').toLowerCase();
  return (
    /руководитель.*поддерж|head of support|support lead|lead.*support|менеджер.*поддерж|team lead.*support/i.test(
      t
    ) && !/специалист|l2|l3/i.test(t)
  );
}

function isSupportVacancyTitle(title) {
  const t = String(title || '').toLowerCase();
  if (!t) return false;
  if (isSupportLeadVacancyTitle(t)) return false;
  if (/\bdevops\b|\bsre\b|site reliability|platform engineer/i.test(t) && !/поддержк|support|helpdesk/i.test(t)) {
    return false;
  }
  return (
    /технич.*поддерж|техническ.*поддерж|служб.*поддерж|help\s*desk|service\s*desk|service desk/i.test(t) ||
    /специалист.*поддерж|инженер.*поддерж|support engineer|support specialist/i.test(t) ||
    /(?:l2|l3).{0,12}поддерж|поддерж.{0,12}(?:l2|l3)/i.test(t) ||
    (/поддержк/i.test(t) && !/devops|sre|data engineer|дата/i.test(t))
  );
}

/**
 * @param {string} title
 * @param {string} [blob]
 */
function isDataEngineerVacancyTitle(title, blob = '') {
  const t = String(title || '').toLowerCase();
  const b = String(blob || '').toLowerCase();
  if (/\bdevops\b|\bsre\b|site reliability/i.test(t)) return false;
  if (isSupportVacancyTitle(t)) return false;
  if (
    /data engineer|data scientist|data science engineer|дата[\s-]?инжен|дата engineer/i.test(t) ||
    /\betl\b.*engineer|dwh|big data engineer/i.test(t)
  ) {
    return true;
  }
  if (/data engineer|дата[\s-]?инжен/i.test(b) && !/\bdevops\b|\bsre\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {string} title
 */
function isDevOpsOrSreVacancyTitle(title) {
  const t = String(title || '').toLowerCase();
  if (!t) return true;
  return (
    /\bdevops\b|\bsre\b|site reliability|platform engineer|инженер эксплуатации|reliability engineer/i.test(
      t
    ) ||
    /kubernetes|k8s|инфраструктур|cloud engineer|платформ/i.test(t)
  );
}

/**
 * @param {object} rec
 * @returns {'support' | 'data' | 'devops'}
 */
function isQaOrTestVacancyTitle(title) {
  const t = String(title || '').toLowerCase();
  return (
    /\bsdet\b|qa engineer|quality.*engineer|инженер.*тест|test engineer|автотест|software development engineer in test/i.test(
      t
    ) && !/\bdevops\b|\bsre\b/i.test(t)
  );
}

export function classifyVacancyResumeRole(rec) {
  const title = String(rec?.title || '');
  const blob = vacancyTextBlob(rec);

  if (titleLooksTamRole(title)) return 'tam';
  if (isSupportLeadVacancyTitle(title)) return 'support_lead';
  if (isSupportVacancyTitle(title) || titleLooksSupportRole(title)) return 'support';
  if (isDataEngineerVacancyTitle(title, blob)) return 'data';
  if (isQaOrTestVacancyTitle(title)) return 'support';
  if (isDevOpsOrSreVacancyTitle(title)) return 'devops';

  const tags = (Array.isArray(rec?.geminiTags) ? rec.geminiTags : []).join(' ').toLowerCase();
  if (/поддержк|support|helpdesk/i.test(tags) && !/devops|sre/i.test(tags)) return 'support';
  if (/data engineer|дата|etl|dwh/i.test(tags) && !/devops|sre/i.test(tags)) return 'data';

  const cfg = loadResumeRoutingConfig();
  return cfg.defaultRole === 'data' || cfg.defaultRole === 'support' ? cfg.defaultRole : 'devops';
}

/**
 * @param {object} rec
 * @returns {{
 *   role: string,
 *   label: string,
 *   title: string,
 *   hash: string,
 *   reason: string,
 * }}
 */
export function resolveResumeForVacancy(rec) {
  const cfg = loadResumeRoutingConfig();
  const role = classifyVacancyResumeRole(rec);
  const entry = cfg.resumes[role] || cfg.resumes[cfg.defaultRole] || cfg.resumes.devops;
  const title = String(entry?.titleOnHh || entry?.titleMatch || '').trim();
  const hash = String(entry?.hash || '').trim();
  const label = String(entry?.label || role).trim();

  let reason = 'по умолчанию DevOps/SRE';
  if (role === 'support') reason = 'вакансия поддержки';
  else if (role === 'tam') reason = 'вакансия TAM';
  else if (role === 'data') reason = 'вакансия Data Engineer';
  else if (isDevOpsOrSreVacancyTitle(rec?.title)) reason = 'вакансия DevOps/SRE';

  return { role, label, title, hash, reason };
}

/** Сброс кэша после правки config (тесты). */
export function resetResumeRoutingCache() {
  cachedConfig = null;
}
