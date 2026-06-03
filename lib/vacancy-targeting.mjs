/**
 * Целевость вакансии для автоматического отклика + план резюме.
 */

import {
  titleLooksTargetRole,
  titleLooksNonItRole,
  titleLooksL1HelpdeskRole,
  detectBlueCollarPattern,
  detectIndustrialSignalPattern,
  titleLooksSalesOrPresaleRole,
  titleLooksTelecomNetworkRole,
  titleLooksIndustrialOrFieldRole,
  titleLooksPlatformPromo,
  titleLooksSeniorDevOpsTitle,
} from './role-classify.mjs';
import { classifyVacancyResumeRole, resolveResumeForVacancy } from './resume-routing.mjs';
import { parseWorkFormatMeta, passesWorkFormatForApply, passesWorkFormatRules } from './vacancy-work-format.mjs';
import { loadPreferences } from './preferences.mjs';
import {
  formatWorkFormatNote,
  developerRolePatterns,
  irrelevantTitlePatterns,
  isDeveloperRoleFilterEnabled,
  isIrrelevantTitleFilterEnabled,
  textMentionsDeveloperRole,
  textMentionsIrrelevantTitle,
} from './filters.mjs';
import { DEFAULT_REJECT_RULES, matchRejectRule } from './reject-role-patterns.mjs';

function workFormatBlob(rec) {
  const wf = rec?.workFormat;
  return [
    rec?.title,
    rec?.employment,
    rec?.workFormatLine,
    rec?.address,
    rec?.descriptionPreview,
    rec?.remoteNote,
    wf ? formatWorkFormatNote(wf) : '',
    wf?.format,
    wf?.city,
  ]
    .filter(Boolean)
    .join('\n');
}

/** @param {string} title @param {string} blob */
function titleOrBlobHasItProfileHints(title, blob) {
  const combined = `${title} ${blob}`.toLowerCase();
  return (
    /\bdevops\b|\bsre\b|\bmlops\b|kubernetes|docker|linux|мониторинг|grafana|ansible|terraform|helpdesk|service desk|\bl2\b|\bl3\b|data engineer|platform engineer|облак|cloud|\bai engineer\b|\bml[\s-]?инженер|machine learning|database administrator|\bdba\b|информационн\w*\s+безопасност|кибербезопасност|secops|devsecops/i.test(
      combined
    )
  );
}

function rejectCategoryByRuleId(ruleId) {
  if (ruleId === 'supportDesk') return 'off-target-l1';
  if (ruleId === 'sales') return 'off-target-sales';
  if (ruleId === 'network') return 'off-target-network';
  if (ruleId === 'industrial') return 'off-target-industrial';
  if (ruleId === 'nonIt') return 'off-target';
  if (ruleId === 'spb' || ruleId === 'utc7' || ruleId === 'tyumen') return 'off-target-region';
  if (ruleId === 'qa') return 'off-target-qa';
  if (ruleId === 'analyst') return 'off-target-analyst';
  if (ruleId === 'architect') return 'off-target-architect';
  if (ruleId === 'security') return 'off-target-security';
  if (ruleId === 'crypto') return 'off-target-crypto';
  if (ruleId === 'chief') return 'off-target-overqualified';
  if (ruleId === 'pm' || ruleId === 'agile') return 'off-target-product';
  return 'off-target';
}

function vacancyBlockedByHhState(rec) {
  const st = String(rec?.hhApply?.hhSiteState || '').toLowerCase();
  const feedback = String(rec?.feedbackReason || '').toLowerCase();
  return (
    st === 'already_applied' ||
    st === 'invited' ||
    st === 'declined' ||
    st === 'archived' ||
    st === 'unavailable' ||
    /уже\s+отказ|уже\s+есть\s+отклик|already\s+applied|already\s+declined/.test(feedback) ||
    rec?.status === 'responded'
  );
}

function titleLooksSoftwareLeadOutsideTarget(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (/devops|sre|mlops|platform/.test(t)) return false;
  if (/поддерж|support|helpdesk|service\s*desk|tam|technical account/.test(t)) return false;
  if (!/\btech\s*lead\b|\bteam\s*lead\b|ведущ\w+/.test(t)) return false;
  return /python|go|golang|php|java|c#|\.net|android|ios|frontend|backend|full[\s-]?stack|разработ/.test(
    t
  );
}

