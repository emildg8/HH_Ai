/**
 * Greenhouse public jobs API.
 */

/**
 * @param {object} cfg — { slug, boardUrl, company, keyword? }
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function parseGreenhouseBoard(cfg, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const slug = cfg.slug || String(cfg.boardUrl || '').match(/boards\.greenhouse\.io\/([^/]+)/i)?.[1];
  if (!slug) return [];

  const res = await fetchImpl(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!res.ok) throw new Error(`Greenhouse ${slug}: HTTP ${res.status}`);
  const data = await res.json();
  const keyword = String(cfg.keyword || 'devops').toLowerCase();
  const jobs = (data.jobs || []).filter((j) => {
    const blob = `${j.title} ${j.content || ''}`.toLowerCase();
    return blob.includes(keyword) || blob.includes('sre') || blob.includes('platform');
  });

  return jobs.map((j) => ({
    source: 'ats',
    externalKey: `greenhouse:${j.id}`,
    url: j.absolute_url,
    title: j.title,
    company: cfg.company || slug,
    description: String(j.content || '').replace(/<[^>]+>/g, ' ').slice(0, 8000),
    salaryRaw: '',
    publishedAt: j.updated_at || j.created_at || null,
    applyMode: 'ats_form',
    ingestMeta: { ats: 'greenhouse', slug, location: j.location?.name || '' },
  }));
}
