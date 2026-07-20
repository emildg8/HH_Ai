#!/usr/bin/env node

/**

 * Точечный отклик HT.7: precheck tier A (лестница fresh → tier A) → до N откликов/день.

 *   npm run devops:apply-point-ready

 *   npm run devops:apply-point-ready -- --dry-run

 *   npm run devops:apply-point-ready -- --tracks=devops,infra --limit=3

 */

import { spawn } from 'child_process';

import fs from 'fs';

import path from 'path';

import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

import { getVacancyRecord, loadQueue } from '../lib/store.mjs';

import { loadPreferences } from '../lib/preferences.mjs';

import { ROOT, DATA_DIR } from '../lib/paths.mjs';

import { HH_SITE_STATES, hhSiteStateBlocksApply, hhSiteStateLabel } from '../lib/hh-vacancy-response-state.mjs';

import { assertPointApplyAllowed } from '../lib/hunt-tracks.mjs';

import { recordNeedsQuestionnaireWork } from '../lib/questionnaire-labels.mjs';

import { pickPointApplyCandidate } from '../lib/point-apply-gate.mjs';

import {
  collectPointDayWaveLetterItems,
} from '../lib/letter-wave-fingerprint.mjs';

import { resolvePointApplyPool } from '../lib/point-apply-precheck.mjs';

import { ensurePointApplyLetters } from '../lib/point-apply-letter-prep.mjs';
import { resolvePointApplyNoPrepareLetters } from '../lib/point-apply-prepare-policy.mjs';

import {

  getPointApplyDailyCap,

  pointApplySlotsRemaining,

  resolvePointApplyRunLimit,

} from '../lib/point-apply-prefs.mjs';

import { checkApplyRateLimits, recordApplyLaunch } from '../lib/hh-apply-rate.mjs';

import { parseHuntTracksOpt } from '../lib/batch-precheck-report.mjs';
import { classifyVacancyHuntTrack } from '../lib/hunt-tracks.mjs';
import {
  getPointApplyAutoTracks,
  pickNextTrackForApply,
  recordPointApplyTrack,
  pointApplyTrackQuotaSummary,
  trackQuotaRemaining,
} from '../lib/point-apply-track-quotas.mjs';



loadDevOpsEnv();



const argv = process.argv.slice(2);

const dryRun = argv.includes('--dry-run');

const prepareLettersFlag = argv.includes('--prepare-letters');
const noPrepareLettersFlag = argv.includes('--no-prepare-letters');



const prefs = loadPreferences();

const tracksArg = argv.find((a) => a.startsWith('--tracks='));

const trackArg = argv.find((a) => a.startsWith('--track='));

const explicitTracks = tracksArg

  ? parseHuntTracksOpt(tracksArg.slice('--tracks='.length))

  : trackArg

    ? [trackArg.slice('--track='.length).trim()]

    : null;

const huntTracks = explicitTracks?.length ? explicitTracks : getPointApplyAutoTracks(prefs);

const huntTrack = huntTracks[0] || 'devops';



for (const tid of huntTracks) {

  const trackGate = assertPointApplyAllowed(tid);

  if (!trackGate.ok) {

    console.error(`[point-apply] ${trackGate.reason}`);

    process.exit(1);

  }

  if (trackGate.requiresApproval) {

    console.log(`[point-apply] маршрут ${tid}: только карточки с userApproved`);

  }

}



const skipIdArg = argv.find((a) => a.startsWith('--skip-id='));

const skipIds = new Set(

  (skipIdArg ? skipIdArg.slice('--skip-id='.length) : '')

    .split(',')

    .map((x) => x.trim())

    .filter(Boolean)

);

const onlyIdArg = argv.find((a) => a.startsWith('--only='));

const onlyIds = new Set(

  (onlyIdArg ? onlyIdArg.slice('--only='.length) : '')

    .split(',')

    .map((x) => x.trim())

    .filter(Boolean)

);

const noPrepareLetters = resolvePointApplyNoPrepareLetters({
  onlyIdsSize: onlyIds.size,
  noPrepareLetters: noPrepareLettersFlag,
  prepareLetters: prepareLettersFlag,
});
if (onlyIds.size && noPrepareLetters) {
  console.log('[point-apply] --only= → без авто-regen лестницы (откат: --prepare-letters / HH_POINT_PREPARE_ON_ONLY=1)');
}

