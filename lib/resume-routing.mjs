/**
 * Подбор резюме hh.ru под вакансию: DevOps/SRE, Data Engineer, поддержка.
 * Конфиг: config/resume-routing.json (+ опционально resume-routing.local.json)
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { titleLooksTamRole, titleLooksSupportRole } from './role-classify.mjs';
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { getTargetingPolicy } from './targeting-policy.mjs';

const DEVOPS_CONFIG_PATHS = [
  path.join(ROOT, 'config', 'resume-routing.local.json'),
  path.join(ROOT, 'config', 'resume-routing.json'),
];

const QA_CONFIG_PATHS = [
  path.join(ROOT, 'config', 'resume-routing.local.json'),
  path.join(ROOT, 'config', 'resume-routing-qa.local.json'),
  path.join(ROOT, 'config', 'resume-routing-qa.json'),
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

  const policy = getTargetingPolicy();
  const qaProfile =
    String(policy?.meta?.targetRole || '').toLowerCase() === 'qa' ||
    ['anastasia', 'qa'].includes(String(process.env.HH_PROFILE || '').toLowerCase());

  const paths = qaProfile ? QA_CONFIG_PATHS : DEVOPS_CONFIG_PATHS;

  let base = null;
  for (const p of paths) {
    const data = readJsonIfExists(p);
    if (!data?.resumes) continue;
    if (!base) {
      base = data;
      continue;
    }
    for (const [role, entry] of Object.entries(data.resumes)) {
      const prev = base.resumes[role] || {};
      base.resumes[role] = {
        ...prev,
        ...entry,
        hash: String(entry?.hash || prev.hash || '').trim() || prev.hash || '',
      };
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
    infra: process.env.HH_RESUME_HASH_INFRA,
    data: process.env.HH_RESUME_HASH_DATA,
    support: process.env.HH_RESUME_HASH_SUPPORT,
    tam: process.env.HH_RESUME_HASH_TAM,
    qa_lead: process.env.HH_PROFILE_RESUME_HASH,
    qa_senior: process.env.HH_RESUME_HASH_SENIOR || process.env.HH_PROFILE_RESUME_HASH,
    qa_aqa: process.env.HH_RESUME_HASH_AQA,
    qa_manual: process.env.HH_RESUME_HASH_MANUAL || process.env.HH_PROFILE_RESUME_HASH,
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
    /сопровождени|сопровождению|сопровождения|администратор.*сопровожд/i.test(t) ||
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
  if (/\bdevops\b|\bmlops\b|\bsre\b/i.test(t) && !/data engineer|data science/i.test(t)) return false;
  // «Data Engineer (SRE)» — data, не devops из-за скобок
  if (/data engineer|data science engineer|data scientist|дата[\s-]?инжен|\bdwh\b|\betl\b.*engineer/i.test(t)) {
    return true;
  }
  if (/\bsre\b|site reliability/i.test(t)) return false;
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
export function isDevOpsOrSreVacancyTitle(title) {
  const t = String(title || '').toLowerCase();
  if (!t) return true;
  if (/data engineer|data science|data scientist|дата[\s-]?инжен/i.test(t)) return false;
  return (
    /\bdevops\b|\bsre\b|\bmlops\b|\bdevsecops\b|site reliability|platform engineer|observability engineer|\bobservability\b|reliability engineer|инженер эксплуатации/i.test(
      t
    ) ||
    /kubernetes|k8s|инфраструктур|cloud engineer|платформ/i.test(t)
  );
}

export function isQaProfileActive() {
  const policy = getTargetingPolicy();
  return (
    String(policy?.meta?.targetRole || '').toLowerCase() === 'qa' ||
    ['anastasia', 'qa'].includes(String(process.env.HH_PROFILE || '').toLowerCase())
  );
}

function isQaVacancyTitle(title) {
  const t = String(title || '').toLowerCase();
  return (
    /\bqa\b|aqa|тестиров|quality|sdet|test\s+lead|автоматизац\w*\s+тест|инженер\s+по\s+тест/i.test(
      t
    ) && !/\bdevops\b|\bsre\b/i.test(t)
  );
}

function isQaOrTestVacancyTitle(title) {
  return isQaVacancyTitle(title);
}

export function classifyVacancyResumeRole(rec) {
  const title = String(rec?.title || '');
  const blob = vacancyTextBlob(rec);

  if (isQaProfileActive()) {
    const track = classifyVacancyHuntTrack(rec);
    if (track === 'qa-lead') return 'qa_lead';
    if (track === 'aqa-ai-assist') return 'qa_aqa';
    if (track === 'senior-qa') return 'qa_senior';
    if (track === 'manual-qa') return 'qa_manual';
    if (isQaVacancyTitle(title)) return 'qa_senior';
    const cfg = loadResumeRoutingConfig();
    return cfg.defaultRole || 'qa_lead';
  }

  if (titleLooksTamRole(title)) return 'tam';
  if (isSupportLeadVacancyTitle(title)) return 'support_lead';
  if (isDataEngineerVacancyTitle(title, blob)) return 'data';
  // DevOps/SRE/MLOps до support — «Системный инженер/DevOps» не уходит в L2
  if (isDevOpsOrSreVacancyTitle(title)) return 'devops';
  if (isSupportVacancyTitle(title) || titleLooksSupportRole(title)) return 'support';
  if (isQaOrTestVacancyTitle(title)) return 'devops';

  // Системный инженер / сисадмин / виртуализация → CV infra (не default DevOps).
  // DevOps/SRE в title уже отсечены выше — «DevOps (VMware)» остаётся devops.
  // Не вызывать classifyVacancyHuntTrack здесь — там снова resolveResume → цикл.
  if (
    /системный\s+инженер|system engineer|системный\s+администратор|sysadmin|system administrator|linux\s+admin/i.test(
      title
    ) ||
    /виртуализац|vmware|hyper-?\s*v|proxmox|\besxi\b/i.test(title)
  ) {
    return 'infra';
  }

  const tags = (Array.isArray(rec?.geminiTags) ? rec.geminiTags : []).join(' ').toLowerCase();
  if (/поддержк|support|helpdesk/i.test(tags) && !/devops|sre/i.test(tags)) return 'support';
  if (/data engineer|дата|etl|dwh/i.test(tags) && !/devops|sre/i.test(tags)) return 'data';
  if (/\binfra\b|инфраструктур|системн\w*\s+инжен/i.test(tags)) return 'infra';

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
  const override = rec?.resumeRoutingOverride;
  if (override && (override.hash || override.title || override.role)) {
    return {
      role: String(override.role || 'qa_manual').trim(),
      label: String(override.reason || 'ME basket').trim(),
      title: String(override.title || '').trim(),
      hash: String(override.hash || '').trim(),
      reason: 'ME basket override',
    };
  }

  const cfg = loadResumeRoutingConfig();
  const role = classifyVacancyResumeRole(rec);
  const entry =
    cfg.resumes[role] ||
    cfg.resumes[cfg.defaultRole] ||
    cfg.resumes.devops ||
    Object.values(cfg.resumes)[0];
  const title = String(entry?.titleOnHh || entry?.titleMatch || '').trim();
  const hash = String(entry?.hash || '').trim();
  const label = String(entry?.label || role).trim();

  let reason = 'по умолчанию DevOps/SRE';
  if (role === 'qa_lead') reason = 'маршрут QA Lead';
  else if (role === 'qa_aqa') reason = 'маршрут AQA / AI-assisted';
  else if (role === 'qa_senior') reason = 'маршрут Senior QA';
  else if (role === 'qa_manual') reason = 'маршрут Manual QA';
  else if (role === 'support') reason = 'вакансия поддержки';
  else if (role === 'infra') reason = 'вакансия системного инженера / infra';
  else if (role === 'tam') reason = 'вакансия TAM';
  else if (role === 'data') reason = 'вакансия Data Engineer';
  else if (isDevOpsOrSreVacancyTitle(rec?.title)) reason = 'вакансия DevOps/SRE';

  return { role, label, title, hash, reason };
}

/** Сброс кэша после правки config (тесты). */
export function resetResumeRoutingCache() {
  cachedConfig = null;
}
