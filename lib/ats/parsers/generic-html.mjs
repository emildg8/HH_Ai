/**
 * Generic HTML fallback для карьерных страниц.
 */

/**
 * @param {object} cfg
 * @param {{ fetchImpl?: typeof fetch, html?: string }} [opts]
 */
export async function parseGenericHtml(cfg, opts = {}) {
  let html = opts.html;
  if (!html) {
    const url = cfg.boardUrl || cfg.url;
    if (!url) return [];
    const fetchImpl = opts.fetchImpl || fetch;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Generic: HTTP ${res.status}`);
    html = await res.text();
  }
  return parseGenericHtmlText(html, cfg);
}

/**
 * @param {string} html
 * @param {object} cfg
 */
export function parseGenericHtmlText(html, cfg) {
  const keyword = String(cfg.keyword || 'devops').toLowerCase();
  const items = [];
  const titleRe = /<h[1-3][^>]*>([^<]{5,120})<\/h[1-3]>/gi;
  let m;
  while ((m = titleRe.exec(html))) {
    const title = m[1].replace(/\s+/g, ' ').trim();
    const t = title.toLowerCase();
    if (!t.includes(keyword) && !t.includes('sre') && !t.includes('platform')) continue;
    items.push({
      source: 'ats',
      externalKey: `generic:${title.toLowerCase().replace(/\s+/g, '-').slice(0, 48)}`,
      url: cfg.boardUrl || cfg.url,
      title,
      company: cfg.company || '',
      description: title,
      salaryRaw: '',
      applyMode: 'ats_form',
      ingestMeta: { ats: 'generic' },
    });
  }
  return items.slice(0, 20);
}