const REPORT = path.join(DATA_DIR, 'logs', 'point-apply-latest.json');

const SESSION_REPORT = path.join(DATA_DIR, 'logs', 'point-apply-session-latest.json');

const runLimit = resolvePointApplyRunLimit({ argv: process.argv, prefs });



function scoreOf(rec) {

  return Number(rec?.scoreOverall ?? rec?.geminiScore ?? 0) || 0;

}



function isAlreadyAppliedInQueue(rec) {

  if (!rec) return true;

  if (rec.status === 'responded') return true;

  if (rec.hhApply?.responseSubmitted) return true;

  const st = String(rec.hhApply?.hhSiteState || rec.negotiationStatus || '').toLowerCase();

  return st === 'already_applied' || st === 'response_sent' || st === 'submitted';

}



function hasSubmittedOnHh(rec) {

  if (!rec) return false;

  if (rec.status === 'responded') return true;

  return Boolean(rec.hhApply?.responseSubmitted);

}



function classifyPointApplyOutcome({ before, after, childCode }) {

  const hhSiteState = String(after?.hhApply?.hhSiteState || '').toLowerCase();

  const responseSubmitted = hasSubmittedOnHh(after);

  const hadResponseBefore = hasSubmittedOnHh(before);

  const detectedOnly =
    Boolean(after?.hhApply?.hhDetectedOnly) &&
    !after?.hhApply?.letterDelivered &&
    !after?.hhApply?.letterInForm;

  const label = hhSiteStateLabel(hhSiteState);



  if (childCode !== 0) {

    return {

      status: 'failed',

      exitCode: childCode,

      responseSubmitted,

      verifiedOnHh: false,

      hhSiteState: hhSiteState || 'none',

      note: 'hh-apply-chat завершился с ошибкой',

      failGate: true,

    };

  }



  if (hhSiteState === HH_SITE_STATES.UNAVAILABLE || hhSiteState === HH_SITE_STATES.ARCHIVED) {

    return {

      status: 'false-positive',

      exitCode: childCode,

      responseSubmitted,

      verifiedOnHh: false,

      hhSiteState,

      note: `${label || hhSiteState}: отклик на hh недоступен, SUCCESS запрещён`,

      failGate: true,

    };

  }



  if (!responseSubmitted) {

    return {

      status: 'false-positive',

      exitCode: childCode,

      responseSubmitted: false,

      verifiedOnHh: false,

      hhSiteState: hhSiteState || 'none',

      note: 'exit 0 без подтверждения responseSubmitted в queue',

      failGate: true,

    };

  }



  if (detectedOnly || (hhSiteStateBlocksApply(hhSiteState) && hadResponseBefore)) {

    return {

      status: 'skipped-repeat',

      exitCode: childCode,

      responseSubmitted: true,

      verifiedOnHh: true,

      hhSiteState: hhSiteState || 'already_applied',

      note: 'Повторный отклик/статус hh уже был — skip, не first-apply success',

      failGate: false,

    };

  }



  return {

    status: 'ok',

    exitCode: childCode,

    responseSubmitted: true,

    verifiedOnHh: true,

    hhSiteState: hhSiteState || 'already_applied',

    note: 'Отклик подтверждён post-check (responseSubmitted=true)',

    failGate: false,

  };

}