function manualFeedbackRejectCategory(feedbackReason) {
  const t = String(feedbackReason || '').toLowerCase().trim();
  if (!t) return null;
  if (/уже\s+отказ|уже\s+есть\s+отклик|already\s+applied|already\s+declined/.test(t)) {
    return 'off-target-hh-state';
  }
  if (/тестиров|^qa$|aqa|test\b/.test(t)) return 'off-target-qa';
  if (/архитект/.test(t)) return 'off-target-architect';
  if (/техподдерж|support|helpdesk|дежурн/.test(t)) return 'off-target-l1';
  if (/безопас|безопаст|security|secops|devsecops/.test(t)) return 'off-target-security';
  if (/аналитик|analyst/.test(t)) return 'off-target-analyst';
  if (/санкт-петербург|спб|utc\s*\+?\s*7|тюмень|дальний\s+восток/.test(t)) return 'off-target-region';
  if (/главн|руководител|head|chief|cto|технический\s+директор/.test(t)) {
    return 'off-target-overqualified';
  }
  if (/crypto|крипт/.test(t)) return 'off-target-crypto';
  if (/agile|product manager|project manager|pm\b/.test(t)) return 'off-target-product';
  if (/сетев|network|mvno/.test(t)) return 'off-target-network';
  if (/продаж|sales|presale|пресейл|b2b/.test(t)) return 'off-target-sales';
  if (/пусконалад|сметчик|сервисный\s+инженер|инженер-проектировщик|одд/.test(t)) {
    return 'off-target-industrial';
  }
  if (/не\s*it|не\s*айти|не it/.test(t)) return 'off-target';
  return null;
}

/**
 * @param {object} rec
 * @param {{ userApproved?: boolean, strictRemoteWork?: boolean, prefs?: object }} [opts]
 *   — `strictRemoteWork=false` ослабляет формат для батча (берёт общие правила, а не "только удалёнка")
 * @returns {{ eligible: boolean, skipReason?: string, category?: string, resumeRole?: string, resumePick?: ReturnType<typeof resolveResumeForVacancy> }}
 */
