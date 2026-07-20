/**
 * Дневной оркестратор охоты (Emil + Anastasia).
 * Срез 1: status + plan + apply-lane.lock
 * Срез 2: ship (point|basket) + outcome JSON; repair отдельной фазой (без авто-repair в ship)
 * MC: basket pack-ship / summary / repair hints по HH_INSTANCE_ID
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getDataDir, ROOT } from './paths.mjs';
import { loadPreferences } from './preferences.mjs';
import { getBrowserLockInfo, clearStaleBrowserLock } from './chromium-session.mjs';
import {
  getApplyLaneLockInfo,
  clearStaleApplyLaneLock,
  assertApplyLaneFreeForPlan,
  acquireApplyLaneLock,
  releaseApplyLaneLock,
  ApplyLaneBusyError,
} from './apply-lane-lock.mjs';
import {
  getPointApplyDailyCap,
  pointApplySlotsRemaining,
} from './point-apply-prefs.mjs';
import {
  getPointApplyAutoTracks,
  pointApplyTrackQuotaSummary,
} from './point-apply-track-quotas.mjs';
import { resolveDuplicateCompanyCooldownDays } from './apply-red-flags.mjs';
import { resolvePointApplyPool } from './point-apply-precheck.mjs';
import { countApplyLaunchesLastDay, getMaxApplyChatPerDay } from './hh-apply-rate.mjs';
import { getVacancyRecord } from './store.mjs';
import { normalizeHuntDayShipOutcome } from './apply-ship-outcome.mjs';
import {
  loadBasketPacksConfig,
  resolveShipPackId,
  getPackItems,
} from './basket-packs.mjs';
import { validateBasketIds } from './basket-validate.mjs';
import { ensurePointApplyLetters } from './point-apply-letter-prep.mjs';
import { runDeliverLetterVacancy } from './spawn-deliver-letter-vacancy.mjs';
import { questionnaireHasLiveProbe } from './hh-questionnaire-auto.mjs';
import { recordNeedsQuestionnaireWork } from './questionnaire-labels.mjs';

export const HUNT_DAY_MODES = /** @type {const} */ (['point', 'basket']);

/** @returns {string} */
export function resolveHuntDayInstance() {
  return String(process.env.HH_INSTANCE_ID || process.env.HH_PROFILE || 'emil')
    .trim()
    .toLowerCase();
}

/** @param {string} [instance] */
export function isAnastasiaHuntDayInstance(instance = resolveHuntDayInstance()) {
  return String(instance || '').trim().toLowerCase() === 'anastasia';
}

/** @param {string} [instance] */
export function packShipScriptForInstance(instance = resolveHuntDayInstance()) {
  return isAnastasiaHuntDayInstance(instance)
    ? 'scripts/devops-anastasia-pack-ship.mjs'
    : 'scripts/devops-emil-pack-ship.mjs';
}

/** @param {string} [instance] */
export function packShipSummaryFileForInstance(instance = resolveHuntDayInstance()) {
  return isAnastasiaHuntDayInstance(instance)
    ? 'anastasia-pack-ship-summary.json'
    : 'emil-pack-ship-summary.json';
}

/** @param {string} [instance] */
export function huntDayNpmScriptForInstance(instance = resolveHuntDayInstance()) {
  return isAnastasiaHuntDayInstance(instance)
    ? 'devops:hunt-day:anastasia'
    : 'devops:hunt-day:emil';
}

/**
 * Id корзин дня Насти (не emil-basket-packs).
 * @param {{ onlyId?: string }} [opts]
 * @returns {string[]}
 */
export function loadAnastasiaDayBasketIds(opts = {}) {
  if (opts.onlyId) return [String(opts.onlyId)];
  const dayPath = path.join(logsDir(), 'anastasia-day-baskets-summary.json');
  if (!fs.existsSync(dayPath)) return [];
  try {
    const day = JSON.parse(fs.readFileSync(dayPath, 'utf8'));
    return (day.baskets || []).map((x) => x?.id).filter(Boolean).map(String);
  } catch {
    return [];
  }
}

