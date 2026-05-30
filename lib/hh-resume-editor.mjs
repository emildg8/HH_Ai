/**
 * Редактирование резюме на hh.ru (опыт + «О себе» / доп. блоки).
 */

import { sleepJitter } from './hh-human-delay.mjs';
import {
  RESUME_LIST_URL,
  EDIT_EXPERIENCE_BUTTON,
  EDIT_ABOUT_BUTTON,
  EDIT_TEXTAREA,
  SAVE_BUTTON,
} from './hh-resume-selectors.mjs';

async function clickFirst(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 700 }).catch(() => false)) {
      await loc.click();
      return sel;
    }
  }
  return null;
}

export async function listApplicantResumes(page) {
  await page.goto('https://hh.ru/applicant/my_resumes', {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  return page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const a of document.querySelectorAll('a[href*="/resume/"]')) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/resume\/([a-f0-9]{16,})/i);
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      const card = a.closest('[data-qa^="resume-card"]') || a.parentElement;
      const title =
        card?.querySelector('[data-qa="resume-title"]')?.innerText?.trim() ||
        a.innerText?.trim() ||
        '';
      out.push({ hash: m[1], title: title.replace(/\s+/g, ' ').trim() });
    }
    return out;
  });
}

export async function openResumeEditPage(page, resumeHash) {
  await page.goto(`https://hh.ru/resume/${resumeHash}`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await page.waitForTimeout(1800);
}

async function saveModal(page) {
  const saved = await clickFirst(page, SAVE_BUTTON);
  if (!saved) {
    const saveBtn = page.getByRole('button', { name: /сохранить|готово/i }).first();
    if (await saveBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await saveBtn.click();
    }
  }
  await page.waitForTimeout(1500);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 * @param {{ mode: 'experience' | 'about' }} opts
 */
async function openAboutSection(page) {
  const clicked = await clickFirst(page, EDIT_ABOUT_BUTTON);
  if (clicked) return true;

  const opened = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('h2, h3, h4, [data-qa], span, div')];
    const heading = nodes.find((n) => /^о себе$/i.test((n.textContent || '').trim()));
    if (!heading) return false;
    let block = heading.closest('[data-qa*="resume"], section, article') || heading.parentElement;
    for (let i = 0; i < 4 && block; i++) {
      const edit = block.querySelector(
        'a[href*="edit"], button, [data-qa*="edit"], [data-qa*="about"]'
      );
      const label = (edit?.textContent || '').trim();
      if (edit && /редактировать|добавить/i.test(label)) {
        edit.click();
        return true;
      }
      block = block.parentElement;
    }
    const add = [...document.querySelectorAll('a, button')].find((el) =>
      /^добавить$/i.test((el.textContent || '').trim())
    );
    if (add) {
      add.click();
      return true;
    }
    return false;
  });
  if (opened) await sleepJitter(page, 400, 800);
  return opened;
}

async function fillResumeSection(page, text, opts) {
  if (!text?.trim()) return { ok: false, reason: 'пустой текст' };

  if (opts.mode === 'experience') {
    await clickFirst(page, EDIT_EXPERIENCE_BUTTON(0) || []);
    const expBtn = page.locator('[data-qa="edit-experience-button-0"]').first();
    if (await expBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expBtn.click({ force: true });
      await sleepJitter(page, 500, 1000);
    }
  } else {
    await openAboutSection(page);
  }

  let textarea = null;
  for (const sel of EDIT_TEXTAREA) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
      textarea = loc;
      break;
    }
  }
  const editable = page.locator('[contenteditable="true"]').first();
  if (!textarea && (await editable.isVisible({ timeout: 1500 }).catch(() => false))) {
    await editable.click();
    await editable.fill(text.trim());
    await saveModal(page);
    return { ok: true, mode: 'contenteditable' };
  }
  if (!textarea) {
    return { ok: false, reason: 'поле ввода не найдено' };
  }

  await textarea.fill('');
  await textarea.fill(text.trim());
  await sleepJitter(page, 300, 600);
  await saveModal(page);
  return { ok: true };
}

export async function applyResumeVariantContent(page, resumeHash, content) {
  const log = content.log || (() => {});
  const results = { aboutMe: null, experience: null };

  if (content.aboutMe) {
    log('[hh-resume-editor] «О себе»…');
    await openResumeEditPage(page, resumeHash);
    results.aboutMe = await fillResumeSection(page, content.aboutMe, { mode: 'about' });
    await sleepJitter(page, 500, 1000);
  }

  if (content.experienceDescription) {
    log('[hh-resume-editor] Опыт (edit-experience-button-0)…');
    await openResumeEditPage(page, resumeHash);
    results.experience = await fillResumeSection(page, content.experienceDescription, {
      mode: 'experience',
    });
  }

  return results;
}
