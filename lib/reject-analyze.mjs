/**
 * Разбор отклонённых вакансий: категория, причина, подсказка для фильтров.
 */

import {
  DEFAULT_REJECT_RULES,
  inferRejectReasonFromRecord,
  matchRejectRule,
  summarizeRejected,
} from './reject-role-patterns.mjs';
import { titleLooksL1HelpdeskRole } from './role-classify.mjs';

/** @typedef {{ id: string, label: string, hint: string }} RejectCategory */

/** @type {Record<string, RejectCategory>} */
export const REJECT_CATEGORIES = {
  support_l1: {
    id: 'support_l1',
    label: 'L1 (не L2+)',
    hint: 'Поддержку L2/L3 вы ищете — здесь отклонены конкретные L1: оператор, чат, helpdesk, 1С. Не «вся техподдержка».',
  },
  sales_presale: {
    id: 'sales_presale',
    label: 'Продажи / presale',
    hint: 'Пресейл и продажи — не инженерная роль.',
  },
  non_it: {
    id: 'non_it',
    label: 'Не IT / промышленность / поле',
    hint: 'Сметчики, монтаж, ОВиК, RAN и т.п. — вне DevOps/поддержки.',
  },
  one_c: {
    id: 'one_c',
    label: '1С / ERP',
    hint: 'Включите exclude1CRoles или отклоняйте правилом при сборе.',
  },
  other: {
    id: 'other',
    label: 'Прочее',
    hint: 'Укажите причину в дашборде — подтянется массовое «похожие».',
  },
};

/**
 * @param {object} rec
 * @returns {{ category: RejectCategory, reason: string, ruleId: string | null }}
 */
export function categorizeRejectedRecord(rec) {
  const hit = matchRejectRule(rec, DEFAULT_REJECT_RULES);
  const reason = String(rec?.feedbackReason || '').trim() || inferRejectReasonFromRecord(rec);
  const ruleId = hit?.rule?.id || rec?.rejectRuleId || null;

  let cat = REJECT_CATEGORIES.other;
  if (titleLooksL1HelpdeskRole(rec?.title)) {
    cat = REJECT_CATEGORIES.support_l1;
  } else if (ruleId === 'supportDesk') {
    cat = REJECT_CATEGORIES.support_l1;
  } else if (ruleId === 'sales') {
    cat = REJECT_CATEGORIES.sales_presale;
  } else if (ruleId === 'industrial' || ruleId === 'nonIt' || ruleId === 'network') {
    cat = REJECT_CATEGORIES.non_it;
  } else if (ruleId === 'oneCRole' || /\b1с\b/i.test(String(rec?.title || ''))) {
    cat = REJECT_CATEGORIES.one_c;
  }

  return { category: cat, reason: reason || '(без причины)', ruleId };
}

/**
 * @param {object[]} queue
 */
export function analyzeRejectedQueue(queue) {
  const { rejected } = summarizeRejected(queue);
  /** @type {Map<string, { category: RejectCategory, items: object[], reasons: Map<string, object[]> }>} */
  const byCategory = new Map();

  for (const rec of rejected) {
    const { category, reason } = categorizeRejectedRecord(rec);
    if (!byCategory.has(category.id)) {
      byCategory.set(category.id, { category, items: [], reasons: new Map() });
    }
    const bucket = byCategory.get(category.id);
    bucket.items.push(rec);
    if (!bucket.reasons.has(reason)) bucket.reasons.set(reason, []);
    bucket.reasons.get(reason).push(rec);
  }

  return { rejected, byCategory };
}
