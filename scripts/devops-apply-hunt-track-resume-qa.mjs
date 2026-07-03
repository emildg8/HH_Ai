/**
 * HT6.3 — запись QA-резюме hh.ru из QA hunt-track черновика.
 *   npm run devops:apply-hunt-track-resume-qa -- --dry-run
 *   node scripts/devops-apply-hunt-track-resume-qa.mjs --track=qa-lead --about-only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { loadProfile } from '../lib/load-profile.mjs';

loadEnv();
loadProfile();

import { sessionProfilePath, DATA_DIR } from '../lib/paths.mjs';
import { assertHhLoggedIn } from '../lib/hh-session-check.mjs';
import { launchPersistentContextSafe, closeContextSafe } from '../lib/chromium-session.mjs';
import { listApplicantResumes, applyResumeVariantContent } from '../lib/hh-resume-editor.mjs';
import {
  getDraftForQaTrack,
  getQaExperienceEntry0ForTrack,
  getQaExperienceEntriesForTrack,
  getQaSkillsForTrackApply,
  buildConditionsPayloadForQaTrack,
  skillVerifiedOnHh,
} from '../lib/hunt-track-resume-drafts-qa.mjs';
import { getSideJobsStatus, assertBrowserFreeForSideJob } from '../lib/browser-guard.mjs';
import { scrapeResumeContent, scrapeResumeVariantContent } from '../lib/hh-resume-scrape.mjs';
import {
  applyResumeEmploymentConditions,
  readResumeEmploymentViewText,
} from '../lib/hh-resume-employment-conditions.mjs';
import {
  describeSalaryRangeRu,
  salaryRangeVisibleInText,
  workFormatVisibleInText,
} from '../lib/resume-employment-conditions.mjs';

const QA_TRACK_IDS = new Set(['qa-lead', 'senior-qa', 'aqa-ai-assist']);
const REPORT = path.join(DATA_DIR, 'logs', 'hunt-track-resume-apply-latest.json');
const SYNC_RESPONSES_TIMEOUT_MS = 8 * 60 * 1000;
const SYNC_RESPONSES_POLL_MS = 15 * 1000;

/**
 * @param {string[]} argv
 */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const trackRaw = String((argv.find((a) => a.startsWith('--track=')) || '').slice(8)).trim();
  const track = trackRaw || 'qa-lead';
  const dryRun = argv.includes('--dry-run');
  const titleOnly = argv.includes('--title-only');
  const aboutOnly = argv.includes('--about-only');
  const experienceOnly = argv.includes('--experience-only');
  const skillsOnly = argv.includes('--skills-only');
  const conditionsOnly = argv.includes('--conditions-only');
  const verifyOnly = argv.includes('--verify-only');
  return { track, dryRun, titleOnly, aboutOnly, experienceOnly, skillsOnly, conditionsOnly, verifyOnly };
}

/**
 * @param {ReturnType<typeof getDraftForQaTrack>} draft
 * @param {{
 *   track?: string,
 *   titleOnly: boolean,
 *   aboutOnly: boolean,
 *   experienceOnly?: boolean,
 *   experienceOnly?: boolean,
 *   skillsOnly?: boolean,
 *   conditionsOnly?: boolean
 * }} flags
 */
export function buildApplyPayload(draft, flags) {
  const trackId = String(flags?.track || draft?.trackId || '').trim();
  const onlyFlags = [
    Boolean(flags?.titleOnly),
    Boolean(flags?.aboutOnly),
    Boolean(flags?.experienceOnly),
    Boolean(flags?.skillsOnly),
    Boolean(flags?.conditionsOnly),
  ].filter(Boolean).length;
  if (onlyFlags > 1) {
    throw new Error(
      'Используйте только один флаг режима: --title-only/--about-only/--experience-only/--skills-only/--conditions-only'
    );
  }

  const title = String(draft?.titleSuggestion || '').trim();
  const aboutMe = String(draft?.aboutMe || '').trim();
  const experienceEntries = trackId
    ? getQaExperienceEntriesForTrack(trackId)
    : draft?.experienceEntry0
      ? [{ index: 0, text: String(draft.experienceEntry0).trim() }]
      : [];
  const skills = trackId
    ? getQaSkillsForTrackApply(trackId)
    : (draft?.skillsApply || []).map((s) => String(s || '').trim()).filter(Boolean);

  const payload = {};

  if (flags?.titleOnly) {
    if (title) payload.title = title;
    return payload;
  }
  if (flags?.aboutOnly) {
    if (aboutMe) payload.aboutMe = aboutMe;
    return payload;
  }
  if (flags?.experienceOnly) {
    if (experienceEntries.length) {
      payload.experienceEntries = experienceEntries.map((entry) => ({
        index: entry.index,
        text: entry.text,
      }));
    }
    return payload;
  }
  if (flags?.skillsOnly) {
    if (skills.length) payload.skills = skills;
    return payload;
  }
  if (flags?.conditionsOnly) {
    if (trackId) {
      payload.conditions = buildConditionsPayloadForQaTrack(trackId);
    }
    return payload;
  }

  if (title) payload.title = title;
  if (aboutMe) payload.aboutMe = aboutMe;
  if (experienceEntries.length) {
    payload.experienceEntries = experienceEntries.map((entry) => ({
      index: entry.index,
      text: entry.text,
    }));
  }
  if (skills.length) payload.skills = skills;
  return payload;
}

