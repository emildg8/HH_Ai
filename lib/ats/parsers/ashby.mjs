/**
 * Ashby job board API.
 */

/**
 * @param {object} cfg
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function parseAshbyBoard(cfg, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const slug = cfg.slug || String(cfg.boardUrl || '').match(/jobs\.ashbyhq\.com\/([^/]+)/i)?.[1];
  if (!slug) return [];

  const res = await fetchImpl(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!res.ok) throw new Error(`Ashby ${slug}: HTTP ${res.status}`);
  const data = await res.json();
  const keyword = String(cfg.keyword || 'devops').toLowerCase();

  return (data.jobs || [])
    .filter((j) => {
      const blob = `${j.title} ${j.descriptionHtml || ''}`.toLowerCase();
      return blob.includes(keyword) || blob.includes('sre');
    })
    .map((j) => ({
      source: 'ats',
      externalKey: `ashby:${j.id}`,
      url: j.jobUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
      title: j.title,
      company: cfg.company || slug,
      description: String(j.descriptionHtml || '').replace(/<[^>]+>/g, ' ').slice(0, 8000),
      salaryRaw: j.compensation?.summary || '',
      publishedAt: j.publishedAt || null,
      applyMode: 'ats_form',
      ingestMeta: { ats: 'ashby', slug, location: j.location || '' },
    }));
}
