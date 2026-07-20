/**
 * Правка сегодняшних писем Emil после L0 letter-quality (20.07).
 *   node scripts/run-with-instance.mjs --instance=emil -- node scripts/fix-hh-letters-2026-07-20.mjs
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { getVacancyRecord } from '../lib/store.mjs';
import { vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { sessionProfilePath } from '../lib/paths.mjs';
import { editCoverLetterInVacancyChat } from '../lib/hh-chat-selectors.mjs';

const TARGETS = [
  { id: '33cd7dec-4f9e-4961-96fa-22eee8abfbc9', label: 'Каспер IDP' },
  { id: '7e5a6f56-6e1c-41f5-b47d-c54b74895693', label: 'МАГНИТ Vault' },
  { id: 'f764c894-5682-43ba-a91f-5198987ab20f', label: 'Рестрим' },
  { id: '8d89e21d-77a0-4393-892a-f6e1166d5e63', label: 'ДОМ.РФ ЕФО' },
  { id: '3faabbab-773d-4003-a9fe-3df0815d5ff7', label: 'Сбер SberTech' },
];

const log = (m) => console.log(m);
const ctx = await launchPersistentContextSafe(
  sessionProfilePath(),
  { headless: true, viewport: { width: 1400, height: 900 }, locale: 'ru-RU' },
  { owner: 'fix-hh-letters-2026-07-20', skipMinimize: true }
);
const page = ctx.pages()[0] || (await ctx.newPage());
const results = [];

try {
  await page.goto('https://hh.ru/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await assertHhLoggedIn(page);

  for (const t of TARGETS) {
    const rec = getVacancyRecord(t.id);
    const letter = String(rec?.coverLetter?.approvedText || '').trim();
    if (!rec || !letter) {
      results.push({ label: t.label, ok: false, note: 'нет письма' });
      continue;
    }
    const vacancyId = vacancyIdFromUrl(rec.url) || String(rec.vacancyId || '');
    log(`\n=== ${t.label} · ${vacancyId} · ${letter.length} симв.`);
    try {
      await page.goto(`https://hh.ru/vacancy/${vacancyId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await page.waitForTimeout(2000);
      const goChat = page
        .getByRole('link', { name: /перейти в чат|открыть чат|написать/i })
        .or(page.getByRole('button', { name: /перейти в чат|открыть чат/i }))
        .first();
      if (await goChat.isVisible({ timeout: 3000 }).catch(() => false)) {
        await goChat.click({ force: true });
        await page.waitForTimeout(3000);
      }
      const r = await editCoverLetterInVacancyChat(
        page,
        {
          text: letter,
          vacancyId,
          company: rec.company,
          vacancyTitle: rec.title,
          forceAlwaysEdit: true,
          log,
        },
        log
      );
      results.push({ label: t.label, ok: r === 'edited' || r === 'verified-visible', note: String(r) });
    } catch (e) {
      results.push({ label: t.label, ok: false, note: String(e?.message || e).slice(0, 240) });
    }
  }
} finally {
  await closeContextSafe(ctx, 'fix-hh-letters-2026-07-20');
}

console.log('\n=== RESULT ===');
console.log(JSON.stringify(results, null, 2));
process.exit(results.every((x) => x.ok) ? 0 : 2);