function logsDir() {
  return path.join(getDataDir(), 'logs');
}

function ensureLogsDir() {
  fs.mkdirSync(logsDir(), { recursive: true });
}

/**
 * @param {string} name
 * @param {object} payload
 */
export function writeHuntDayJson(name, payload) {
  ensureLogsDir();
  const filePath = path.join(logsDir(), name);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

/**
 * @param {'point' | 'basket' | string} mode
 */
export function normalizeHuntDayMode(mode) {
  const m = String(mode || 'point').trim().toLowerCase();
  if (m === 'basket') return 'basket';
  return 'point';
}

/**
 * @param {string} scriptRel
 * @param {string[]} args
 * @returns {Promise<number>}
 */
export function spawnHuntDayChild(scriptRel, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, scriptRel), ...args], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

/**
 * @param {object} [opts]
 * @param {'point' | 'basket'} [opts.mode]
 * @param {object} [opts.prefs]
 * @param {string[]} [opts.huntTracks]
 * @param {string[]} [opts.skipIds]
 * @param {(opts: object) => Promise<object>} [opts.resolvePool]
 */
export async function buildHuntDayStatus(opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  const mode = normalizeHuntDayMode(opts.mode || 'point');
  clearStaleBrowserLock();
  clearStaleApplyLaneLock();

  const huntTracks = opts.huntTracks || getPointApplyAutoTracks(prefs);
  const browser = getBrowserLockInfo();
  const applyLane = getApplyLaneLockInfo();
  const cooldownDays = resolveDuplicateCompanyCooldownDays(prefs);
  const slotsRemaining = pointApplySlotsRemaining(prefs);
  const dailyCap = getPointApplyDailyCap(prefs);
  const usedToday = countApplyLaunchesLastDay();
  const hhMax = getMaxApplyChatPerDay();
  const trackQuotas = pointApplyTrackQuotaSummary(huntTracks, prefs);

  /** @type {object | null} */
  let pool = null;
  if (mode === 'point') {
    const resolvePool = opts.resolvePool || resolvePointApplyPool;
    const wrap = await resolvePool({
      huntTracks,
      prefs,
      skipIds: opts.skipIds || [],
    });
    pool = {
      poolId: wrap.poolId,
      poolLabel: wrap.poolLabel,
      ready: wrap.report?.ready ?? 0,
      totalCandidates: wrap.report?.totalCandidates ?? 0,
      ladderExhausted: wrap.ladderExhausted,
      message: wrap.report?.message || null,
      blocked: wrap.report?.blocked || {},
    };
  } else if (isAnastasiaHuntDayInstance()) {
    const ids = loadAnastasiaDayBasketIds({ onlyId: opts.onlyId || '' }).filter(Boolean);
    const dayPath = 'anastasia-day-baskets-summary.json';
    pool = {
      poolId: 'anastasia-day',
      poolLabel: 'корзины дня Насти',
      ready: ids.length,
      totalCandidates: ids.length,
      ladderExhausted: false,
      message: ids.length
        ? `Day baskets: ${ids.length} id (${dayPath})`
        : `Нет day baskets — проверьте data-*/logs/${dayPath} или anastasia-build-day-baskets`,
      blocked: {},
    };
  } else {
    const config = loadBasketPacksConfig();
    const packId = resolveShipPackId(['--from-day'], config) || config.dayPackId || null;
    const items = packId ? getPackItems(packId, config) : [];
    pool = {
      poolId: packId || 'basket',
      poolLabel: packId ? `корзина ${packId}` : 'корзина (нет day pack)',
      ready: items.length,
      totalCandidates: items.length,
      ladderExhausted: false,
      message: packId
        ? `Day pack «${packId}»: ${items.length} id`
        : 'Нет day pack в config/emil-basket-packs.json',
      blocked: {},
    };
  }

  return {
    at: new Date().toISOString(),
    slice: 2,
    mode,
    dataDir: getDataDir(),
    cooldownDays,
    slots: {
      pointApplyRemaining: slotsRemaining,
      pointApplyDailyCap: dailyCap,
      hhApplyUsedToday: usedToday,
      hhApplyMaxPerDay: hhMax,
    },
    trackQuotas,
    huntTracks,
    browserLock: {
      held: browser.held,
      stale: browser.stale,
      owner: browser.owner || null,
      pid: browser.pid || null,
      hint: browser.hint || null,
    },
    applyLaneLock: {
      held: applyLane.held,
      stale: applyLane.stale,
      owner: applyLane.owner || null,
      command: applyLane.command || null,
      pid: applyLane.pid || null,
      path: applyLane.path,
      hint: applyLane.hint || null,
    },
    pool,
    surfacesNote:
      'Три поверхности hh не смешивать: apply (модалка) · анкета · robot chatik. Ship без авто-repair; repair — отдельная фаза.',
  };
}

