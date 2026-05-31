/**
 * Локальный мини-дашборд: http://127.0.0.1:3849
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { spawnBackground } from '../lib/spawn-background.mjs';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import { applyStoredProfile, getStoredProfileId, listProfiles, saveStoredProfileId } from '../lib/profile-prefs.mjs';
import { parseHarvestPeriodDays, harvestPeriodLabel } from '../lib/hh-search-period.mjs';
import { getBrowserLockInfo, clearStaleBrowserLock } from '../lib/chromium-session.mjs';
loadEnv();
applyStoredProfile();

const cliPort = process.argv.find((a) => a.startsWith('--port='));
if (cliPort) process.env.DASHBOARD_PORT = cliPort.slice('--port='.length);
const cliQueue = process.argv.find((a) => a.startsWith('--queue-file='));
if (cliQueue) process.env.HH_VACANCIES_QUEUE_FILE = cliQueue.slice('--queue-file='.length);

import {
  ROOT,
  HH_APPLY_CHAT_LOG_FILE,
  HARVEST_RUN_LOG_FILE,
  DATA_DIR,
  HARVEST_DASHBOARD_TICK_FILE,
} from '../lib/paths.mjs';
import { readApplyChatLogTail, readHarvestRunLogTail } from '../lib/apply-chat-log.mjs';
import {
  countApplyLaunchesLastHour,
  countApplyLaunchesLastDay,
  countApplyLaunchesLastMonth,
  getMaxApplyChatPerHour,
  getMaxApplyChatPerDay,
  getMaxApplyChatPerMonth,
  applyRateLimitsSnapshot,
  recordApplyLaunch,
} from '../lib/hh-apply-rate.mjs';
import {
  patchDashboardPreferences,
  getDashboardUiConfig,
  getDashboardBatchSizeCap,
  DASHBOARD_PREF_BOUNDS,
} from '../lib/dashboard-preferences.mjs';
import {
  loadQueue,
  updateVacancyRecord,
  getVacancyRecord,
  removeVacancyRecord,
} from '../lib/store.mjs';
import {
  vacancyHasHhApply,
  vacancyQuestionnairePending,
  vacancyShownInAppliedTab,
  vacancyHhSiteBlocked,
} from '../lib/vacancy-hh-apply.mjs';
import { buildHhApplySiteStatePatch, hhSiteStateLabel } from '../lib/hh-vacancy-response-state.mjs';
import { computeConversionStats } from '../lib/conversion-stats.mjs';
import { computeDashboardStats } from '../lib/offers-stats.mjs';
import { computeFunnelAnalytics } from '../lib/funnel-analytics.mjs';
import { importInterviewNotesFromDir } from '../lib/interview-notes.mjs';
import { buildInterviewPrepPack } from '../lib/interview-prep.mjs';
import { draftChatReply } from '../lib/chat-reply-draft.mjs';
import { DAILY_ROUTINE_STEPS } from '../lib/daily-routine.mjs';
import { buildHhNegotiationOnlyCards } from '../lib/hh-negotiation-cards.mjs';
import { importNegotiationsToQueue } from '../lib/import-negotiations-queue.mjs';
import { CHAT_REPLY_TEMPLATES } from '../lib/chat-reply-templates.mjs';
import {
  loadNegotiationsCache,
  mergeNegotiationsIntoQueue,
  parseNegotiationStatusText,
} from '../lib/hh-negotiations-sync.mjs';
import { getBrowserBusyState, getSideJobsStatus } from '../lib/browser-guard.mjs';
import { getResumeRoutingHealth } from '../lib/routing-health.mjs';
import { spawnSideJob } from '../lib/side-job-runner.mjs';
import {
  getResumeRaiseScheduleStatus,
  shouldRunScheduledRaise,
  saveResumeRaiseScheduleConfig,
  loadResumeRaiseScheduleConfig,
} from '../lib/resume-raise-schedule.mjs';
import { generateVariantTexts } from '../lib/resume-variants.mjs';
import { pruneRespondedFromActiveQueue, QUEUE_STATUS_RESPONDED } from '../lib/queue-prune.mjs';
import { recordNeedsQuestionnaireWork } from '../lib/questionnaire-labels.mjs';
import { normalizeBatchScope } from '../lib/batch-scope.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import {
  recordPassesMinSalary,
  recordHasDescription,
  recordPassesLlmList,
  recordPassesNotFirstLine,
  recordPassesNotDeveloper,
  recordPassesNotSenior,
  recordPassesNot1C,
  recordHiddenRoleReasons,
  recordIsHiddenByRoleFilters,
} from '../lib/filters.mjs';
import { appendFeedback } from '../lib/feedback-context.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import {
  createLlmRoutingContext,
  hasScoreProviderCredentials,
  scoreVacancyWithLlm,
} from '../lib/openrouter-score.mjs';
import {
  generateCoverLetterVariants,
  normalizeVariants,
} from '../lib/cover-letter-openrouter.mjs';
import { appendCoverLetterUserEditSnippet } from '../lib/cover-letter-user-edits.mjs';
import { computeLetterEditMetrics } from '../lib/cover-letter-metrics.mjs';
import { fetchVacancyTextFromHh } from '../lib/refresh-vacancy-from-hh.mjs';
import {
  generateQuestionnaireAnswers,
  isQuestionnaireLlmEnabled,
} from '../lib/hh-questionnaire-answers.mjs';
import {
  meaningfulQuestions,
  recordLooksLikeCaptchaQuestionnaire,
  patchClearCaptchaQuestionnaire,
} from '../lib/questionnaire-labels.mjs';
import { resolveResumeForVacancy } from '../lib/resume-routing.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import { readBatchRunReport } from '../lib/batch-run-report.mjs';
import { isVacancyDeferred, deferVacancyForDays, clearVacancyDefer } from '../lib/vacancy-defer.mjs';
import { buildDailyDigest, readDailyDigest } from '../lib/daily-digest.mjs';
import { remapQuestionnaireAnswers } from '../lib/questionnaire-merge.mjs';
import {
  prepQuestionnaireAnswersBatch,
  filterQuestionnairePrepCandidates,
  filterQuestionnaireReprobeCandidates,
} from '../lib/questionnaire-pipeline.mjs';
import {
  AUTO_REPROBE_LIMIT,
  pickAutoReprobeBatch,
} from '../lib/questionnaire-auto-reprobe.mjs';
import { captureQuestionnaireEditsOnSave } from '../lib/questionnaire-user-edits.mjs';
import { getJobStatus, setHarvestPid, setBatchPid, isProcessAlive } from '../lib/job-pids.mjs';
import {
  getBatchControlSummary,
  requestBatchPause,
  requestBatchResume,
  requestBatchStop,
  canResumeFromState,
  clearBatchResumeState,
} from '../lib/batch-control.mjs';
import {
  getHarvestControlSummary,
  requestHarvestPause,
  requestHarvestResume,
  requestHarvestStop,
} from '../lib/harvest-control.mjs';
import { readLogTail } from '../lib/log-tail.mjs';
import { readJobProgress } from '../lib/job-progress.mjs';
import { HARVEST_PROGRESS_FILE, BATCH_PROGRESS_FILE, APPLY_CHAT_PROGRESS_FILE } from '../lib/paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(ROOT, 'dashboard', 'public');
const PORT = Number(process.env.DASHBOARD_PORT || 3849) || 3849;
let activeApplyChatPid = null;

/** @param {object[]} records */
async function runQuestionnaireProbeRecords(records) {
  const scriptPath = path.join(ROOT, 'scripts', 'probe-questionnaire.mjs');
  let okCount = 0;
  let failed = 0;
  /** @type {Array<{ id: string, title?: string, error: string }>} */
  const errors = [];
  for (const rec of records) {
    const exitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [scriptPath, `--id=${rec.id}`], {
        cwd: ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let errText = '';
      child.stderr?.on('data', (d) => {
        errText += d.toString();
      });
      child.on('close', (code) => resolve({ code: code ?? 1, errText }));
    });
    if (exitCode.code === 0) okCount++;
    else {
      failed++;
      errors.push({ id: rec.id, title: rec.title, error: exitCode.errText.slice(0, 200) });
    }
  }
  return { okCount, failed, errors, ran: records.length };
}

function questionnaireReprobeCandidatePool() {
  return filterQuestionnaireReprobeCandidates(
    loadQueue().filter((x) => x.status === 'pending' || x.status === 'approved')
  );
}

