/**
 * Локальный мини-дашборд: http://127.0.0.1:3849
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnBackground } from '../lib/spawn-background.mjs';
import { hideSideJobConsole, sideJobHeadlessEnv } from '../lib/side-job-spawn.mjs';
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
  PREFS_FILE,
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
  ensureLegacySidebarPrefsMigrated,
  getDashboardUiConfig,
  getDashboardBatchSizeCap,
  DASHBOARD_PREF_BOUNDS,
} from '../lib/dashboard-preferences.mjs';
import {
  PLAYWRIGHT_DISPLAY_MODE_OPTIONS,
  normalizePlaywrightDisplayMode,
  playwrightDisplayEnv,
} from '../lib/playwright-display-mode.mjs';
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
import {
  runIntelligenceLoop,
  INTELLIGENCE_DIGEST_FILE,
} from '../lib/intelligence-loop.mjs';
import { readConversionEvents } from '../lib/observability.mjs';
import { previewApplyGate, GATE_SKIP_REASON } from '../lib/apply-gate.mjs';
import {
  buildEmployerDossierIndex,
  employerIntelForCompany,
  getEmployerDossier,
  listEmployerDossiers,
} from '../lib/employer-dossier.mjs';
import { mapGateVerdictToPrecheckKey } from '../lib/batch-gate-skip.mjs';
import { listTopTierRecords } from '../lib/source-quality.mjs';
import { ingestUrl, ingestUrlsFromText } from '../lib/vacancy-ingest.mjs';
import { parseUrlMetadata } from '../lib/vacancy-id.mjs';
import { classifyAllRecords } from '../lib/outcome-classifier.mjs';
import { loadAnalyticsUnionRecords } from '../lib/queue-aggregate.mjs';
import { importInterviewNotesFromDir } from '../lib/interview-notes.mjs';
import { buildInterviewPrepPack } from '../lib/interview-prep.mjs';
import { buildTechnicalMockInterview } from '../lib/interview-mock.mjs';
import { buildHrScreeningMock } from '../lib/interview-mock-hr.mjs';
import { buildPromptState } from '../lib/interview-prompt.mjs';
import {
  pushPromptState,
  pushPrepPromptState,
  getPromptState,
  getPrepPromptState,
  clearPromptState,
} from '../lib/interview-prompt-bridge.mjs';
import {
  buildDebriefSummary,
  mergeSpokenToNotes,
  mergeSpokenToVoiceProfile,
  buildFollowUpDraft,
  detectVideoCapabilities,
} from '../lib/interview-copilot-post.mjs';
import { autoPrepAfterNegotiationSync } from '../lib/interview-auto-prep.mjs';
import { recordDebriefPattern } from '../lib/interview-debrief-patterns.mjs';
import { buildCandidateContext } from '../lib/candidate-context-bundle.mjs';
import { injectQuestion, getLiveSessionId } from '../lib/interview-copilot-session.mjs';
import { recordSpokenAnswer, getSpokenTurns } from '../lib/interview-copilot-spoken.mjs';
import { enrichPackWithScripts, buildAnswerScript, formatScriptPromptText } from '../lib/interview-copilot-answers.mjs';
import { startLiveCopilot, ingestLiveCopilotChunk, stopLiveCopilot } from '../lib/interview-copilot-live.mjs';
import {
  startReplaySession,
  tickReplaySession,
  listReplayTranscripts,
  updatePlanTimelineOffset,
} from '../lib/interview-copilot-replay.mjs';
import {
  loadReplayPlan,
  ensureReplayPlan,
  validateReplayPlan,
  enrichPlanWithLlm,
  findPlanByTranscriptBase,
} from '../lib/interview-replay-plan.mjs';
import { ingestFromSegments } from '../lib/interview-ingest.mjs';
import {
  prepareReplayFromStream,
  prepareReplayFromLocalVideo,
  listInterviewVideosForReplay,
  resolveReplayVideoPath,
  resolveInterviewDirVideo,
} from '../lib/interview-copilot-transcribe.mjs';
import { getCopilotSessionSnapshot } from '../lib/interview-copilot-session.mjs';
import { buildOffersTrackerSnapshot, setOfferDecision } from '../lib/offer-tracker.mjs';
import { resolveVacancyRecord } from '../lib/vacancy-record-resolve.mjs';
import { draftChatReply } from '../lib/chat-reply-draft.mjs';
import { buildChatInbox, getChatThreadDetail } from '../lib/chat-inbox.mjs';
import { classifyChatFollowUp, defaultInviteNudgeText, listChatFollowUps } from '../lib/chat-follow-up.mjs';
import {
  getChatFollowUpScheduleStatus,
  shouldRunChatFollowUpSchedule,
  saveChatFollowUpScheduleConfig,
  loadChatFollowUpScheduleConfig,
  markChatFollowUpSlotDone,
} from '../lib/chat-follow-up-schedule.mjs';
import { checkChatSendRateLimit, recordChatSendLaunch, countChatSendLastHour, getMaxChatSendPerHour } from '../lib/chat-send-rate.mjs';
import { notifyChatFollowUpTelegram } from '../lib/chat-notify.mjs';
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
import { normalizeBatchScope, batchScopeUiLabel } from '../lib/batch-scope.mjs';
import { countBatchCandidates, listBatchCandidates } from '../lib/batch-candidates.mjs';
import { bootstrapKnowledgeStoreIfEnabled } from '../lib/knowledge-bootstrap.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { getSystemSetupStatus } from '../lib/system-setup-status.mjs';
import { computeTargetingRejectStats } from '../lib/targeting-reject-stats.mjs';
import { computeApplyThresholdPreview, computeTargetingRolePreview } from '../lib/settings-apply-preview.mjs';
import { getRegistryMetaForClient } from '../lib/settings-registry.mjs';
import { getSettingsSnapshot, patchSettings, normalizeSettingsPatchInput } from '../lib/settings-store.mjs';
import { listCopilotAudioDevices } from '../lib/copilot-audio-devices.mjs';
import { getQueueMeta, loadDemoIntoActiveQueue } from '../lib/demo-queue.mjs';
import {
  pickDashboardPrefsExport,
  sanitizeDashboardPrefsImport,
  backupPreferencesFile,
} from '../lib/dashboard-preferences.mjs';
import {
  recordPassesMinSalary,
  recordHasDescription,
  recordPassesLlmList,
  recordPassesNotFirstLine,
  recordPassesNotDeveloper,
  recordPassesNotSenior,
  recordPassesNot1C,
  recordPassesNotFieldRole,
  recordPassesRoleFiltersForList,
  recordHiddenRoleReasons,
  recordIsHiddenByRoleFilters,
  isDecidedQueueStatus,
} from '../lib/filters.mjs';
import {
  clearRejectSourcePatch,
  isAutoRejectRecord,
  isManualRejectRecord,
  passesRejectSourceFilter,
  rejectSourcePatchForManual,
} from '../lib/reject-source.mjs';
import { appendFeedback } from '../lib/feedback-context.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import {
  buildMarketSkillsReport,
  compareMarketVsVacancy,
  readCvTextSync,
} from '../lib/market-skills.mjs';
import {
  createLlmRoutingContext,
  hasScoreProviderCredentials,
  scoreVacancyWithLlm,
} from '../lib/openrouter-score.mjs';
import {
  generateCoverLetterVariants,
  normalizeVariants,
} from '../lib/cover-letter-openrouter.mjs';
import { loadEmployerRagBlockForRecord } from '../lib/employer-rag.mjs';
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
import { resolveResumeForVacancy, classifyVacancyResumeRole } from '../lib/resume-routing.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import { resolveApplyIntelligence } from '../lib/apply-intelligence-prefs.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';
import { prepareCoverLetterForSend } from '../lib/cover-letter-prepare.mjs';
import {
  evaluateLetterQuality,
  improveApprovedLetterForVacancy,
  bulkImproveApprovedLetters,
} from '../lib/cover-letter-quality-scan.mjs';
import { listLetterIssues } from '../lib/cover-letter-issues.mjs';
import { computeLetterReadiness } from '../lib/letter-readiness.mjs';
import { appendLetterMetric } from '../lib/letter-metrics.mjs';
import { summarizeLetterMetrics } from '../lib/letter-metrics-summary.mjs';
import { summarizeLetterInviteCorrelation } from '../lib/letter-invite-correlation.mjs';
import { buildLetterStyleInsightsFromQueue } from '../lib/letter-style-learning.mjs';
import { runTargetingGoldenRegression } from '../lib/targeting-golden-set.mjs';
import {
  summarizeFalsePositives,
  recordFalsePositiveSnapshot,
  computeFalsePositiveTrend,
  isFalsePositiveGuardrailTriggered,
  learningSuggestionsFromFalsePositives,
} from '../lib/false-positive-analytics.mjs';
import { computeQualityBaseline } from '../lib/quality-baseline.mjs';
import { readLetterQualityReport } from '../lib/batch-letter-quality-report.mjs';
import { buildCoverLetterQualityHub } from '../lib/cover-letter-quality-hub.mjs';
import { filterSafeAutoApplyItems } from '../lib/learning-auto-apply.mjs';
import { pickBestPreparedVariant } from '../lib/cover-letter-prepare.mjs';
import { passesAutoApproveLetterScore } from '../lib/letter-batch-gate.mjs';
import {
  letterQualityToScore10,
  enrichLetterQualityForApi,
  letterQualityForListRow,
} from '../lib/letter-score.mjs';
import { readBatchRunReport } from '../lib/batch-run-report.mjs';
import {
  diffBatchPrefsSnapshots,
  pickBatchPrefsSnapshot,
} from '../lib/batch-prefs-diff.mjs';
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
const LEARNING_LOG_FILE = path.join(DATA_DIR, 'learning-rules-log.jsonl');
const LETTER_HUB_CACHE_MS = 20_000;
/** @type {{ body: object|null, at: number }} */
let letterQualityHubCache = { body: null, at: 0 };