/**
 * @param {object} [opts]
 * @param {'point' | 'basket'} [opts.mode]
 * @param {object} [opts.prefs]
 * @param {string[]} [opts.huntTracks]
 * @param {string[]} [opts.skipIds]
 * @param {number} [opts.limit]
 * @param {boolean} [opts.dryRun]
 * @param {(opts: object) => Promise<object>} [opts.resolvePool]
 * @param {boolean} [opts.checkLane]
 * @param {string} [opts.packId]
 * @param {string} [opts.onlyId]
 */
export async function buildHuntDayPlan(opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  const mode = normalizeHuntDayMode(opts.mode || 'point');
  const dryRun = opts.dryRun !== false;
  const limit = Math.max(1, Number(opts.limit) || 15);
  const skipIds = new Set((opts.skipIds || []).map(String));

  if (opts.checkLane !== false) {
    assertApplyLaneFreeForPlan('plan');
  }

  if (mode === 'basket') {
    const anastasia = isAnastasiaHuntDayInstance();

    /** @type {string[]} */
    let rawIds = [];
    /** @type {string | null} */
    let packId = null;

    if (anastasia) {
      if (opts.packId) {
        throw new Error(
          'hunt-day anastasia: --pack= не поддержан (только --from-day / --only=). Используйте day-summary или --only=<id>.'
        );
      }
      rawIds = loadAnastasiaDayBasketIds({ onlyId: opts.onlyId || '' });
      packId = opts.onlyId ? null : 'anastasia-day';
    } else {
      const config = loadBasketPacksConfig();
      packId =
        opts.packId ||
        resolveShipPackId(opts.onlyId ? [`--only=${opts.onlyId}`] : ['--from-day'], config) ||
        config.dayPackId ||
        '';
      rawIds = opts.onlyId
        ? [opts.onlyId]
        : (packId ? getPackItems(packId, config) : []).map((x) =>
            typeof x === 'string' ? x : x.id || x.vacancyId
          );
    }

    const ids = rawIds.map(String).filter(Boolean).filter((id) => !skipIds.has(id)).slice(0, limit);
    let validation = { rows: [], ready: 0, total: ids.length };
    try {
      validation = validateBasketIds(ids, { config: anastasia ? undefined : loadBasketPacksConfig() });
    } catch {
      validation = {
        rows: ids.map((id) => ({ id, ok: false, blockers: ['validate unavailable'] })),
        ready: 0,
        total: ids.length,
      };
    }
    const candidates = (validation.rows || [])
      .filter((r) => r.ok)
      .map((r) => ({
        id: r.id,
        company: r.company || null,
        title: r.title || null,
        score: r.interviewChance ?? null,
        blockReason: null,
        ready: true,
      }));
    const blockedSamples = (validation.rows || [])
      .filter((r) => !r.ok)
      .map((r) => ({
        id: r.id,
        company: r.company || null,
        title: r.title || null,
        blockCode: 'basket-validate',
        blockReason: (r.blockers || []).join('; ') || 'не готово',
        ready: false,
      }));

    return {
      at: new Date().toISOString(),
      slice: 2,
      mode,
      dryRun,
      packId: packId || null,
      instance: resolveHuntDayInstance(),
      cooldownDays: resolveDuplicateCompanyCooldownDays(prefs),
      huntTracks: opts.huntTracks || getPointApplyAutoTracks(prefs),
      skipIds: [...skipIds],
      readyCount: candidates.length,
      totalCandidates: validation.total ?? ids.length,
      blocked: { 'basket-validate': blockedSamples.length },
      candidates,
      blockedSamples,
      skippedReady: [],
      message: anastasia
        ? `Корзина plan (Настя day): ready ${candidates.length}/${validation.total ?? ids.length}`
        : `Корзина plan: ready ${candidates.length}/${validation.total ?? ids.length}`,
      note: anastasia
        ? 'plan basket Настя — day-summary. ship --mode=basket --go --only=<id> | --from-day.'
        : 'plan basket — без браузера. ship --mode=basket --go --only=<id>.',
    };
  }

  const huntTracks = opts.huntTracks || getPointApplyAutoTracks(prefs);
  const resolvePool = opts.resolvePool || resolvePointApplyPool;
  const wrap = await resolvePool({ huntTracks, prefs, skipIds: [...skipIds] });
  const report = wrap.report || {};

  const allReady = report.readyItems || [];
  const skippedReady = allReady.filter((item) => skipIds.has(String(item.id)));
  const readyItems = allReady
    .filter((item) => !skipIds.has(String(item.id)))
    .slice(0, limit)
    .map((item) => {
      const rec = getVacancyRecord(item.id) || item;
      const needsProbe =
        recordNeedsQuestionnaireWork(rec) && !questionnaireHasLiveProbe(rec);
      return {
        id: item.id,
        company: item.company || null,
        title: item.title || null,
        score: item.scoreOverall ?? item.geminiScore ?? null,
        blockReason: null,
        ready: true,
        needsProbe: Boolean(needsProbe),
      };
    });

  const needsProbeCount = readyItems.filter((c) => c.needsProbe).length;
  /** @type {object[]} */
  const blockedSamples = [];
  const samples = report.blockedSamples || {};
  for (const [code, list] of Object.entries(samples)) {
    for (const s of list || []) {
      blockedSamples.push({
        id: s.id || null,
        company: s.company || null,
        title: s.title || null,
        blockCode: code,
        blockReason: s.reason || report.blockedLabels?.[code] || code,
        ready: false,
      });
    }
  }

  return {
    at: new Date().toISOString(),
    slice: 2,
    mode,
    dryRun,
    poolId: wrap.poolId,
    poolLabel: wrap.poolLabel,
    ladderExhausted: wrap.ladderExhausted,
    cooldownDays: resolveDuplicateCompanyCooldownDays(prefs),
    huntTracks,
    skipIds: [...skipIds],
    readyCount: readyItems.length,
    totalCandidates: report.totalCandidates ?? 0,
    blocked: report.blocked || {},
    candidates: readyItems,
    needsProbeCount,
    blockedSamples: blockedSamples.slice(0, 40),
    skippedReady: skippedReady.map((item) => ({
      id: item.id,
      company: item.company || null,
      title: item.title || null,
      blockReason: 'skip-id',
    })),
    message: report.message || null,
    note:
      needsProbeCount > 0
        ? `plan — без браузера. ${needsProbeCount} id нужен probe: prep --with-probe. ship без авто-repair; naked → hunt-day repair --id=.`
        : 'plan — без браузера apply. ship без авто-repair; naked → hunt-day repair --id=.',
  };
}

