/**
 * Применить тексты вариантов резюме на hh.ru (О себе + опыт).
 *   npm run devops:generate-resume-texts -- --role=devops
 *   npm run devops:sync-resume-variants
 *   npm run devops:sync-resume-variants -- --role=support --dry-run
 */

import fs from 'fs';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import {
  loadResumeVariantsConfig,
  resolveVariantTexts,
  generateVariantTexts,
} from '../lib/resume-variants.mjs';
import { applyResumeVariantContent, listApplicantResumes } from '../lib/hh-resume-editor.mjs';
import { ensureResumeTitlesExist } from '../lib/hh-resume-create.mjs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const dryRun = process.argv.includes('--dry-run');
const roleArg = (process.argv.find((a) => a.startsWith('--role=')) || '').slice(6).trim();
const genOnly = process.argv.includes('--generate-only');
const ensureResumes = process.argv.includes('--ensure-resumes');

function saveVariantHashes(cfg, onHh) {
  const cfgPath = path.join(ROOT, 'config', 'resume-variants.json');
  let changed = false;
  for (const v of cfg.variants || []) {
    if (v.hash) continue;
    const match = onHh.find((r) =>
      v.titleOnHh && r.title.toLowerCase().includes(String(v.titleOnHh).toLowerCase().slice(0, 10))
    );
    if (match) {
      v.hash = match.hash;
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
    console.log('[resume-variants] Обновлены hash в config/resume-variants.json');
  }
}

async function main() {
  const cfg = loadResumeVariantsConfig();
  const roles = roleArg
    ? [roleArg]
    : (cfg.variants || []).map((v) => v.role).filter(Boolean);

  if (!roles.length) {
    console.error('Нет вариантов в config/resume-variants.json');
    process.exit(1);
  }

  for (const role of roles) {
    console.log(`[resume-variants] Генерация текстов: ${role}`);
    await generateVariantTexts(role);
  }

  if (genOnly) {
    console.log('[resume-variants] --generate-only: тексты в data/resume-variants-drafts.json');
    return;
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('npm run login');
    process.exit(1);
  }

  const launchOpts = { headless: false, viewport: { width: 1280, height: 900 }, locale: 'ru-RU' };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;

  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'resume-variants' });
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await assertHhLoggedIn(page);
    let onHh = await listApplicantResumes(page);
    console.log('[resume-variants] На hh.ru:', onHh.map((r) => `${r.title} (${r.hash.slice(0, 8)}…)`).join(' | '));

    if (ensureResumes) {
      const missing = (cfg.variants || [])
        .filter((v) => v.titleOnHh && !onHh.some((r) => r.title.toLowerCase().includes(v.titleOnHh.toLowerCase().slice(0, 8))))
        .map((v) => v.titleOnHh);
      if (missing.length) {
        console.log('[resume-variants] Создаём дубли:', missing.join(', '));
        await ensureResumeTitlesExist(page, {
          titles: missing,
          sourceHash: onHh[0]?.hash,
          log: console.log,
        });
        onHh = await listApplicantResumes(page);
      }
    }
    saveVariantHashes(cfg, onHh);

    for (const role of roles) {
      const texts = resolveVariantTexts(role);
      if (!texts.hash) {
        const match = onHh.find((r) =>
          texts.titleOnHh && r.title.toLowerCase().includes(texts.titleOnHh.toLowerCase().slice(0, 8))
        );
        if (match) texts.hash = match.hash;
      }
      if (!texts.hash) {
        console.warn(`[resume-variants] ${role}: нет hash — укажите в resume-variants.json или создайте резюме с названием «${texts.titleOnHh}»`);
        continue;
      }
      if (dryRun) {
        console.log(`[dry-run] ${role} → ${texts.hash}`, texts.aboutMe?.slice(0, 80));
        continue;
      }
      const r = await applyResumeVariantContent(page, texts.hash, {
        aboutMe: texts.aboutMe,
        experienceDescription: texts.experienceDescription,
        log: console.log,
      });
      console.log(`[resume-variants] ${role}:`, JSON.stringify(r));
    }
  } finally {
    await closeContextSafe(ctx, 'resume-variants');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
