/**
 * Базовая проверка качества сопроводительного перед авто-откликом.
 */

import { auditText } from './ai-writing-audit.mjs';
import { assessLetterVacancyCoherence } from './letter-vacancy-coherence.mjs';
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { hasStaleCvLetterFraming, hasL2l3OverqualifiedOpening, hasDevopsLeadershipOverqual } from './letter-cv-framing.mjs';
import { detectJdRequirementParroting } from './letter-jd-parroting.mjs';
import { detectWeakLetterFraming, sanitizeCoverLetterRuTerms, detectNicheTitleGap, detectWrongGovEmployerFraming, detectWorkFormatLetterMismatch, detectQaIcLeadTone, detectQaCursorLlmNoise } from './letter-ru-sanitize.mjs';
import { assessQaLetterPersona } from './qa-letter-persona.mjs';
import { assessLetterDomainFraming, assessQaAutomationHonesty } from './letter-domain-framing.mjs';
import {
  detectJuniorStretchLetter,
  detectInformalBrandGreeting,
  detectDevopsDbFirstFraming,
} from './letter-mid-quality.mjs';
import { detectL2ToneDevopsOpening, detectMerchantLeadDevopsOpening } from './letter-framing-router.mjs';

const PLACEHOLDER_RE =
  /\b(?:todo|заполнит[еь]|вставьт[еь]|текст\s+письма|your\s+name|company\s+name|название\s+компании)\b|[{[]\s*(?:company|name|vacancy|role)\s*[}\]]|\{\{\s*ROLE\s*\}\}/i;

/** @type {Record<string, RegExp>} */
export const ROLE_KEYWORDS = {
  devops: /\bdevops\b|\bsre\b|kubernetes|k8s|docker|linux|terraform|ansible|grafana|ci\/cd|инфраструктур/i,
  support: /поддержк|helpdesk|service\s*desk|sla|инцидент|\bl2\b|\bl3\b|эксплуатац/i,
  data: /data\s*engineer|etl|dwh|big\s*data|airflow|clickhouse|пайплайн|аналитическ/i,
  tam: /technical\s+account|tam|клиент|сопровождени/i,
  dba: /\bdba\b|mongodb|postgres|oracle|баз\s+данн|администратор\s+бд/i,
  platform: /platform|openshift|kubernetes|\bk8s\b/i,
  qa: /\bqa\b|aqa|тестиров|quality assurance|sdet|автоматизац\w*\s+тест|test\s+lead/i,
};

const GENERIC_ONLY_RE =
  /^(?:здравствуйте|добрый\s+день)[!.]?\s*(?:откликаюсь|готов\s+обсудить|интересует\s+ваканси)/i;

/**
 * @param {string} role
 * @returns {RegExp|undefined}
 */
export function getRoleKeywordPattern(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'qa_lead' || r === 'qa' || r.startsWith('qa_')) return ROLE_KEYWORDS.qa;
  return ROLE_KEYWORDS[r];
}

const GENERIC_HR_RE =
  /командный игрок|стрессоустойчив|в связи с вышеизложенным|осуществлял|является ключевым|динамичн(?:ая|ую) компани/i;

const JOB_RECAP_VACANCY_REQUIRES_RE = /ваша\s+вакансия.{0,160}требует/i;
const JOB_REQUIRES_EXPERIENCE_RE = /требует\s+опыт/i;
const JOB_RECAP_CANDIDATE_CTX_RE = /\b(?:мой\s+опыт|откликаюсь|по\s+опыту)\b/i;
const VACANCY_SALARY_RANGE_IN_LETTER_RE = /(?:зарплат\w*|оплат\w*|доход\w*)?.{0,24}(?:от\s+)?[\d\s]{4,}(?:до|–|-)\s*[\d\s]{4,}\s*₽/i;
const CANDIDATE_METRIC_CTX_RE =
  /\b(?:мой\s+опыт|по\s+опыту|у\s+меня|\d+\s*\+?\s*лет|\d+\s*%|сократил|увеличил|7000\+|обращени|инцидент|mttr|sla)\b/i;