function bumpLetterQualityHubCache() {
  letterQualityHubCache = { body: null, at: 0 };
}
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
      const child = spawnBackground(process.execPath, [scriptPath, `--id=${rec.id}`], {
        cwd: ROOT,
        env: sideJobHeadlessEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        hideConsole: hideSideJobConsole(),
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

function normalizeLearnTarget(raw) {
  const t = String(raw || '').trim();
  return t === 'developer' || t === 'irrelevant' || t === 'senior' ? t : 'irrelevant';
}

function addUniquePattern(list, value) {
  const next = Array.isArray(list) ? [...list.map((x) => String(x))] : [];
  const v = String(value || '').trim().toLowerCase();
  if (!v) return { list: next, added: false };
  if (next.some((x) => String(x).trim().toLowerCase() === v)) {
    return { list: next, added: false };
  }
  next.push(v);
  return { list: next, added: true };
}

function normalizePatternToken(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[«»"'`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function suggestionFromFeedbackReason(reason) {
  const t = normalizePatternToken(reason);
  if (!t) return null;
  if (/тестиров|^qa$|aqa|test\b/.test(t)) return { pattern: 'тестировщик', target: 'irrelevant' };
  if (/архитект/.test(t)) return { pattern: 'архитектор', target: 'irrelevant' };
  if (/техподдерж|support|helpdesk|дежурн/.test(t)) {
    return { pattern: 'технической поддержки l1', target: 'irrelevant' };
  }
  if (/безопас|безопаст|security|secops|devsecops/.test(t)) return { pattern: 'security engineer', target: 'irrelevant' };
  if (/аналитик|analyst/.test(t)) return { pattern: 'аналитик', target: 'irrelevant' };
  if (/главн|руководител|head|chief|cto|технический\s+директор/.test(t)) {
    return { pattern: 'team lead', target: 'senior' };
  }
  if (/продаж|sales|presale|пресейл|b2b/.test(t)) {
    return { pattern: 'менеджер по продажам', target: 'irrelevant' };
  }
  if (/сетев|network|mvno/.test(t)) return { pattern: 'сетевой инженер', target: 'irrelevant' };
  if (/crypto|крипт/.test(t)) return { pattern: 'crypto', target: 'irrelevant' };
  if (/agile|product manager|project manager|pm\b/.test(t)) return { pattern: 'product manager', target: 'irrelevant' };
  if (/не\s*it|не\s*айти|не it/.test(t)) return { pattern: 'не it', target: 'irrelevant' };
  if (/санкт-петербург|спб/.test(t)) return { pattern: 'санкт-петербург', target: 'irrelevant' };
  if (/тюмень|utc\s*\+?\s*7|дальний\s+восток/.test(t)) return { pattern: 'utc +7', target: 'irrelevant' };
  return null;
}

function learnListByTarget(prefs, target) {
  if (target === 'developer') return prefs.excludeDeveloperRolePatterns || [];
  if (target === 'senior') return prefs.excludeSeniorRolePatterns || [];
  return prefs.excludeIrrelevantTitlePatterns || [];
}

function collectLearningSuggestionsFromRejected(rejected, prefs, limit = 5) {
  /** @type {Map<string, { pattern: string, target: string, count: number, sample: string, source?: string }>} */
  const acc = new Map();

  const fpSummary = summarizeFalsePositives(rejected, prefs, { limit: 8 });
  for (const row of learningSuggestionsFromFalsePositives(fpSummary, prefs, limit)) {
    const key = `${row.target}::${row.pattern}`;
    acc.set(key, row);
  }

  for (const rec of rejected) {
    const r = suggestionFromFeedbackReason(rec.feedbackReason || '');
    if (!r) continue;
    const key = `${r.target}::${r.pattern}`;
    if (!acc.has(key)) {
      acc.set(key, {
        pattern: r.pattern,
        target: r.target,
        count: 1,
        sample: String(rec.title || '').slice(0, 90),
        source: 'feedback',
      });
    } else {
      acc.get(key).count += 1;
    }
  }
  const out = [...acc.values()]
    .filter((x) => {
      const existing = learnListByTarget(prefs, x.target);
      return !existing.some((v) => normalizePatternToken(v) === normalizePatternToken(x.pattern));
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  return out;
}

function appendLearningLog(entry) {
  try {
    fs.appendFileSync(
      LEARNING_LOG_FILE,
      `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
      'utf8'
    );
  } catch {
    /* ignore logging errors */
  }
}

function readLearningLog(limit = 20) {
  try {
    if (!fs.existsSync(LEARNING_LOG_FILE)) return [];
    const raw = fs.readFileSync(LEARNING_LOG_FILE, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
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

function readBodyBuffer(req, maxBytes = 600_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let len = 0;
    req.on('data', (c) => {
      len += c.length;
      if (len > maxBytes) reject(new Error('Файл слишком большой (лимит ~600 МБ)'));
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
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
      chatFollowUpSchedule: getChatFollowUpScheduleStatus(),
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

  if (req.method === 'GET' && pathname === '/api/intelligence-digest') {
    const refresh = url.searchParams.get('refresh') === '1';
    if (refresh) {
      return sendJson(res, 200, runIntelligenceLoop({ label: 'api' }));
    }
    if (fs.existsSync(INTELLIGENCE_DIGEST_FILE)) {
      try {
        return sendJson(res, 200, JSON.parse(fs.readFileSync(INTELLIGENCE_DIGEST_FILE, 'utf8')));
      } catch {
        /* fall through */
      }
    }
    return sendJson(res, 200, runIntelligenceLoop({ label: 'api' }));
  }

  if (req.method === 'GET' && pathname === '/api/conversion-events') {
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const correlationId = url.searchParams.get('correlationId') || undefined;
    const batchRunId = url.searchParams.get('batchRunId') || undefined;
    const typePrefix = url.searchParams.get('typePrefix') || undefined;
    const { events, total, file } = readConversionEvents({
      limit,
      correlationId,
      batchRunId,
      typePrefix,
    });
    return sendJson(res, 200, { ok: true, file, total, events });
  }

  if (req.method === 'GET' && pathname === '/api/apply-gate/preview') {
    const ref = String(
      url.searchParams.get('recordId') || url.searchParams.get('vacancyId') || ''
    ).trim();
    if (!ref) {
      return sendJson(res, 400, {
        ok: false,
        error: 'recordId или vacancyId обязателен',
        hint: 'recordId — id карточки в очереди; vacancyId — число из hh.ru/vacancy/131926667',
      });
    }
    const rec = resolveVacancyRecord(ref);
    if (!rec) {
      return sendJson(res, 404, {
        ok: false,
        error: 'record not found',
        ref,
        hint: 'Перезапустите дашборд после обновления; id с hh.ru — параметр vacancyId',
      });
    }
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const verdict = await previewApplyGate(rec, {
      prefs,
      allRecords: loadQueue(),
      requireLetter: url.searchParams.get('requireLetter') !== '0',
    });
    return sendJson(res, 200, { ok: true, ...verdict });
  }

  if (req.method === 'GET' && pathname === '/api/employers') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 25) || 25));
    const employers = listEmployerDossiers({ limit });
    return sendJson(res, 200, { ok: true, total: employers.length, employers });
  }

  const employerMatch = pathname.match(/^\/api\/employers\/([^/]+)$/);
  if (req.method === 'GET' && employerMatch) {
    const ref = decodeURIComponent(employerMatch[1]);
    const dossier = getEmployerDossier(ref);
    if (!dossier) {
      return sendJson(res, 404, {
        ok: false,
        error: 'employer not found',
        ref,
        hint: 'Используйте slug (komitas) или имя компании из карточки',
      });
    }
    return sendJson(res, 200, { ok: true, dossier });
  }

  if (req.method === 'GET' && pathname === '/api/market-skills') {
    const role = url.searchParams.get('role') || process.env.HH_PROFILE || 'devops';
    const prefs = loadPreferences();
    if (!prefs.marketSkillsEnabled) {
      return sendJson(res, 200, { ok: true, enabled: false });
    }
    let cvText = readCvTextSync();
    try {
      const cvBundle = await loadCvBundle();
      if (cvBundle?.text) cvText = cvBundle.text;
    } catch {
      /* sync fallback */
    }
    const report = buildMarketSkillsReport(role, cvText);
    let vacancySample = null;
    try {
      const union = loadAnalyticsUnionRecords();
      const sample =
        union.records.find((r) => r.status === 'pending' && r.title) || union.records.find((r) => r.title);
      if (sample) {
        vacancySample = compareMarketVsVacancy(sample, report.bundle.skills);
      }
    } catch {
      /* optional */
    }
    return sendJson(res, 200, {
      ok: true,
      enabled: true,
      role: report.bundle.role,
      bundle: report.bundle,
      cvCompare: report.cvCompare,
      vacancySample,
    });
  }

  if (req.method === 'GET' && pathname === '/api/outcome-buckets') {
    const union = loadAnalyticsUnionRecords();
    const classified = classifyAllRecords(union.records);
    return sendJson(res, 200, {
      at: new Date().toISOString(),
      summary: classified.summary,
      items: classified.items.slice(0, 200),
    });
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

  if (req.method === 'GET' && pathname === '/api/queue-meta') {
    try {
      return sendJson(res, 200, { ok: true, ...getQueueMeta() });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/load-demo-queue') {
    let body = {};
    try {
      const raw = await readBody(req);
      if (raw) body = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const result = loadDemoIntoActiveQueue({ replace: Boolean(body.replace) });
      if (!result.ok) {
        return sendJson(res, 409, { ok: false, ...result, error: 'Очередь не пуста' });
      }
      return sendJson(res, 200, { ok: true, ...result });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/vacancies') {
    const status = url.searchParams.get('status') || 'pending';
    const scoreBand = url.searchParams.get('scoreBand') || 'all';
    const applyViewRaw = url.searchParams.get('applyView') || 'queue';
    const rejectSourceFilterRaw = url.searchParams.get('rejectSource') || 'all';
    const sourceFilter = url.searchParams.get('source') || 'all';
    const tierFilter = url.searchParams.get('tier') || 'all';
    const rejectSourceFilter =
      rejectSourceFilterRaw === 'auto' || rejectSourceFilterRaw === 'manual'
        ? rejectSourceFilterRaw
        : 'all';
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
    const decidedList = isDecidedQueueStatus(status);
    q = q.filter((x) => recordHasDescription(x)).filter((x) => recordPassesLlmList(x));
    if (!decidedList) {
      q = q.filter((x) => recordPassesMinSalary(x, prefs));
    }
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
      q = q.filter((x) => recordPassesRoleFiltersForList(x, prefs));
      q = q.filter((x) => !vacancyHasHhApply(x));
      q = q.filter((x) => !recordNeedsQuestionnaireWork(x));
    } else {
      if (!decidedList) {
        q = q.filter((x) => recordPassesRoleFiltersForList(x, prefs));
      }
      if (applyView !== 'deferred') {
        q = q.filter((x) => !isVacancyDeferred(x));
      }
      if (applyView === 'applied') {
        q = q.filter((x) => vacancyShownInAppliedTab(x));
      } else {
        q = q.filter((x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x));
      }
    }
    if (status === 'rejected' && rejectSourceFilter !== 'all') {
      q = q.filter((x) => passesRejectSourceFilter(x, rejectSourceFilter));
    }
    if (minScoreLegacy != null && minScoreLegacy !== '' && scoreBand === 'all') {
      const minScore = Math.max(0, Number(minScoreLegacy) || 0);
      if (minScore > 0) q = q.filter((x) => scoreOfItem(x) >= minScore);
    } else {
      q = filterByScoreBand(q, scoreBand, threshold);
    }
    if (sourceFilter !== 'all') {
      q = q.filter((x) => String(x.source || 'hh').toLowerCase() === sourceFilter.toLowerCase());
    }
    if (tierFilter !== 'all') {
      q = q.filter((x) => String(x.sourceQualityTier || '').toUpperCase() === tierFilter.toUpperCase());
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
    baseForCounts = baseForCounts.filter((x) => recordPassesLlmList(x));
    if (!isDecidedQueueStatus(status)) {
      baseForCounts = baseForCounts
        .filter((x) => recordPassesRoleFiltersForList(x, prefs))
        .filter((x) => recordPassesMinSalary(x, prefs));
    }
    const workBase = baseForCounts.filter(
      (x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x) && !isVacancyDeferred(x)
    );
    const noQuestionnaireBase = workBase.filter((x) => !recordNeedsQuestionnaireWork(x));
    const questionnaireBase = workBase.filter((x) => recordNeedsQuestionnaireWork(x));
    let appliedNavBase = loadQueue()
      .filter((x) => recordHasDescription(x))
      .filter((x) => recordPassesLlmList(x))
      .filter((x) => recordPassesMinSalary(x, prefs))
      .filter((x) => recordPassesRoleFiltersForList(x, prefs))
      .filter((x) => !isVacancyDeferred(x))
      .filter((x) => vacancyShownInAppliedTab(x));
    let appliedNavFiltered = appliedNavBase;
    if (scoreBand === 'high' || scoreBand === 'low') {
      appliedNavFiltered = filterByScoreBand(appliedNavBase, scoreBand, threshold);
    }
    const appliedNavIds = new Set(
      appliedNavFiltered.map((x) => String(x.vacancyId || '').trim()).filter(Boolean)
    );
    const appliedNavCount = appliedNavFiltered.length + buildHhNegotiationOnlyCards(appliedNavIds).length;
    const high = filterByScoreBand(noQuestionnaireBase, 'high', threshold).length;
    const low = filterByScoreBand(noQuestionnaireBase, 'low', threshold).length;
    const appliedHigh = filterByScoreBand(appliedNavBase, 'high', threshold).length;
    const appliedLow = filterByScoreBand(appliedNavBase, 'low', threshold).length;

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
        .filter((x) => recordPassesRoleFiltersForList(x, prefs))
        .filter((x) => recordPassesLlmList(x))
        .filter((x) => recordPassesMinSalary(x, prefs));
      const inBandAfterRole =
        scoreBand === 'all' ? afterRole.length : filterByScoreBand(afterRole, scoreBand, threshold).length;
      hiddenByRole = Math.max(0, rawInBand - inBandAfterRole);
    }

    let rejectedAll = 0;
    let rejectedAuto = 0;
    let rejectedManual = 0;
    if (status === 'rejected' && applyView !== 'applied') {
      let rejectedBase = loadQueue()
        .filter((x) => x.status === 'rejected')
        .filter((x) => recordHasDescription(x))
        .filter((x) => recordPassesLlmList(x));
      if (applyView === 'hidden') {
        rejectedBase = rejectedBase
          .filter((x) => !isVacancyDeferred(x))
          .filter((x) => !vacancyHasHhApply(x))
          .filter((x) => recordIsHiddenByRoleFilters(x, prefs));
      } else if (applyView === 'deferred') {
        rejectedBase = rejectedBase.filter((x) => isVacancyDeferred(x));
      } else {
        rejectedBase = rejectedBase
          .filter((x) => !isVacancyDeferred(x))
          .filter((x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x));
      }
      if (scoreBand === 'high' || scoreBand === 'low') {
        rejectedBase = filterByScoreBand(rejectedBase, scoreBand, threshold);
      }
      rejectedAll = rejectedBase.length;
      rejectedAuto = rejectedBase.filter((x) => isAutoRejectRecord(x)).length;
      rejectedManual = rejectedBase.filter((x) => isManualRejectRecord(x)).length;
    }

    let statusTabCounts = null;
    let pendingNavCounts = null;
    if (applyView !== 'applied' && applyView !== 'questionnaire' && applyView !== 'deferred') {
      const scopeForApplyView = (items, st = status) => {
        const decided = isDecidedQueueStatus(st);
        if (applyView === 'hidden') {
          return items
            .filter((x) => !isVacancyDeferred(x))
            .filter((x) => !vacancyHasHhApply(x))
            .filter((x) => recordIsHiddenByRoleFilters(x, prefs));
        }
        if (applyView === 'noQuestionnaire') {
          let out = items
            .filter((x) => !vacancyHasHhApply(x))
            .filter((x) => !recordNeedsQuestionnaireWork(x));
          if (!decided) out = out.filter((x) => recordPassesRoleFiltersForList(x, prefs));
          return out;
        }
        let out = items
          .filter((x) => !isVacancyDeferred(x))
          .filter((x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x));
        if (!decided) out = out.filter((x) => recordPassesRoleFiltersForList(x, prefs));
        return out;
      };
      const countStatusTab = (st) => {
        let base = loadQueue()
          .filter((x) => x.status === st)
          .filter((x) => recordHasDescription(x))
          .filter((x) => recordPassesLlmList(x));
        if (!isDecidedQueueStatus(st)) {
          base = base.filter((x) => recordPassesMinSalary(x, prefs));
        }
        if (st === 'pending' || st === 'approved') {
          base = base.filter((x) => x.status !== QUEUE_STATUS_RESPONDED);
        }
        base = scopeForApplyView(base, st);
        if (scoreBand === 'high' || scoreBand === 'low') {
          base = filterByScoreBand(base, scoreBand, threshold);
        }
        return base.length;
      };
      statusTabCounts = {
        pending: countStatusTab('pending'),
        approved: countStatusTab('approved'),
        rejected: countStatusTab('rejected'),
      };
      const countPendingInView = (extra = null) => {
        let base = loadQueue()
          .filter((x) => x.status === 'pending')
          .filter((x) => x.status !== QUEUE_STATUS_RESPONDED)
          .filter((x) => recordHasDescription(x))
          .filter((x) => recordPassesLlmList(x))
          .filter((x) => recordPassesMinSalary(x, prefs));
        base = scopeForApplyView(base);
        if (typeof extra === 'function') base = base.filter(extra);
        if (scoreBand === 'high' || scoreBand === 'low') {
          base = filterByScoreBand(base, scoreBand, threshold);
        }
        return base.length;
      };
      pendingNavCounts = {
        queue: countPendingInView(),
        noQuestionnaire: countPendingInView((x) => !recordNeedsQuestionnaireWork(x)),
        questionnaire: countPendingInView((x) => recordNeedsQuestionnaireWork(x)),
      };
    }

    const employerIndex = buildEmployerDossierIndex({ limit: 200 });

    const itemsOut = q.map((x) => {
      const row = { ...x };
      if (applyView === 'hidden') {
        row.hiddenRoleReasons = recordHiddenRoleReasons(x, prefs);
      }
      const employerIntel = employerIntelForCompany(x.company, employerIndex);
      if (employerIntel) row.employerIntel = employerIntel;
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
        const approvedLetter = String(x.coverLetter?.approvedText || '').trim();
        const variants = (x.coverLetter?.variants || []).filter(Boolean);
        let letterText = approvedLetter;
        if (!letterText && variants.length) {
          letterText = pickBestPreparedVariant(variants, x, pick.role, prefs);
        }
        let letterEv = null;
        if (letterText) {
          letterEv = evaluateLetterQuality(x, letterText, pick.role, prefs);
          row.letterQuality = letterQualityForListRow(letterEv);
        } else {
          row.letterQuality = letterQualityForListRow(null);
        }
        const strictRemoteWork = prefs.batchRequireRemote !== undefined
          ? prefs.batchRequireRemote !== false
          : prefs.requireRemote !== false;
        row.readiness = computeLetterReadiness(x, prefs, {
          userApproved: x.status === 'approved',
          strictRemoteWork,
          letterQualityEval: letterEv,
        });
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
        applied: appliedNavCount,
        appliedHigh,
        appliedLow,
        queue: pendingNavCounts?.queue ?? workBase.length,
        questionnaire: pendingNavCounts?.questionnaire ?? questionnaireBase.length,
        noQuestionnaire: pendingNavCounts?.noQuestionnaire ?? noQuestionnaireBase.length,
        deferred: loadQueue().filter((x) => isVacancyDeferred(x)).length,
        rawInBand,
        hiddenByRole,
        totalPending: loadQueue().filter((x) => x.status === status).length,
        negotiationsOnly: negotiationsOnlyCount,
        rejectedAll,
        rejectedAuto,
        rejectedManual,
        statusTabCounts,
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
      .filter((x) => recordHasDescription(x));
    let letterPrefs = {};
    try {
      letterPrefs = loadPreferences();
    } catch {
      /* ignore */
    }
    const qLetters = q
      .filter((x) => recordPassesRoleFiltersForList(x, letterPrefs))
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
      const p = ensureLegacySidebarPrefsMigrated(loadPreferences());
      return sendJson(res, 200, {
        preferences: p,
        bounds: DASHBOARD_PREF_BOUNDS,
        ui: getDashboardUiConfig(p),
        applyRates: applyRateLimitsSnapshot(),
        activeProfile: getStoredProfileId(),
        profiles: listProfiles(),
        queuePath: process.env.HH_VACANCIES_QUEUE_FILE || 'data/vacancies-devops.json',
        playwrightDisplay: {
          mode: normalizePlaywrightDisplayMode(p.dashboardPlaywrightDisplayMode),
          options: PLAYWRIGHT_DISPLAY_MODE_OPTIONS,
        },
        systemStatus: getSystemSetupStatus(),
        apiFeatures: { preferencesSave: true, profileSelect: true },
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/system-status') {
    try {
      return sendJson(res, 200, getSystemSetupStatus());
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/targeting/reject-stats') {
    try {
      const limit = Math.min(12, Math.max(3, Number(url.searchParams.get('limit') || 8) || 8));
      return sendJson(res, 200, computeTargetingRejectStats({ limit }));
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/settings') {
    try {
      return sendJson(res, 200, { ok: true, ...getSettingsSnapshot() });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'PATCH' && pathname === '/api/settings') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const patch = normalizeSettingsPatchInput(body);
    if (!patch || Object.keys(patch).length === 0) {
      return sendJson(res, 400, { error: 'Пустой patch' });
    }
    try {
      const { preferences, updated, ui } = patchSettings(patch);
      bumpLetterQualityHubCache();
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

  if (req.method === 'GET' && pathname === '/api/settings/apply-preview') {
    try {
      const threshold = Number(url.searchParams.get('threshold'));
      const scope = url.searchParams.get('batchScope') || 'noQuestionnaire';
      const prefs = loadPreferences();
      return sendJson(res, 200, computeApplyThresholdPreview(threshold, prefs, scope));
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/settings/targeting-preview') {
    try {
      const prefs = loadPreferences();
      return sendJson(res, 200, { ok: true, ...computeTargetingRolePreview(prefs) });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'GET' && pathname === '/api/preferences/export') {
    try {
      const patch = pickDashboardPrefsExport();
      return sendJson(res, 200, {
        ok: true,
        version: 1,
        exportedAt: new Date().toISOString(),
        patch,
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/preferences/import') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const patch = sanitizeDashboardPrefsImport(body?.patch ?? body);
    if (!patch) {
      return sendJson(res, 400, { error: 'Нет поддерживаемых ключей в JSON' });
    }
    try {
      const backupPath = backupPreferencesFile();
      const { preferences, updated, ui } = patchSettings(patch);
      bumpLetterQualityHubCache();
      return sendJson(res, 200, {
        ok: true,
        preferences,
        updated,
        ui: ui || getDashboardUiConfig(preferences),
        applyRates: applyRateLimitsSnapshot(),
        backupPath: backupPath || undefined,
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
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
      const { preferences, updated, ui } = patchSettings(patch);
      bumpLetterQualityHubCache();
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
      const { preferences, updated, ui } = patchSettings(patch);
      bumpLetterQualityHubCache();
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
    if (!id) {
      return sendJson(res, 400, { error: 'Нужны id и action' });
    }

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    if (action === 'restore') {
      if (['rejected', 'approved'].includes(rec.status)) {
        updateVacancyRecord(id, {
          status: 'pending',
          feedbackReason: '',
          ...clearRejectSourcePatch(),
        });
        appendFeedback({
          at: new Date().toISOString(),
          action: 'restore',
          reason: String(rec.feedbackReason || '').trim(),
          vacancyId: rec.vacancyId,
          title: rec.title,
          recordId: id,
          url: rec.url,
          fromStatus: rec.status,
        });
        return sendJson(res, 200, { ok: true, status: 'pending' });
      }
      if (rec.status === 'pending') {
        let prefs = {};
        try {
          prefs = loadPreferences();
        } catch {
          /* ignore */
        }
        const hiddenReasons = recordHiddenRoleReasons(rec, prefs);
        if (!hiddenReasons.length) {
          return sendJson(res, 409, { error: 'Вакансия уже в основной очереди' });
        }
        updateVacancyRecord(id, {
          roleFilterBypass: true,
          roleFilterBypassAt: new Date().toISOString(),
          roleFilterBypassReasons: hiddenReasons,
        });
        appendFeedback({
          at: new Date().toISOString(),
          action: 'restore',
          reason: `unhide: ${hiddenReasons.join(', ')}`,
          vacancyId: rec.vacancyId,
          title: rec.title,
          recordId: id,
          url: rec.url,
          fromStatus: 'pending-hidden',
        });
        return sendJson(res, 200, { ok: true, status: 'pending', roleFilterBypass: true });
      }
      return sendJson(res, 409, { error: 'Нельзя вернуть эту запись в очередь' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return sendJson(res, 400, { error: 'Нужны id и action: approve | reject | restore' });
    }

    if (rec.status !== 'pending') {
      return sendJson(res, 409, { error: 'Уже обработана' });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    let reasonText = String(reason || '').trim();
    let rejectRuleHit = null;
    if (action === 'reject') {
      const { matchRejectRule, DEFAULT_REJECT_RULES } = await import('../lib/reject-role-patterns.mjs');
      rejectRuleHit = matchRejectRule(rec, DEFAULT_REJECT_RULES);
      if (!reasonText && rejectRuleHit) reasonText = rejectRuleHit.rule.reason;
    }

    updateVacancyRecord(id, {
      status: nextStatus,
      feedbackReason: reasonText,
      ...(action === 'reject' ? rejectSourcePatchForManual(rejectRuleHit?.rule?.id) : {}),
    });

    appendFeedback({
      at: new Date().toISOString(),
      action,
      reason: reasonText,
      vacancyId: rec.vacancyId,
      title: rec.title,
      recordId: id,
      url: rec.url,
      ...(action === 'reject'
        ? {
            source: 'dashboard-manual',
            ruleId: rejectRuleHit?.rule?.id || null,
          }
        : {}),
    });

    let autoRejected = [];
    if (action === 'reject') {
      const { rejectSimilarAfterRecordReject } = await import('../lib/reject-similar-apply.mjs');
      const updatedRec = { ...rec, status: 'rejected', feedbackReason: reasonText };
      const result = rejectSimilarAfterRecordReject(updatedRec, {
        feedbackReason: reasonText,
        excludeRecordId: id,
        source: 'dashboard-reject',
      });
      autoRejected = result.applied;
      if (!reasonText && result.storeReason) {
        updateVacancyRecord(id, { feedbackReason: result.storeReason });
      }
    }

    return sendJson(res, 200, { ok: true, status: nextStatus, autoRejected, feedbackReason: reasonText });
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
    const role = classifyVacancyResumeRole(rec);
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const variantQuality = (result.variants || []).map((v, i) => {
      const ev = evaluateLetterQuality(rec, v, role, prefs);
      return {
        index: i,
        pass: ev.pass,
        rawPass: ev.rawPass,
        fixable: ev.fixable,
        reason: ev.reason,
        rawReason: ev.rawReason,
        score: ev.score,
        letterScore10: letterQualityToScore10(ev),
      };
    });
    const bestText = pickBestPreparedVariant(result.variants || [], rec, role, prefs);
    const bestEv = bestText ? evaluateLetterQuality(rec, bestText, role, prefs) : null;
    const autoApprove =
      prefs.batchAutoApproveBestLetter === true &&
      bestEv?.pass &&
      passesAutoApproveLetterScore(bestEv, prefs);

    const coverLetter = {
      status: autoApprove ? 'approved' : 'pending',
      variants: autoApprove ? [] : result.variants,
      approvedText: autoApprove ? bestText : '',
      generatedText: primaryGenerated,
      openRouterModel: result.providerModel || null,
      variantQuality: variantQuality.length ? variantQuality : undefined,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });
    bumpLetterQualityHubCache();

    return sendJson(res, 200, {
      ok: true,
      coverLetter,
      variantQuality,
      autoApproved: autoApprove,
    });
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
      const child = spawnBackground(process.execPath, [scriptPath, `--id=${id}`], {
        cwd: ROOT,
        env: sideJobHeadlessEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        hideConsole: hideSideJobConsole(),
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
      const role = classifyVacancyResumeRole(rec);
      const t = prepareCoverLetterForSend(rec, String(text || '').trim(), role);
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
      appendLetterMetric('approve', { vacancyId: id, pass: true });
      updateVacancyRecord(id, { coverLetter });
      bumpLetterQualityHubCache();
      let prefsAp = {};
      try {
        prefsAp = loadPreferences();
      } catch {
        prefsAp = {};
      }
      return sendJson(res, 200, {
        ok: true,
        coverLetter,
        letterQuality: evaluateLetterQuality(rec, t, role, prefsAp),
      });
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

  if (req.method === 'GET' && pathname === '/api/cover-letter/issues') {
    const batchScope = normalizeBatchScope(url.searchParams.get('batchScope') || 'noQuestionnaire');
    const queueStatus = url.searchParams.get('queueStatus') === 'approved' ? 'approved' : 'pending';
    const kind = url.searchParams.get('kind') || 'issues';
    const minScore = Math.max(0, Number(url.searchParams.get('minScore') || 0) || 0);
    const maxScore = Math.max(0, Number(url.searchParams.get('maxScore') || 0) || 0);
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const candidates = listBatchCandidates({
      batchScope,
      queueStatus,
      minScore,
      maxScore,
      prefs,
    });
    const report = listLetterIssues(candidates, prefs, { kind, limit: 100 });
    return sendJson(res, 200, { ok: true, batchScope, queueStatus, kind, ...report });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/evaluate') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, text } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const raw = String(text ?? '').trim();
    if (!raw) return sendJson(res, 400, { error: 'Нужен text' });
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const role = classifyVacancyResumeRole(rec);
    const quality = enrichLetterQualityForApi(evaluateLetterQuality(rec, raw, role, prefs));
    return sendJson(res, 200, { ok: true, letterQuality: quality });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/prepare-text') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, text } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const raw = String(text ?? rec.coverLetter?.approvedText ?? '').trim();
    if (!raw) return sendJson(res, 400, { error: 'Нужен text' });
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const role = classifyVacancyResumeRole(rec);
    const prepared = prepareCoverLetterForSend(rec, raw, role, prefs);
    const quality = enrichLetterQualityForApi(
      evaluateLetterQuality(rec, prepared, role, prefs)
    );
    return sendJson(res, 200, { ok: true, text: prepared, letterQuality: quality });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/improve') {
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
    if (rec.coverLetter?.status !== 'approved') {
      return sendJson(res, 409, { error: 'Улучшение только для утверждённого письма' });
    }
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const result = improveApprovedLetterForVacancy(rec, prefs);
    if (!result.ok) {
      return sendJson(res, 422, {
        error: result.reason || 'Письмо не проходит проверку даже после подготовки',
        letterQuality: result.quality,
      });
    }
    const now = new Date().toISOString();
    const coverLetter = {
      ...rec.coverLetter,
      approvedText: result.letter,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });
    bumpLetterQualityHubCache();
    return sendJson(res, 200, {
      ok: true,
      improved: result.improved,
      coverLetter,
      letterQuality: result.quality,
    });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/bulk-improve') {
    let body = {};
    try {
      if (req.headers['content-length'] && Number(req.headers['content-length']) > 0) {
        body = JSON.parse(await readBody(req));
      }
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const batchScope = normalizeBatchScope(body.batchScope || 'noQuestionnaire');
    const queueStatus = body.queueStatus === 'approved' ? 'approved' : 'pending';
    const minScore = Math.max(0, Number(body.minScore || 0) || 0);
    const maxScore = Math.max(0, Number(body.maxScore || 0) || 0);
    const limit = Math.max(1, Math.min(500, Number(body.limit) || 150));
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const candidates = listBatchCandidates({
      batchScope,
      queueStatus,
      minScore,
      maxScore,
      prefs,
    });
    const summary = bulkImproveApprovedLetters(candidates, prefs, {
      limit,
      onUpdate: (vacId, coverLetter) => updateVacancyRecord(vacId, { coverLetter }),
    });
    appendLetterMetric('bulk_improve', { improved: summary.improved, scanned: summary.scanned });
    bumpLetterQualityHubCache();
    return sendJson(res, 200, {
      ok: true,
      batchScope,
      queueStatus,
      ...summary,
      message:
        summary.improved > 0
          ? `Подготовлено писем: ${summary.improved} (просмотрено ${summary.scanned})`
          : `Изменений нет (просмотрено ${summary.scanned}, уже ок: ${summary.alreadyOk})`,
    });
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/metrics-summary') {
    return sendJson(res, 200, summarizeLetterMetrics());
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/quality-hub') {
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const hubNow = Date.now();
    if (
      letterQualityHubCache.body &&
      hubNow - letterQualityHubCache.at < LETTER_HUB_CACHE_MS
    ) {
      return sendJson(res, 200, letterQualityHubCache.body);
    }
    const hubBody = buildCoverLetterQualityHub(prefs);
    letterQualityHubCache = { body: hubBody, at: hubNow };
    return sendJson(res, 200, hubBody);
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/invite-correlation') {
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const scope = url.searchParams.get('scope') || 'all';
    let records = loadQueue();
    if (scope === 'responded') {
      records = records.filter(
        (r) =>
          r.hhApply?.hhSiteState === 'invited' ||
          r.hhApply?.hhSiteState === 'already_applied' ||
          r.status === 'responded'
      );
    }
    return sendJson(res, 200, summarizeLetterInviteCorrelation(records, prefs));
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/regenerate-weak') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const mode = body.mode === 'fixable' ? 'fixable' : 'fail';
    const limit = Math.max(1, Math.min(80, Number(body.limit) || 25));
    const script = path.join(ROOT, 'scripts', 'regenerate-cover-letters.mjs');
    if (!fs.existsSync(script)) {
      return sendJson(res, 500, { error: 'regenerate-cover-letters.mjs не найден' });
    }
    if (!hasScoreProviderCredentials()) {
      return sendJson(res, 503, { error: 'Нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_*' });
    }
    const args = [script, `--limit=${limit}`];
    if (mode === 'fixable') args.push('--only-fixable');
    else args.push('--only-fail');
    const child = spawnBackground(process.execPath, args, {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      hideConsole: hideSideJobConsole(),
      env: { ...process.env },
    });
    child.unref();
    appendLetterMetric('regenerate_weak_launch', { mode, limit, pid: child.pid });
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message:
        mode === 'fixable'
          ? `Перегенерация fixable-писем (до ${limit}) запущена — см. data/cover-letter-regen.log`
          : `Перегенерация слабых писем (до ${limit}) запущена — см. data/cover-letter-regen.log`,
    });
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/employer-context') {
    const id = url.searchParams.get('id');
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const ai = prefs?.applyIntelligence || {};
    const enabled = ai.employerRagEnabled !== false && ai.knowledgeStoreEnabled !== false;
    const block = enabled ? String(loadEmployerRagBlockForRecord(rec, { prefs }) || '').trim() : '';
    return sendJson(res, 200, {
      ok: true,
      enabled,
      company: rec.company || '',
      block,
    });
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/stats') {
    const batchScope = normalizeBatchScope(url.searchParams.get('batchScope') || 'noQuestionnaire');
    const queueStatus = url.searchParams.get('queueStatus') === 'approved' ? 'approved' : 'pending';
    const minScore = Math.max(0, Number(url.searchParams.get('minScore') || 0) || 0);
    const maxScore = Math.max(0, Number(url.searchParams.get('maxScore') || 0) || 0);
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const candidates = listBatchCandidates({
      batchScope,
      queueStatus,
      minScore,
      maxScore,
      prefs,
    });
    let approved = 0;
    let pass = 0;
    let fixable = 0;
    let fail = 0;
    let missing = 0;
    for (const rec of candidates) {
      const letter = String(rec.coverLetter?.approvedText || '').trim();
      if (!letter || rec.coverLetter?.status !== 'approved') {
        missing++;
        continue;
      }
      approved++;
      const ev = evaluateLetterQuality(rec, letter, undefined, prefs);
      if (ev.pass) {
        pass++;
        if (ev.fixable) fixable++;
      } else fail++;
    }
    const letterReadyRate =
      approved > 0 ? Math.round((pass / approved) * 100) : null;
    return sendJson(res, 200, {
      ok: true,
      batchScope,
      queueStatus,
      totalCandidates: candidates.length,
      approved,
      pass,
      fixable,
      fail,
      missing,
      letterReadyRate,
    });
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
        hideConsole: hideSideJobConsole(),
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
    const harvestPrefs = loadPreferences();
    const pwHarvestEnv = playwrightDisplayEnv('harvest', harvestPrefs);
    const child = spawnBackground(process.execPath, [harvestScript], {
      cwd: ROOT,
      detached: true,
      hideConsole: hideSideJobConsole(),
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        ...pwHarvestEnv,
        HH_SEARCH_PERIOD: periodDays === 0 ? '0' : String(periodDays),
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
    const queueStatus = body.queueStatus === 'approved' ? 'approved' : 'pending';
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
      const candidateCount = countBatchCandidates({
        batchScope,
        queueStatus,
        minScore,
        maxScore,
      });
      if (candidateCount === 0) {
        const tabLabel = queueStatus === 'approved' ? 'Подходят' : 'На проверке';
        return sendJson(res, 409, {
          error: `Нет вакансий для серии: «${batchScopeUiLabel(batchScope)}», вкладка «${tabLabel}»${minScore ? `, балл ≥${minScore}` : ''}${maxScore ? `, балл ≤${maxScore}` : ''}.`,
          candidates: 0,
        });
      }
    }
    const logFd = fs.openSync(HH_APPLY_CHAT_LOG_FILE, 'a');
    const header = `\n======== BATCH ${new Date().toISOString()} scope=${batchScope} status=${queueStatus} minScore=${minScore} limit=${limit} resume=${resume} ========\n`;
    fs.writeSync(logFd, header);
    const args = [batchScript, '--use-pool-letters', '--tailor-resume'];
    if (resume) {
      args.push('--resume');
    } else {
      args.push(`--limit=${limit}`);
      if (minScore > 0) args.push(`--min-score=${minScore}`);
      if (maxScore > 0) args.push(`--max-score=${maxScore}`);
      args.push(`--batch-scope=${batchScope}`);
      args.push(`--status=${queueStatus}`);
    }
    loadDevOpsEnv();
    const batchPrefs = loadPreferences();
    const pwBatchEnv = playwrightDisplayEnv('batch', batchPrefs);
    const child = spawnBackground(process.execPath, args, {
      cwd: ROOT,
      detached: true,
      hideConsole: hideSideJobConsole(),
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        ...pwBatchEnv,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(ROOT, '.playwright-browsers'),
        HH_FAST: String(process.env.HH_FAST ?? '1'),
      },
    });
    fs.closeSync(logFd);
    setBatchPid(child.pid);
    child.on('exit', () => setBatchPid(null));
    child.unref();
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: `Батч «${batchScopeUiLabel(batchScope)}»${batchScope === 'queue' ? ` · ${queueStatus === 'approved' ? 'Подходят' : 'На проверке'}` : ''} (до ${limit} откликов${minScore ? `, ≥${minScore}` : ''}${maxScore ? `, ≤${maxScore}` : ''}). Смотрите лог.`,
      batchScope,
      queueStatus,
    });
  }

  if (req.method === 'GET' && pathname === '/api/batch-precheck') {
    const minScore = Math.max(0, Number(url.searchParams.get('minScore') || 0) || 0);
    const maxScore = Math.max(0, Number(url.searchParams.get('maxScore') || 0) || 0);
    const batchScope = normalizeBatchScope(url.searchParams.get('batchScope') || 'noQuestionnaire');
    const queueStatus = url.searchParams.get('queueStatus') === 'approved' ? 'approved' : 'pending';
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const candidates = listBatchCandidates({
      batchScope,
      queueStatus,
      minScore,
      maxScore,
      prefs,
    });
    /** @type {Record<string, number>} */
    const blocked = {};
    /** @type {Record<string, Array<{ id: string, title: string, reason?: string }>>} */
    const blockedSamples = {};
    let ready = 0;
    let fixableLetterQuality = 0;
    let gateScoreSum = 0;
    let gateScored = 0;
    const strictRemoteWork = prefs.batchRequireRemote !== undefined
      ? prefs.batchRequireRemote !== false
      : prefs.requireRemote !== false;
    for (const rec of candidates) {
      const gate = await previewApplyGate(rec, {
        prefs,
        allRecords: loadQueue(),
        userApproved: queueStatus === 'approved',
        strictRemoteWork,
        requireLetter: true,
      });
      gateScored++;
      gateScoreSum += gate.gateScore;
      if (!gate.pass) {
        const key = mapGateVerdictToPrecheckKey(gate) || 'gate';
        blocked[key] = (blocked[key] || 0) + 1;
        if (!blockedSamples[key]) blockedSamples[key] = [];
        if (blockedSamples[key].length < 3) {
          blockedSamples[key].push({
            id: rec.id,
            title: String(rec.title || rec.id || '').slice(0, 90),
            reason: gate.reasons?.[0] || gate.skipReason || '',
            gateScore: gate.gateScore,
            pInvitePct: gate.pInvitePct,
          });
        }
        continue;
      }
      if (gate.letter?.fixable) fixableLetterQuality++;
      ready++;
    }

    const rejectedAll = loadQueue().filter((x) => x.status === 'rejected' && !x.hidden);
    const fpSummary = summarizeFalsePositives(rejectedAll, prefs);
    const falsePositiveMax = Number(prefs.batchFalsePositiveMax ?? 20);
    const falsePositiveGuardrail = isFalsePositiveGuardrailTriggered(
      fpSummary.totalFalsePositives,
      prefs
    );

    const letterBlocked = Number(blocked.letterQuality || 0);
    const letterReadyPercent =
      candidates.length > 0 ? Math.round((ready / candidates.length) * 100) : null;
    const gateAi = resolveApplyIntelligence(prefs);
    const gateAvgScore = gateScored > 0 ? Math.round(gateScoreSum / gateScored) : null;

    const currentPrefsSnap = pickBatchPrefsSnapshot(prefs);
    const lastReport = readBatchRunReport();
    const prefsDiff = diffBatchPrefsSnapshots(lastReport?.prefsSnapshot, currentPrefsSnap);
    const lastBatchFinishedAt = lastReport?.finishedAt || null;
    let prefsDiffHint = null;
    if (!prefsDiff.length) {
      if (!lastReport?.finishedAt) {
        prefsDiffHint =
          'После первой завершённой серии здесь появится сравнение настроек с прошлым запуском.';
      } else if (!lastReport?.prefsSnapshot) {
        prefsDiffHint =
          'Сравнение настроек появится после следующей серии (в прошлом отчёте ещё не было снимка).';
      }
    }

    return sendJson(res, 200, {
      ok: true,
      batchScope,
      queueStatus,
      minScore,
      maxScore,
      strictRemoteWork,
      totalCandidates: candidates.length,
      ready,
      fixableLetterQuality,
      letterBlocked,
      letterReadyPercent,
      blocked,
      blockedSamples,
      falsePositives: fpSummary.totalFalsePositives,
      falsePositiveRate: fpSummary.falsePositiveRate,
      falsePositiveMax,
      falsePositiveGuardrail,
      gateEnabled: gateAi.gateEnabled,
      effectiveMinGate: gateAi.effectiveMinGate,
      gateAvgScore,
      gateScored,
      prefsDiff,
      prefsDiffHint,
      lastBatchFinishedAt,
      message:
        ready > 0
          ? `Готово к отклику: ${ready} из ${candidates.length}${letterReadyPercent != null ? ` (${letterReadyPercent}%)` : ''}`
          : `Нет готовых карточек для отклика (кандидатов: ${candidates.length})`,
    });
  }

  if (req.method === 'GET' && pathname === '/api/top-false-positives') {
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit') || 5) || 5));
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const rejected = loadQueue().filter((x) => x.status === 'rejected' && !x.hidden);
    const summary = summarizeFalsePositives(rejected, prefs, { limit });
    recordFalsePositiveSnapshot(summary);
    const trend = computeFalsePositiveTrend(summary);
    const falsePositiveMax = Number(prefs.batchFalsePositiveMax ?? 20);
    return sendJson(res, 200, {
      ok: true,
      totalRejected: summary.totalRejected,
      totalFalsePositives: summary.totalFalsePositives,
      falsePositiveRate: summary.falsePositiveRate,
      top: summary.top,
      trend,
      falsePositiveMax,
      guardrailTriggered: isFalsePositiveGuardrailTriggered(
        summary.totalFalsePositives,
        prefs
      ),
      updatedAt: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && pathname === '/api/targeting/golden-regression') {
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    const report = runTargetingGoldenRegression(prefs);
    return sendJson(res, 200, report);
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/style-insights') {
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    return sendJson(res, 200, buildLetterStyleInsightsFromQueue(prefs));
  }

  if (req.method === 'GET' && pathname === '/api/cover-letter/letter-quality-report') {
    return sendJson(res, 200, { ok: true, report: readLetterQualityReport() });
  }

  if (req.method === 'GET' && pathname === '/api/quality/baseline') {
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
    return sendJson(res, 200, computeQualityBaseline(prefs));
  }

  if (req.method === 'POST' && pathname === '/api/learning/auto-apply-safe') {
    const prefs = loadPreferences();
    const rejected = loadQueue().filter((x) => x.status === 'rejected' && !x.hidden);
    const fpSummary = summarizeFalsePositives(rejected, prefs, { limit: 8 });
    const merged = [
      ...learningSuggestionsFromFalsePositives(fpSummary, prefs, 6),
      ...collectLearningSuggestionsFromRejected(rejected, prefs, 6),
    ];
    const seen = new Set();
    const unique = [];
    for (const row of merged) {
      const key = `${row.target}::${row.pattern}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }
    const safe = filterSafeAutoApplyItems(unique, prefs);
    if (!safe.length) {
      return sendJson(res, 200, {
        ok: true,
        added: 0,
        message: 'Нет безопасных правил для авто-применения (нужен count ≥ порога)',
      });
    }
    let added = 0;
    const results = [];
    for (const it of safe) {
      const pattern = normalizePatternToken(it.pattern);
      const target = normalizeLearnTarget(it.target);
      let r;
      if (target === 'developer') {
        r = addUniquePattern(prefs.excludeDeveloperRolePatterns, pattern);
        prefs.excludeDeveloperRolePatterns = r.list;
      } else if (target === 'senior') {
        r = addUniquePattern(prefs.excludeSeniorRolePatterns, pattern);
        prefs.excludeSeniorRolePatterns = r.list;
      } else {
        r = addUniquePattern(prefs.excludeIrrelevantTitlePatterns, pattern);
        prefs.excludeIrrelevantTitlePatterns = r.list;
      }
      if (r.added) added++;
      results.push({ pattern, target, added: r.added });
    }
    fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
    appendLearningLog({ source: 'auto-apply-safe', added, total: results.length, results });
    return sendJson(res, 200, {
      ok: true,
      added,
      applied: results,
      message:
        added > 0
          ? `Авто-применено правил: ${added}`
          : 'Правила уже были в настройках',
    });
  }

  if (req.method === 'POST' && pathname === '/api/learning/add-pattern') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const pattern = String(body?.pattern || '').trim().toLowerCase();
    if (!pattern || pattern.length < 2) {
      return sendJson(res, 400, { error: 'pattern is too short' });
    }
    const target = normalizeLearnTarget(body?.target);
    const prefs = loadPreferences();
    let added = false;
    if (target === 'developer') {
      const r = addUniquePattern(prefs.excludeDeveloperRolePatterns, pattern);
      prefs.excludeDeveloperRolePatterns = r.list;
      added = r.added;
    } else if (target === 'senior') {
      const r = addUniquePattern(prefs.excludeSeniorRolePatterns, pattern);
      prefs.excludeSeniorRolePatterns = r.list;
      added = r.added;
    } else {
      const r = addUniquePattern(
        prefs.excludeIrrelevantTitlePatterns,
        pattern
      );
      prefs.excludeIrrelevantTitlePatterns = r.list;
      added = r.added;
    }
    fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
    appendLearningLog({ source: 'single', pattern, target, added });
    return sendJson(res, 200, {
      ok: true,
      pattern,
      target,
      added,
      message: added
        ? `Добавлено правило: ${pattern} (${target})`
        : `Правило уже есть: ${pattern} (${target})`,
    });
  }

  if (req.method === 'GET' && pathname === '/api/learning/suggestions') {
    const limit = Math.min(12, Math.max(1, Number(url.searchParams.get('limit') || 6) || 6));
    const prefs = loadPreferences();
    const rejected = loadQueue().filter((x) => x.status === 'rejected' && !x.hidden);
    const suggestions = collectLearningSuggestionsFromRejected(rejected, prefs, limit);
    return sendJson(res, 200, {
      ok: true,
      suggestions,
      totalRejected: rejected.length,
      updatedAt: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && pathname === '/api/learning/history') {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 12) || 12));
    return sendJson(res, 200, {
      ok: true,
      items: readLearningLog(limit),
    });
  }

  if (req.method === 'POST' && pathname === '/api/learning/add-patterns') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return sendJson(res, 400, { error: 'items is empty' });
    const prefs = loadPreferences();
    let added = 0;
    /** @type {Array<{pattern: string, target: string, added: boolean}>} */
    const results = [];
    for (const it of items.slice(0, 30)) {
      const pattern = normalizePatternToken(it?.pattern || '');
      if (!pattern || pattern.length < 2) continue;
      const target = normalizeLearnTarget(it?.target);
      let r;
      if (target === 'developer') {
        r = addUniquePattern(prefs.excludeDeveloperRolePatterns, pattern);
        prefs.excludeDeveloperRolePatterns = r.list;
      } else if (target === 'senior') {
        r = addUniquePattern(prefs.excludeSeniorRolePatterns, pattern);
        prefs.excludeSeniorRolePatterns = r.list;
      } else {
        r = addUniquePattern(prefs.excludeIrrelevantTitlePatterns, pattern);
        prefs.excludeIrrelevantTitlePatterns = r.list;
      }
      if (r.added) added++;
      results.push({ pattern, target, added: r.added });
    }
    fs.writeFileSync(PREFS_FILE, `${JSON.stringify(prefs, null, 2)}\n`, 'utf8');
    appendLearningLog({ source: 'batch', added, total: results.length, results });
    return sendJson(res, 200, {
      ok: true,
      added,
      total: results.length,
      results,
      message: `Добавлено правил: ${added} из ${results.length}`,
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
    const rec = resolveVacancyRecord(body.id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    try {
      const pack = await buildInterviewPrepPack(rec);
      if (getVacancyRecord(rec.id)) {
        updateVacancyRecord(rec.id, { interviewPrep: pack });
      }
      return sendJson(res, 200, { ok: true, interviewPrep: pack });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/interview-hub') {
    const tracker = buildOffersTrackerSnapshot();
    let digest = null;
    try {
      digest = runIntelligenceLoop({ writeDigest: false, label: 'interview-hub' });
    } catch {
      /* */
    }
    return sendJson(res, 200, {
      offers: tracker.offers,
      summary: tracker.summary,
      buckets: digest ? { summary: digest.buckets, rates: digest.rates } : null,
      suggestions: digest?.suggestions || [],
    });
  }

  if (req.method === 'POST' && pathname === '/api/interview-mock-tech') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const rec = resolveVacancyRecord(body.id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    try {
      const mock = await buildTechnicalMockInterview(rec);
      return sendJson(res, 200, { ok: true, mock });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-mock-hr') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const rec = body.id ? resolveVacancyRecord(body.id) : null;
    return sendJson(res, 200, { ok: true, hrMock: buildHrScreeningMock(rec || {}) });
  }

  if (req.method === 'POST' && pathname === '/api/interview-prompt/format') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const pack = body.pack;
    const preset = String(body.preset || 'thesis');
    if (!pack || typeof pack !== 'object') {
      return sendJson(res, 400, { error: 'pack обязателен' });
    }
    try {
      let enriched = pack;
      if (preset === 'script' && !pack.answerScripts?.length) {
        enriched = await enrichPackWithScripts(pack);
      }
      const state = buildPromptState(enriched, preset);
      return sendJson(res, 200, { ok: true, state, pack: enriched });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-prompt/push') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const state = pushPromptState(body);
    return sendJson(res, 200, { ok: true, state });
  }

  if (req.method === 'GET' && pathname === '/api/interview-prompt/state') {
    const url = new URL(req.url || '', 'http://localhost');
    const channel = url.searchParams.get('channel') || 'live';
    const state = channel === 'prep' ? getPrepPromptState() : getPromptState(channel);
    return sendJson(res, 200, { ok: true, state });
  }

  if (req.method === 'GET' && pathname === '/api/interview-prompt/prep-state') {
    return sendJson(res, 200, { ok: true, state: getPrepPromptState() });
  }

  if (req.method === 'POST' && pathname === '/api/interview-prompt/prep-push') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const state = pushPrepPromptState(body);
    return sendJson(res, 200, { ok: true, state });
  }

  if (req.method === 'GET' && pathname === '/api/copilot/video-capabilities') {
    return sendJson(res, 200, { ok: true, capabilities: detectVideoCapabilities() });
  }

  if (req.method === 'GET' && pathname === '/api/copilot/audio-devices') {
    try {
      const devices = listCopilotAudioDevices();
      return sendJson(res, 200, { ok: true, ...devices });
    } catch (e) {
      return sendJson(res, 200, {
        ok: true,
        ffmpeg: false,
        wasapi: [{ id: 'default', label: 'По умолчанию (системный звук)' }],
        mic: [],
        error: e.message || String(e),
      });
    }
  }

  if (req.method === 'GET' && pathname === '/api/copilot/capture-log') {
    const url = new URL(req.url || '', 'http://localhost');
    const maxLines = Math.min(80, Math.max(1, Number(url.searchParams.get('lines')) || 20));
    const logPath = path.join(DATA_DIR, 'copilot-capture.log');
    let lines = [];
    if (fs.existsSync(logPath)) {
      const raw = fs.readFileSync(logPath, 'utf8');
      lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-maxLines);
    }
    return sendJson(res, 200, { ok: true, lines, tail: lines[lines.length - 1] || '' });
  }

  if (req.method === 'GET' && pathname === '/api/interview-prep/cached') {
    const url = new URL(req.url || '', 'http://localhost');
    const id = url.searchParams.get('id');
    const rec = resolveVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    return sendJson(res, 200, {
      ok: true,
      hasPrep: Boolean(rec.interviewPrep),
      interviewPrep: rec.interviewPrep || null,
      title: rec.title,
      company: rec.company,
    });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/answer') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const question = String(body.question || '').trim();
    if (!question) return sendJson(res, 400, { error: 'question обязателен' });
    try {
      const answer = await buildAnswerScript(question, {
        title: body.title,
        company: body.company,
        focus: body.focus,
      });
      return sendJson(res, 200, { ok: true, answer });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/script-pack') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const pack = body.pack;
    if (!pack) return sendJson(res, 400, { error: 'pack обязателен' });
    try {
      const enriched = await enrichPackWithScripts(pack, { maxQuestions: body.maxQuestions || 6 });
      const text = formatScriptPromptText(enriched);
      const state = buildPromptState(enriched, 'script');
      return sendJson(res, 200, { ok: true, pack: enriched, text, state });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/context/preview') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const bundle = await buildCandidateContext({
        title: body.title,
        company: body.company,
        vacancyId: body.vacancyId,
        recordId: body.recordId,
        prepContext: body.prepContext,
        vacancyText: body.description || body.vacancyText,
        interviewStage: body.interviewStage,
        transcriptBase: body.transcriptBase,
        force: true,
      });
      return sendJson(res, 200, {
        ok: true,
        hash: bundle.hash,
        title: bundle.title,
        company: bundle.company,
        focus: bundle.focus,
        chunkCount: bundle.chunks?.length || 0,
        prepSummaryLen: bundle.prepSummary?.length || 0,
        cvLen: bundle.cvText?.length || 0,
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/live/start') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const session = await startLiveCopilot({
        title: body.title,
        company: body.company,
        vacancyId: body.vacancyId,
        recordId: body.recordId,
        prepContext: body.prepContext,
        vacancyText: body.description || body.vacancyText,
        interviewStage: body.interviewStage,
        scriptOnlyOverlay: body.scriptOnlyOverlay !== false,
        prepPack: body.prepPack,
        focus: body.focus,
        forceContext: Boolean(body.forceContext),
      });
      return sendJson(res, 200, { ok: true, session: getCopilotSessionSnapshot(session.id) });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/live/inject-question') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const question = String(body.question || '').trim();
    if (!question) return sendJson(res, 400, { error: 'question обязателен' });
    try {
      const result = await injectQuestion(body.sessionId || getLiveSessionId(), question);
      return sendJson(res, 200, { ok: true, ...result, session: getCopilotSessionSnapshot(result.session?.id) });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/spoken-chunk') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { getCopilotSession } = await import('../lib/interview-copilot-session.mjs');
    const s = getCopilotSession(body.sessionId, { strict: true });
    if (!s) return sendJson(res, 404, { error: 'session_not_found' });
    recordSpokenAnswer(s, {
      questionText: body.questionText,
      spokenText: body.text,
      source: body.source || 'mic',
    });
    return sendJson(res, 200, { ok: true, count: getSpokenTurns(s).length });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/spoken/mark') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { getCopilotSession } = await import('../lib/interview-copilot-session.mjs');
    const s = getCopilotSession(body.sessionId, { strict: true });
    if (!s) return sendJson(res, 404, { error: 'session_not_found' });
    recordSpokenAnswer(s, {
      questionText: body.questionText,
      spokenText: body.text || '',
      source: 'manual',
      usedScript: body.usedScript || 'none',
    });
    return sendJson(res, 200, { ok: true, count: getSpokenTurns(s).length });
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/spoken/snapshot') {
    const url = new URL(req.url || '', 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');
    const { getCopilotSession } = await import('../lib/interview-copilot-session.mjs');
    const s = getCopilotSession(sessionId, { strict: Boolean(sessionId) });
    if (!s) return sendJson(res, 404, { error: 'session_not_found' });
    return sendJson(res, 200, { ok: true, turns: getSpokenTurns(s) });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/spoken/merge-notes') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const result = mergeSpokenToNotes(body.items, { title: body.title });
    if (body.learnProfile && body.debrief) {
      mergeSpokenToVoiceProfile(body.debrief);
    }
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/post/debrief') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { getCopilotSession } = await import('../lib/interview-copilot-session.mjs');
    const s = getCopilotSession(body.sessionId, { strict: true });
    if (!s) return sendJson(res, 404, { error: 'session_not_found' });
    const recordId = body.recordId || s.recordId || s.vacancyId;
    const debrief = buildDebriefSummary(s, {
      recordId,
      vacancyId: s.vacancyId,
      selfRating: body.selfRating,
      unexpectedQuestion: body.unexpectedQuestion,
    });
    const followUpDraft = buildFollowUpDraft(debrief);
    let debriefPattern = null;
    try {
      debriefPattern = recordDebriefPattern(debrief);
    } catch {
      /* knowledge optional */
    }
    const tracker = buildOffersTrackerSnapshot();
    const slot = tracker.offers?.find((o) => o.id === recordId || o.vacancyId === String(s.vacancyId));
    return sendJson(res, 200, {
      ok: true,
      debrief,
      followUpDraft,
      debriefPattern,
      offerTracker: slot
        ? {
            id: slot.id,
            bucket: slot.bucket,
            decision: slot.decision?.status || 'pending',
            reminder: 'Обновите статус слота в трекере оферов (следующий раунд / жду / отказ).',
          }
        : null,
    });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/post/save-followup') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const text = String(body.text || '').trim();
    if (!text) return sendJson(res, 400, { error: 'text обязателен' });
    const rec = resolveVacancyRecord(body.recordId || body.id);
    if (!rec || !getVacancyRecord(rec.id)) {
      return sendJson(res, 404, { error: 'Запись не найдена' });
    }
    updateVacancyRecord(rec.id, {
      hhApply: {
        ...(rec.hhApply || {}),
        chatReplyDraft: {
          reply: text,
          source: 'interview-debrief',
          at: new Date().toISOString(),
        },
      },
    });
    return sendJson(res, 200, { ok: true, id: rec.id });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/simulate/run') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const { runCopilotSimulate } = await import('../lib/interview-copilot-simulate-run.mjs');
      const result = await runCopilotSimulate({
        transcriptBase: body.transcriptBase,
        file: body.file,
        title: body.title,
        company: body.company,
        vacancyId: body.vacancyId,
        recordId: body.recordId,
        prepContext: body.prepContext,
        interviewStage: body.interviewStage,
        speed: body.speed || 80,
        keepSession: Boolean(body.keepSession),
      });
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/live/stop') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      /* empty */
    }
    stopLiveCopilot(body.sessionId);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/stt-chunk') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const result = await ingestLiveCopilotChunk(body);
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/session') {
    const url = new URL(req.url || '/', 'http://localhost');
    const id = url.searchParams.get('id');
    const mode = url.searchParams.get('mode');
    const sessionId = id || (mode === 'live' ? getLiveSessionId() : null);
    const session = getCopilotSessionSnapshot(sessionId);
    return sendJson(res, 200, { ok: true, session });
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/replay/transcripts') {
    return sendJson(res, 200, { ok: true, items: listReplayTranscripts() });
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/replay/video') {
    const url = new URL(req.url || '/', 'http://localhost');
    const file = url.searchParams.get('file');
    const fp = resolveReplayVideoPath(file);
    if (!fp) {
      return sendJson(res, 404, { error: 'Видео не найдено' });
    }
    const ext = path.extname(fp).toLowerCase();
    const mime =
      ext === '.webm'
        ? 'video/webm'
        : ext === '.mov'
          ? 'video/quicktime'
          : ext === '.wav'
            ? 'audio/wav'
            : ext === '.m4a'
              ? 'audio/mp4'
              : 'video/mp4';
    res.writeHead(200, { 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/replay/local-videos') {
    const listing = listInterviewVideosForReplay();
    return sendJson(res, 200, { ok: true, ...listing });
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/replay/interview-video') {
    const url = new URL(req.url || '/', 'http://localhost');
    const id = url.searchParams.get('id');
    const fp = resolveInterviewDirVideo(id);
    if (!fp) {
      return sendJson(res, 404, { error: 'Видео не найдено' });
    }
    const ext = path.extname(fp).toLowerCase();
    const mime =
      ext === '.webm'
        ? 'video/webm'
        : ext === '.mov'
          ? 'video/quicktime'
          : ext === '.wav'
            ? 'audio/wav'
            : ext === '.m4a'
              ? 'audio/mp4'
              : 'video/mp4';
    res.writeHead(200, { 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/replay/prepare-local') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const prepared = await prepareReplayFromLocalVideo(body.videoId);
      return sendJson(res, 200, { ok: true, ...prepared });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/replay/prepare-video') {
    const fileName = decodeURIComponent(String(req.headers['x-file-name'] || 'replay.mp4'));
    try {
      const prepared = await prepareReplayFromStream(req, fileName);
      return sendJson(res, 200, { ok: true, ...prepared });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/replay/start') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const session = await startReplaySession({
        transcriptPath: body.transcriptPath,
        transcriptBase: body.transcriptBase,
        sourceId: body.sourceId,
        title: body.title,
        company: body.company,
        vacancyId: body.vacancyId,
        prepContext: body.prepContext,
        focus: body.focus,
        videoPath: body.videoPath,
      });
      await tickReplaySession(session.id, 0);
      return sendJson(res, 200, { ok: true, session: getCopilotSessionSnapshot(session.id) });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/interview-copilot/replay/plan') {
    const sourceId = String(url.searchParams.get('sourceId') || '').trim();
    const transcriptBase = String(url.searchParams.get('transcriptBase') || '').trim();
    let plan = sourceId ? loadReplayPlan(sourceId) : null;
    if (!plan && transcriptBase) {
      plan = findPlanByTranscriptBase(transcriptBase);
    }
    if (!plan) return sendJson(res, 404, { error: 'План репетиции не найден' });
    const validation = validateReplayPlan(plan);
    return sendJson(res, 200, { ok: true, plan, validation });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/replay/build-plan') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const transcriptBase = body.transcriptBase;
      if (!transcriptBase) return sendJson(res, 400, { error: 'transcriptBase обязателен' });
      const jsonPath = path.join(DATA_DIR, 'interview-transcripts', `${transcriptBase}.json`);
      const txtPath = path.join(DATA_DIR, 'interview-transcripts', `${transcriptBase}.txt`);
      const fp = fs.existsSync(jsonPath) ? jsonPath : fs.existsSync(txtPath) ? txtPath : null;
      if (!fp) return sendJson(res, 404, { error: 'Транскрипт не найден' });
      const { loadTranscriptSegments } = await import('../lib/interview-copilot-replay.mjs');
      const segments = loadTranscriptSegments(fp);
      const normalized = ingestFromSegments(
        { segments, transcriptBase },
        {
          prepContext: body.prepContext || '',
          title: body.title || '',
          company: body.company || '',
          force: body.force,
        }
      );
      normalized.meta = { title: body.title || '', company: body.company || '' };
      const plan = await ensureReplayPlan(normalized, { force: body.force });
      if (body.llm) void enrichPlanWithLlm(plan).catch(() => {});
      const validation = validateReplayPlan(plan);
      return sendJson(res, 200, { ok: true, plan, validation });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/replay/offset') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const plan = updatePlanTimelineOffset(body.sourceId, body.offsetSec);
    if (!plan) return sendJson(res, 404, { error: 'План не найден' });
    return sendJson(res, 200, { ok: true, timelineOffsetSec: plan.timelineOffsetSec });
  }

  if (req.method === 'POST' && pathname === '/api/interview-copilot/replay/tick') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      const result = await tickReplaySession(body.sessionId, Number(body.currentTimeSec) || 0);
      return sendJson(res, 200, { ok: true, ...result });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/offer-decision') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const id = String(body.id || '').trim();
    const status = String(body.status || 'pending').trim();
    if (!id) return sendJson(res, 400, { error: 'id обязателен' });
    const tracker = setOfferDecision(id, status, String(body.note || ''));
    return sendJson(res, 200, { ok: true, tracker: buildOffersTrackerSnapshot() });
  }

  if (req.method === 'POST' && pathname === '/api/import-interview-notes') {
    try {
      const dir = process.env.HH_INTERVIEW_DIR || path.join(ROOT, 'my');
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
      hideConsole: hideSideJobConsole(),
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
      const prep = await autoPrepAfterNegotiationSync(r.updatedIds || []);
      return sendJson(res, 200, {
        ok: true,
        updated: r.updated,
        total: r.total,
        negotiations: (cache.items || []).length,
        autoPrep: prep,
        message: `Обновлено карточек: ${r.updated}${
          prep.prepared?.length ? ` · auto prep: ${prep.prepared.length}` : ''
        }`,
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
    const extra = [];
    if (body.withHarvest) extra.push('--with-harvest');
    if (body.withHabrHarvest) extra.push('--with-habr-harvest');
    const child = spawnSideJob('dailyRoutine', 'daily-routine.mjs', extra);
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: 'Ежедневная рутина запущена (синхр. отклики → кэш → чаты)',
    });
  }

  if (req.method === 'POST' && pathname === '/api/run-external-harvest') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const target = String(body.target || 'all').toLowerCase();
    const scriptMap = {
      habr: 'harvest-habr.mjs',
      telegram: 'harvest-telegram-channels.mjs',
      ats: 'harvest-ats.mjs',
      all: 'harvest-all.mjs',
      jobboards: 'harvest-jobboards.mjs',
    };
    const script = scriptMap[target];
    if (!script) {
      return sendJson(res, 400, { error: `Unknown target: ${target}` });
    }
    const args = target === 'all' && body.withJobboards ? ['--with-jobboards'] : [];
    const child = spawnBackground(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      hideConsole: hideSideJobConsole(),
      env: process.env,
    });
    child.unref();
    return sendJson(res, 200, { ok: true, pid: child.pid, target, script });
  }

  if (req.method === 'POST' && pathname === '/api/ingest-url') {
    let body = {};
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    try {
      let results;
      if (body.text) {
        results = await ingestUrlsFromText(String(body.text));
      } else if (body.url) {
        results = [await ingestUrl(String(body.url))];
      } else {
        return sendJson(res, 400, { error: 'url or text required' });
      }
      const added = results.filter((r) => r.added).length;
      return sendJson(res, 200, { ok: true, added, total: results.length, results });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || String(e) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/parse-url') {
    const raw = url.searchParams.get('url') || '';
    if (!raw.trim()) return sendJson(res, 400, { error: 'url required' });
    return sendJson(res, 200, parseUrlMetadata(raw.trim()));
  }

  if (req.method === 'GET' && pathname === '/api/top-tier') {
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const records = loadQueue();
    const top = listTopTierRecords(records, { limit, tiers: ['A', 'B'] });
    return sendJson(res, 200, { ok: true, count: top.length, items: top });
  }

  if (req.method === 'POST' && pathname === '/api/backfill-source-meta') {
    const child = spawnBackground(process.execPath, [path.join(ROOT, 'scripts', 'backfill-source-meta.mjs')], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
      hideConsole: hideSideJobConsole(),
    });
    child.unref();
    return sendJson(res, 200, { ok: true, pid: child.pid });
  }

  if (req.method === 'POST' && pathname === '/api/chat-reply-batch') {
    const q = loadQueue().filter(
      (x) => x.hhApply?.chatSummary?.needsReply || x.hhApply?.chatSummary?.questionNeedsReply
    );
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

  if (req.method === 'GET' && pathname === '/api/chat-inbox') {
    const threadId = url.searchParams.get('id');
    if (threadId) {
      const detail = getChatThreadDetail(threadId);
      if (!detail) return sendJson(res, 404, { error: 'Поток не найден' });
      return sendJson(res, 200, { ok: true, thread: detail });
    }
    const filter = url.searchParams.get('filter') || 'all';
    const limit = url.searchParams.get('limit');
    return sendJson(res, 200, { ok: true, ...buildChatInbox({ filter, limit }) });
  }

  if (req.method === 'POST' && pathname === '/api/chat-mark-sent') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const rec = getVacancyRecord(body.id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const text = String(body.text || rec.hhApply?.chatReplyDraft?.reply || '').trim();
    const summary = { ...(rec.hhApply?.chatSummary || {}), needsReply: false, questionNeedsReply: false };
    updateVacancyRecord(rec.id, {
      hhApply: {
        ...(rec.hhApply || {}),
        chatLastSentAt: new Date().toISOString(),
        chatSummary: summary,
        chatReplyDraft: text
          ? { reply: text, source: 'sent', at: new Date().toISOString() }
          : rec.hhApply?.chatReplyDraft,
      },
    });
    return sendJson(res, 200, { ok: true, id: rec.id });
  }

  if (req.method === 'GET' && pathname === '/api/chat-follow-ups') {
    const cfg = loadChatFollowUpScheduleConfig();
    return sendJson(res, 200, {
      ok: true,
      items: listChatFollowUps(loadQueue(), { inviteNudgeAfterDays: cfg.inviteNudgeAfterDays }),
    });
  }

  if (req.method === 'GET' && pathname === '/api/chat-follow-up-schedule') {
    return sendJson(res, 200, getChatFollowUpScheduleStatus());
  }

  if (req.method === 'PATCH' && pathname === '/api/chat-follow-up-schedule') {
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
    if (typeof body.autoSyncChats === 'boolean') patch.autoSyncChats = body.autoSyncChats;
    if (typeof body.autoDraftNudges === 'boolean') patch.autoDraftNudges = body.autoDraftNudges;
    if (typeof body.telegramNotify === 'boolean') patch.telegramNotify = body.telegramNotify;
    if (body.inviteNudgeAfterDays != null) patch.inviteNudgeAfterDays = Math.max(1, Number(body.inviteNudgeAfterDays) || 2);
    const cfg = saveChatFollowUpScheduleConfig(patch);
    return sendJson(res, 200, { ok: true, config: cfg, status: getChatFollowUpScheduleStatus() });
  }

  if (req.method === 'POST' && pathname === '/api/chat-reply-send') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const rec = getVacancyRecord(body.id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const text = String(body.text || rec.hhApply?.chatReplyDraft?.reply || '').trim();
    if (!text) return sendJson(res, 400, { error: 'Нет текста ответа' });
    if (text.length > 4000) return sendJson(res, 400, { error: 'Слишком длинный текст' });
    const rateErr = checkChatSendRateLimit();
    if (rateErr) return sendJson(res, 429, { error: rateErr });
    const busy = getBrowserBusyState();
    if (busy.busy) {
      return sendJson(res, 409, { error: busy.message, reason: busy.reason });
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(DATA_DIR, 'chat-send-request.json'),
      `${JSON.stringify({ id: rec.id, text, requestedAt: new Date().toISOString() })}\n`,
      'utf8'
    );
    recordChatSendLaunch();
    const child = spawnSideJob('chatReplySend', 'send-chat-reply.mjs', [], { HH_HEADLESS: '0' });
    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      message: 'Отправка в чат запущена — проверьте окно Chromium',
      rate: { used: countChatSendLastHour(), max: getMaxChatSendPerHour() },
    });
  }

  if (req.method === 'POST' && pathname === '/api/chat-nudge-batch') {
    const cfg = loadChatFollowUpScheduleConfig();
    let n = 0;
    for (const rec of loadQueue()) {
      const fu = classifyChatFollowUp(rec, { inviteNudgeAfterDays: cfg.inviteNudgeAfterDays });
      if (fu?.kind !== 'invite_nudge') continue;
      if (rec.hhApply?.chatReplyDraft?.reply) continue;
      updateVacancyRecord(rec.id, {
        hhApply: {
          ...(rec.hhApply || {}),
          chatReplyDraft: {
            reply: defaultInviteNudgeText(rec),
            source: 'nudge-template',
            at: new Date().toISOString(),
          },
        },
      });
      n++;
      if (n >= 15) break;
    }
    return sendJson(res, 200, { ok: true, processed: n });
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
      hideConsole: hideSideJobConsole(),
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

  if (pathname.startsWith('/api/')) {
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
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    const noCache =
      staticRel === 'index.html' ||
      staticRel === 'app.js' ||
      staticRel.startsWith('dashboard-settings') ||
      staticRel === 'dashboard-v4.css' ||
      staticRel === 'style.css';
    if (noCache) {
      headers['Cache-Control'] = 'no-cache, must-revalidate';
    }
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

let resumeRaiseSchedulerBusy = false;
let chatFollowUpSchedulerBusy = false;

function tickChatFollowUpSchedule() {
  if (chatFollowUpSchedulerBusy) return;
  const check = shouldRunChatFollowUpSchedule();
  if (!check.run) return;
  chatFollowUpSchedulerBusy = true;
  void (async () => {
    const cfg = loadChatFollowUpScheduleConfig();
    const result = { syncStarted: false, nudgeDrafts: 0 };
    try {
      const busy = getBrowserBusyState();
      const side = getSideJobsStatus();
      if (cfg.autoSyncChats && !busy.busy && !side.syncChats?.running) {
        spawnSideJob('syncChats', 'sync-hh-chats.mjs');
        result.syncStarted = true;
      }
      if (cfg.autoDraftNudges) {
        for (const rec of loadQueue()) {
          const fu = classifyChatFollowUp(rec, { inviteNudgeAfterDays: cfg.inviteNudgeAfterDays });
          if (fu?.kind !== 'invite_nudge') continue;
          if (rec.hhApply?.chatReplyDraft?.reply) continue;
          updateVacancyRecord(rec.id, {
            hhApply: {
              ...(rec.hhApply || {}),
              chatReplyDraft: {
                reply: defaultInviteNudgeText(rec),
                source: 'nudge-template',
                at: new Date().toISOString(),
              },
            },
          });
          result.nudgeDrafts++;
          if (result.nudgeDrafts >= 10) break;
        }
      }
      if (cfg.telegramNotify) {
        result.telegram = await notifyChatFollowUpTelegram(check.slotKey);
      }
      markChatFollowUpSlotDone(check.slotKey, result);
      console.log(
        `[dashboard] Chat follow-up (слот ${check.slotKey}): sync=${result.syncStarted} nudges=${result.nudgeDrafts}`
      );
    } catch (e) {
      console.warn('[dashboard] chat-follow-up schedule:', e.message || e);
    } finally {
      chatFollowUpSchedulerBusy = false;
    }
  })();
}

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
  setInterval(tickChatFollowUpSchedule, 60_000);
  tickResumeRaiseSchedule();
  tickChatFollowUpSchedule();
  const cfg = loadResumeRaiseScheduleConfig();
  const chatCfg = loadChatFollowUpScheduleConfig();
  console.log(
    `  Авто-подъём резюме: ${cfg.enabled ? 'вкл' : 'выкл'} · ${cfg.slots.join(', ')}:00 (${cfg.timezone})`
  );
  console.log(
    `  Follow-up чатов: ${chatCfg.enabled ? 'вкл' : 'выкл'} · ${chatCfg.slots.join(', ')}:00 (${chatCfg.timezone})`
  );
  const ks = bootstrapKnowledgeStoreIfEnabled();
  if (ks) {
    console.log(`  Knowledge Store: schema v${ks.schemaVersion} · ${ks.dbPath || 'memory'}`);
  }
});
