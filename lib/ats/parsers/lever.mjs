/**
 * Lever public postings API.
 */

/**
 * @param {object} cfg
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function parseLeverBoard(cfg, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const slug = cfg.slug || String(cfg.boardUrl || '').match(/jobs\.lever\.co\/([^/]+)/i)?.[1];
  if (!slug) return [];

  const res = await fetchImpl(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!res.ok) throw new Error(`Lever ${slug}: HTTP ${res.status}`);
  const jobs = await res.json();
  const keyword = String(cfg.keyword || 'devops').toLowerCase();

  return (Array.isArray(jobs) ? jobs : [])
    .filter((j) => {
      const blob = `${j.text || ''} ${j.categories?.team || ''}`.toLowerCase();
      return blob.includes(keyword) || blob.includes('sre') || blob.includes('infrastructure');
    })
    .map((j) => ({
      source: 'ats',
      externalKey: `lever:${j.id}`,
      url: j.hostedUrl || `https://jobs.lever.co/${slug}/${j.id}`,
      title: j.text?.split('\n')[0] || j.text || 'Vacancy',
      company: cfg.company || slug,
      description: String(j.descriptionPlain || j.description || '').slice(0, 8000),
      salaryRaw: '',
      publishedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      applyMode: 'ats_form',
      ingestMeta: { ats: 'lever', slug, team: j.categories?.team || '' },
    }));
}
