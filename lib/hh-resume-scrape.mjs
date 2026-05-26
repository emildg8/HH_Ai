/**
 * Снятие текста и подсказок завершённости с просмотра резюме hh.ru.
 */

import { openResumeEditPage } from './hh-resume-editor.mjs';

/**
 * @param {import('playwright').Page} page
 * @param {string} hash
 */
export async function scrapeResumeContent(page, hash) {
  await openResumeEditPage(page, hash);
  await page.waitForTimeout(1200);

  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const percentMatch =
      text.match(/Завершённость[^\d]*(\d{1,3})\s*%/i) ||
      text.match(/(\d{1,3})\s*%\s*заверш/i);
    const completenessPercent = percentMatch ? Number(percentMatch[1]) : null;

    const missingHints = [];
    for (const el of document.querySelectorAll('a, button, [data-qa]')) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 80) continue;
      if (
        /^добавить$/i.test(t) ||
        /категория прав|сертификат|портфолио|рекомендац|дополнительное образование|пройденные тесты/i.test(
          t
        )
      ) {
        if (!missingHints.includes(t)) missingHints.push(t);
      }
    }

    let aboutMe = '';
    const headings = [...document.querySelectorAll('h2, h3, [data-qa], div')];
    const aboutH = headings.find((n) => /^о себе$/i.test((n.innerText || '').trim()));
    if (aboutH) {
      const container = aboutH.closest('section, [data-qa*="resume"], div')?.parentElement;
      if (container) {
        aboutMe = (container.innerText || '')
          .replace(/о себе/gi, '')
          .replace(/редактировать/gi, '')
          .trim()
          .slice(0, 5000);
      }
    }

    let experienceDescription = '';
    const expIdx = text.search(/опыт работы/i);
    if (expIdx >= 0) {
      const chunk = text.slice(expIdx, expIdx + 6000);
      const lines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 20 && !/^(опыт работы|редактировать|добавить)/i.test(l));
      experienceDescription = lines.slice(0, 12).join('\n').slice(0, 4500);
    }

    const title =
      document.querySelector('[data-qa="resume-title"]')?.innerText?.trim() ||
      document.querySelector('h1')?.innerText?.trim() ||
      '';

    return {
      hash: location.pathname.match(/\/resume\/([a-f0-9]+)/i)?.[1] || '',
      title: title.replace(/\s+/g, ' ').trim(),
      completenessPercent,
      missingHints,
      aboutMe,
      experienceDescription,
    };
  });
}