/**
 * @param {object} [opts]
 * @param {object} [opts.prefs]
 * @param {string[]} [opts.huntTracks]
 * @param {number} [opts.limit]
 * @param {boolean} [opts.withProbe] — live probe анкеты (браузер); default false
 * @param {number} [opts.probeLimit]
 * @param {(script: string, args: string[]) => Promise<number>} [opts.spawnChild]
 * @param {(opts: object) => Promise<object>} [opts.resolvePool]
 * @param {(msg: string) => void} [opts.log]
 */
export async function runHuntDayPrep(opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  const huntTracks = opts.huntTracks || getPointApplyAutoTracks(prefs);
  const limit = Math.max(1, Number(opts.limit) || 8);
  const withProbe = Boolean(opts.withProbe);
  const probeLimit = Math.max(0, Number(opts.probeLimit) || (withProbe ? limit : 0));
  const log = opts.log || console.log;
  const spawnChild = opts.spawnChild || spawnHuntDayChild;
  assertApplyLaneFreeForPlan('prep');
  const result = await ensurePointApplyLetters({
    huntTracks,
    prefs,
    limit,
    log,
  });

  /** @type {{ enabled: boolean, probed: object[], skipped: object[], errors: object[] }} */
  const questionnaire = {
    enabled: withProbe,
    probed: [],
    skipped: [],
    errors: [],
  };

  if (withProbe && probeLimit > 0) {
    const resolvePool = opts.resolvePool || resolvePointApplyPool;
    const wrap = await resolvePool({ huntTracks, prefs, skipIds: [] });
    const ids = (wrap.report?.readyItems || [])
      .map((x) => String(x.id || ''))
      .filter(Boolean)
      .slice(0, Math.max(limit, probeLimit));
    const needProbeIds = [];
    for (const id of ids) {
      if (needProbeIds.length >= probeLimit) break;
      const rec = getVacancyRecord(id);
      if (!rec) continue;
      if (recordNeedsQuestionnaireWork(rec) && !questionnaireHasLiveProbe(rec)) {
        needProbeIds.push(id);
      } else {
        questionnaire.skipped.push({
          id,
          reason: questionnaireHasLiveProbe(rec) ? 'already-probed' : 'no-questionnaire-work',
        });
      }
    }
    for (const id of needProbeIds) {
      log(`[hunt-day prep] probe-questionnaire --id=${id}`);
      try {
        const code = await spawnChild('scripts/probe-questionnaire.mjs', [`--id=${id}`]);
        const after = getVacancyRecord(id);
        const ok = code === 0 && questionnaireHasLiveProbe(after);
        questionnaire.probed.push({
          id,
          exitCode: code,
          ok,
          probedAt: after?.hhApply?.questionnaire?.probedAt || null,
        });
        if (!ok) {
          questionnaire.errors.push({ id, exitCode: code, reason: 'probe-exit-or-no-probedAt' });
        }
      } catch (e) {
        questionnaire.errors.push({ id, error: e?.message || String(e) });
      }
    }
  }

  const payload = {
    at: new Date().toISOString(),
    slice: 2,
    command: 'prep',
    mode: 'point',
    ...result,
    questionnaire,
  };
  payload.outPath = writeHuntDayJson('hunt-day-prep-latest.json', payload);
  return payload;
}

