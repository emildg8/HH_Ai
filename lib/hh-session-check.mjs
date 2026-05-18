/**
 * Проверка авторизации на hh.ru в текущей вкладке Playwright.
 */

/**
 * @param {string} url
 */
export function looksLikeLoginUrl(url) {
  const u = String(url || '').toLowerCase();
  return u.includes('/account/login') || u.includes('oauth.hh.ru') || u.includes('/logon');
}

/**
 * @param {import('playwright').Page} page
 */
export async function isLoggedInOnHh(page) {
  if (looksLikeLoginUrl(page.url())) return false;

  const header = page.locator('header, [data-qa="header"], [class*="supernova-header"]').first();
  const loginInHeader = header.getByRole('link', { name: /^войти$/i });
  if (await loginInHeader.isVisible({ timeout: 800 }).catch(() => false)) return false;

  const applicantMarkers = [
    page.locator('[data-qa="mainmenu_applicantProfile"]'),
    page.locator('[data-qa="mainmenu_applicantResumes"]'),
    page.getByRole('link', { name: /мои резюме|резюме и профиль/i }),
    page.locator('a[href*="/applicant/resumes"]'),
  ];
  for (const m of applicantMarkers) {
    if (await m.first().isVisible({ timeout: 500 }).catch(() => false)) return true;
  }

  return true;
}

/**
 * @param {import('playwright').Page} page
 */
export async function assertHhLoggedIn(page) {
  if (await isLoggedInOnHh(page)) return;
  const url = page.url();
  throw new Error(
    `Вы не вошли в hh.ru в профиле Playwright (url=${url}). ` +
      'Резюме в обычном браузере здесь не видно. Выполните: npm run login — войдите в открывшемся Chromium и нажмите Enter.'
  );
}
