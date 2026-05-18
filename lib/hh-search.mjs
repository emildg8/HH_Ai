/**
 * Поисковые запросы hh.ru: дополнение ключевых слов минус-словами.
 */

/**
 * @returns {string[]}
 */
export function searchExcludeTokens() {
  const env = process.env.HH_SEARCH_EXCLUDE_TOKENS;
  const raw =
    env === undefined || env === null
      ? 'senior,сеньор,lead,лид,1с,1c'
      : String(env).trim();
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} keyword
 * @returns {string}
 */
export function buildHhSearchText(keyword) {
  const base = String(keyword || '').trim();
  if (!base) return base;
  const excludes = searchExcludeTokens();
  if (!excludes.length) return base;
  const parts = [base];
  for (const token of excludes) {
    const t = token.replace(/^\s*-\s*/, '').trim();
    if (!t) continue;
    if (base.toLowerCase().includes(t.toLowerCase())) continue;
    parts.push(`-${t}`);
  }
  return parts.join(' ');
}
