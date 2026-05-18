/**
 * Правила «похожих ролей» для массового отклонения в дашборде.
 * Сопоставление в первую очередь по заголовку вакансии (меньше ложных срабатываний из описания).
 */

/** @typedef {{ id: string, label: string, reason: string, match: (item: object) => boolean }} RejectRule */

/** @type {RejectRule[]} */
export const DEFAULT_REJECT_RULES = [
  {
    id: 'qa',
    label: 'QA / тестировщик',
    reason: 'Тестировщик',
    match(item) {
      const t = titleBlob(item);
      if (/проникновен|penetration/i.test(t)) return false;
      return /\bqa\b|тестиров|инженер по тестирован|automation qa|manual qa|тестированию/i.test(t);
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
      return !/devops|sre|инфраструктур|облачн|platform/i.test(t);
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
      const t = locationBlob(item);
      if (/санкт[-\s]?петербург|\bспб\b|петербург/i.test(t)) return true;
      // офис без удалёнки (как у отклонённой Defa Group)
      if (/пятидневн/i.test(t) && /в офисе|работа в офисе|офисе компании/i.test(t)) {
        if (!/удален|удалён|remote|дистанцион|из дома/i.test(t)) return true;
      }
      return false;
    },
  },
  {
    id: 'utc7',
    label: 'Часовой пояс UTC+7',
    reason: 'UTC +7',
    match(item) {
      return /utc\s*\+\s*7|utc\+7|\(utc\s*\+7\)/i.test(titleBlob(item));
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
      const t = titleBlob(item);
      if (/\bглавный\b/i.test(t)) return true;
      return /\bглавный\s+sre\b|\bsre\s+главный\b|\bглавный\b.*\bsre\b|\bsre\b.*\bглавный\b/i.test(t);
    },
  },
  {
    id: 'tyumen',
    label: 'Тюмень / нет удалёнки',
    reason: 'Тюмень нет удаленки',
    match(item) {
      return /тюмень/i.test(locationBlob(item));
    },
  },
];

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
export function ruleIdsLearnedFromRejected(rejected) {
  const ids = new Set();
  for (const rec of rejected) {
    for (const id of ruleIdsFromFeedbackReason(rec.feedbackReason)) {
      ids.add(id);
    }
  }
  return ids;
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