async function pickReadyForPointApply(readyItems) {

  /** @type {object[]} */
  let pool = readyItems;

  if (onlyIds.size) {

    const fromPool = readyItems.filter((item) => onlyIds.has(item.id));

    const missing = [...onlyIds].filter((id) => !fromPool.some((i) => i.id === id));

    /** @type {object[]} */
    const forced = [];

    for (const id of missing) {

      const rec = getVacancyRecord(id);

      if (!rec || isAlreadyAppliedInQueue(rec)) continue;

      forced.push({

        id,

        title: rec.title,

        company: rec.employer || rec.company || null,

        score: scoreOf(rec),

        url: rec.url || rec.alternateUrl || null,

        userApproved: Boolean(rec.userApproved),

      });

    }

    pool = [...fromPool, ...forced];

    if (onlyIds.size) {

      console.log(

        `[point-apply] --only=${[...onlyIds].join(',')} · в пуле ${fromPool.length}, форс ${forced.length}`

      );

    }

  }

  const eligibleItems = pool.filter((item) => {

    const rec = getVacancyRecord(item.id) || item;

    if (onlyIds.size && !onlyIds.has(item.id)) return false;

    return !skipIds.has(item.id) && !isAlreadyAppliedInQueue(rec);

  });

  const queue = loadQueue({ force: true }) || [];
  const waveItems = collectPointDayWaveLetterItems(queue, {
    shortlistIds: eligibleItems.map((x) => x.id),
  }).map((x) => ({
    id: x.id,
    company: x.company,
    letter: x.letter,
  }));

  const { picked, blockedSamples } = await pickPointApplyCandidate(eligibleItems, {

    getRec: (id) => getVacancyRecord(id),
    waveItems,

  });

  if (!picked) return { picked: null, blockedSamples };

  return { picked, blockedSamples };

}



async function runOneApply(pick, out) {

  if (dryRun) {

    out.status = 'dry-run';

    return { ok: true, dryRun: true };

  }



  const beforeApply = getVacancyRecord(pick.id) || pick;

  console.log(`Точечный отклик: ${pick.company} — ${pick.title}`);

  // Preflight видимости резюме (Magritte clients) — verify на форме этой вакансии; abort при !ok.
  // Отключается HH_RESUME_VISIBILITY_PREFLIGHT=0
  if (String(process.env.HH_RESUME_VISIBILITY_PREFLIGHT ?? '1').trim() !== '0' && !dryRun) {
    try {
      const { resolveResumeForVacancy } = await import('../lib/resume-routing.mjs');
      const { launchPersistentContextSafe, closeContextSafe } = await import('../lib/chromium-session.mjs');
      const { sessionProfilePath } = await import('../lib/paths.mjs');
      const { showResumeVisibleToHhClients } = await import('../lib/hh-resume-visibility.mjs');
      const { vacancyIdFromUrl } = await import('../lib/vacancy-parse.mjs');
      const resumePick = resolveResumeForVacancy(beforeApply);
      const hash = String(resumePick.hash || '').trim();
      const verifyVacancyId =
        String(beforeApply.vacancyId || '').trim() ||
        vacancyIdFromUrl(beforeApply.url || '') ||
        '';
      if (hash) {
        console.log(
          `[point-apply] visibility preflight: ${resumePick.title} [${hash.slice(0, 8)}…]` +
            (verifyVacancyId ? ` verifyVac=${verifyVacancyId}` : '')
        );
        const ctx = await launchPersistentContextSafe(
          sessionProfilePath(),
          { headless: true, viewport: { width: 1280, height: 800 }, locale: 'ru-RU' },
          { owner: 'point-vis-preflight', skipMinimize: true }
        );
        try {
          const page = ctx.pages()[0] || (await ctx.newPage());
          const vis = await showResumeVisibleToHhClients(page, hash, {
            log: (m) => console.log(m),
            verifyVacancyId: verifyVacancyId || undefined,
          });
          console.log(`[point-apply] visibility: ${vis?.message || vis?.ok || JSON.stringify(vis)}`);
          if (vis && vis.ok === false) {
            const reason = vis.reason || 'resume_visibility';
            console.warn(`[point-apply] visibility STOP: ${reason} — ${vis.message || ''}`);
            return {
              ok: false,
              status: 'skip',
              reason,
              message: vis.message || 'resume_visibility',
              pick,
              visibility: vis,
            };
          }
        } finally {
          await closeContextSafe(ctx, 'point-vis-preflight');
        }
      }
    } catch (e) {
      console.warn(`[point-apply] visibility preflight error (fail-closed): ${e?.message || e}`);
      return {
        ok: false,
        status: 'skip',
        reason: 'resume_visibility_preflight_error',
        message: String(e?.message || e),
        pick,
      };
    }
  }

  const pointQAuto = String(process.env.HH_POINT_QUESTIONNAIRE_AUTO ?? '1').trim() !== '0';

  const questionnaireAuto =

    pointQAuto ||

    recordNeedsQuestionnaireWork(pick) ||

    process.env.HH_QUESTIONNAIRE_AUTO === '1';

  const childArgs = ['scripts/hh-apply-chat-letter.mjs', `--id=${pick.id}`];

  if (questionnaireAuto) childArgs.push('--questionnaire-auto');

  const child = spawn(process.execPath, childArgs, {

    cwd: ROOT,

    stdio: 'inherit',

    env: {

      ...process.env,

      HH_HEADLESS: process.env.HH_HEADLESS || '0',

      HH_FAST: process.env.HH_FAST || '1',

      HH_QUESTIONNAIRE_AUTO: questionnaireAuto ? '1' : '',

    },

  });



  const code = await new Promise((resolve) => child.on('close', resolve));

  const afterApply = getVacancyRecord(pick.id) || pick;

  const result = classifyPointApplyOutcome({

    before: beforeApply,

    after: afterApply,

    childCode: Number(code) || 0,

  });

  return { ...result, pick };

}