/**
 * @param {string} [salaryRaw]
 * @returns {number[]}
 */
export function extractSalaryAmounts(salaryRaw) {
  const nums = String(salaryRaw || '').match(/\d[\d\s]*/g) || [];
  return nums
    .map((n) => parseInt(n.replace(/\s/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n >= 1000);
}

/**
 * @param {string} text
 * @param {string} [salaryRaw]
 */
export function letterContainsVacancySalaryAmounts(text, salaryRaw) {
  const amounts = extractSalaryAmounts(salaryRaw);
  if (!amounts.length) return false;
  const norm = String(text || '').replace(/\s/g, '');
  return amounts.some((amt) => norm.includes(String(amt)));
}

/**
 * @param {string} text
 * @param {object} rec
 */
export function letterDigitsAreVacancySalaryOnly(text, rec) {
  if (!/\d/.test(text)) return false;
  if (CANDIDATE_METRIC_CTX_RE.test(text)) return false;

  const salaryRaw = rec?.salaryRaw;
  const hasSalaryRange =
    VACANCY_SALARY_RANGE_IN_LETTER_RE.test(text) && letterContainsVacancySalaryAmounts(text, salaryRaw);
  if (!hasSalaryRange && !letterContainsVacancySalaryAmounts(text, salaryRaw)) return false;

  const digitChunks = String(text).match(/\d[\d\s]*/g) || [];
  const salaryAmounts = extractSalaryAmounts(salaryRaw);
  if (!digitChunks.length || !salaryAmounts.length) return hasSalaryRange;

  return digitChunks.every((chunk) => {
    const val = parseInt(chunk.replace(/\s/g, ''), 10);
    return Number.isFinite(val) && salaryAmounts.includes(val);
  });
}

/**
 * @param {string} text
 * @param {object} rec
 */
export function letterHasCandidateMetric(text, rec) {
  if (!/\d/.test(text)) return false;
  if (letterDigitsAreVacancySalaryOnly(text, rec)) return false;
  return true;
}

/**
 * @param {string} text
 * @param {object} rec
 */
export function detectJobRecap(text, rec) {
  if (JOB_RECAP_VACANCY_REQUIRES_RE.test(text)) {
    return {
      recap: true,
      reason: 'пересказ вакансии без фактов кандидата: «ваша вакансия … требует»',
    };
  }

  if (
    JOB_REQUIRES_EXPERIENCE_RE.test(text) &&
    (letterContainsVacancySalaryAmounts(text, rec?.salaryRaw) ||
      VACANCY_SALARY_RANGE_IN_LETTER_RE.test(text)) &&
    !JOB_RECAP_CANDIDATE_CTX_RE.test(text)
  ) {
    return { recap: true, reason: 'пересказ требований вакансии без фактов кандидата' };
  }

  return { recap: false, reason: null };
}

/**
 * @param {object} rec
 * @param {string} letter
 * @param {string} resumeRole
 * @param {object} [prefs]
 */
export function assessLetterQuality(rec, letter, resumeRole, prefs = {}) {
  const text = String(letter || '').replace(/\s+/g, ' ').trim();
  const huntTrack = rec?.huntTrack || classifyVacancyHuntTrack(rec);
  const minLen = Number(prefs.batchLetterMinLength || 90);
  const maxLen = Number(prefs.batchLetterMaxLength || 2600);
  const requireRoleKeywords = prefs.batchLetterRequireRoleKeywords !== false;
  const requireMetric = prefs.batchLetterRequireMetric === true;

  if (!text) return { pass: false, reason: 'письмо пустое', score: 0 };
  if (text.length < minLen) {
    return { pass: false, reason: `письмо слишком короткое (${text.length} < ${minLen})`, score: 0 };
  }
  if (text.length > maxLen) {
    return { pass: false, reason: `письмо слишком длинное (${text.length} > ${maxLen})`, score: 0 };
  }
  if (PLACEHOLDER_RE.test(text)) {
    return { pass: false, reason: 'письмо содержит плейсхолдер/черновик', score: 0 };
  }

  const junior = detectJuniorStretchLetter(text);
  if (!junior.ok) {
    return { pass: false, reason: junior.reason, score: 0, juniorStretch: true };
  }
  const greeting = detectInformalBrandGreeting(rec, text);
  if (!greeting.ok) {
    return { pass: false, reason: greeting.reason, score: 0, informalGreeting: true };
  }
  const dbFirst = detectDevopsDbFirstFraming(rec, text);
  if (!dbFirst.ok) {
    return { pass: false, reason: dbFirst.reason, score: 0, devopsDbFirst: true };
  }
  const l2Tone = detectL2ToneDevopsOpening(rec, text);
  if (!l2Tone.ok) {
    return { pass: false, reason: l2Tone.reason, score: 0, l2ToneOpening: true };
  }
  const merchantLead = detectMerchantLeadDevopsOpening(rec, text);
  if (!merchantLead.ok) {
    return {
      pass: false,
      reason: merchantLead.reason,
      score: 0,
      merchantLeadOpening: true,
    };
  }

  if ((huntTrack === 'devops' || huntTrack === 'infra') && hasStaleCvLetterFraming(text)) {
    return {
      pass: false,
      reason: 'устаревший L2-framing (7000+ у Softline или L2/SL2 вместо DevOps)',
      score: 0,
    };
  }

  const titleBlob = String(rec?.title || '');
  const isSreTitle = /\bsre\b|site reliability|надёжност/i.test(titleBlob);
  if (isSreTitle && /7000\s*\+/i.test(text)) {
    return {
      pass: false,
      reason: 'SRE: запрещён тикетный объём 7000+ (звучит как L2, не надёжность)',
      score: 0,
    };
  }
  if (
    (huntTrack === 'devops' || huntTrack === 'infra' || isSreTitle) &&
    /playwright|node\.js/i.test(text) &&
    !/тест|qa|sdet|бот|автоматизац\w*\s+тест/i.test(
      `${titleBlob} ${String(rec?.descriptionPreview || '').slice(0, 240)}`
    )
  ) {
    return {
      pass: false,
      reason: 'Playwright/Node.js в письме вне контекста вакансии',
      score: 0,
    };
  }

  if (
    (huntTrack === 'l2l3' ||
      huntTrack === 'infra' ||
      resumeRole === 'support' ||
      resumeRole === 'infra') &&
    resumeRole !== 'support_lead' &&
    hasL2l3OverqualifiedOpening(text)
  ) {
    return {
      pass: false,
      reason: 'L2/L3/infra: overqualified лид (14+/7000+/руководство в первых предложениях)',
      score: 0,
    };
  }

  if ((huntTrack === 'devops' || resumeRole === 'devops') && hasDevopsLeadershipOverqual(text)) {
    return {
      pass: false,
      reason: 'DevOps IC: «руководил 20+» / лид-команда — overqualified для mid-эксплуатации',
      score: 0,
    };
  }

  const formatMismatch = detectWorkFormatLetterMismatch(rec, text);
  if (!formatMismatch.ok) {
    return {
      pass: false,
      reason: formatMismatch.reason || 'письмо: удалёнка при гибрид/офис JD',
      score: 0,
      workFormatMismatch: true,
    };
  }

  if (prefs.batchLetterRequireVacancyCoherence !== false) {
    const coherence = assessLetterVacancyCoherence(rec, text);
    if (!coherence.pass) {
      return {
        pass: false,
        reason: coherence.reason || 'роль в письме не совпадает с вакансией',
        score: 0,
        letterRoleMismatch: true,
      };
    }
  }

  const jobRecap = detectJobRecap(text, rec);
  if (jobRecap.recap) {
    return { pass: false, reason: jobRecap.reason || 'пересказ вакансии без фактов кандидата', score: 0 };
  }

  const jdParrot = detectJdRequirementParroting(text);
  if (jdParrot.parroting) {
    return { pass: false, reason: jdParrot.reason || 'пересказ требований вакансии', score: 0 };
  }

  const framingRaw = detectWeakLetterFraming(text);
  if (!framingRaw.ok) {
    return { pass: false, reason: framingRaw.reason || 'слабый framing письма', score: 0 };
  }
  const framing = detectWeakLetterFraming(sanitizeCoverLetterRuTerms(text));
  if (!framing.ok) {
    return { pass: false, reason: framing.reason || 'слабый framing письма', score: 0 };
  }

  const niche = detectNicheTitleGap(rec, text);
  if (!niche.ok) {
    return { pass: false, reason: niche.reason || 'ниша из заголовка не в письме', score: 0 };
  }

  const govFrame = detectWrongGovEmployerFraming(rec, text);
  if (!govFrame.ok) {
    return { pass: false, reason: govFrame.reason || 'чужая госкорпорация в письме', score: 0 };
  }

  const domainFrame = assessLetterDomainFraming(rec, text);
  if (!domainFrame.pass) {
    return {
      pass: false,
      reason: domainFrame.reason || 'домен JD ≠ framing письма',
      score: 0,
      domainMismatch: true,
    };
  }

  const autoHonesty = assessQaAutomationHonesty(rec, text);
  if (!autoHonesty.pass) {
    return {
      pass: false,
      reason: autoHonesty.reason || 'QA Automation honesty gap',
      score: 0,
      automationHonestyGap: true,
    };
  }

  const icLead = detectQaIcLeadTone(rec, text, huntTrack);
  if (!icLead.ok) {
    return { pass: false, reason: icLead.reason || 'QA IC lead-tone', score: 0 };
  }

  const cursorNoise = detectQaCursorLlmNoise(rec, text);
  if (!cursorNoise.ok) {
    return { pass: false, reason: cursorNoise.reason || 'Cursor/LLM noise', score: 0 };
  }

  const qaPersona = assessQaLetterPersona(rec, text, resumeRole);
  if (!qaPersona.pass) {
    return {
      pass: false,
      reason: qaPersona.reason || 'QA persona mismatch',
      score: 0,
      qaPersonaMismatch: true,
    };
  }

  let score = 0;
  if (letterHasCandidateMetric(text, rec)) score += 2;
  if (text.length >= 280) score += 1;
  if (/\b(отклик|позици|ваканси|готов|интересн)\b/i.test(text)) score += 1;

  if (requireMetric && !letterHasCandidateMetric(text, rec)) {
    return { pass: false, reason: 'нет цифр/метрик из опыта', score };
  }

  if (requireRoleKeywords) {
    const roleRe = getRoleKeywordPattern(resumeRole);
    if (roleRe && !roleRe.test(text)) {
      const titleBlob = [
        rec?.title,
        rec?.geminiSummary,
        ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
      ]
        .filter(Boolean)
        .join(' ');
      if (roleRe.test(titleBlob)) {
        return { pass: false, reason: 'письмо не отражает профиль роли вакансии', score };
      }
    }
  }

  if (
    GENERIC_ONLY_RE.test(text) &&
    text.length < 200 &&
    !/\b(linux|docker|kubernetes|devops|sql|инцидент|etl|поддержк|\d)\b/i.test(text)
  ) {
    return { pass: false, reason: 'слишком общее письмо без фактов', score };
  }

  if (GENERIC_HR_RE.test(text)) {
    return { pass: false, reason: 'шаблонные HR-фразы без фактов', score };
  }

  const maxAi = Number(prefs.batchLetterMaxAiScore ?? 0);
  if (maxAi > 0) {
    const ai = auditText(text, { maxScore: maxAi });
    if (!ai.pass) {
      return {
        pass: false,
        reason: `AI-writing score ${ai.score} > ${maxAi}`,
        score,
        aiWritingScore: ai.score,
      };
    }
  }

  return { pass: true, reason: 'ok', score };
}
