/**
 * Безопасное авто-применение предложений обучения (C1).
 */

/**
 * @param {Array<{ pattern?: string, target?: string, count?: number, source?: string }>} items
 * @param {object} [prefs]
 * @param {{ minCount?: number, maxItems?: number }} [opts]
 */
export function filterSafeAutoApplyItems(items, prefs = {}, opts = {}) {
  if (prefs.learningAutoApplyPatterns === false) return [];
  const minCount = Math.max(2, Number(opts.minCount ?? prefs.learningAutoApplyMinCount ?? 3));
  const maxItems = Math.max(1, Math.min(8, Number(opts.maxItems) || 4));
  const list = Array.isArray(items) ? items : [];
  return list
    .filter((x) => {
      const p = String(x.pattern || '').trim();
      if (p.length < 3 || p.length > 80) return false;
      if (Number(x.count || 0) < minCount) return false;
      const t = String(x.target || 'irrelevant');
      return t === 'developer' || t === 'senior' || t === 'irrelevant';
    })
    .slice(0, maxItems)
    .map((x) => ({
      pattern: String(x.pattern).trim().toLowerCase(),
      target: String(x.target || 'irrelevant'),
      count: Number(x.count || 0),
      source: x.source || 'auto',
    }));
}
