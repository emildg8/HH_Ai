/**
 * Workday — упрощённый парсер (fixture / live HTML).
 */

/**
 * @param {object} cfg
 * @param {{ fetchImpl?: typeof fetch, html?: string }} [opts]
 */
export async function parseWorkdayBoard(cfg, opts = {}) {
  const html = opts.html;
  if (html) return parseWorkdayHtml(html, cfg);
  const url = cfg.boardUrl || cfg.url;
  if (!url) return [];
  const fetchImpl = opts.fetchImpl || fetch;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Workday: HTTP ${res.status}`);
  const text = await res.text();
  return parseWorkdayHtml(text, cfg);
}

/**
 * @param {string} html
 * @param {object} cfg
 */
export function parseWorkdayHtml(html, cfg) {
  const items = [];
  const re = /data-automation-id="jobTitle"[^>]*>([^<]+)</gi;
  let m;
  while ((m = re.exec(html))) {
    const title = m[1].trim();
    if (!/devops|sre|platform|infrastructure/i.test(title)) continue;
    items.push({
      source: 'ats',
      externalKey: `workday:${title.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`,
      url: cfg.boardUrl || cfg.url,
      title,
      company: cfg.company || 'Workday',
      description: title,
      salaryRaw: '',
      applyMode: 'ats_form',
      ingestMeta: { ats: 'workday' },
    });
  }
  return items;
}