function writeReport(filePath, data) {

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

}



async function main() {

  const slots = pointApplySlotsRemaining(prefs);

  const cap = getPointApplyDailyCap(prefs);



  console.log(

    `[point-apply] треки: ${huntTracks.join(', ')} · лимит прогона: ${runLimit} · слоты сегодня: ${slots}/${cap}`

  );

  const quotaLine = pointApplyTrackQuotaSummary(huntTracks, prefs)

    .map((q) => `${q.track} ${q.used}/${q.quota}`)

    .join(' · ');

  if (quotaLine) console.log(`[point-apply] квоты маршрутов: ${quotaLine}`);



  if (runLimit <= 0) {

    const rateErr = checkApplyRateLimits();

    const msg = rateErr || `Дневной лимит point apply (${cap}) исчерпан`;

    writeReport(REPORT, {

      at: new Date().toISOString(),

      huntTracks,

      status: 'rate-limited',

      message: msg,

    });

    console.log(msg);

    process.exit(0);

  }



  if (!noPrepareLetters && !dryRun) {

    await ensurePointApplyLetters({

      huntTracks,

      prefs,

      limit: Math.max(3, runLimit * 2),

      log: console.log,

    });

  }



  const session = {

    at: new Date().toISOString(),

    huntTracks,

    dryRun,

    runLimit,

    dailyCap: cap,

    slotsRemainingStart: slots,

    poolId: null,

    poolLabel: null,

    letterPrep: !noPrepareLetters,

    attempts: [],

    ok: 0,

    failed: 0,

    skipped: 0,

  };



  let lastOut = null;

  let anyFail = false;



  for (let i = 0; i < runLimit; i++) {

    const rateErr = checkApplyRateLimits();

    if (rateErr) {

      console.log(rateErr);

      break;

    }



    const trackThisRound =

      huntTracks.length === 1 ? huntTracks[0] : pickNextTrackForApply(huntTracks, prefs);



    const out = {

      at: new Date().toISOString(),

      huntTrack: trackThisRound,

      huntTracks,

      poolId: null,

      poolLabel: null,

      ready: 0,

      totalCandidates: 0,

      blockedByCompany: {},

      dryRun,

      attempt: i + 1,

      runLimit,

      selected: null,

      status: 'skipped',

    };



    if (!trackThisRound) {

      out.status = 'track-quota-exhausted';

      out.message = 'Дневные квоты по маршрутам исчерпаны';

      session.attempts.push(out);

      lastOut = out;

      console.log(out.message);

      break;

    }



    const tracksWithQuota = huntTracks.filter((tid) => trackQuotaRemaining(tid, prefs) > 0);
    const poolTracks = tracksWithQuota.length ? tracksWithQuota : [trackThisRound];
    const poolWrap = await resolvePointApplyPool({
      huntTracks: poolTracks,
      prefs,
      skipIds: [...skipIds],
    });

    const report = poolWrap.report;

    session.poolId = poolWrap.poolId;

    session.poolLabel = poolWrap.poolLabel;



    const readyItems = report?.readyItems || [];

    out.poolId = poolWrap.poolId;

    out.poolLabel = poolWrap.poolLabel;

    out.ready = report?.ready ?? 0;

    out.totalCandidates = report?.totalCandidates ?? 0;

    out.blockedByCompany = report?.blockedByCompany ?? {};



    if (!readyItems.length && !onlyIds.size) {

      out.status = 'no-ready';

      out.message = `Нет ready (${report?.ready}/${report?.totalCandidates}) · пул: ${poolWrap.poolLabel}`;

      if (report?.blockedByCompany && Object.keys(report.blockedByCompany).length) {

        const top = Object.entries(report.blockedByCompany)

          .sort((a, b) => b[1] - a[1])

          .slice(0, 5)

          .map(([co, n]) => `${co} (${n})`)

          .join(', ');

        out.message += ` · блокеры по компаниям: ${top}`;

      }

      session.attempts.push(out);

      lastOut = out;

      console.log(out.message);

      break;

    }



    const pickedWrap = await pickReadyForPointApply(readyItems);

    if (!pickedWrap.picked) {

      if (pickedWrap.blockedSamples?.length) {

        out.status = 'blocked-point-gate';

        out.blockedSamples = pickedWrap.blockedSamples.slice(0, 5);

        out.message = `Point-gate: все ready заблокированы (hrStack/ниша)`;

      } else {

        out.status = 'no-eligible-ready';

        out.message = `Нет eligible ready — skip-id или уже откликались`;

      }

      session.attempts.push(out);

      lastOut = out;

      console.log(out.message);

      break;

    }



    const picked = pickedWrap.picked;

    const pick = picked.rec;

    skipIds.add(pick.id);



    if (picked.gate) {

      out.pointApplyGate = {

        hrStack: picked.gate.hrStack,

        niche: picked.gate.niche,

        gateScore: picked.gate.gateScore,

      };

    }

    out.selected = {

      id: pick.id,

      title: pick.title,

      company: pick.company,

      score: scoreOf(pick),

      url: pick.url,

      userApproved: Boolean(pick.userApproved),

      preferTier: picked.preferTier || null,

      preferReasons: picked.preferReasons || [],

      fitScore: picked.fitScore ?? null,

      shortlistRank: picked.shortlistRank ?? null,

      shortlistSize: picked.shortlistSize ?? null,

    };



    const preferLine = picked.preferTier

      ? `prefer=${picked.preferTier} #${picked.shortlistRank}/${picked.shortlistSize} fit=${Math.round(picked.fitScore || 0)}${

          picked.preferReasons?.length ? ` (${picked.preferReasons.slice(0, 3).join(', ')})` : ''

        }`

      : '';



    if (dryRun) {

      out.status = 'dry-run';

      session.attempts.push(out);

      lastOut = out;

      console.log(

        `[dry-run ${i + 1}/${runLimit}] ${pick.company} — ${pick.title}${preferLine ? ` · ${preferLine}` : ''}`

      );

      continue;

    }



    if (preferLine) console.log(`[point-apply] ${preferLine}`);



    const result = await runOneApply(pick, out);

    out.status = result.status;

    out.exitCode = result.exitCode;

    out.responseSubmitted = result.responseSubmitted;

    out.verifiedOnHh = result.verifiedOnHh;

    out.hhSiteState = result.hhSiteState;

    out.note = result.note;

    session.attempts.push(out);

    lastOut = out;

    writeReport(REPORT, out);



    if (result.status === 'ok') {

      recordApplyLaunch();

      recordPointApplyTrack(classifyVacancyHuntTrack(pick) || trackThisRound);

      session.ok++;

    }

    else if (result.failGate) {

      session.failed++;

      anyFail = true;

      break;

    } else session.skipped++;

  }



  session.slotsRemainingEnd = pointApplySlotsRemaining(prefs);

  writeReport(SESSION_REPORT, session);



  if (lastOut) writeReport(REPORT, lastOut);



  if (dryRun) {

    console.log(`[dry-run] готово: ${session.attempts.length} кандидат(ов)`);

    return;

  }



  process.exit(anyFail ? 1 : 0);

}



main().catch((e) => {

  console.error(e.message || e);

  process.exit(1);

});


