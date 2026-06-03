/**
 * Извлечение полей со страницы вакансии hh.ru (зависит от вёрстки).
 */

export async function parseVacancyPage(page) {
  await page
    .waitForSelector('[data-qa="vacancy-title"], h1', { timeout: 12_000 })
    .catch(() => {});
  await page
    .waitForSelector(
      '[data-qa="vacancy-description"], .vacancy-description, [itemprop="description"]',
      { timeout: 10_000 }
    )
    .catch(() => {});
  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.body.scrollHeight * 0.35))).catch(() => {});
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    const t = (sel) =>
      document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ')?.trim() || '';

    function readDescriptionFromDom() {
      const selectors = [
        '[data-qa="vacancy-description"]',
        '.vacancy-description',
        '[itemprop="description"]',
        '[data-qa="vacancy-view-description"]',
        '.g-user-content',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length >= 40) return text;
      }
      const main = document.querySelector('main');
      if (main) {
        const blocks = main.querySelectorAll('div, section');
        let best = '';
        for (const b of blocks) {
          const text = (b.innerText || '').replace(/\s+/g, ' ').trim();
          if (text.length > best.length && text.length >= 120 && text.length < 20_000) {
            best = text;
          }
        }
        if (best.length >= 40) return best;
      }
      return '';
    }

    const title = t('[data-qa="vacancy-title"]') || t('h1');
    const company = t('[data-qa="vacancy-company-name"]') || t('a[data-qa="vacancy-company-name"]');
    const salary = t('[data-qa="vacancy-salary"]');
    const experience = t('[data-qa="vacancy-experience"]');
    const employment = t('[data-qa="vacancy-employment-mode"]') || t('[data-qa="vacancy-view-employment-mode"]');
    const workFormat =
      t('[data-qa="vacancy-view-work-format"]') ||
      t('[data-qa="vacancy-work-format"]') ||
      t('[data-qa="work-formats"]') ||
      '';
    const address = t('[data-qa="vacancy-view-location"]') || t('[data-qa="vacancy-view-raw-address"]');

    let description = readDescriptionFromDom();

    if (description.length > 12_000) description = `${description.slice(0, 12_000)}…`;

    const blob = [title, company, salary, experience, employment, workFormat, address, description]
      .join('\n')
      .toLowerCase();

    return {
      title,
      company,
      salaryRaw: salary,
      experience,
      employment,
      workFormat,
      address,
      description,
      textBlob: blob,
    };
  });
}

export function vacancyIdFromUrl(url) {
  const s = String(url || '');
  let m = s.match(/\/vacancy\/(\d+)/i);
  if (m) return m[1];
  m = s.match(/[?&]vacancyId=(\d+)/i);
  if (m) return m[1];
  m = s.match(/\/vacancies\/(\d+)/i);
  return m ? m[1] : null;
}
