/**
 * Парсинг карточки Habr Карьера из HTML.
 */

/**
 * @param {string} html
 * @param {string} url
 */
export function parseHabrVacancyHtml(html, url) {
  const id = url.match(/vacancies\/(\d+)/i)?.[1] || '';
  const title =
    html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim() ||
    html.match(/<h1[^>]*>([^<]+)/i)?.[1]?.trim() ||
    '';
  const company =
    html.match(/class="[^"]*company_name[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim() ||
    html.match(/data-company-name="([^"]+)"/i)?.[1]?.trim() ||
    '';
  const salary = html.match(/class="[^"]*basic-salary[^"]*"[^>]*>([^<]+)/i)?.[1]?.trim() || '';
  const descMatch = html.match(/class="[^"]*vacancy-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const description = descMatch
    ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return {
    source: 'habr',
    externalKey: `habr:${id}`,
    vacancyId: id,
    url,
    title,
    company,
    salaryRaw: salary,
    description,
    applyMode: 'manual_link',
    ingestMeta: { sourceSite: 'career.habr.com' },
  };
}

/**
 * @param {string} html — страница поиска
 */
export function parseHabrSearchCards(html) {
  const cards = [];
  const re = /href="(\/vacancies\/(\d+))"[^>]*>[\s\S]*?<\/a>/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) {
    const id = m[2];
    if (seen.has(id)) continue;
    seen.add(id);
    const chunk = m[0];
    const title = chunk.match(/>([^<]{5,120})</)?.[1]?.trim() || `Vacancy ${id}`;
    cards.push({
      source: 'habr',
      externalKey: `habr:${id}`,
      vacancyId: id,
      url: `https://career.habr.com/vacancies/${id}`,
      title,
      company: '',
      description: title,
      applyMode: 'manual_link',
    });
  }
  return cards;
}