/**
 * @param {object} session
 * @param {number} childExit
 */
function outcomesFromPointSession(session, childExit) {
  const attempts = session?.attempts || [];
  /** @type {object[]} */
  const outcomes = [];
  for (const attempt of attempts) {
    const id = attempt.selected?.id;
    const rec = id ? getVacancyRecord(id) : null;
    const normalized = normalizeHuntDayShipOutcome({
      hhApply: rec?.hhApply,
      exitCode: attempt.exitCode ?? childExit,
      errorMessage: attempt.note || attempt.message || '',
      pointStatus: attempt.status,
    });
    outcomes.push({
      id: id || null,
      company: attempt.selected?.company || rec?.company || null,
      title: attempt.selected?.title || rec?.title || null,
      mode: 'point',
      childStatus: attempt.status || null,
      exitCode: attempt.exitCode ?? childExit,
      ...normalized,
      hint:
        normalized.needsLetterRepair
          ? 'naked: npm run devops:hunt-day:emil -- repair --id=' + (id || '<uuid>')
          : null,
    });
  }
  if (!outcomes.length) {
    outcomes.push({
      id: null,
      company: null,
      title: null,
      mode: 'point',
      status: childExit === 0 ? 'skip' : 'fail',
      error: session?.message || 'нет attempts в point-apply-session',
      needsLetterRepair: false,
      repaired: false,
      exitCode: childExit,
    });
  }
  return outcomes;
}