function scoreThreshold(prefs) {
  const n = Number(prefs?.dashboardMinScoreFilter ?? prefs?.dashboardHighScoreThreshold);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

function checkApplyRateLimits() {
  const maxApplyHour = getMaxApplyChatPerHour();
  const maxApplyDay = getMaxApplyChatPerDay();
  const maxApplyMonth = getMaxApplyChatPerMonth();
  if (countApplyLaunchesLastHour() >= maxApplyHour) {
    return `Слишком частые отклики: максимум ${maxApplyHour} в час (hhApplyChatMaxPerHour).`;
  }
  if (countApplyLaunchesLastDay() >= maxApplyDay) {
    return `Дневной лимит откликов: ${maxApplyDay} (hhApplyChatMaxPerDay). Продолжите завтра.`;
  }
  if (countApplyLaunchesLastMonth() >= maxApplyMonth) {
    return `Лимит за 30 дней: ${maxApplyMonth} (hhApplyChatMaxPerMonth).`;
  }
  return null;
}

function filterByScoreBand(items, band, threshold) {
  if (band === 'high') {
    return items.filter((x) => scoreOfItem(x) >= threshold);
  }
  if (band === 'low') {
    return items.filter((x) => {
      const s = scoreOfItem(x);
      return s > 0 ? s < threshold : true;
    });
  }
  return items;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function scoreOfItem(x) {
  return Number(x.scoreOverall ?? x.geminiScore ?? 0) || 0;
}

/** Без завершающего слэша, кроме корня `/` — иначе `/api/foo/` не совпадёт с маршрутом. */
function requestPathname(url) {
  let p = url.pathname || '/';
  if (p !== '/') p = p.replace(/\/+$/, '');
  return p || '/';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 2_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** pause | resume | stop — для /api/batch-control и /api/hh-launch-apply-batch */
function handleBatchControlAction(action) {
  const st = getJobStatus();
  if (action === 'pause') {
    if (!st.batch.running) {
      return { code: 409, body: { error: 'Батч не запущен' } };
    }
    requestBatchPause();
    return { code: 200, body: { ok: true, message: 'Пауза после текущей вакансии' } };
  }
  if (action === 'resume') {
    const ctrl = getBatchControlSummary();
    if (ctrl.batchRunning && ctrl.command === 'paused') {
      requestBatchResume();
      return { code: 200, body: { ok: true, message: 'Продолжение батча' } };
    }
    if (ctrl.batchRunning) {
      return { code: 409, body: { error: 'Батч уже выполняется' } };
    }
    if (!canResumeFromState()) {
      return { code: 409, body: { error: 'Нет сохранённого батча для продолжения' } };
    }
    return { code: 200, body: { ok: true, needsRelaunch: true, message: 'Запустите продолжение' } };
  }
  if (action === 'stop') {
    if (!st.batch.running) {
      return { code: 409, body: { error: 'Батч не запущен' } };
    }
    requestBatchStop({ killChild: true });
    return { code: 200, body: { ok: true, message: 'Остановка батча…' } };
  }
  return { code: 400, body: { error: 'action: pause | resume | stop' } };
}

function handleHarvestControlAction(action) {
  const st = getJobStatus();
  if (action === 'pause') {
    if (!st.harvest.running) {
      return { code: 409, body: { error: 'Сбор не запущен' } };
    }
    requestHarvestPause();
    return { code: 200, body: { ok: true, message: 'Пауза сбора — после текущей вакансии' } };
  }
  if (action === 'resume') {
    const hc = getHarvestControlSummary();
    if (!st.harvest.running) {
      return { code: 409, body: { error: 'Сбор не запущен' } };
    }
    if (hc.command !== 'paused') {
      return { code: 409, body: { error: 'Сбор не на паузе' } };
    }
    requestHarvestResume();
    return { code: 200, body: { ok: true, message: 'Сбор продолжен' } };
  }
  if (action === 'stop') {
    if (!st.harvest.running) {
      return { code: 409, body: { error: 'Сбор не запущен' } };
    }
    requestHarvestStop();
    return { code: 200, body: { ok: true, message: 'Остановка сбора…' } };
  }
  return { code: 400, body: { error: 'action: pause | resume | stop' } };
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '127.0.0.1';
  const url = new URL(req.url || '/', `http://${host}`);
  const pathname = requestPathname(url);

  if (req.method === 'GET' && pathname === '/api/harvest-tick') {
    if (!fs.existsSync(HARVEST_DASHBOARD_TICK_FILE)) {
      return sendJson(res, 200, { sequence: 0, addedThisRun: null, at: null });
    }
    try {
      const raw = fs.readFileSync(HARVEST_DASHBOARD_TICK_FILE, 'utf8').trim();
      const data = JSON.parse(raw);
      return sendJson(res, 200, data);
    } catch {
      return sendJson(res, 200, { sequence: 0, addedThisRun: null, at: null });
    }
  }

  if (req.method === 'GET' && pathname === '/api/job-status') {
    const st = getJobStatus();
    if (activeApplyChatPid && !isProcessAlive(activeApplyChatPid)) {
      activeApplyChatPid = null;
    }
    st.applyChat = {
      pid: activeApplyChatPid,
      running: isProcessAlive(activeApplyChatPid),
    };
    let harvestTick = null;
    if (fs.existsSync(HARVEST_DASHBOARD_TICK_FILE)) {
      try {
        harvestTick = JSON.parse(fs.readFileSync(HARVEST_DASHBOARD_TICK_FILE, 'utf8').trim());
      } catch {
        /* ignore */
      }
    }
    const queuePath = process.env.HH_VACANCIES_QUEUE_FILE || 'data/vacancies-devops.json';
    const browserLock = getBrowserLockInfo();
    const harvestLog = readLogTail(HARVEST_RUN_LOG_FILE, 18);
    const harvestProgressRaw = readJobProgress(HARVEST_PROGRESS_FILE);
    const batchProgressRaw = readJobProgress(BATCH_PROGRESS_FILE);
    const applyChatProgressRaw = readJobProgress(APPLY_CHAT_PROGRESS_FILE);
    const batchControlSummary = getBatchControlSummary();
    const harvestControlSummary = getHarvestControlSummary();
    const batchAlive = st.batch.running || batchControlSummary.batchRunning;
    const uiProgress = (p, running, { allowStaleRunningMs = 0 } = {}) => {
      if (!p) return null;
      const age = Date.now() - new Date(p.updatedAt || 0).getTime();
      if (running || p.phase === 'paused') return p;
      if (p.phase === 'running' && allowStaleRunningMs > 0 && age < allowStaleRunningMs) return p;
      if ((p.phase === 'done' || p.phase === 'error') && age < 90_000) return p;
      return null;
    };
    const applyLogTail = readApplyChatLogTail(14, { lastRunOnly: true });
    let negotiationsCache = { count: 0, syncedAt: null };
    try {
      const nc = loadNegotiationsCache();
      negotiationsCache = {
        count: (nc.items || []).length,
        syncedAt: nc.syncedAt || nc.fetchedAt || null,
      };
    } catch {
      /* ignore */
    }
    return sendJson(res, 200, {
      ...st,
      sideJobs: getSideJobsStatus(),
      negotiationsCache,
      routingHealth: getResumeRoutingHealth(),
      resumeRaiseSchedule: getResumeRaiseScheduleStatus(),
      browserBusy: getBrowserBusyState(),
      harvestTick,
      queuePath,
      browserLock,
      harvestProgress: uiProgress(harvestProgressRaw, st.harvest.running, { allowStaleRunningMs: 120_000 }),
      batchProgress: uiProgress(batchProgressRaw, batchAlive, { allowStaleRunningMs: 300_000 }),
      applyChatProgress: uiProgress(applyChatProgressRaw, st.applyChat.running || batchAlive, {
        allowStaleRunningMs: 120_000,
      }),
      harvestLog: {
        lastError: harvestLog.lastError,
        tail: harvestLog.lines.slice(-6).join('\n'),
      },
      applyLog: {
        tail: applyLogTail.lines.slice(-8).join('\n'),
        modifiedAt: applyLogTail.modifiedAt,
        lastRunHeader: applyLogTail.lastRunHeader,
      },
      batchControl: batchControlSummary,
      harvestControl: harvestControlSummary,
      batchLastReport: readBatchRunReport(),
      batchActive: batchAlive,
      activeProfile: getStoredProfileId(),
      queuePathEffective: process.env.HH_VACANCIES_QUEUE_FILE || queuePath,
      applyRates: applyRateLimitsSnapshot(),
      conversion: computeConversionStats(),
      dashboardStats: computeDashboardStats(),
    });
  }

  if (req.method === 'GET' && pathname === '/api/conversion-stats') {
    return sendJson(res, 200, computeDashboardStats());
  }

  if (req.method === 'GET' && pathname === '/api/dashboard-stats') {
    return sendJson(res, 200, computeDashboardStats());
  }

  if (req.method === 'GET' && pathname === '/api/funnel-analytics') {
    const periodDays = parseHarvestPeriodDays(url.searchParams.get('period') ?? url.searchParams.get('periodDays') ?? 0);
    const since = url.searchParams.get('since') || url.searchParams.get('sinceDate') || '';
    const scope = String(url.searchParams.get('scope') || 'applied').toLowerCase();
    const minScoreRaw = url.searchParams.get('minScore');
    const minScore = minScoreRaw != null && minScoreRaw !== '' ? Math.max(0, Number(minScoreRaw) || 0) : 0;
    return sendJson(
      res,
      200,
      computeFunnelAnalytics({ periodDays, since, scope, minScore })
    );
  }

  if (
    (req.method === 'GET' || req.method === 'POST') &&
    (pathname === '/api/batch-control' || pathname === '/api/hh-batch-control')
  ) {
    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, api: 'batch-control', ...getBatchControlSummary() });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const action = String(body.action || '').toLowerCase();
    const result = handleBatchControlAction(action);
    return sendJson(res, result.code, result.body);
  }

  if (
    (req.method === 'GET' || req.method === 'POST') &&
    pathname === '/api/harvest-control'
  ) {
    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, api: 'harvest-control', ...getHarvestControlSummary() });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const action = String(body.action || '').toLowerCase();
    const result = handleHarvestControlAction(action);
    return sendJson(res, result.code, result.body);
  }

  if (req.method === 'GET' && pathname === '/api/vacancies') {
    const status = url.searchParams.get('status') || 'pending';
    const scoreBand = url.searchParams.get('scoreBand') || 'all';
    const applyViewRaw = url.searchParams.get('applyView') || 'queue';
    const applyView =
      applyViewRaw === 'applied'
        ? 'applied'
        : applyViewRaw === 'hidden'
          ? 'hidden'
          : applyViewRaw === 'questionnaire'
            ? 'questionnaire'
            : applyViewRaw === 'noQuestionnaire'
              ? 'noQuestionnaire'
              : applyViewRaw === 'deferred'
                ? 'deferred'
                : 'queue';
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      /* ignore */
    }
    const threshold = scoreThreshold(prefs);
    const minScoreLegacy = url.searchParams.get('minScore');
    let q = loadQueue();
    if (applyView !== 'applied') {
      q = q.filter((x) => x.status === status);
      if (status === 'pending' || status === 'approved') {
        q = q.filter((x) => x.status !== QUEUE_STATUS_RESPONDED);
      }
    }
    q = q
      .filter((x) => recordHasDescription(x))
      .filter((x) => recordPassesLlmList(x))
      .filter((x) => recordPassesMinSalary(x, prefs));
    if (applyView === 'hidden') {
      q = q.filter((x) => !isVacancyDeferred(x));
      q = q.filter((x) => !vacancyHasHhApply(x));
      q = q.filter((x) => recordIsHiddenByRoleFilters(x, prefs));
    } else if (applyView === 'deferred') {
      q = q.filter((x) => isVacancyDeferred(x));
    } else if (applyView === 'questionnaire') {
      q = q.filter((x) => !vacancyHasHhApply(x));
      q = q.filter((x) => recordNeedsQuestionnaireWork(x));
    } else if (applyView === 'noQuestionnaire') {
      q = q
        .filter((x) => recordPassesNotFirstLine(x))
        .filter((x) => recordPassesNotDeveloper(x, prefs))
        .filter((x) => recordPassesNotSenior(x, prefs))
        .filter((x) => recordPassesNot1C(x, prefs));
      q = q.filter((x) => !vacancyHasHhApply(x));
      q = q.filter((x) => !recordNeedsQuestionnaireWork(x));
    } else {
      q = q
        .filter((x) => recordPassesNotFirstLine(x))
        .filter((x) => recordPassesNotDeveloper(x, prefs))
        .filter((x) => recordPassesNotSenior(x, prefs))
        .filter((x) => recordPassesNot1C(x, prefs));
      if (applyView !== 'deferred') {
        q = q.filter((x) => !isVacancyDeferred(x));
      }
      if (applyView === 'applied') {
        q = q.filter((x) => vacancyShownInAppliedTab(x));
      } else {
        q = q.filter((x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x));
      }
    }
    if (minScoreLegacy != null && minScoreLegacy !== '' && scoreBand === 'all') {
      const minScore = Math.max(0, Number(minScoreLegacy) || 0);
      if (minScore > 0) q = q.filter((x) => scoreOfItem(x) >= minScore);
    } else {
      q = filterByScoreBand(q, scoreBand, threshold);
    }
    let negotiationsOnlyCount = 0;
    if (applyView === 'applied') {
      const shownIds = new Set(q.map((x) => String(x.vacancyId || '').trim()).filter(Boolean));
      const extra = buildHhNegotiationOnlyCards(shownIds);
      negotiationsOnlyCount = extra.length;
      q = [...q, ...extra];
    }
    q.sort((a, b) => {
      if (applyView === 'applied') {
        const ta = Date.parse(a.hhApply?.lastAt || a.hhApply?.hhSiteStateAt || '') || 0;
        const tb = Date.parse(b.hhApply?.lastAt || b.hhApply?.hhSiteStateAt || '') || 0;
        if (tb !== ta) return tb - ta;
      }
      return scoreOfItem(b) - scoreOfItem(a);
    });
    let baseForCounts = loadQueue().filter((x) => recordHasDescription(x));
    if (applyView !== 'applied') {
      baseForCounts = baseForCounts.filter((x) => x.status === status);
    }
    baseForCounts = baseForCounts
      .filter((x) => recordPassesNotFirstLine(x))
      .filter((x) => recordPassesNotDeveloper(x, prefs))
      .filter((x) => recordPassesNotSenior(x, prefs))
      .filter((x) => recordPassesNot1C(x, prefs))
      .filter((x) => recordPassesLlmList(x))
      .filter((x) => recordPassesMinSalary(x, prefs));
    const workBase = baseForCounts.filter(
      (x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x) && !isVacancyDeferred(x)
    );
    const noQuestionnaireBase = workBase.filter((x) => !recordNeedsQuestionnaireWork(x));
    const questionnaireBase = workBase.filter((x) => recordNeedsQuestionnaireWork(x));
    const appliedBase = baseForCounts.filter((x) => vacancyShownInAppliedTab(x));
    const high = filterByScoreBand(noQuestionnaireBase, 'high', threshold).length;
    const low = filterByScoreBand(noQuestionnaireBase, 'low', threshold).length;
    const appliedHigh = filterByScoreBand(appliedBase, 'high', threshold).length;
    const appliedLow = filterByScoreBand(appliedBase, 'low', threshold).length;

    let rawInBand = 0;
    let hiddenByRole = 0;
    if (applyView !== 'applied') {
      let rawStatus = loadQueue()
        .filter((x) => x.status === status && !vacancyHasHhApply(x))
        .filter((x) => !vacancyHhSiteBlocked(x));
      rawStatus = rawStatus.filter((x) => recordHasDescription(x));
      if (scoreBand === 'high' || scoreBand === 'low' || scoreBand === 'all') {
        rawInBand =
          scoreBand === 'all' ? rawStatus.length : filterByScoreBand(rawStatus, scoreBand, threshold).length;
      }
      const afterRole = rawStatus
        .filter((x) => recordPassesNotFirstLine(x))
        .filter((x) => recordPassesNotDeveloper(x, prefs))
        .filter((x) => recordPassesNotSenior(x, prefs))
        .filter((x) => recordPassesNot1C(x, prefs))
        .filter((x) => recordPassesLlmList(x))
        .filter((x) => recordPassesMinSalary(x, prefs));
      const inBandAfterRole =
        scoreBand === 'all' ? afterRole.length : filterByScoreBand(afterRole, scoreBand, threshold).length;
      hiddenByRole = Math.max(0, rawInBand - inBandAfterRole);
    }

    const itemsOut = q.map((x) => {
      const row = { ...x };
      if (applyView === 'hidden') {
        row.hiddenRoleReasons = recordHiddenRoleReasons(x, prefs);
      }
      try {
        const pick = resolveResumeForVacancy(x);
        row.resumeRouting = {
          role: pick.role,
          label: pick.label,
          title: pick.title,
          reason: pick.reason,
        };
        const targeting = assessVacancyForApply(x);
        row.targeting = {
          eligible: targeting.eligible,
          category: targeting.category || null,
          skipReason: targeting.skipReason || null,
        };
      } catch {
        /* ignore */
      }
      return row;
    });

    return sendJson(res, 200, {
      items: itemsOut,
      threshold,
      scoreBand,
      applyView,
      counts: {
        high,
        low,
        shown: q.length,
        applied: appliedBase.length,
        appliedHigh,
        appliedLow,
        queue: workBase.length,
        questionnaire: questionnaireBase.length,
        noQuestionnaire: noQuestionnaireBase.length,
        deferred: loadQueue().filter((x) => isVacancyDeferred(x)).length,
        rawInBand,
        hiddenByRole,
        totalPending: loadQueue().filter((x) => x.status === status).length,
        negotiationsOnly: negotiationsOnlyCount,
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/cover-letters') {
    const letterStatus = url.searchParams.get('status') || 'pending';
    if (!['pending', 'approved', 'declined'].includes(letterStatus)) {
      return sendJson(res, 400, { error: 'status: pending | approved | declined' });
    }
    const q = loadQueue()
      .filter((x) => x.coverLetter?.status === letterStatus)
      .filter((x) => recordHasDescription(x))
      .filter((x) => recordPassesNotFirstLine(x));
    let letterPrefs = {};
    try {
      letterPrefs = loadPreferences();
    } catch {
      /* ignore */
    }
    const qLetters = q
      .filter((x) => recordPassesNotDeveloper(x, letterPrefs))
      .filter((x) => recordPassesNotSenior(x, letterPrefs))
      .filter((x) => recordPassesNot1C(x, letterPrefs))
      .filter((x) => recordPassesLlmList(x));
    qLetters.sort(
      (a, b) =>
        (b.scoreOverall ?? b.geminiScore ?? 0) - (a.scoreOverall ?? a.geminiScore ?? 0)
    );
    return sendJson(res, 200, { items: qLetters });
  }

  if (req.method === 'GET' && pathname === '/api/hh-apply-chat-log') {
    const lines = url.searchParams.get('lines');
    const lastRunOnly = url.searchParams.get('lastRun') !== '0';
    const tail = readApplyChatLogTail(lines, { lastRunOnly });
    return sendJson(res, 200, { ...tail, logKind: 'apply-chat' });
  }

  if (req.method === 'GET' && pathname === '/api/harvest-log') {
    const lines = url.searchParams.get('lines');
    const lastRunOnly = url.searchParams.get('lastRun') !== '0';
    const tail = readHarvestRunLogTail(lines, { lastRunOnly });
    return sendJson(res, 200, { ...tail, logKind: 'harvest' });
  }

  if (req.method === 'GET' && pathname === '/api/preferences') {
    try {
      const p = loadPreferences();
      return sendJson(res, 200, {
        preferences: p,
        bounds: DASHBOARD_PREF_BOUNDS,
        ui: getDashboardUiConfig(p),
        applyRates: applyRateLimitsSnapshot(),
        activeProfile: getStoredProfileId(),
        profiles: listProfiles(),
        queuePath: process.env.HH_VACANCIES_QUEUE_FILE || 'data/vacancies-devops.json',
        apiFeatures: { preferencesSave: true, profileSelect: true },
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/profiles') {
    return sendJson(res, 200, {
      activeProfile: getStoredProfileId(),
      profiles: listProfiles(),
      queuePath: process.env.HH_VACANCIES_QUEUE_FILE || 'data/vacancies-devops.json',
    });
  }

  if (req.method === 'POST' && pathname === '/api/profile/select') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const id = String(body?.id || '').trim();
    if (!id) return sendJson(res, 400, { error: 'Нужен id профиля' });
    const known = listProfiles();
    if (!known.some((p) => p.id === id)) {
      return sendJson(res, 400, { error: `Неизвестный профиль: ${id}` });
    }
    try {
      saveStoredProfileId(id);
      const applied = applyStoredProfile();
      return sendJson(res, 200, {
        ok: true,
        activeProfile: applied.id,
        envPath: applied.envPath,
        queuePath: process.env.HH_VACANCIES_QUEUE_FILE || 'data/vacancies-devops.json',
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/preferences/save') {
    return sendJson(res, 200, { ok: true, preferencesSave: true });
  }

  if (req.method === 'POST' && pathname === '/api/preferences/save') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const patch = body?.patch && typeof body.patch === 'object' ? body.patch : body;
    if (!patch || typeof patch !== 'object') {
      return sendJson(res, 400, { error: 'Нужен объект настроек (patch)' });
    }
    try {
      const { preferences, updated, ui } = patchDashboardPreferences(patch);
      return sendJson(res, 200, {
        ok: true,
        preferences,
        updated,
        ui: ui || getDashboardUiConfig(preferences),
        applyRates: applyRateLimitsSnapshot(),
        apiFeatures: { preferencesSave: true },
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (
    (req.method === 'PATCH' || req.method === 'POST') &&
    pathname === '/api/preferences'
  ) {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const patch = body?.patch && typeof body.patch === 'object' ? body.patch : body;
    if (!patch || typeof patch !== 'object') {
      return sendJson(res, 400, { error: 'Нужен объект настроек (patch)' });
    }
    try {
      const { preferences, updated, ui } = patchDashboardPreferences(patch);
      return sendJson(res, 200, {
        ok: true,
        preferences,
        updated,
        ui: ui || getDashboardUiConfig(preferences),
        applyRates: applyRateLimitsSnapshot(),
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/action') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, action, reason } = body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return sendJson(res, 400, { error: 'Нужны id и action: approve | reject' });
    }

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (rec.status !== 'pending') {
      return sendJson(res, 409, { error: 'Уже обработана' });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    updateVacancyRecord(id, {
      status: nextStatus,
      feedbackReason: String(reason || '').trim(),
    });

    appendFeedback({
      at: new Date().toISOString(),
      action,
      reason: String(reason || '').trim(),
      vacancyId: rec.vacancyId,
      title: rec.title,
      recordId: id,
      url: rec.url,
    });

    let autoRejected = [];
    if (action === 'reject') {
      const reasonText = String(reason || '').trim();
      if (reasonText) {
        const { isAutoRejectSimilarEnabled, rejectSimilarPendingFromReason } = await import(
          '../lib/reject-similar-apply.mjs'
        );
        if (isAutoRejectSimilarEnabled()) {
          const result = rejectSimilarPendingFromReason({
            feedbackReason: reasonText,
            excludeRecordId: id,
            source: 'dashboard-reject',
          });
          autoRejected = result.applied;
        }
      }
    }

    return sendJson(res, 200, { ok: true, status: nextStatus, autoRejected });
  }

  if (req.method === 'POST' && pathname === '/api/vacancy/refresh-body') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (!rec.url) return sendJson(res, 400, { error: 'У записи нет url' });

    let parsed;
    try {
      parsed = await fetchVacancyTextFromHh(rec.url);
    } catch (e) {
      return sendJson(res, 502, { error: e.message || 'Не удалось загрузить страницу вакансии' });
    }

    const desc = String(parsed.description || '');
    const now = new Date().toISOString();
    const title = parsed.title || rec.title;
    const company = parsed.company || rec.company;
    const salaryRaw = parsed.salaryRaw || rec.salaryRaw;

    const patch = {
      title,
      company,
      salaryRaw,
      descriptionPreview: desc.slice(0, 600),
      descriptionForLlm: desc.slice(0, 6000),
      vacancyBodyRefreshedAt: now,
    };

    let scoreUpdated = false;
    let scoreError = null;

    if (hasScoreProviderCredentials()) {
      try {
        const cvBundle = await loadCvBundle();
        if (!cvBundle.text.trim()) {
          scoreError = 'Нет текста CV в CV/ — оценка пропущена';
        } else {
          const prefs = loadPreferences();
          const llm = await scoreVacancyWithLlm(
            {
              title,
              company,
              salaryRaw,
              description: desc,
              url: rec.url,
            },
            cvBundle,
            prefs,
            createLlmRoutingContext()
          );
          Object.assign(patch, {
            llmProvider: llm.llmSource === 'custom' ? 'openai-compatible' : 'openrouter',
            openRouterModel: llm.providerModel || null,
            scoreVacancy: llm.scoreVacancy,
            scoreCvMatch: llm.scoreCvMatch,
            scoreOverall: llm.scoreOverall,
            geminiScore: llm.scoreOverall ?? llm.score,
            geminiSummary: llm.summary,
            geminiRisks: llm.risks,
            geminiMatchCv: llm.matchCv,
            geminiTags: llm.tags,
          });
          scoreUpdated = true;
        }
      } catch (e) {
        scoreError = e.message || String(e);
      }
    } else {
      scoreError = 'Нет OpenRouter и не настроен HH_CUSTOM_LLM_* — обновлён только текст с hh.ru';
    }

    updateVacancyRecord(id, patch);

    const next = getVacancyRecord(id);
    return sendJson(res, 200, {
      ok: true,
      vacancyBodyRefreshedAt: now,
      scoreUpdated,
      scoreError,
      item: next,
    });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/generate') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, force } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const prev = rec.coverLetter;
    if (prev?.status === 'approved' && !force) {
      return sendJson(res, 409, {
        error: 'Письмо уже утверждено. Отправьте force: true для перегенерации.',
      });
    }

    if (!hasScoreProviderCredentials()) {
      return sendJson(res, 503, {
        error: 'Нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL',
      });
    }

    let cvBundle;
    try {
      cvBundle = await loadCvBundle();
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'Не удалось загрузить CV' });
    }
    if (!cvBundle.text.trim()) {
      return sendJson(res, 400, { error: 'Нет текста CV — положите файлы в папку CV/' });
    }

    let result;
    try {
      result = await generateCoverLetterVariants(rec, cvBundle);
    } catch (e) {
      const raw = String(e?.message || e || 'Ошибка LLM');
      let error = raw;
      if (/\b429\b|rate\s*limit|Rate limit exceeded|лимит/i.test(raw)) {
        error =
          'Лимит запросов OpenRouter (часто дневной лимит бесплатных моделей). ' +
          'Запустите Ollama и задайте HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL в .env как запасной канал, ' +
          'или подождите / пополните баланс на openrouter.ai.';
      } else if (raw.length > 600) {
        error = `${raw.slice(0, 600)}…`;
      }
      return sendJson(res, 502, { error });
    }

    const now = new Date().toISOString();
    const primaryGenerated = (result.variants && result.variants[0]) || '';
    const coverLetter = {
      status: 'pending',
      variants: result.variants,
      approvedText: '',
      generatedText: primaryGenerated,
      openRouterModel: result.providerModel || null,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });

    return sendJson(res, 200, { ok: true, coverLetter });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/generate') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const questions = meaningfulQuestions(rec.hhApply?.questionnaire?.questions);
    if (!questions.length) {
      return sendJson(res, 400, {
        error:
          'Нет текста вопросов (в JSON только «Текстовое поле N»). Нажмите «Загрузить с hh.ru» в модалке анкеты.',
      });
    }

    if (isQuestionnaireLlmEnabled() && !hasScoreProviderCredentials()) {
      return sendJson(res, 503, {
        error:
          'HH_QUESTIONNAIRE_LLM=1: нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_*. Без LLM достаточно папки CV/.',
      });
    }

    let cvBundle;
    try {
      cvBundle = await loadCvBundle();
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'Не удалось загрузить CV' });
    }
    if (!cvBundle.text.trim()) {
      return sendJson(res, 400, { error: 'Нет текста CV — положите файлы в папку CV/' });
    }

    let result;
    try {
      result = await generateQuestionnaireAnswers({
        record: rec,
        questions,
        cvText: cvBundle.text,
      });
    } catch (e) {
      return sendJson(res, 502, { error: String(e?.message || e).slice(0, 600) });
    }

    const now = new Date().toISOString();
    const prevQ = rec.hhApply?.questionnaire || {};
    const savedAnswers = prevQ.savedAnswers?.length
      ? remapQuestionnaireAnswers(prevQ.questions, questions, prevQ.savedAnswers)
      : prevQ.savedAnswers;
    const questionnaire = {
      ...prevQ,
      status: prevQ.status || 'pending_manual',
      questions,
      suggestedAnswers: result.answers,
      savedAnswers,
      answersModel: result.model,
      answersGeneratedAt: now,
    };
    updateVacancyRecord(id, {
      hhApply: { ...rec.hhApply, lastAt: now, questionnaire },
    });

    return sendJson(res, 200, {
      ok: true,
      questionnaire,
      model: result.model,
      answerCount: result.answers?.length ?? 0,
    });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/prep-batch') {
    let body = {};
    try {
      const raw = await readBody(req);
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const force = Boolean(body.force);
    const candidates = filterQuestionnairePrepCandidates(
      loadQueue().filter((x) => x.status === 'pending' || x.status === 'approved')
    );
    if (!candidates.length) {
      return sendJson(res, 200, {
        ok: true,
        okCount: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        message: 'Нет карточек с вопросами анкеты — сначала probe или батч.',
      });
    }
    if (isQuestionnaireLlmEnabled() && !hasScoreProviderCredentials()) {
      return sendJson(res, 503, {
        error:
          'HH_QUESTIONNAIRE_LLM=1: нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_*. Без LLM достаточно папки CV/.',
      });
    }
    const r = await prepQuestionnaireAnswersBatch(candidates, { force });
    return sendJson(res, 200, {
      ok: true,
      okCount: r.ok,
      skipped: r.skipped,
      failed: r.failed,
      total: r.total,
      errors: r.errors?.slice(0, 20),
      needsRelabel: r.needsRelabel ?? 0,
      message:
        `Ответы: ${r.ok} сгенерировано, ${r.skipped} пропущено, ${r.failed} ошибок` +
        (r.needsRelabel ? `; ${r.needsRelabel} без текста вопросов — сначала «Обновить вопросы с hh.ru»` : ''),
    });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/save-answers') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, answers: rawAnswers } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const questions = rec.hhApply?.questionnaire?.questions;
    if (!Array.isArray(questions) || !questions.length) {
      return sendJson(res, 400, { error: 'Нет вопросов анкеты' });
    }

    const answers = (Array.isArray(rawAnswers) ? rawAnswers : [])
      .map((row) => ({
        index: Number(row.index),
        answer: String(row.answer ?? '').trim(),
      }))
      .filter((a) => Number.isFinite(a.index) && a.index >= 1);

    const now = new Date().toISOString();
    const prevQ = rec.hhApply?.questionnaire || {};
    const questionnaire = {
      ...prevQ,
      questions,
      savedAnswers: answers,
      answersSavedAt: now,
    };
    const learned = captureQuestionnaireEditsOnSave(rec, answers);
    updateVacancyRecord(id, {
      hhApply: { ...rec.hhApply, lastAt: now, questionnaire },
    });

    return sendJson(res, 200, { ok: true, questionnaire, learnedEdits: learned });
  }

  if (req.method === 'GET' && pathname === '/api/questionnaire/reprobe-candidates') {
    const candidates = questionnaireReprobeCandidatePool();
    return sendJson(res, 200, {
      count: candidates.length,
      sample: candidates.slice(0, 8).map((r) => ({ id: r.id, title: r.title || r.url || '' })),
    });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/reprobe-batch') {
    let body = {};
    try {
      const raw = await readBody(req);
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const auto = Boolean(body.auto);
    const limit = Math.min(
      20,
      Math.max(1, Number(body.limit) || (auto ? AUTO_REPROBE_LIMIT : 5))
    );
    const candidates = questionnaireReprobeCandidatePool();
    if (!candidates.length) {
      return sendJson(res, 200, {
        ok: true,
        okCount: 0,
        failed: 0,
        total: 0,
        auto,
        message: 'Нет карточек с заглушками — probe не нужен.',
      });
    }
    const harvestSt = getJobStatus();
    if (harvestSt.harvest.running) {
      return sendJson(res, 409, { error: 'Идёт сбор вакансий — дождитесь завершения.' });
    }
    if (auto && (harvestSt.batch?.running || harvestSt.batchActive)) {
      return sendJson(res, 409, { error: 'Идёт серия откликов — auto-reprobe отложен.' });
    }
    const batch = auto ? pickAutoReprobeBatch(candidates, { limit }) : candidates.slice(0, limit);
    const { okCount, failed, errors, ran } = await runQuestionnaireProbeRecords(batch);
    return sendJson(res, 200, {
      ok: true,
      okCount,
      failed,
      total: candidates.length,
      ran,
      auto,
      errors: errors.slice(0, 10),
      message: auto
        ? `Авто-reprobe: ${okCount} OK, ${failed} ошибок (из ${ran})`
        : `Probe: ${okCount} OK, ${failed} ошибок (из ${ran})`,
    });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/probe-batch') {
    let body = {};
    try {
      const raw = await readBody(req);
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const limit = Math.min(15, Math.max(1, Number(body.limit) || 5));
    const scope = String(body.scope || 'questionnaire').trim();
    let candidates = loadQueue().filter((x) => !x.hidden && (x.status === 'pending' || x.status === 'approved'));
    if (scope === 'questionnaire') {
      candidates = candidates.filter((x) => vacancyQuestionnairePending(x) && !vacancyHasHhApply(x));
    } else if (scope === 'needs-probe') {
      candidates = candidates.filter(
        (x) => vacancyQuestionnairePending(x) && !(x.hhApply?.questionnaire?.questions?.length > 0)
      );
    }
    if (!candidates.length) {
      return sendJson(res, 200, {
        ok: true,
        okCount: 0,
        failed: 0,
        total: 0,
        message: 'Нет карточек для probe в текущем фильтре.',
      });
    }
    const harvestSt = getJobStatus();
    if (harvestSt.harvest.running) {
      return sendJson(res, 409, { error: 'Идёт сбор вакансий — дождитесь завершения.' });
    }
    const batch = candidates.slice(0, limit);
    const { okCount, failed, errors, ran } = await runQuestionnaireProbeRecords(batch);
    return sendJson(res, 200, {
      ok: true,
      okCount,
      failed,
      total: candidates.length,
      ran,
      scope,
      errors: errors.slice(0, 10),
      message: `Probe (${scope}): ${okCount} OK, ${failed} ошибок`,
    });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/clear-captcha') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, fixAll } = body;
    if (!id && !fixAll) {
      return sendJson(res, 400, { error: 'Нужен id или fixAll: true' });
    }
    if (!fixAll) {
      const rec = getVacancyRecord(id);
      if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
      if (!recordLooksLikeCaptchaQuestionnaire(rec)) {
        return sendJson(res, 400, {
          error: 'Карточка не похожа на капчу. Проверьте подписи полей.',
        });
      }
      updateVacancyRecord(id, patchClearCaptchaQuestionnaire(rec));
      return sendJson(res, 200, { ok: true, fixed: 1 });
    }
    const queue = loadQueue();
    let fixed = 0;
    for (const rec of queue) {
      if (!recordLooksLikeCaptchaQuestionnaire(rec)) continue;
      updateVacancyRecord(rec.id, patchClearCaptchaQuestionnaire(rec));
      fixed++;
    }
    return sendJson(res, 200, { ok: true, fixed });
  }

  if (req.method === 'POST' && pathname === '/api/questionnaire/probe') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const harvestSt = getJobStatus();
    if (harvestSt.harvest.running) {
      return sendJson(res, 409, { error: 'Идёт сбор вакансий — дождитесь завершения.' });
    }
    if (activeApplyChatPid) {
      try {
        process.kill(activeApplyChatPid, 0);
        return sendJson(res, 409, { error: 'Сейчас открыт отклик в браузере — дождитесь завершения.' });
      } catch {
        activeApplyChatPid = null;
      }
    }
    const lock = getBrowserLockInfo();
    if (lock.held && lock.owner !== 'probe-questionnaire') {
      return sendJson(res, 409, {
        error: `Профиль браузера занят (${lock.owner}). Закройте Chromium или подождите.`,
      });
    }

    const scriptPath = path.join(ROOT, 'scripts', 'probe-questionnaire.mjs');
    if (!fs.existsSync(scriptPath)) {
      return sendJson(res, 500, { error: 'probe-questionnaire.mjs не найден' });
    }

    const exitCode = await new Promise((resolve) => {
      const child = spawn(process.execPath, [scriptPath, `--id=${id}`], {
        cwd: ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let errText = '';
      child.stderr?.on('data', (d) => {
        errText += d.toString();
      });
      child.on('close', (code) => resolve({ code: code ?? 1, errText }));
    });

    const updated = getVacancyRecord(id);
    if (exitCode.code === 0) {
      return sendJson(res, 200, {
        ok: true,
        questionnaire: updated?.hhApply?.questionnaire,
        questionCount: meaningfulQuestions(updated?.hhApply?.questionnaire?.questions).length,
      });
    }
    if (exitCode.code === 2) {
      return sendJson(res, 404, {
        error: 'На странице отклика анкета не найдена (возможно, вопросы только после «Далее»).',
      });
    }
    return sendJson(res, 502, {
      error: (exitCode.errText || 'Ошибка probe-questionnaire').trim().slice(0, 500),
    });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/save-draft') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, variants: rawVariants } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (rec.coverLetter?.status !== 'pending') {
      return sendJson(res, 409, { error: 'Черновик можно править только в статусе «на согласовании»' });
    }

    const normalized = normalizeVariants(rawVariants, { forSaveDraft: true });
    const now = new Date().toISOString();
    const prev = rec.coverLetter || {};
    const coverLetter = {
      ...prev,
      status: 'pending',
      variants: normalized,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });

    const snippet = normalized.filter(Boolean).join('\n---\n').trim();
    if (snippet) appendCoverLetterUserEditSnippet(snippet);

    return sendJson(res, 200, { ok: true, coverLetter });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/action') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, action, text } = body;
    if (!id || !['approve', 'decline'].includes(action)) {
      return sendJson(res, 400, { error: 'Нужны id и action: approve | decline' });
    }

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const now = new Date().toISOString();
    const model = rec.coverLetter?.openRouterModel ?? null;

    if (action === 'approve') {
      const t = String(text || '').trim();
      if (!t) return sendJson(res, 400, { error: 'Для approve нужен непустой text' });
      const generated =
        rec.coverLetter?.generatedText ||
        (Array.isArray(rec.coverLetter?.variants) ? rec.coverLetter.variants[0] : '') ||
        '';
      const metrics = computeLetterEditMetrics(generated, t);
      const coverLetter = {
        status: 'approved',
        variants: [],
        approvedText: t,
        generatedText: generated || rec.coverLetter?.generatedText || '',
        openRouterModel: model,
        updatedAt: now,
        ...(metrics ? { metrics: { ...metrics, approvedAt: now } } : {}),
      };
      updateVacancyRecord(id, { coverLetter });
      return sendJson(res, 200, { ok: true, coverLetter });
    }

    const coverLetter = {
      status: 'declined',
      variants: [],
      approvedText: '',
      openRouterModel: model,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });
    return sendJson(res, 200, { ok: true, coverLetter });
  }

  if (req.method === 'POST' && pathname === '/api/hh-launch-apply-chat') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, usePoolLetter, tailorResume, questionnaireWait, questionnaireAuto } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const letter = String(rec.coverLetter?.approvedText || '').trim();
    if (!letter && !usePoolLetter) {
      return sendJson(res, 400, {
        error:
          'Нет утверждённого письма — утвердите в «Черновик письма» или нажмите «Авто-отклик» (письмо из пула)',
      });
    }

    if (activeApplyChatPid) {
      try {
        process.kill(activeApplyChatPid, 0);
        return sendJson(res, 409, {
          error: `Уже запущен «Отклик в браузере» (pid=${activeApplyChatPid}). Дождитесь завершения текущего сценария.`,
        });
      } catch {
        activeApplyChatPid = null;
      }
    }
    const harvestSt = getJobStatus();
    if (harvestSt.harvest.running) {
      return sendJson(res, 409, {
        error: `Сейчас идёт сбор вакансий (pid=${harvestSt.harvest.pid}). Сначала дождитесь его завершения.`,
      });
    }
    const applyLock = getBrowserLockInfo();
    if (applyLock.held && applyLock.owner !== 'apply-chat') {
      return sendJson(res, 409, {
        error: `Профиль браузера занят (${applyLock.owner}). Закройте лишний Chromium или дождитесь сбора.`,
      });
    }

    const scriptPath = path.join(ROOT, 'scripts', 'hh-apply-chat-letter.mjs');
    if (!fs.existsSync(scriptPath)) {
      return sendJson(res, 500, { error: 'Скрипт hh-apply-chat-letter.mjs не найден' });
    }

    const rateErr = checkApplyRateLimits();
    if (rateErr) return sendJson(res, 429, { error: rateErr });
    recordApplyLaunch();

    fs.mkdirSync(DATA_DIR, { recursive: true });
    const header = `\n======== ${new Date().toISOString()} recordId=${id} launch dashboard pid=${process.pid} ========\n`;
    fs.appendFileSync(HH_APPLY_CHAT_LOG_FILE, header, 'utf8');

    /**
     * detached + pipe ломает дочерний процесс (буфер stdout заполняется).
     * Пишем stdout/stderr в файл через унаследованный fd.
     */
    const logFd = fs.openSync(HH_APPLY_CHAT_LOG_FILE, 'a');
    let child;
    try {
      const playwrightBrowsersPath =
        String(process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim() || path.join(ROOT, '.playwright-browsers');
      const childArgs = [scriptPath, `--id=${id}`];
      if (usePoolLetter) childArgs.push('--use-pool-letter');
      if (tailorResume !== false) childArgs.push('--tailor-resume');
      if (questionnaireWait) {
        childArgs.push('--questionnaire-wait', '--stay-open');
      }
      if (questionnaireAuto || (usePoolLetter && process.env.HH_QUESTIONNAIRE_AUTO === '1')) {
        childArgs.push('--questionnaire-auto');
      }
      loadDevOpsEnv();
      child = spawnBackground(process.execPath, childArgs, {
        cwd: ROOT,
        detached: true,
        // Лог только через appendApplyChatLog в скрипте — иначе каждая строка дублируется.
        stdio: ['ignore', 'ignore', 'ignore'],
        env: {
          ...process.env,
          PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath,
          HH_HEADLESS: '0',
          HH_FAST: '1',
          HH_USE_POOL_LETTER: usePoolLetter ? '1' : '',
          HH_TAILOR_RESUME: tailorResume !== false ? '1' : '',
          HH_QUESTIONNAIRE_WAIT: questionnaireWait ? '1' : '',
          HH_QUESTIONNAIRE_AUTO:
            questionnaireAuto || (usePoolLetter && process.env.HH_QUESTIONNAIRE_AUTO === '1') ? '1' : '',
        },
      });
    } finally {
      try {
        fs.closeSync(logFd);
      } catch {
        /* ignore */
      }
    }

    child.on('exit', (code, signal) => {
      if (activeApplyChatPid === child.pid) activeApplyChatPid = null;
      const line = `\n--- child exit code=${code} signal=${signal || ''} at ${new Date().toISOString()} ---\n`;
      try {
        fs.appendFileSync(HH_APPLY_CHAT_LOG_FILE, line, 'utf8');
      } catch {
        /* ignore */
      }
    });

    activeApplyChatPid = child.pid;
    child.unref();

    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      logFile: path.relative(ROOT, HH_APPLY_CHAT_LOG_FILE),
      logFileAbsolute: HH_APPLY_CHAT_LOG_FILE,
    });
  }

  if (req.method === 'POST' && pathname === '/api/run-harvest') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const periodDays = parseHarvestPeriodDays(body.periodDays ?? 7);
    const st = getJobStatus();
    if (st.harvest.running) {
      return sendJson(res, 409, { error: `Сбор уже идёт (pid=${st.harvest.pid})` });
    }
    clearStaleBrowserLock();
    const lock = getBrowserLockInfo();
    if (lock.held) {
      return sendJson(res, 409, {
        error: `Профиль браузера занят (${lock.owner}, pid=${lock.pid}). Закройте все окна Chromium с hh.ru (сбор/отклик) и повторите.`,
      });
    }
    if (isProcessAlive(activeApplyChatPid)) {
      return sendJson(res, 409, {
        error: `Сейчас идёт отклик в браузере (pid=${activeApplyChatPid}). Дождитесь завершения или закройте окно.`,
      });
    }
    const harvestScript = path.join(ROOT, 'scripts', 'run-devops-harvest.mjs');
    const logPath = path.join(DATA_DIR, 'harvest-run.log');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const logFd = fs.openSync(logPath, 'a');
    fs.writeSync(
      logFd,
      `\n======== HARVEST ${new Date().toISOString()} period=${harvestPeriodLabel(periodDays)} ========\n`
    );
    loadDevOpsEnv();
    const child = spawnBackground(process.execPath, [harvestScript], {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        HH_SEARCH_PERIOD: periodDays === 0 ? '0' : String(periodDays),
        // Из дашборда сбор всегда без окна: это стабильнее и не крадёт фокус.
        HH_HEADLESS: '1',
        HH_BROWSER_BACKGROUND: '1',
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(ROOT, '.playwright-browsers'),
      },
    });
    fs.closeSync(logFd);
    setHarvestPid(child.pid);
    child.on('exit', () => setHarvestPid(null));
    child.unref();
    try {
      const devopsEnvPath = path.join(ROOT, 'config', 'devops.env');
      let txt = fs.readFileSync(devopsEnvPath, 'utf8');
      if (/^HH_SEARCH_PERIOD=.*/m.test(txt)) {
        txt = txt.replace(
          /^HH_SEARCH_PERIOD=.*/m,
          `HH_SEARCH_PERIOD=${periodDays === 0 ? '0' : periodDays}`
        );
      } else {
        txt += `\nHH_SEARCH_PERIOD=${periodDays === 0 ? '0' : periodDays}\n`;
      }
      fs.writeFileSync(devopsEnvPath, txt, 'utf8');
    } catch {
      /* ignore */
    }
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      periodDays,
      logFile: 'data/harvest-run.log',
    });
  }

  if (req.method === 'POST' && pathname === '/api/tailor-resume') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    try {
      const { ensureTailoredResumePdf } = await import('../lib/tailor-resume.mjs');
      const { pdfPath, mdPath } = await ensureTailoredResumePdf(rec.id, {
        title: rec.title,
        company: rec.company,
        description: String(rec.descriptionForLlm || rec.descriptionPreview || ''),
      });
      const tailoredResume = { pdfPath, mdPath, updatedAt: new Date().toISOString() };
      updateVacancyRecord(id, { tailoredResume });
      return sendJson(res, 200, { ok: true, tailoredResume });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/hh-launch-apply-batch') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const controlAction = String(body.action || body.control || '').toLowerCase();
    if (controlAction === 'pause' || controlAction === 'resume' || controlAction === 'stop') {
      const result = handleBatchControlAction(controlAction);
      return sendJson(res, result.code, result.body);
    }
    const minScore = body.minScore != null ? Math.max(0, Number(body.minScore) || 0) : 50;
    const maxScore = body.maxScore != null ? Math.max(0, Number(body.maxScore) || 0) : 0;
    const batchCap = getDashboardBatchSizeCap();
    const limit = Math.min(batchCap, Math.max(1, Number(body.limit) || batchCap));
    const batchScope = normalizeBatchScope(body.batchScope || body.applyView || 'noQuestionnaire');
    const batchScript = path.join(ROOT, 'scripts', 'hh-apply-batch.mjs');
    if (!fs.existsSync(batchScript)) {
      return sendJson(res, 500, { error: 'hh-apply-batch.mjs не найден' });
    }
    const batchRateErr = checkApplyRateLimits();
    if (batchRateErr) return sendJson(res, 429, { error: batchRateErr });
    const resume = Boolean(body.resume);
    const batchSt = getJobStatus();
    if (batchSt.batch.running) {
      return sendJson(res, 409, { error: `Батч уже идёт (pid=${batchSt.batch.pid})` });
    }
    if (resume) {
      if (!canResumeFromState()) {
        return sendJson(res, 409, { error: 'Нет сохранённого батча для продолжения' });
      }
    } else {
      clearBatchResumeState();
    }
    const logFd = fs.openSync(HH_APPLY_CHAT_LOG_FILE, 'a');
    const header = `\n======== BATCH ${new Date().toISOString()} scope=${batchScope} minScore=${minScore} limit=${limit} resume=${resume} ========\n`;
    fs.writeSync(logFd, header);
    const args = [batchScript, '--use-pool-letters', '--tailor-resume'];
    if (resume) {
      args.push('--resume');
    } else {
      args.push(`--limit=${limit}`);
      if (minScore > 0) args.push(`--min-score=${minScore}`);
      if (maxScore > 0) args.push(`--max-score=${maxScore}`);
      args.push(`--batch-scope=${batchScope}`);
    }
    loadDevOpsEnv();
    const child = spawnBackground(process.execPath, args, {
      cwd: ROOT,
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(ROOT, '.playwright-browsers'),
        HH_HEADLESS: process.env.HH_BATCH_HEADLESS === '1' ? '1' : '0',
        HH_FAST: String(process.env.HH_FAST ?? '1'),
        HH_BROWSER_BACKGROUND: process.env.HH_BROWSER_BACKGROUND ?? '1',
      },
    });
    fs.closeSync(logFd);
    setBatchPid(child.pid);
    child.on('exit', () => setBatchPid(null));
    child.unref();
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: `Батч «${batchScope}» запущен (до ${limit} откликов${minScore ? `, ≥${minScore}` : ''}${maxScore ? `, ≤${maxScore}` : ''}). Смотрите лог.`,
      batchScope,
    });
  }

  if (req.method === 'POST' && pathname === '/api/prune-responded-queue') {
    const dryRun = url.searchParams.get('dryRun') === '1';
    const r = pruneRespondedFromActiveQueue({ dryRun });
    return sendJson(res, 200, {
      ok: true,
      dryRun,
      changed: r.changed,
      total: r.total,
      message: dryRun
        ? `Будет убрано: ${r.changed}`
        : `Убрано из очереди: ${r.changed} (статус responded, см. вкладку «Отклики»)`,
    });
  }

  if (req.method === 'POST' && pathname === '/api/interview-prep') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const rec = getVacancyRecord(body.id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    try {
      const pack = await buildInterviewPrepPack(rec);
      updateVacancyRecord(rec.id, { interviewPrep: pack });
      return sendJson(res, 200, { ok: true, interviewPrep: pack });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/import-interview-notes') {
    try {
      const dir = process.env.HH_INTERVIEW_DIR || 'D:\\Dev\\HH\\hh\\Интервью';
      const r = importInterviewNotesFromDir(dir);
      return sendJson(res, r.ok ? 200 : 400, r);
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/chat-templates') {
    return sendJson(res, 200, { templates: CHAT_REPLY_TEMPLATES });
  }

  if (req.method === 'POST' && pathname === '/api/import-negotiations-queue') {
    try {
      const r = importNegotiationsToQueue();
      return sendJson(res, 200, {
        ok: true,
        ...r,
        message: `Импортировано: ${r.imported}, пропущено (уже в очереди): ${r.skipped}`,
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/launch-sync-resume-from-source') {
    const script = path.join(ROOT, 'scripts', 'sync-resume-from-source.mjs');
    if (!fs.existsSync(script)) return sendJson(res, 500, { error: 'sync-resume-from-source.mjs не найден' });
    let body = {};
    try {
      if (req.headers['content-length']) body = JSON.parse(await readBody(req));
    } catch {
      /* */
    }
    const args = [script];
    if (body.probeOnly) args.push('--probe-only');
    if (body.dryRun) args.push('--dry-run');
    if (body.force) args.push('--force');
    if (body.role) args.push(`--role=${String(body.role).trim()}`);
    const child = spawnBackground(process.execPath, args, {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    child.unref();
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: body.probeOnly
        ? 'Проверка завершённости резюме (см. data/resume-sync-report.json)'
        : 'Синхронизация резюме с эталона запущена',
    });
  }

  if (req.method === 'GET' && pathname === '/api/daily-routine') {
    return sendJson(res, 200, { steps: DAILY_ROUTINE_STEPS });
  }

  if (req.method === 'GET' && pathname === '/api/resume-sync-report') {
    const reportPath = path.join(DATA_DIR, 'resume-sync-report.json');
    if (!fs.existsSync(reportPath)) {
      return sendJson(res, 200, { ok: false, message: 'Отчёт ещё не создан — запустите синхронизацию или probe' });
    }
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      return sendJson(res, 200, { ok: true, report });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/routing-health') {
    return sendJson(res, 200, getResumeRoutingHealth());
  }

  if (req.method === 'GET' && pathname === '/api/batch-report') {
    const report = readBatchRunReport();
    if (!report) {
      return sendJson(res, 200, { ok: false, message: 'Отчёт батча ещё не создан — запустите авто-отклики' });
    }
    return sendJson(res, 200, { ok: true, report });
  }

  if (req.method === 'POST' && pathname === '/api/apply-negotiations-cache') {
    try {
      const cache = loadNegotiationsCache();
      for (const it of cache.items || []) {
        it.status = parseNegotiationStatusText(it.statusRaw);
      }
      const r = mergeNegotiationsIntoQueue(cache);
      return sendJson(res, 200, {
        ok: true,
        updated: r.updated,
        total: r.total,
        negotiations: (cache.items || []).length,
        message: `Обновлено карточек: ${r.updated}`,
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/daily-routine-run') {
    const busy = getBrowserBusyState();
    if (busy.busy) {
      return sendJson(res, 409, { error: busy.message, reason: busy.reason });
    }
    let body = {};
    try {
      if (req.headers['content-length']) body = JSON.parse(await readBody(req));
    } catch {
      /* */
    }
    const extra = body.withHarvest ? ['--with-harvest'] : [];
    const child = spawnSideJob('dailyRoutine', 'daily-routine.mjs', extra);
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: 'Ежедневная рутина запущена (синхр. отклики → кэш → чаты)',
    });
  }

  if (req.method === 'POST' && pathname === '/api/chat-reply-batch') {
    const q = loadQueue().filter((x) => x.hhApply?.chatSummary?.needsReply);
    const results = [];
    for (const rec of q.slice(0, 15)) {
      try {
        const draft = await draftChatReply({
          vacancyTitle: rec.title,
          company: rec.company,
          messages: rec.hhApply?.chatMessages || [],
        });
        updateVacancyRecord(rec.id, {
          hhApply: { ...(rec.hhApply || {}), chatReplyDraft: draft },
        });
        results.push({ id: rec.id, ok: true, source: draft.source });
      } catch (e) {
        results.push({ id: rec.id, ok: false, error: e.message });
      }
    }
    return sendJson(res, 200, { ok: true, processed: results.length, results });
  }

  if (req.method === 'POST' && pathname === '/api/chat-reply-draft') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    let rec = getVacancyRecord(body.id);
    if (!rec) {
      const id = String(body.id || '');
      if (id.startsWith('hh-neg-')) {
        const vid = id.slice('hh-neg-'.length);
        const cache = loadNegotiationsCache();
        const it = (cache.items || []).find((x) => String(x.vacancyId) === vid);
        if (it) {
          rec = {
            id,
            vacancyId: vid,
            title: it.title,
            company: it.company,
            hhApply: {
              chatMessages: it.chatMessages || [],
              chatSummary: it.chatSummary,
            },
          };
        }
      }
    }
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const messages = body.messages || rec.hhApply?.chatMessages || [];
    try {
      const draft = await draftChatReply({
        vacancyTitle: rec.title,
        company: rec.company,
        messages,
      });
      if (!String(rec.id || '').startsWith('hh-neg-')) {
        updateVacancyRecord(rec.id, {
          hhApply: { ...(rec.hhApply || {}), chatReplyDraft: draft },
        });
      }
      return sendJson(res, 200, { ok: true, ...draft });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/generate-resume-variant') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const role = String(body.role || 'devops').trim();
    try {
      const texts = await generateVariantTexts(role);
      return sendJson(res, 200, { ok: true, role, texts });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/launch-sync-hh-responses') {
    const busy = getBrowserBusyState();
    if (busy.busy) {
      return sendJson(res, 409, { error: busy.message, reason: busy.reason });
    }
    const child = spawnSideJob('syncResponses', 'sync-hh-responses.mjs');
    return sendJson(res, 200, { ok: true, pid: child.pid, message: 'Синхронизация откликов hh.ru запущена' });
  }

  if (req.method === 'POST' && pathname === '/api/launch-sync-hh-chats') {
    const busy = getBrowserBusyState();
    if (busy.busy) {
      return sendJson(res, 409, { error: busy.message, reason: busy.reason });
    }
    const child = spawnSideJob('syncChats', 'sync-hh-chats.mjs');
    return sendJson(res, 200, { ok: true, pid: child.pid, message: 'Синхронизация чатов запущена' });
  }

  if (req.method === 'GET' && pathname === '/api/resume-raise-schedule') {
    return sendJson(res, 200, getResumeRaiseScheduleStatus());
  }

  if (req.method === 'PATCH' && pathname === '/api/resume-raise-schedule') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const patch = {};
    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (Array.isArray(body.slots)) patch.slots = body.slots.map((h) => Number(h)).filter((h) => h >= 0 && h < 24);
    if (body.timezone) patch.timezone = String(body.timezone);
    if (typeof body.raiseAll === 'boolean') patch.raiseAll = body.raiseAll;
    const cfg = saveResumeRaiseScheduleConfig(patch);
    return sendJson(res, 200, { ok: true, config: cfg, status: getResumeRaiseScheduleStatus() });
  }

  if (req.method === 'POST' && pathname === '/api/resume-raise') {
    const busy = getBrowserBusyState();
    if (busy.busy) {
      return sendJson(res, 409, { error: busy.message, reason: busy.reason });
    }
    let body = {};
    try {
      if (req.headers['content-length']) body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const extra = [];
    if (body.all) extra.push('--all');
    if (body.role) extra.push(`--role=${String(body.role).trim()}`);
    if (body.hash) extra.push(`--hash=${String(body.hash).trim()}`);
    const child = spawnSideJob('resumeRaise', 'raise-resumes.mjs', extra);
    const cfg = loadResumeRaiseScheduleConfig();
    const label = body.all
      ? 'Подъём всех резюме'
      : body.role
        ? `Подъём резюме (${body.role})`
        : 'Подъём резюме из routing';
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: `${label} запущен (слоты авто: ${cfg.slots.join(', ')}:00 ${cfg.timezone})`,
    });
  }

  if (req.method === 'POST' && pathname === '/api/launch-sync-resume-variants') {
    let body = {};
    try {
      if (req.headers['content-length']) body = JSON.parse(await readBody(req));
    } catch {
      /* empty body ok */
    }
    const script = path.join(ROOT, 'scripts', 'sync-hh-resume-variants.mjs');
    if (!fs.existsSync(script)) return sendJson(res, 500, { error: 'sync-hh-resume-variants.mjs не найден' });
    const args = [script];
    if (body.role) args.push(`--role=${body.role}`);
    if (body.generateOnly) args.push('--generate-only');
    const child = spawnBackground(process.execPath, args, {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });
    child.unref();
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: 'Обновление резюме на hh.ru запущено (смотрите браузер)',
    });
  }

  if (req.method === 'POST' && pathname === '/api/hh-site-state') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, state } = body;
    const allowed = new Set(['none', 'already_applied', 'invited', 'declined', 'viewed', 'awaiting']);
    if (!id || !allowed.has(String(state || ''))) {
      return sendJson(res, 400, { error: 'Нужны id и state: none | already_applied | invited | declined' });
    }
    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const st = String(state);
    const hhApply = buildHhApplySiteStatePatch(rec.hhApply || {}, {
      state: st,
      label: hhSiteStateLabel(st),
      source: 'dashboard-manual',
    });
    updateVacancyRecord(id, { hhApply });
    if (st === 'invited' || st === 'declined') {
      appendFeedback({
        at: new Date().toISOString(),
        action: st,
        reason: st === 'invited' ? 'приглашение на hh.ru' : 'отказ работодателя',
        vacancyId: rec.vacancyId,
        title: rec.title,
        recordId: id,
        url: rec.url,
        letterExcerpt: String(rec.coverLetter?.approvedText || '').replace(/\s+/g, ' ').trim().slice(0, 220),
        resumeRole: rec.hhApply?.resumeRole || rec.resumeRouting?.role,
      });
    }
    return sendJson(res, 200, { ok: true, hhApply });
  }

  if (req.method === 'POST' && pathname === '/api/vacancy/defer') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, days, clear } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (clear) {
      clearVacancyDefer(id);
      return sendJson(res, 200, { ok: true, deferUntil: null });
    }
    const d = Math.max(1, Math.min(90, Number(days) || 1));
    deferVacancyForDays(id, d);
    const updated = getVacancyRecord(id);
    return sendJson(res, 200, { ok: true, deferUntil: updated?.deferUntil || null });
  }

  if (req.method === 'GET' && pathname === '/api/daily-digest') {
    const fresh = url.searchParams.get('refresh') === '1';
    if (fresh) {
      return sendJson(res, 200, { ok: true, digest: buildDailyDigest() });
    }
    const digest = readDailyDigest();
    if (!digest) {
      return sendJson(res, 200, { ok: false, message: 'Дайджест ещё не создан — npm run devops:daily-digest' });
    }
    return sendJson(res, 200, { ok: true, digest });
  }

  if (req.method === 'POST' && pathname === '/api/daily-digest') {
    let body = {};
    try {
      if (req.headers['content-length']) body = JSON.parse(await readBody(req));
    } catch {
      /* */
    }
    try {
      const { writeDailyDigest } = await import('../lib/daily-digest.mjs');
      const digest = await writeDailyDigest({ sendTelegram: body.sendTelegram !== false });
      return sendJson(res, 200, { ok: true, digest });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/dismiss') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    if (!removeVacancyRecord(id)) {
      return sendJson(res, 404, { error: 'Запись не найдена' });
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api')) {
    return sendJson(res, 404, { error: 'Неизвестный путь API', path: pathname });
  }

  const staticRel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(STATIC_DIR, staticRel);
  const staticRoot = path.resolve(STATIC_DIR);
  filePath = path.resolve(filePath);
  if (!filePath.startsWith(staticRoot + path.sep) && filePath !== staticRoot) {
    res.writeHead(403);
    return res.end();
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

let resumeRaiseSchedulerBusy = false;

function tickResumeRaiseSchedule() {
  if (resumeRaiseSchedulerBusy) return;
  const check = shouldRunScheduledRaise();
  if (!check.run) return;
  const busy = getBrowserBusyState();
  if (busy.busy) return;
  const side = getSideJobsStatus();
  if (side.resumeRaise?.running) return;
  resumeRaiseSchedulerBusy = true;
  try {
    spawnSideJob('resumeRaise', 'raise-resumes.mjs', ['--scheduled']);
    console.log(`[dashboard] Авто-подъём резюме (слот ${check.slotKey})`);
  } catch (e) {
    console.warn('[dashboard] resume-raise schedule:', e.message || e);
  } finally {
    resumeRaiseSchedulerBusy = false;
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Дашборд: http://127.0.0.1:${PORT}`);
  console.log('  API: batch-control, POST /api/preferences/save (лимиты из UI)');
  setInterval(tickResumeRaiseSchedule, 60_000);
  tickResumeRaiseSchedule();
  const cfg = loadResumeRaiseScheduleConfig();
  console.log(
    `  Авто-подъём резюме: ${cfg.enabled ? 'вкл' : 'выкл'} · ${cfg.slots.join(', ')}:00 (${cfg.timezone})`
  );
});
