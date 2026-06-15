/**
 * Dice.com search HTML parser.
 */

/**
 * @param {object} cfg — { query?, html? }
 * @param {{ fetchImpl?: typeof fetch, html?: string }} [opts]
 */
export async function parseDiceSearchHtml(cfg, opts = {}) {
  let html = opts.html || cfg.html;
  if (!html) {
    const q = encodeURIComponent(cfg.query || 'devops remote');
    const fetchImpl = opts.fetchImpl || fetch;
    const res = await fetchImpl(`https://www.dice.com/jobs?q=${q}`, {
      headers: { 'User-Agent': 'HH-Ai/3.2' },
    });
    if (!res.ok) throw new Error(`Dice: HTTP ${res.status}`);
    html = await res.text();
  }
  return parseDiceHtml(html);
}

/**
 * @param {string} html
 */
export function parseDiceHtml(html) {
  const items = [];
  const re = /href="(https:\/\/www\.dice\.com\/job-detail\/[a-f0-9-]+)"/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const id = url.split('/').pop();
    items.push({
      source: 'jobboard',
      externalKey: `dice:${id}`,
      url,
      title: 'DevOps (Dice)',
      company: '',
      description: '',
      applyMode: 'manual_link',
      ingestMeta: { jobboard: 'dice' },
    });
  }
  return items.slice(0, 30);
}
