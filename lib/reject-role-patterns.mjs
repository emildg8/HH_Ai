/**
 * Правила «похожих ролей» для массового отклонения в дашборде.
 * Сопоставление в первую очередь по заголовку вакансии (меньше ложных срабатываний из описания).
 */

import {
  titleLooksTargetRole,
  isClearlyOverqualifiedTitle,
  titleLooksNonItRole,
  titleLooksOffTargetFieldRole,
  titleLooksIndustrialOrFieldRole,
  titleLooksTelecomNetworkRole,
  titleLooksSalesOrPresaleRole,
  titleLooksL1HelpdeskRole,
} from './role-classify.mjs';
import { parseWorkFormatMeta } from './vacancy-work-format.mjs';

/** @typedef {{ id: string, label: string, reason: string, match: (item: object) => boolean }} RejectRule */

function itemHasExplicitRemote(item) {
  const meta = parseWorkFormatMeta(locationBlob(item));
  return meta.hasRemote;
}

/** @type {RejectRule[]} */
export const DEFAULT_REJECT_RULES = [
  {
    id: 'qa',
    label: 'QA / тестировщик',
    reason: 'Тестировщик',
    match(item) {
      const t = titleBlob(item);
      if (/проникновен|penetration/i.test(t)) return false;
      return /\baqa\b|\bqa\b|тестиров|инженер по тестирован|automation qa|manual qa|тестированию|тест[-\s]*менеджер/i.test(t);
    },
  },
  {
    id: 'pm',
    label: 'Product Manager / PO',
    reason: 'Product Manager',
    match(item) {
      return /product\s*manager|product\s*owner|менеджер\s+продукта|владелец\s+продукта/i.test(
        titleBlob(item)
      );
    },
  },
  {
    id: 'analyst',
    label: 'Аналитик',
    reason: 'Аналитик',
    match(item) {
      return /аналитик|business\s+analyst|бизнес[-\s]?аналитик/i.test(titleBlob(item));
    },
  },
  {
    id: 'agile',
    label: 'Agile / Scrum / коуч',
    reason: 'Agile-коуч',
    match(item) {
      return /agile[-\s]?коуч|scrum\s*master|аджайл[-\s]?коуч/i.test(titleBlob(item));
    },
  },
  {
    id: 'architect',
    label: 'Архитектор (не DevOps/SRE)',
    reason: 'Архитектор',
    match(item) {
      const t = titleBlob(item);
      if (!/архитектор/i.test(t)) return false;
      if (/devops|sre|devsecops|cloud\s+architect|platform\s+engineer|архитектор\s+(devops|sre|облач|cloud|platform)/i.test(t)) {
        return false;
      }
      return true;
    },
  },
  {
    id: 'security',
    label: 'ИБ / безопасность (не DevOps)',
    reason: 'Безопастник',
    match(item) {
      const t = titleBlob(item);
      if (/devops|sre|devsecops/i.test(t)) return false;
      return /информационн(ой|ая)\s+безопасност|инженер.*безопасност|специалист.*\bиб\b|защищенност/i.test(
        t
      );
    },
  },
  {
    id: 'spb',
    label: 'Санкт-Петербург / СПб',
    reason: 'Санкт-Петербург',
    match(item) {
      if (itemHasExplicitRemote(item)) return false;
      const t = locationBlob(item);
      if (/санкт[-\s]?петербург|\bспб\b/i.test(t) && !/москв/i.test(t)) return true;
      if (/пятидневн/i.test(t) && /в офисе|работа в офисе|офисе компании/i.test(t)) {
        return true;
      }
      return false;
    },
  },
  {
    id: 'utc7',
    label: 'Часовой пояс UTC+7',
    reason: 'UTC +7',
    match(item) {
      if (itemHasExplicitRemote(item)) return false;
      return /utc\s*\+\s*7|utc\+7|\(utc\s*\+7\)/i.test(locationBlob(item));
    },
  },
  {
    id: 'crypto',
    label: 'Криптография / Crypto (роль)',
    reason: 'Crypto',
    match(item) {
      const t = titleBlob(item);
      return (
        /\bcrypto\b/i.test(t) ||
        /криптограф|крипто[-\s]?lead|head of cryptograph/i.test(t) ||
        /руководитель.*криптограф/i.test(t)
      );
    },
  },
  {
    id: 'chief',
    label: 'Главный / Главный SRE',
    reason: 'Главный',
    match(item) {
      return isClearlyOverqualifiedTitle(titleBlob(item));
    },
  },
  {
    id: 'industrial',
    label: 'Промышленный / полевой инженер',
    reason: 'Не IT',
    match(item) {
      const t = titleBlob(item);
      if (titleLooksSalesOrPresaleRole(t)) return false;
      return titleLooksIndustrialOrFieldRole(t);
    },
  },
  {
    id: 'network',
    label: 'Сетевой инженер (не DevOps/SRE)',
    reason: 'Сетевой инженер',
    match(item) {
      return titleLooksTelecomNetworkRole(titleBlob(item));
    },
  },
  {
    id: 'sales',
    label: 'Продажи / Presale',
    reason: 'Продажи',
    match(item) {
      return titleLooksSalesOrPresaleRole(titleBlob(item));
    },
  },
  {
    id: 'nonIt',
    label: 'Вне IT (продавец и т.п.)',
    reason: 'Не IT',
    match(item) {
      const t = titleBlob(item);
      if (
        titleLooksIndustrialOrFieldRole(t) ||
        titleLooksTelecomNetworkRole(t) ||
        titleLooksSalesOrPresaleRole(t)
      ) {
        return false;
      }
      return titleLooksNonItRole(t);
    },
  },
  {
    id: 'tyumen',
    label: 'Тюмень / нет удалёнки',
    reason: 'Тюмень нет удаленки',
    match(item) {
      if (itemHasExplicitRemote(item)) return false;
      return /тюмень/i.test(locationBlob(item)) && !/удален|удалён|remote|дистанцион/i.test(locationBlob(item));
    },
  },
  {
    id: 'supportDesk',
    label: 'L1 helpdesk (не L2+)',
    reason: 'L1 helpdesk',
    match(item) {
      return titleLooksL1HelpdeskRole(titleBlob(item));
    },
  },
];

