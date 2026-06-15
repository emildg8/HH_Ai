/**
 * URL поиска Habr Карьера.
 */

const BASE = 'https://career.habr.com/vacancies';

/**
 * @param {{ query?: string, page?: number, remote?: boolean }} [opts]
 */
export function buildHabrSearchUrl(opts = {}) {
  const q = encodeURIComponent(opts.query || 'devops');
  const page = Math.max(1, Number(opts.page) || 1);
  const params = new URLSearchParams({ q, page: String(page) });
  if (opts.remote !== false) params.set('remote', 'true');
  return `${BASE}?${params.toString()}`;
}

/**
 * @param {string} html
 */
export function extractHabrVacancyLinks(html) {
  const links = new Set();
  const re = /href="(\/vacancies\/\d+[^"]*)"/gi;
  let m;
  while ((m = re.exec(html))) {
    links.add(`https://career.habr.com${m[1].split('?')[0]}`);
  }
  return [...links];
}
