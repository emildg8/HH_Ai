/**
 * Мастер hh.ru после нового профиля: «Кем вы хотите работать?» и похожие шаги.
 * Без прохождения редирект с vacancy_response ломает отклик (таймаут формы).
 */

import { isFastMode } from './hh-human-delay.mjs';
import { bringBrowserToFront } from './chromium-session.mjs';

/**
 * @param {import('playwright').Page} page
 */
export async function detectApplicantProfileOnboarding(page) {
  const heading = page.getByRole('heading', { name: /кем вы хотите работать/i });
  if (await heading.isVisible({ timeout: 700 }).catch(() => false)) return true;

  const combo =
    (await page.getByText(/укажу профессию/i).first().isVisible({ timeout: 500 }).catch(() => false)) &&
    (await page.getByText(/ищу любую работу/i).first().isVisible({ timeout: 500 }).catch(() => false));
  return combo;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ log?: (s: string) => void, raiseIfStuck?: boolean }} [opts]
 * @returns {Promise<boolean>} true — мастер был и обработан (или уже не показывается)
 */
export async function ensureApplicantOnboardingDismissed(page, opts = {}) {
  const log = opts.log || (() => {});
  const maxSteps = 10;
  let acted = false;

  for (let step = 0; step < maxSteps; step++) {
    if (!(await detectApplicantProfileOnboarding(page))) {
      return acted || true;
    }
    acted = true;
    log(`[hh-onboarding] Мастер профиля hh.ru (шаг ${step + 1})…`);

    const anyJob = page.locator('text=/ищу любую работу/i').first();
    if (await anyJob.isVisible({ timeout: 2500 }).catch(() => false)) {
      await anyJob.click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(isFastMode() ? 700 : 1400);
      continue;
    }

    const dontKnow = page.locator('text=/не знаю, кем хочу работать/i').first();
    if (await dontKnow.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dontKnow.click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(isFastMode() ? 700 : 1400);
      continue;
    }

    const nav = page.getByRole('button', { name: /пропустить|далее|готово|позже|не сейчас|продолжить/i }).first();
    if (await nav.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nav.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(isFastMode() ? 600 : 1200);
      continue;
    }

    log('[hh-onboarding] Нужно вручную: завершите мастер в окне Chromium (панель задач)');
    await bringBrowserToFront(page.context());
    if (opts.raiseIfStuck) {
      throw new Error(
        'Мастер hh.ru «Кем вы хотите работать» — завершите в браузере (npm run open-hh) и перезапустите батч'
      );
    }
    return false;
  }

  if (await detectApplicantProfileOnboarding(page)) {
    if (opts.raiseIfStuck) {
      throw new Error('Мастер профиля hh.ru не завершён — npm run open-hh');
    }
    return false;
  }
  return true;
}