/**
 * Конкретная причина отклонения L1-вакансии (поддержку L2+ пользователь ищет).
 * @param {string} [title]
 * @returns {string}
 */
export function inferL1HelpdeskRejectReason(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim() || !titleLooksL1HelpdeskRole(title)) return '';
  if (/\b1с\b|1c:enterprise|erp\s*1с|поддерж.*1с|1с.*поддерж/i.test(t)) {
    return 'Поддержка 1С';
  }
  if (/\(оператор\)|оператор\).*технич[а-яё]*\s*поддерж/i.test(t)) {
    return 'Оператор L1';
  }
  if (/оператор.*чат|чат.*поддерж|специалист\s+чата/i.test(t)) {
    return 'Чат / оператор L1';
  }
  if (/help\s*desk|helpdesk/i.test(t)) return 'Helpdesk L1';
  if (/оператор/i.test(t) && /поддерж/i.test(t)) return 'Оператор L1';
  if (/техподдерж/i.test(t)) return 'Техподдержка L1';
  return 'L1 поддержка (нужен L2+)';
}

const GENERIC_SUPPORT_REJECT_REASONS = new Set([
  'техподдержка',
  'техническая поддержка',
  'технической поддержки',
  'l1 helpdesk',
]);

const REASON_TO_RULE_IDS = {
  тестировщик: ['qa'],
  тестирование: ['qa'],
  'product manager': ['pm'],
  'product owner': ['pm'],
  продакт: ['pm'],
  'менеджер продукта': ['pm'],
  аналитик: ['analyst'],
  'business analyst': ['analyst'],
  архитектор: ['architect'],
  безопастник: ['security'],
  безопасност: ['security'],
  'agile-коуч': ['agile'],
  'scrum master': ['agile'],
  'санкт-петербург': ['spb'],
  'спб': ['spb'],
  'utc +7': ['utc7'],
  'utc+7': ['utc7'],
  crypto: ['crypto'],
  криптограф: ['crypto'],
  главный: ['chief'],
  'главный sre': ['chief'],
  тюмень: ['tyumen'],
  'нет удаленки': ['tyumen'],
  'нет удалёнки': ['tyumen'],
  'l1 поддержка': ['supportDesk'],
  'l1 helpdesk': ['supportDesk'],
  'оператор l1': ['supportDesk'],
  'чат / оператор': ['supportDesk'],
  'чат l1': ['supportDesk'],
  'helpdesk l1': ['supportDesk'],
  'поддержка 1с': ['supportDesk'],
  'техподдержка l1': ['supportDesk'],
  'сетевой инженер': ['network'],
  продажи: ['sales'],
  presale: ['sales'],
  пресейл: ['sales'],
  aqa: ['qa'],
  пусконаладчик: ['industrial'],
  сметчик: ['industrial'],
  mvno: ['industrial', 'network'],
  дежурный: ['network'],
};

