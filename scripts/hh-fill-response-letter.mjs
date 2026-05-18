/**
 * Открывает страницу вакансии в сохранённом профиле, нажимает «Откликнуться»,
 * вставляет текст в поле сопроводительного письма. Отправку отклика не нажимает — проверьте и отправьте вручную.
 *
 * Варианты:
 *   node scripts/hh-fill-response-letter.mjs --id=<uuid записи из очереди>
 *   node scripts/hh-fill-response-letter.mjs --url=<https://hh.ru/vacancy/...> --text-file=./letter.txt
 *
 * Флаги: --stay-open — ждать Enter перед закрытием браузера.
 * HH_HEADLESS=1 — headless (для отладки формы обычно без headless).
 */

import { chromium } from 'playwright';
import fs from 'fs';
import readline from 'readline';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { getVacancyRecord } from '../lib/store.mjs';
import { clickVacancyResponseButton, fillCoverLetterField } from '../lib/hh-response-selectors.mjs';

const headless = process.env.HH_HEADLESS === '1';
const stayOpen = process.argv.includes('--stay-open');

function parseArgs() {
  const out = { id: null, url: null, textFile: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--stay-open') continue;
    if (a.startsWith('--id=')) out.id = a.slice(5).trim();
    else if (a.startsWith('--url=')) out.url = a.slice(6).trim();
    else if (a.startsWith('--text-file=')) out.textFile = a.slice(12).trim();
  }
  return out;
}

function waitEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

function looksLikeLoginUrl(url) {
  const u = url.toLowerCase();
  return u.includes('/account/login') || u.includes('oauth.hh.ru') || u.includes('/logon');
}

function resolveLetterAndUrl() {
  const { id, url, textFile } = parseArgs();

  if (id) {
    const rec = getVacancyRecord(id);
    if (!rec) {
      console.error('Запись не найдена в очереди по id:', id);
      process.exit(1);
    }
    const letter = String(rec.coverLetter?.approvedText || '').trim();
    if (!letter) {
      console.error('У записи нет утверждённого письма (coverLetter.approvedText). Сначала утвердите в дашборде.');
      process.exit(1);
    }
    if (!rec.url) {
      console.error('У записи нет url');
      process.exit(1);
    }
    return { vacancyUrl: rec.url, letterText: letter };
  }

  if (url && textFile) {
    if (!fs.existsSync(textFile)) {
      console.error('Файл не найден:', textFile);
      process.exit(1);
    }
    const letterText = fs.readFileSync(textFile, 'utf8').trim();
    if (!letterText) {
      console.error('Файл письма пуст');
      process.exit(1);
    }
    return { vacancyUrl: url, letterText };
  }

  console.error(`Укажите либо:
  --id=<uuid>  (запись с утверждённым письмом из data/vacancies-queue.json)
  либо  --url=<страница вакансии> --text-file=<путь к .txt с текстом письма>`);
  process.exit(1);
}

async function main() {
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Профиль не найден. Сначала: npm run login\n', profile);
    process.exit(1);
  }

  const { vacancyUrl, letterText } = resolveLetterAndUrl();

  const ctx = await chromium.launchPersistentContext(profile, {
    headless,
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await page.goto(vacancyUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(800);

    if (looksLikeLoginUrl(page.url())) {
      throw new Error('Редирект на логин. Выполните: npm run login');
    }

    const usedBtn = await clickVacancyResponseButton(page);
    console.log('Клик по отклику:', usedBtn);

    const usedField = await fillCoverLetterField(page, letterText);
    console.log('Текст вставлен в поле:', usedField);
    console.log('Проверьте форму и отправьте отклик вручную (скрипт отправку не нажимает).');

    if (stayOpen) {
      await waitEnter('Enter — закрыть браузер: ');
    }
  } finally {
    await ctx.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
