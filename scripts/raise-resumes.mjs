/**
 * Поднять резюме в поиске на hh.ru.
 *   npm run devops:raise-resumes -- --all
 *   npm run devops:raise-resumes -- --role=devops
 *   npm run devops:raise-resumes -- --hash=abc123...
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { raiseResumesOnHh } from '../lib/hh-resume-raise.mjs';
import { setSideJobPid, assertBrowserFreeForSideJob } from '../lib/browser-guard.mjs';
import {
  shouldRunScheduledRaise,
  markScheduledSlotDone,
  loadResumeRaiseScheduleConfig,
} from '../lib/resume-raise-schedule.mjs';

const scheduled = process.argv.includes('--scheduled');
const raiseAll = process.argv.includes('--all');
const roleArg = process.argv.find((a) => a.startsWith('--role='));
const hashArg = process.argv.find((a) => a.startsWith('--hash='));
const role = roleArg ? roleArg.split('=')[1] : undefined;
const hash = hashArg ? hashArg.split('=')[1] : undefined;

async function main() {
  setSideJobPid('resumeRaise', process.pid);
  let slotKey = null;
  try {
    if (scheduled) {
      const check = shouldRunScheduledRaise();
      if (!check.run) {
        console.log(`[resume-raise] Пропуск (${check.reason || 'не время'})`);
        process.exit(0);
      }
      slotKey = check.slotKey;
    } else {
      assertBrowserFreeForSideJob('подъём резюме');
    }

    const profile = sessionProfilePath();
    if (!fs.existsSync(profile)) {
      console.error('Нет профиля. npm run login');
      process.exit(1);
    }

    const cfg = loadResumeRaiseScheduleConfig();
    const useAll = raiseAll || (scheduled && cfg.raiseAll !== false);

    const launchOpts = {
      headless: process.env.HH_HEADLESS !== '0',
      viewport: { width: 1280, height: 900 },
      locale: 'ru-RU',
    };
    const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
    if (ch) launchOpts.channel = ch;

    const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'resume-raise' });
    const page = ctx.pages()[0] || (await ctx.newPage());

    try {
      await assertHhLoggedIn(page);
      const result = await raiseResumesOnHh(page, {
        raiseAll: useAll && !role && !hash,
        role,
        hash,
        log: (m) => console.log(m),
      });

      console.log(
        `\n[resume-raise] Готово: поднято ${result.raised.length}, пропуск ${result.skipped.length}, ошибки ${result.errors.length}`
      );
      for (const r of result.raised) {
        console.log('  ✓', r.hash ? r.hash.slice(0, 12) : r.scope, r.method || '');
      }
      for (const s of result.skipped) {
        console.log('  ○', s.hash ? s.hash.slice(0, 12) : s.scope, s.message || s.reason);
      }
      for (const e of result.errors) {
        console.log('  ✗', e.hash ? e.hash.slice(0, 12) : '?', e.message || e.reason);
      }

      if (slotKey) {
        markScheduledSlotDone(slotKey, {
          ok: result.raised.length > 0,
          raised: result.raised.length,
          skipped: result.skipped.length,
          errors: result.errors.length,
        });
      }

      process.exit(result.errors.length && !result.raised.length ? 1 : 0);
    } finally {
      await closeContextSafe(ctx, 'resume-raise');
    }
  } catch (e) {
    console.error(e.message || e);
    process.exit(e.code === 'BROWSER_BUSY' ? 2 : 1);
  } finally {
    setSideJobPid('resumeRaise', null);
  }
}

main();