/**
 * @param {object} [opts]
 * @param {'point' | 'basket'} [opts.mode]
 * @param {object} [opts.prefs]
 * @param {string[]} [opts.huntTracks]
 * @param {string[]} [opts.skipIds]
 * @param {number} [opts.limit]
 * @param {boolean} [opts.go] — live; без --go только dry-run
 * @param {boolean} [opts.dryRun]
 * @param {string} [opts.onlyId]
 * @param {string} [opts.packId]
 * @param {boolean} [opts.noPrepareLetters]
 * @param {boolean} [opts.prepareLetters] — явный regen даже при --only=
 * @param {(script: string, args: string[]) => Promise<number>} [opts.spawnChild]
 * @param {string} [opts.owner]
 */
export async function runHuntDayShip(opts = {}) {
  const owner = opts.owner || 'hunt-day';
  const prefs = opts.prefs || loadPreferences();
  const mode = normalizeHuntDayMode(opts.mode || 'point');
  const go = Boolean(opts.go);
  const dryRun = !go || opts.dryRun === true;
  const limit = Math.max(1, Number(opts.limit) || 1);
  const skipIds = (opts.skipIds || []).map(String).filter(Boolean);
  const huntTracks = opts.huntTracks || getPointApplyAutoTracks(prefs);
  const spawnChild = opts.spawnChild || spawnHuntDayChild;

  await acquireApplyLaneLock(owner, 'ship', { timeoutMs: 0 });

  /** @type {object} */
  let payload;
  try {
    if (mode === 'point') {
      /** @type {string[]} */
      const args = [`--tracks=${huntTracks.join(',')}`, `--limit=${limit}`];
      if (dryRun) args.push('--dry-run');
      // P0: --only= → no-prepare по умолчанию; откат --prepare-letters
      const skipPrepare =
        opts.noPrepareLetters === true ||
        (Boolean(opts.onlyId) && opts.prepareLetters !== true);
      if (skipPrepare) args.push('--no-prepare-letters');
      if (opts.prepareLetters) args.push('--prepare-letters');
      if (skipIds.length) args.push(`--skip-id=${skipIds.join(',')}`);
      if (opts.onlyId) args.push(`--only=${opts.onlyId}`);

      const childExit = await spawnChild('scripts/devops-apply-point-ready.mjs', args);
      const sessionPath = path.join(logsDir(), 'point-apply-session-latest.json');
      let session = {};
      try {
        session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      } catch {
        session = {};
      }
      const outcomes = dryRun
        ? (session.attempts || []).map((a) => ({
            id: a.selected?.id || null,
            company: a.selected?.company || null,
            title: a.selected?.title || null,
            mode: 'point',
            status: 'dry-run',
            needsLetterRepair: false,
            repaired: false,
            exitCode: 0,
            childStatus: a.status,
          }))
        : outcomesFromPointSession(session, childExit);

      payload = {
        at: new Date().toISOString(),
        slice: 2,
        command: 'ship',
        mode,
        dryRun,
        go,
        autoLetterRepair: false,
        childExit,
        huntTracks,
        skipIds,
        limit,
        outcomes,
        okCount: outcomes.filter((o) => o.status === 'ok').length,
        nakedCount: outcomes.filter((o) => o.status === 'naked').length,
        message: dryRun
          ? `dry-run ship point: ${outcomes.length} кандидат(ов)`
          : `ship point: ok=${outcomes.filter((o) => o.status === 'ok').length} naked=${outcomes.filter((o) => o.status === 'naked').length}`,
      };
    } else {
      const instance = resolveHuntDayInstance();
      const anastasia = isAnastasiaHuntDayInstance(instance);
      if (anastasia && opts.packId) {
        throw new Error(
          'hunt-day anastasia: --pack= не поддержан (только --from-day / --only=)'
        );
      }

      /** @type {string[]} */
      const args = ['--no-letter-repair'];
      if (dryRun) args.push('--dry-run');
      if (opts.onlyId) args.push(`--only=${opts.onlyId}`);
      else if (opts.packId) args.push(`--pack=${opts.packId}`);
      else args.push('--from-day');

      const packScript = packShipScriptForInstance(instance);
      const childExit = await spawnChild(packScript, args);
      const summaryPath = path.join(logsDir(), packShipSummaryFileForInstance(instance));
      let summary = {};
      try {
        summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
      } catch {
        summary = {};
      }

      const npmScript = huntDayNpmScriptForInstance(instance);

      /** @type {object[]} */
      let outcomes = [];
      if (dryRun) {
        outcomes = (summary.prepared || []).map((row) => ({
          id: row.id,
          company: row.company || null,
          title: null,
          mode: 'basket',
          status: 'dry-run',
          needsLetterRepair: false,
          repaired: false,
          exitCode: 0,
        }));
      } else {
        for (const row of summary.outcomes || []) {
          const rec = row.id ? getVacancyRecord(row.id) : null;
          const normalized = normalizeHuntDayShipOutcome({
            hhApply: rec?.hhApply,
            exitCode: row.exitCode ?? childExit,
            errorMessage: row.error || '',
            repaired: Boolean(row.repaired),
          });
          // pack-ship с --no-letter-repair не должен вернуть repaired
          outcomes.push({
            id: row.id,
            company: row.company || rec?.company || null,
            title: rec?.title || null,
            mode: 'basket',
            exitCode: row.exitCode ?? childExit,
            packStatus: row.status,
            ...normalized,
            hint:
              normalized.needsLetterRepair
                ? `naked: npm run ${npmScript} -- repair --id=${row.id}`
                : null,
          });
        }
        if (!outcomes.length && opts.onlyId) {
          const rec = getVacancyRecord(opts.onlyId);
          const normalized = normalizeHuntDayShipOutcome({
            hhApply: rec?.hhApply,
            exitCode: childExit,
          });
          outcomes.push({
            id: opts.onlyId,
            company: rec?.company || null,
            title: rec?.title || null,
            mode: 'basket',
            exitCode: childExit,
            ...normalized,
          });
        }
      }

      payload = {
        at: new Date().toISOString(),
        slice: 2,
        command: 'ship',
        mode,
        dryRun,
        go,
        instance,
        autoLetterRepair: false,
        packScript,
        summaryFile: packShipSummaryFileForInstance(instance),
        childExit,
        onlyId: opts.onlyId || null,
        packId: opts.packId || null,
        outcomes,
        okCount: outcomes.filter((o) => o.status === 'ok').length,
        nakedCount: outcomes.filter((o) => o.status === 'naked').length,
        message: dryRun
          ? `dry-run ship basket: ${outcomes.length}`
          : `ship basket: ok=${outcomes.filter((o) => o.status === 'ok').length}`,
      };
    }

    const outPath = writeHuntDayJson('hunt-day-ship-latest.json', payload);
    payload.outPath = outPath;
    return payload;
  } finally {
    releaseApplyLaneLock(owner);
  }
}