/**
 * @param {ReturnType<typeof getDraftForQaTrack>} draft
 */
export function buildExperiencePreview(draft) {
  const entry0 = String(draft?.experienceEntry0 || '').trim();
  if (entry0) return entry0;
  const projects = draft?.experienceFraming?.projects || [];
  const rows = projects
    .map((project) => String(project?.framing || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  return rows.length ? rows.join('\n') : '';
}

/**
 * @param {string} track
 * @param {Array<{ hash: string, title: string }>} resumes
 */
export function resolveTargetResume(track, resumes) {
  const trackId = String(track || '').trim().toLowerCase();
  if (!QA_TRACK_IDS.has(trackId)) {
    return { hash: '', reason: 'unsupported-track', title: '' };
  }
  const envHash = String(process.env.HH_PROFILE_RESUME_HASH || '').trim();
  if (!envHash) {
    return { hash: '', reason: 'env-hash-missing', title: '' };
  }
  const hit = resumes.find((resume) => resume.hash === envHash);
  return {
    hash: envHash,
    reason: hit ? 'env-hash' : 'env-hash-not-listed',
    title: hit?.title || '',
  };
}

function writeReport(report) {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function shortText(text, max = 240) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function firstMeaningfulLine(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .find((line) => line.length > 8);
}

/**
 * @param {{ timeoutMs?: number, pollMs?: number, log?: (msg: string) => void }} [opts]
 */
export async function waitForSyncResponsesIdle(opts = {}) {
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : SYNC_RESPONSES_TIMEOUT_MS;
  const pollMs = Number.isFinite(opts.pollMs) ? opts.pollMs : SYNC_RESPONSES_POLL_MS;
  const log = opts.log || (() => {});
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const side = getSideJobsStatus();
    if (!side.syncResponses?.running) {
      return {
        ok: true,
        waitedMs: Date.now() - startedAt,
      };
    }
    const waitedSec = Math.round((Date.now() - startedAt) / 1000);
    log(
      `[guard] sync-responses активен (pid=${side.syncResponses.pid || 'n/a'}), ждём (${waitedSec}s/${Math.round(timeoutMs / 1000)}s)…`
    );
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const side = getSideJobsStatus();
  return {
    ok: false,
    waitedMs: Date.now() - startedAt,
    pid: side.syncResponses?.pid || null,
  };
}

async function main() {
  const args = parseCliArgs();
  if (!QA_TRACK_IDS.has(args.track)) {
    throw new Error(`Неверный --track. Разрешено: ${Array.from(QA_TRACK_IDS).join(', ')}`);
  }

  const draft = getDraftForQaTrack(args.track);
  const applyPayload = buildApplyPayload(draft, { ...args, track: args.track });
  if (
    !applyPayload.title &&
    !applyPayload.aboutMe &&
    !applyPayload.experienceEntries?.length &&
    !applyPayload.skills?.length &&
    !applyPayload.conditions
  ) {
    throw new Error(
      'После выбранных флагов нечего применять. Проверьте draft и режим (--title-only/--about-only/--experience-only/--skills-only/--conditions-only).'
    );
  }

  const report = {
    at: new Date().toISOString(),
    track: args.track,
    mode: args.dryRun ? 'dry-run' : 'live',
    flags: {
      dryRun: args.dryRun,
      titleOnly: args.titleOnly,
      aboutOnly: args.aboutOnly,
      experienceOnly: args.experienceOnly,
      skillsOnly: args.skillsOnly,
      conditionsOnly: args.conditionsOnly,
      verifyOnly: args.verifyOnly,
    },
    reportPath: REPORT,
    draftSummary: {
      titleSuggestion: shortText(draft.titleSuggestion, 120),
      aboutPreview: shortText(draft.aboutMe, 220),
      experiencePreview: shortText(buildExperiencePreview(draft), 220),
      skillsPreview: (getQaSkillsForTrackApply(args.track) || []).slice(0, 10),
    },
    payloadSummary: {
      hasTitle: Boolean(applyPayload.title),
      title: shortText(applyPayload.title, 120),
      hasAboutMe: Boolean(applyPayload.aboutMe),
      aboutLen: String(applyPayload.aboutMe || '').length,
      hasExperienceEntries: Boolean(applyPayload.experienceEntries?.length),
      experienceEntriesCount: applyPayload.experienceEntries?.length || 0,
      experiencePreview: shortText(applyPayload.experienceEntries?.[0]?.text || '', 220),
      hasSkills: Boolean(applyPayload.skills?.length),
      skillsCount: applyPayload.skills?.length || 0,
      skillsPreview: (applyPayload.skills || []).slice(0, 10),
      hasConditions: Boolean(applyPayload.conditions),
      conditionsPreview: applyPayload.conditions
        ? {
            salary: describeSalaryRangeRu(applyPayload.conditions.salaryRange),
            workFormat: applyPayload.conditions.workFormat?.labelRu || '',
            commute: applyPayload.conditions.commuteTimeRu || '',
            businessTrips: applyPayload.conditions.businessTripsLabelRu || '',
          }
        : null,
    },
    resumesOnHh: [],
    selectedResume: null,
    applyResult: null,
    verifyAfter: null,
    verifyIssues: [],
    waitedForSyncResponsesMs: 0,
    status: 'started',
    error: null,
  };

  let ctx = null;

  try {
    const waitGuard = await waitForSyncResponsesIdle({ log: console.log });
    report.waitedForSyncResponsesMs = waitGuard.waitedMs;
    if (!waitGuard.ok) {
      const err = new Error(
        `sync-responses не освободил браузер за ${Math.round(waitGuard.waitedMs / 1000)}с (pid=${waitGuard.pid || 'n/a'})`
      );
      err.code = 'BROWSER_BUSY';
      throw err;
    }

    assertBrowserFreeForSideJob('запись QA-резюме по hunt-track');

    const profile = sessionProfilePath();
    if (!fs.existsSync(profile)) {
      throw new Error('Нет профиля Chromium. Выполните: npm run login:anastasia');
    }

    const launchOpts = {
      headless: process.env.HH_HEADLESS === '1',
      viewport: { width: 1280, height: 900 },
      locale: 'ru-RU',
    };
    const channel = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
    if (channel) launchOpts.channel = channel;

    ctx = await launchPersistentContextSafe(profile, launchOpts, {
      owner: `hunt-track-resume-apply-qa-${args.track}`,
    });
    const page = ctx.pages()[0] || (await ctx.newPage());

    await page
      .goto('https://hh.ru/applicant/resumes', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      .catch(() => {});
    await page.waitForTimeout(900);
    await assertHhLoggedIn(page);
    const resumes = await listApplicantResumes(page);
    report.resumesOnHh = resumes;
    for (const resume of resumes) console.log('[resume]', resume.title, resume.hash);

    const target = resolveTargetResume(args.track, resumes);
    report.selectedResume = target;
    if (!target.hash) {
      throw new Error(
        `Не найден hash целевого QA-резюме. Проверьте HH_PROFILE_RESUME_HASH в anastasia env (track=${args.track}, reason=${target.reason})`
      );
    }

    console.log(
      `[hunt-track-resume-qa] Выбрано: ${target.title || '(без названия)'} ${target.hash.slice(0, 8)}… (${target.reason})`
    );

    if (args.verifyOnly) {
      if (applyPayload.conditions) {
        const view = await readResumeEmploymentViewText(page, target.hash);
        const verifyIssues = [];
        report.verifyAfter = {
          hash: target.hash,
          employmentBlob: shortText(view.blob, 420),
          conditionsExpected: applyPayload.conditions,
        };
        if (!salaryRangeVisibleInText(applyPayload.conditions.salaryRange, view.blob)) {
          verifyIssues.push('salary-mismatch');
        }
        if (!workFormatVisibleInText(applyPayload.conditions.workFormat, view.blob)) {
          verifyIssues.push('work-format-mismatch');
        }
        report.verifyIssues = verifyIssues;
        report.status = verifyIssues.length ? 'verify-partial' : 'verify-ok';
        writeReport(report);
        console.log('[verify-only conditions]', report.status, verifyIssues.join(', ') || 'ok');
        return;
      }

      const verify = await scrapeResumeContent(page, target.hash);
      const verifyVariant = await scrapeResumeVariantContent(page, target.hash);
      const gotSkills = verifyVariant?.skills || [];
      const skillCheck = (applyPayload.skills || draft.skillsApply || []).map((skill) => ({
        skill,
        ok: skillVerifiedOnHh(skill, gotSkills),
      }));
      report.verifyAfter = {
        hash: verify.hash,
        title: verify.title,
        aboutMePreview: shortText(verify.aboutMe, 280),
        aboutLen: String(verify.aboutMe || '').length,
        experiencePreview: shortText(
          verifyVariant?.experienceEntries?.[0]?.text || verify.experienceDescription || '',
          320
        ),
        skills: gotSkills,
        skillsCount: gotSkills.length,
        skillCheck,
      };
      const verifyIssues = [];
      if (
        draft.titleSuggestion &&
        !String(verify.title || '')
          .toLowerCase()
          .includes(String(draft.titleSuggestion).toLowerCase().slice(0, 6))
      ) {
        verifyIssues.push('title-mismatch');
      }
      if (draft.aboutMe && !String(verify.aboutMe || '').includes(String(draft.aboutMe).slice(0, 40))) {
        verifyIssues.push('about-mismatch');
      }
      const exp0 = getQaExperienceEntry0ForTrack(args.track);
      const gotExp = String(verifyVariant?.experienceEntries?.[0]?.text || verify.experienceDescription || '');
      if (exp0 && !gotExp.includes(firstMeaningfulLine(exp0)?.slice(0, 24) || '')) {
        verifyIssues.push('experience-mismatch');
      }
      for (const item of skillCheck) {
        if (!item.ok) verifyIssues.push(`skill-missing:${item.skill}`);
      }
      const condPayload = buildConditionsPayloadForQaTrack(args.track);
      if (condPayload?.salaryRange) {
        const view = await readResumeEmploymentViewText(page, target.hash);
        report.verifyAfter.employmentBlob = shortText(view.blob, 280);
        if (!salaryRangeVisibleInText(condPayload.salaryRange, view.blob)) {
          verifyIssues.push('salary-mismatch');
        }
        if (!workFormatVisibleInText(condPayload.workFormat, view.blob)) {
          verifyIssues.push('work-format-mismatch');
        }
      }
      report.verifyIssues = verifyIssues;
      report.status = verifyIssues.length ? 'verify-partial' : 'verify-ok';
      writeReport(report);
      console.log('[verify-only]', report.status, verifyIssues.join(', ') || 'ok');
      return;
    }

    if (args.dryRun) {
      report.status = 'dry-run-ok';
      console.log('[dry-run] payload:', JSON.stringify(report.payloadSummary, null, 2));
      console.log('[dry-run] about preview:', report.draftSummary.aboutPreview || '(empty)');
      writeReport(report);
      return;
    }

    if (applyPayload.conditions) {
      report.applyResult = await applyResumeEmploymentConditions(page, target.hash, {
        ...applyPayload.conditions,
        log: console.log,
      });
      console.log('[live] conditions', report.applyResult.ok ? 'ok' : 'partial', report.applyResult);
      report.status = report.applyResult.ok ? 'live-ok' : 'live-partial';
      writeReport(report);
      return;
    }

    const applyResult = await applyResumeVariantContent(page, target.hash, {
      title: applyPayload.title,
      aboutMe: applyPayload.aboutMe,
      experienceEntries: applyPayload.experienceEntries,
      skills: applyPayload.skills,
      skillsReplace: args.skillsOnly,
      log: console.log,
    });
    report.applyResult = applyResult;

    const verify = await scrapeResumeContent(page, target.hash);
    const verifyVariant = await scrapeResumeVariantContent(page, target.hash);
    report.verifyAfter = {
      hash: verify.hash,
      title: verify.title,
      aboutMePreview: shortText(verify.aboutMe, 280),
      aboutLen: String(verify.aboutMe || '').length,
      experiencePreview: shortText(
        verifyVariant?.experienceEntries?.[0]?.text || verify.experienceDescription || '',
        320
      ),
      experienceLen: String(verifyVariant?.experienceEntries?.[0]?.text || verify.experienceDescription || '')
        .length,
      skills: verifyVariant?.skills || [],
      skillsCount: verifyVariant?.skills?.length || 0,
    };

    const verifyIssues = [];
    if (applyResult?.title && applyResult.title.ok === false) {
      verifyIssues.push(`title-edit-failed:${applyResult.title.reason || 'unknown'}`);
    }
    if (applyResult?.aboutMe && applyResult.aboutMe.ok === false) {
      const probe = String(applyPayload.aboutMe || '').slice(0, 40);
      const gotAbout = String(verify.aboutMe || '');
      if (!probe || gotAbout.includes(probe)) {
        applyResult.aboutMe = { ...applyResult.aboutMe, ok: true, note: 'persisted-on-view' };
      } else {
        verifyIssues.push(`about-edit-failed:${applyResult.aboutMe.reason || 'unknown'}`);
      }
    }
    if (Array.isArray(applyResult?.experiences)) {
      for (const entry of applyResult.experiences) {
        if (entry?.ok === false) verifyIssues.push(`experience-${entry.index}-edit-failed:${entry.reason || 'unknown'}`);
      }
    }
    if (applyResult?.skills && applyResult.skills.ok === false) {
      verifyIssues.push(`skills-edit-failed:${applyResult.skills.reason || 'unknown'}`);
    }
    if (applyPayload.title) {
      const expected = String(applyPayload.title).toLowerCase().slice(0, 8);
      const got = String(verify.title || '').toLowerCase();
      if (!got) verifyIssues.push('title-empty-after-apply');
      else if (!got.includes(expected)) verifyIssues.push('title-mismatch-after-apply');
    }
    if (applyPayload.aboutMe && !String(verify.aboutMe || '').trim()) {
      verifyIssues.push('about-empty-after-apply');
    }
    if (applyPayload.experienceEntries?.length) {
      const expectedLine = firstMeaningfulLine(applyPayload.experienceEntries[0]?.text || '');
      const gotExperience = String(verifyVariant?.experienceEntries?.[0]?.text || verify.experienceDescription || '');
      if (!gotExperience.trim()) {
        verifyIssues.push('experience-empty-after-apply');
      } else if (expectedLine) {
        const probe = expectedLine.toLowerCase().slice(0, Math.min(24, expectedLine.length));
        if (!gotExperience.toLowerCase().includes(probe)) verifyIssues.push('experience-mismatch-after-apply');
      }
    }
    if (applyPayload.skills?.length) {
      const gotSkills = verifyVariant?.skills || [];
      if (!gotSkills.length) {
        verifyIssues.push('skills-empty-after-apply');
      } else {
        const missing = applyPayload.skills.filter((skill) => !skillVerifiedOnHh(skill, gotSkills));
        if (missing.length === applyPayload.skills.length) {
          verifyIssues.push('skills-mismatch-after-apply');
        } else if (missing.length) {
          verifyIssues.push(`skills-partial:${missing.join(',')}`);
        }
        if (args.skillsOnly && gotSkills.length > applyPayload.skills.length + 4) {
          verifyIssues.push(`skills-legacy-not-removed:${gotSkills.length}`);
        }
      }
    }
    report.verifyIssues = verifyIssues;

    console.log('[live] title on hh:', report.verifyAfter.title || '(empty)');
    console.log('[live] about on hh:', report.verifyAfter.aboutMePreview || '(empty)');
    if (applyPayload.experienceEntries?.length) {
      console.log('[live] experience on hh:', report.verifyAfter.experiencePreview || '(empty)');
    }
    if (applyPayload.skills?.length) {
      console.log('[live] skills on hh:', (report.verifyAfter.skills || []).join(', ') || '(empty)');
    }

    if (verifyIssues.length) {
      report.status = 'live-partial';
      console.warn('[live] verify issues:', verifyIssues.join(', '));
    } else {
      report.status = 'live-ok';
    }
    writeReport(report);
  } catch (error) {
    report.status = 'failed';
    report.error = String(error?.message || error);
    writeReport(report);
    throw error;
  } finally {
    if (ctx) {
      await closeContextSafe(ctx, `hunt-track-resume-apply-qa-${args.track}`).catch(() => {});
    }
  }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(error?.code === 'BROWSER_BUSY' ? 2 : 1);
  });
}
