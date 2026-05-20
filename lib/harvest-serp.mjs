/**
 * Сбор ссылок и заголовков с выдачи поиска hh.ru (до открытия карточек вакансий).
 */

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ url: string, title: string }>>}
 */
export async function collectVacancyCardsFromSearch(page) {
  await page
    .waitForSelector('a[href*="/vacancy/"]', { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(600);

  return page.evaluate(() => {
    const seen = new Set();
    /** @type {Array<{ url: string, title: string }>} */
    const out = [];

    function push(id, title) {
      if (!id || seen.has(id)) return;
      const t = String(title || '').replace(/\s+/g, ' ').trim();
      if (t.length < 2) return;
      seen.add(id);
      out.push({ url: `https://hh.ru/vacancy/${id}`, title: t });
    }

    const cardSelectors = [
      '[data-qa="vacancy-serp__vacancy"]',
      '[data-qa="serp-item"]',
      '[data-qa="vacancy-serp__vacancy-card"]',
    ];
    for (const sel of cardSelectors) {
      for (const card of document.querySelectorAll(sel)) {
        const a =
          card.querySelector('[data-qa="serp-item__title"]') ||
          card.querySelector('[data-qa="vacancy-serp__vacancy-title"]') ||
          card.querySelector('a[href*="/vacancy/"]');
        if (!a) continue;
        const href = a.href || a.getAttribute('href') || '';
        const m = href.match(/\/vacancy\/(\d+)/);
        if (!m) continue;
        const title =
          (a.textContent || '').replace(/\s+/g, ' ').trim() ||
          (card.querySelector('h3')?.textContent || '').replace(/\s+/g, ' ').trim();
        push(m[1], title);
      }
    }

    if (out.length > 0) return out;

    for (const a of document.querySelectorAll('a[href*="/vacancy/"]')) {
      const href = a.href || '';
      const m = href.match(/\/vacancy\/(\d+)/);
      if (!m) continue;
      const title = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (title.length < 4 || /откликнуться|сохранить|скрыть/i.test(title)) continue;
      push(m[1], title);
    }
    return out;
  });
}