export function titleBlob(item) {
  return String(item.title || '').trim();
}

/** Заголовок + фрагмент описания для локации / офиса. */
export function locationBlob(item) {
  return [item.title, item.company, item.address, item.descriptionPreview]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
}

export function recordTextBlob(item) {
  const tags = Array.isArray(item.geminiTags) ? item.geminiTags.join(' ') : '';
  return [item.title, item.company, item.descriptionPreview, item.geminiSummary, tags]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {string} feedbackReason
 * @returns {string[]}
 */
export function ruleIdsFromFeedbackReason(feedbackReason) {
  const key = String(feedbackReason || '')
    .trim()
    .toLowerCase();
  if (!key) return [];
  const ids = new Set();
  for (const [needle, ruleIds] of Object.entries(REASON_TO_RULE_IDS)) {
    if (key.includes(needle)) {
      for (const id of ruleIds) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * @param {object[]} rejected
 * @returns {Set<string>}
 */
function shouldLearnSupportDeskFromRecord(rec) {
  const r = String(rec?.feedbackReason || '')
    .trim()
    .toLowerCase();
  if (!r) return true;
  if (GENERIC_SUPPORT_REJECT_REASONS.has(r)) return false;
  if (r.includes('не devops') && r.includes('l2')) return false;
  return true;
}

export function ruleIdsLearnedFromRejected(rejected) {
  const ids = new Set();
  for (const rec of rejected) {
    for (const id of ruleIdsFromFeedbackReason(rec.feedbackReason)) {
      ids.add(id);
    }
    const hit = matchRejectRule(rec, DEFAULT_REJECT_RULES);
    if (!hit) continue;
    if (hit.rule.id === 'supportDesk' && !shouldLearnSupportDeskFromRecord(rec)) continue;
    ids.add(hit.rule.id);
  }
  return ids;
}

/** Причина для очереди: из комментария или по заголовку отклонённой вакансии. */
export function inferRejectReasonFromRecord(rec) {
  let fromFeedback = String(rec?.feedbackReason || '').trim();
  if (fromFeedback && GENERIC_SUPPORT_REJECT_REASONS.has(fromFeedback.toLowerCase())) {
    fromFeedback = '';
  }
  if (fromFeedback) return fromFeedback;
  const hit = matchRejectRule(rec, DEFAULT_REJECT_RULES);
  if (hit?.rule.id === 'supportDesk') {
    return inferL1HelpdeskRejectReason(rec?.title) || 'L1 поддержка (нужен L2+)';
  }
  return hit?.rule?.reason || '';
}

/**
 * @param {object} item
 * @param {RejectRule[]} rules
 * @returns {{ rule: RejectRule } | null}
 */
export function matchRejectRule(item, rules) {
  for (const rule of rules) {
    if (rule.match(item)) return { rule };
  }
  return null;
}

/**
 * @param {object[]} queue
 * @param {{ ruleIds?: string[], rules?: RejectRule[], includePending?: boolean }} [opts]
 */
export function findSimilarToReject(queue, opts = {}) {
  const rules = opts.rules || DEFAULT_REJECT_RULES;
  const allowed = opts.ruleIds?.length
    ? new Set(opts.ruleIds)
    : opts.learnFromRejected
      ? ruleIdsLearnedFromRejected(queue.filter((x) => x.status === 'rejected'))
      : null;

  const activeRules = allowed?.size
    ? rules.filter((r) => allowed.has(r.id))
    : rules;

  const out = [];
  for (const item of queue) {
    if (opts.includePending !== false && item.status !== 'pending') continue;
    const hit = matchRejectRule(item, activeRules);
    if (hit) out.push({ item, rule: hit.rule });
  }
  return out;
}

/**
 * @param {object[]} queue
 */
export function summarizeRejected(queue) {
  const rejected = queue.filter((x) => x.status === 'rejected');
  const byReason = new Map();
  for (const rec of rejected) {
    const reason = String(rec.feedbackReason || '').trim() || '(без причины)';
    if (!byReason.has(reason)) byReason.set(reason, []);
    byReason.get(reason).push(rec);
  }
  return { rejected, byReason };
}