/**
 * После успешного ship — watchdog робота по id (поверхность 3, без чипов).
 * Вызывать **после** release apply-lane (браузер свободен).
 *
 * @param {object} opts
 * @param {object[]} opts.outcomes — из runHuntDayShip
 * @param {boolean} [opts.sendAuto=true]
 * @param {number} [opts.waitSec=45]
 * @param {(script: string, args: string[]) => Promise<number>} [opts.spawnChild]
 * @param {(msg: string) => void} [opts.log]
 */
export async function runHuntDayAfterShipWatch(opts = {}) {
  const log = opts.log || console.log;
  const spawnChild = opts.spawnChild || spawnHuntDayChild;
  const sendAuto = opts.sendAuto !== false;
  const waitSec = Math.max(0, Number(opts.waitSec ?? 45));
  const ids = (opts.outcomes || [])
    .filter((o) => o && o.id && (o.status === 'ok' || o.status === 'ok_repaired'))
    .map((o) => o.id);
  if (!ids.length) {
    log('[hunt-day] after-ship=watch: нет ok id — пропуск');
    return {
      at: new Date().toISOString(),
      skipped: true,
      reason: 'no-ok-ids',
      ids: [],
      childExit: 0,
    };
  }

  /** @type {string[]} */
  const args = [`--id=${ids.join(',')}`, `--limit=${ids.length}`, `--wait=${waitSec}`];
  if (sendAuto) args.push('--send-auto');
  if (opts.notify) args.push('--notify');

  log(
    `[hunt-day] after-ship=watch: ${ids.length} id · wait=${waitSec}s · send-auto=${sendAuto ? '1' : '0'}`
  );
  const childExit = await spawnChild('scripts/devops-robot-recruiter-watch.mjs', args);

  let report = null;
  try {
    report = JSON.parse(
      fs.readFileSync(path.join(logsDir(), 'robot-recruiter-watchdog-latest.json'), 'utf8')
    );
  } catch {
    report = null;
  }

  const payload = {
    at: new Date().toISOString(),
    command: 'after-ship-watch',
    ids,
    waitSec,
    sendAuto,
    childExit,
    pending: report?.pending?.length ?? null,
    sent: report?.sent?.length ?? null,
    frozen: report?.frozen?.length ?? null,
    report,
  };
  payload.outPath = writeHuntDayJson('hunt-day-after-ship-watch-latest.json', payload);
  return payload;
}

