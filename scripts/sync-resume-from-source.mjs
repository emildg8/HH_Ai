/**
 * Синхронизация резюме с эталона (опыт + «О себе») на все варианты.
 *   npm run devops:sync-resume-from-source
 *   npm run devops:sync-resume-from-source -- --dry-run
 *   npm run devops:sync-resume-from-source -- --probe-only
 *   npm run devops:sync-resume-from-source -- --role=devops --force
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadEnv();
loadDevOpsEnv();

import { sessionProfilePath, ROOT, DATA_DIR } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { listApplicantResumes, applyResumeVariantContent } from '../lib/hh-resume-editor.mjs';
import { scrapeResumeContent } from '../lib/hh-resume-scrape.mjs';
import {
  loadResumeVariantsConfig,
  generateVariantTexts,
  resolveVariantTexts,
  resolveSourceVariant,
  resumeVariantNeedsFill,
} from '../lib/resume-variants.mjs';

const LEGACY_SOURCE_HASH =
  process.env.HH_RESUME_SOURCE_HASH || '5b1800eeff08c89ff50039ed1f63626a393870';
const dryRun = process.argv.includes('--dry-run');
const probeOnly = process.argv.includes('--probe-only');
const forceAll = process.argv.includes('--force');
const roleArg = (process.argv.find((a) => a.startsWith('--role=')) || '').slice(7).trim();
const REPORT = path.join(DATA_DIR, 'resume-sync-report.json');

async function main() {
  const cfg = loadResumeVariantsConfig();
  const sourceRef = resolveSourceVariant(cfg);
  const sourceHash = sourceRef.hash || cfg.sourceHash || LEGACY_SOURCE_HASH;
  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('npm run login');
    process.exit(1);
  }

  const launchOpts = { headless: false, viewport: { width: 1400, height: 900 }, locale: 'ru-RU' };
  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: 'resume-sync-source' });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const report = {
    at: new Date().toISOString(),
    sourceRole: sourceRef.role,
    sourceHash,
    probes: [],
    applied: [],
  };

  try {
    await assertHhLoggedIn(page);
    const onHh = await listApplicantResumes(page);
    console.log('[sync] На hh.ru:', onHh.length, 'резюме');
    for (const r of onHh) console.log(' ', r.title, r.hash.slice(0, 8) + '…');

    const source = await scrapeResumeContent(page, sourceHash);
    report.source = source;
    console.log('\n[эталон]', source.title, sourceRef.role ? `(${sourceRef.role})` : '');
    console.log('  завершённость:', source.completenessPercent ?? '—', '%');
    console.log('  не хватает:', source.missingHints.join(', ') || '—');
    console.log('  «О себе»:', source.aboutMe?.slice(0, 80) || '(пусто)…');
    console.log('  опыт:', source.experienceDescription?.slice(0, 120) || '(пусто)…');

    let targets = (cfg.variants || []).filter((v) => v.hash && v.hash !== sourceHash);
    if (roleArg) {
      targets = targets.filter((v) => v.role === roleArg);
      if (!targets.length) {
        console.error(`[sync] Нет варианта role=${roleArg} с hash в resume-variants.json`);
        process.exit(1);
      }
    }

    for (const v of targets) {
      const probe = await scrapeResumeContent(page, v.hash);
      report.probes.push({ role: v.role, titleOnHh: v.titleOnHh, ...probe });
      const needs = resumeVariantNeedsFill(probe, source, { force: forceAll });
      console.log(`\n[${v.role}] ${probe.title || v.titleOnHh}`);
      console.log('  завершённость:', probe.completenessPercent ?? '—', '%');
      console.log('  не хватает:', probe.missingHints.join(', ') || '—');
      console.log('  «О себе»:', probe.aboutMe?.slice(0, 60) || '(пусто)');
      console.log('  дополнить:', needs ? 'да' : 'нет');
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('\nОтчёт:', REPORT);

    if (probeOnly) return;

    for (const v of targets) {
      const probe = report.probes.find((p) => p.role === v.role);
      const needsFill = resumeVariantNeedsFill(probe, source, { force: forceAll });

      if (!needsFill) {
        console.log(`[${v.role}] пропуск — достаточно заполнено`);
        continue;
      }

      let aboutMe = source.aboutMe || '';
      let experienceDescription = source.experienceDescription || '';
      try {
        const texts = await generateVariantTexts(v.role);
        if (texts.aboutMe) aboutMe = texts.aboutMe;
        if (texts.experienceDescription) experienceDescription = texts.experienceDescription;
      } catch (e) {
        console.warn(`[${v.role}] LLM тексты не сгенерированы, берём с эталона:`, e.message);
      }

      const resolved = resolveVariantTexts(v.role);
      const hash = v.hash || resolved.hash;
      if (!hash) continue;

      if (dryRun) {
        console.log(`[dry-run] ${v.role} → ${hash.slice(0, 8)}…`);
        continue;
      }

      const r = await applyResumeVariantContent(page, hash, {
        aboutMe,
        experienceDescription,
        log: console.log,
      });
      report.applied.push({ role: v.role, hash, result: r });
      console.log(`[${v.role}] применено:`, JSON.stringify(r));

      const after = await scrapeResumeContent(page, hash);
      console.log(
        `  после: ${after.completenessPercent ?? '—'}% · «О себе» ${after.aboutMe ? 'есть' : 'пусто'}`
      );
    }

    fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    await closeContextSafe(ctx, 'resume-sync-source');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
