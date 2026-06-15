/**
 * Welcome to the Jungle search HTML parser.
 */

/**
 * @param {object} cfg
 * @param {{ fetchImpl?: typeof fetch, html?: string }} [opts]
 */
export async function parseJungleSearchHtml(cfg, opts = {}) {
  let html = opts.html || cfg.html;
  if (!html) {
    const q = encodeURIComponent(cfg.query || 'devops');
    const fetchImpl = opts.fetchImpl || fetch;
    const res = await fetchImpl(
      `https://www.welcometothejungle.com/en/jobs?query=${q}&refinementList%5Boffices.country_code%5D%5B%5D=FR`,
      { headers: { 'User-Agent': 'HH-Ai/3.2' } }
    );
    if (!res.ok) throw new Error(`Jungle: HTTP ${res.status}`);
    html = await res.text();
  }
  return parseJungleHtml(html);
}

/**
 * @param {string} html
 */
export function parseJungleHtml(html) {
  const items = [];
  const re = /href="(\/[^"]*\/jobs\/[^"?#]+)"/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) {
    const path = m[1];
    if (!/\/jobs\//.test(path)) continue;
    const url = `https://www.welcometothejungle.com${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const slug = path.split('/').pop();
    items.push({
      source: 'jobboard',
      externalKey: `jungle:${slug}`,
      url,
      title: slug.replace(/-/g, ' '),
      company: '',
      description: '',
      applyMode: 'manual_link',
      ingestMeta: { jobboard: 'welcometothejungle' },
    });
  }
  return items.slice(0, 30);
}