/**
 * Отдельная фаза repair ×1 (не вызывать из ship).
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} [opts.instance]
 * @param {string} [opts.owner]
 * @param {(opts: { recordId: string, instance: string, log?: Function }) => Promise<number>} [opts.deliver]
 * @param {(msg: string) => void} [opts.log]
 */
export async function runHuntDayRepair(opts) {
  const id = String(opts?.id || '').trim();
  if (!id) throw new Error('hunt-day repair: нужен --id=<uuid>');
  const owner = opts.owner || 'hunt-day';
  const instance = opts.instance || process.env.HH_INSTANCE_ID || 'emil';
  const log = opts.log || console.log;
  const deliver = opts.deliver || runDeliverLetterVacancy;

  await acquireApplyLaneLock(owner, 'repair', { timeoutMs: 0 });
  try {
    const before = getVacancyRecord(id);
    let deliverExit = 0;
    let deliverError = null;
    try {
      deliverExit = await deliver({ recordId: id, instance, log });
    } catch (e) {
      deliverExit = 1;
      deliverError = String(e?.message || e);
      log(`[hunt-day repair] fail: ${deliverError}`);
    }
    const after = getVacancyRecord(id);
    const normalized = normalizeHuntDayShipOutcome({
      hhApply: after?.hhApply,
      exitCode: deliverExit,
      errorMessage: deliverError || '',
      repaired: true,
    });
    const payload = {
      at: new Date().toISOString(),
      slice: 2,
      command: 'repair',
      id,
      company: after?.company || before?.company || null,
      title: after?.title || before?.title || null,
      deliverExit,
      ...normalized,
      letterDelivered: Boolean(after?.hhApply?.letterDelivered),
      message:
        normalized.status === 'ok_repaired'
          ? 'letter-repair ×1 OK (ok_repaired — не first-pass цель дня)'
          : normalized.error || 'repair не подтвердил письмо',
    };
    const outPath = writeHuntDayJson('hunt-day-repair-latest.json', payload);
    payload.outPath = outPath;
    return payload;
  } finally {
    releaseApplyLaneLock(owner);
  }
}

/**
 * @deprecated срез 1 stub — **только для тестов lock** (`test-hunt-day-plan`).
 * Live ship: `runHuntDayShip` / `hunt-day ship [--go]`. Не вызывать из CLI.
 */
export async function runHuntDayShipStub(opts = {}) {
  const owner = opts.owner || 'hunt-day';
  await acquireApplyLaneLock(owner, 'ship', { timeoutMs: 0 });
  const holdMs = Math.max(0, Number(opts.holdMs) || 0);
  if (holdMs > 0) await new Promise((r) => setTimeout(r, holdMs));
  const payload = {
    at: new Date().toISOString(),
    slice: 2,
    status: 'use_runHuntDayShip',
    message: 'Используйте runHuntDayShip / hunt-day ship [--go]',
    applyLaneLock: getApplyLaneLockInfo(),
  };
  if (!opts.keepLock) releaseApplyLaneLock(owner);
  return payload;
}

export { ApplyLaneBusyError };