export function assessVacancyForApply(rec, opts = {}) {
  const userApproved = Boolean(opts.userApproved);
  const title = String(rec?.title || '').trim();
  const resumePick = resolveResumeForVacancy(rec);
  const resumeRole = resumePick.role;
  const feedbackCategory = manualFeedbackRejectCategory(rec?.feedbackReason);

  if (feedbackCategory && rec?.status === 'rejected') {
    return {
      eligible: false,
      skipReason: `ручной reject: ${String(rec?.feedbackReason || '').slice(0, 60)}`,
      category: feedbackCategory,
      resumeRole,
      resumePick,
    };
  }

  if (vacancyBlockedByHhState(rec)) {
    return {
      eligible: false,
      skipReason: `уже есть статус на hh.ru (отклик/исход): «${title.slice(0, 48)}»`,
      category: 'off-target-hh-state',
      resumeRole,
      resumePick,
    };
  }

  let prefs = opts.prefs;
  if (!prefs) {
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
  }
  const wfMeta = parseWorkFormatMeta(workFormatBlob(rec), prefs);
  const wf = opts.strictRemoteWork === false
    ? passesWorkFormatRules(wfMeta, prefs)
    : passesWorkFormatForApply(wfMeta, prefs);
  if (!wf.pass) {
    return {
      eligible: false,
      skipReason: wf.reason || 'формат работы не подходит',
      category: 'work-format',
      resumeRole,
      resumePick,
      workFormat: wfMeta,
    };
  }

  if (titleLooksPlatformPromo(title)) {
    return {
      eligible: false,
      skipReason: `служебная/рекламная карточка hh.ru: «${title.slice(0, 48)}»`,
      category: 'off-target-promo',
      resumeRole,
      resumePick,
    };
  }

  if (titleLooksSeniorDevOpsTitle(title) || titleLooksSoftwareLeadOutsideTarget(title)) {
    return {
      eligible: false,
      skipReason: `senior/lead выше целевого уровня: «${title.slice(0, 48)}»`,
      category: 'off-target-overqualified',
      resumeRole,
      resumePick,
    };
  }

  const rejectHit = matchRejectRule(rec, DEFAULT_REJECT_RULES);
  if (rejectHit?.rule) {
    return {
      eligible: false,
      skipReason: `${rejectHit.rule.reason || 'нецелевая роль'}: «${title.slice(0, 48)}»`,
      category: rejectCategoryByRuleId(rejectHit.rule.id),
      resumeRole,
      resumePick,
    };
  }

  if (isIrrelevantTitleFilterEnabled(prefs)) {
    const pats = irrelevantTitlePatterns(prefs);
    if (textMentionsIrrelevantTitle(title, pats)) {
      return {
        eligible: false,
        skipReason: `роль вне целевого профиля: «${title.slice(0, 48)}»`,
        category: 'off-target-irrelevant-title',
        resumeRole,
        resumePick,
      };
    }
  }

  if (isDeveloperRoleFilterEnabled(prefs) && !titleLooksTargetRole(title)) {
    const devPats = developerRolePatterns(prefs);
    if (textMentionsDeveloperRole(title, devPats)) {
      return {
        eligible: false,
        skipReason: `разработчик вне целевого стека: «${title.slice(0, 48)}»`,
        category: 'off-target-dev-outside-profile',
        resumeRole,
        resumePick,
      };
    }
  }

  const nonItBlob = [
    rec?.title,
    rec?.descriptionPreview,
    rec?.geminiSummary,
    ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
  ]
    .filter(Boolean)
    .join(' ');
  const blueCollarMatch = detectBlueCollarPattern(nonItBlob, prefs.blueCollarPatterns);
  if (blueCollarMatch) {
    return {
      eligible: false,
      skipReason: `рабочая специальность (${blueCollarMatch}): «${title.slice(0, 48)}»`,
      category: 'off-target-blue-collar',
      resumeRole,
      resumePick,
    };
  }

  const industrialSignal = detectIndustrialSignalPattern(nonItBlob, prefs.industrialSignalPatterns);
  if (industrialSignal) {
    return {
      eligible: false,
      skipReason: `промышленный сигнал (${industrialSignal}): «${title.slice(0, 48)}»`,
      category: 'off-target-industrial',
      resumeRole,
      resumePick,
    };
  }

  if (titleLooksL1HelpdeskRole(title)) {
    return {
      eligible: false,
      skipReason: `L1 поддержка (цель — L2+): «${title.slice(0, 48)}»`,
      category: 'off-target-l1',
      resumeRole,
      resumePick,
    };
  }

  if (titleLooksSalesOrPresaleRole(title)) {
    return {
      eligible: false,
      skipReason: `продажи/presale (нецелевая): «${title.slice(0, 48)}»`,
      category: 'off-target-sales',
      resumeRole,
      resumePick,
    };
  }

  if (titleLooksTelecomNetworkRole(title)) {
    return {
      eligible: false,
      skipReason: `сетевой/телеком профиль (не DevOps/SRE): «${title.slice(0, 48)}»`,
      category: 'off-target-network',
      resumeRole,
      resumePick,
    };
  }

  if (titleLooksIndustrialOrFieldRole(title)) {
    return {
      eligible: false,
      skipReason: `промышленный/полевой профиль (нецелевая): «${title.slice(0, 48)}»`,
      category: 'off-target-industrial',
      resumeRole,
      resumePick,
    };
  }

  if (titleLooksNonItRole(title)) {
    return {
      eligible: false,
      skipReason: `нецелевая вакансия: «${title.slice(0, 48)}»`,
      category: 'off-target',
      resumeRole,
      resumePick,
    };
  }

  if (!userApproved && title && !titleLooksTargetRole(title)) {
    const blob = [
      rec?.descriptionPreview,
      rec?.geminiSummary,
      ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
    ]
      .filter(Boolean)
      .join(' ');
    if (!titleOrBlobHasItProfileHints(title, blob)) {
      return {
        eligible: false,
        skipReason: `нет IT-профиля в названии: «${title.slice(0, 48)}»`,
        category: 'off-target-no-it-profile',
        resumeRole,
        resumePick,
      };
    }
  }

  return { eligible: true, resumeRole, resumePick };
}

/** @param {string} formTitle @param {ReturnType<typeof resolveResumeForVacancy>} planned */
export function resumeSelectionMatches(formTitle, planned) {
  const t = String(formTitle || '').toLowerCase();
  const want = String(planned?.title || '').toLowerCase();
  if (!t || !want) return null;
  if (t.includes(want) || want.includes(t.split('.')[0]?.trim())) return true;
  if (planned.role === 'devops' && /\bdevops\b/i.test(t)) return true;
  if (planned.role === 'data' && /data engineer/i.test(t)) return true;
  if (planned.role === 'support' && /поддержк/i.test(t)) return true;
  return false;
}
