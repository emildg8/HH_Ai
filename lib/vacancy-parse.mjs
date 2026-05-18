/**
 * Извлечение полей со страницы вакансии hh.ru (зависит от вёрстки).
 */

export async function parseVacancyPage(page) {
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const t = (sel) =>
      document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ')?.trim() || '';

    const title = t('[data-qa="vacancy-title"]') || t('h1');
    const company = t('[data-qa="vacancy-company-name"]') || t('a[data-qa="vacancy-company-name"]');
    const salary = t('[data-qa="vacancy-salary"]');
    const experience = t('[data-qa="vacancy-experience"]');
    const employment = t('[data-qa="vacancy-employment-mode"]') || t('[data-qa="vacancy-view-employment-mode"]');
    const address = t('[data-qa="vacancy-view-location"]') || t('[data-qa="vacancy-view-raw-address"]');

    let description =
      t('[data-qa="vacancy-description"]') ||
      t('.vacancy-description') ||
      t('[itemprop="description"]');

    if (description.length > 12_000) description = `${description.slice(0, 12_000)}…`;

    const blob = [title, company, salary, experience, employment, address, description]
      .join('\n')
      .toLowerCase();

    return {
      title,
      company,
      salaryRaw: salary,
      experience,
      employment,
      address,
      description,
      textBlob: blob,
    };
  });
}

export function vacancyIdFromUrl(url) {
  const m = String(url).match(/\/vacancy\/(\d+)/);
  return m ? m[1] : null;
}
