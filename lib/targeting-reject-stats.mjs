/**
 * Статистика отсечений по категориям таргетинга (очередь + reject).
 */

import { loadQueue } from './store.mjs';
import { loadPreferences } from './preferences.mjs';
import { assessVacancyForApply } from './vacancy-targeting.mjs';
import { summarizeFalsePositives } from './false-positive-analytics.mjs';

/** @type {Record<string, string>} */
export const TARGETING_CATEGORY_LABELS = {
  'work-format': 'Формат работы / удалёнка',
  'off-target-overqualified': 'Senior / lead',
  'off-target-dev-outside-profile': 'Разработчик вне профиля',
  'off-target-irrelevant-title': 'Нерелевантный заголовок',
  'off-target-l1': 'L1 поддержка',
  'off-target-sales': 'Продажи / presale',
  'off-target-network': 'Сетевые / телеком',
  'off-target-industrial': 'Промышленный / полевой',
  'off-target-blue-collar': 'Рабочие специальности',
  'off-target-no-it-profile': 'Нет IT-профиля',
  'off-target-promo': 'Промо / служебные',
  'off-target-hh-state': 'Уже отклик на hh.ru',
  'off-target': 'Нецелевая',
  manual: 'Ручной reject',
};

/**
 * @param {object} rec
 * @param {object} prefs
 */
function targetingSnapshot(rec, prefs) {
  if (rec?.targeting && typeof rec.targeting === 'object') {
    return rec.targeting;
  }
  return assessVacancyForApply(rec, { prefs });
}

/**
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {object} [opts.prefs]
 */
export function computeTargetingRejectStats(opts = {}) {
  const limit = Math.min(12, Math.max(3, Number(opts.limit) || 8));
  let prefs = opts.prefs;
  if (!prefs) {
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
  }

  const queue = loadQueue().filter((x) => !x.hidden);
  const rejected = queue.filter((x) => x.status === 'rejected');
  /** @type {Map<string, { category: string, label: string, count: number, samples: Array<{ id: string, title: string }> }>} */
  const byCategory = new Map();

  for (const rec of queue) {
    const feedback = String(rec.feedbackReason || '').trim();
    if (rec.status === 'rejected' && feedback) {
      const t = targetingSnapshot(rec, prefs);
      const category = t.eligible === false ? String(t.category || 'manual') : 'manual';
      const label = category === 'manual' ? TARGETING_CATEGORY_LABELS.manual : TARGETING_CATEGORY_LABELS[category] || category;
      let row = byCategory.get(category);
      if (!row) {
        row = { category, label, count: 0, samples: [] };
        byCategory.set(category, row);
      }
      row.count += 1;
      if (row.samples.length < 2) {
        row.samples.push({
          id: String(rec.id || ''),
          title: String(rec.title || rec.id || '').slice(0, 72),
        });
      }
      continue;
    }

    const t = targetingSnapshot(rec, prefs);
    if (t.eligible !== false) continue;
    const category = String(t.category || 'off-target');
    const label = TARGETING_CATEGORY_LABELS[category] || category;
    let row = byCategory.get(category);
    if (!row) {
      row = { category, label, count: 0, samples: [] };
      byCategory.set(category, row);
    }
    row.count += 1;
    if (row.samples.length < 2) {
      row.samples.push({
        id: String(rec.id || ''),
        title: String(rec.title || rec.id || '').slice(0, 72),
      });
    }
  }

  const topCategories = [...byCategory.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  const fp = summarizeFalsePositives(rejected, prefs, { limit: 5 });

  return {
    totalIneligible: [...byCategory.values()].reduce((s, r) => s + r.count, 0),
    totalRejected: rejected.length,
    topCategories,
    falsePositives: {
      total: fp.totalFalsePositives,
      rate: fp.falsePositiveRate,
      top: fp.top,
    },
    updatedAt: new Date().toISOString(),
  };
}
