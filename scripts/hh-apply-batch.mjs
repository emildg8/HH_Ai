/**
 * Массовый отклик по очереди (Playwright, по одной вакансии).
 *
 *   npm run devops:apply-batch
 *   npm run devops:apply-batch -- --min-score=50 --limit=20 --dry-run
 *   npm run devops:apply-batch -- --use-pool-letters
 *   npm run devops:apply-batch -- --resume   # продолжить после стоп/паузы с сохранённым state
 *
 * Управление во время работы: data/batch-control.json (пауза / стоп / продолжить из дашборда).
 */

import fs from 'fs';
import { spawnBackground } from '../lib/spawn-background.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';

loadDevOpsEnv();
import { loadQueue, updateVacancyRecord, getVacancyRecord } from '../lib/store.mjs';
import {
  applyRateLimitsSnapshot,
  countApplyLaunchesLastDay,
  countApplyLaunchesLastHour,
  countApplyLaunchesLastMonth,
  getMaxApplyChatPerDay,
  getMaxApplyChatPerHour,
  getMaxApplyChatPerMonth,
  recordApplyLaunch,
} from '../lib/hh-apply-rate.mjs';
import { loadCoverLetterPool, pickCoverLetterFromPool, pickCoverLetterForVacancy } from '../lib/cover-letter-pool.mjs';
import { ROOT } from '../lib/paths.mjs';
import { createBatchProgressTracker, readJobProgress } from '../lib/job-progress.mjs';
import { APPLY_CHAT_PROGRESS_FILE } from '../lib/paths.mjs';
import { appendApplyChatLog, appendApplyChatRunHeader } from '../lib/apply-chat-log.mjs';
import { formatLogLine } from '../lib/log-line.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { getDashboardBatchSizeCap } from '../lib/dashboard-preferences.mjs';
import { playwrightDisplayEnv } from '../lib/playwright-display-mode.mjs';
import { normalizeBatchScope, filterForBatchScope } from '../lib/batch-scope.mjs';
import { setBatchPid, isProcessAlive } from '../lib/job-pids.mjs';
import { HH_APPLY_EXIT_ALREADY_RESPONDED, HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED } from '../lib/hh-apply-exit-codes.mjs';
import { DATA_DIR } from '../lib/paths.mjs';
import {
  initBatchControl,
  readBatchResumeState,
  clearBatchResumeState,
  shouldStopBatch,
  setActiveChildPid,
  killPid,
  waitAtBatchBoundary,
  syncBatchCounters,
  finishBatchControl,
  getBatchCommand,
} from '../lib/batch-control.mjs';
import {
  findBatchSkipReasonInLines,
  formatApplySkipReasonFromText,
} from '../lib/batch-skip-reason.mjs';
import { pruneRespondedFromActiveQueue, pruneVacancyFromActiveQueue } from '../lib/queue-prune.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import { runBatchPreflight, repairProfileIfNeeded } from '../lib/batch-preflight.mjs';
import { writeBatchRunReport } from '../lib/batch-run-report.mjs';
import { pickBatchPrefsSnapshot } from '../lib/batch-prefs-diff.mjs';
import { logBatchSkipReason } from '../lib/batch-skip-reason.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';
import { prepareCoverLetterForSend } from '../lib/cover-letter-prepare.mjs';
import { autoPrepareLettersForBatch } from '../lib/batch-auto-prepare-letters.mjs';
import { appendLetterMetric } from '../lib/letter-metrics.mjs';
import { writeLetterQualityReport } from '../lib/batch-letter-quality-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH_LOCK_FILE = path.join(DATA_DIR, 'apply-batch.lock');

function tryAcquireBatchLock() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(BATCH_LOCK_FILE)) {
    const oldPid = Number(fs.readFileSync(BATCH_LOCK_FILE, 'utf8').trim());
    if (isProcessAlive(oldPid)) {
      console.error(`Батч уже запущен (pid=${oldPid}). Дождитесь завершения или остановите процесс.`);
      process.exit(1);
    }
    try {
      fs.unlinkSync(BATCH_LOCK_FILE);
    } catch {
      /* ignore */
    }
  }
  fs.writeFileSync(BATCH_LOCK_FILE, String(process.pid), 'utf8');
}

function releaseBatchLock() {
  try {
    const cur = Number(fs.readFileSync(BATCH_LOCK_FILE, 'utf8').trim());
    if (cur === process.pid) fs.unlinkSync(BATCH_LOCK_FILE);
  } catch {
    /* ignore */
  }
}

function parseArgs() {
  let minScore = 50;
  let maxScore = 0;
  let limit = 50;
  let dryRun = false;
  let usePoolLetters = false;
  let tailorResume = false;
  let status = 'pending';
  let resume = false;
  let batchScope = 'noQuestionnaire';
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--min-score=')) minScore = Math.max(0, Number(a.slice(12)) || 0);
    if (a.startsWith('--max-score=')) maxScore = Math.max(0, Number(a.slice(12)) || 0);
    if (a.startsWith('--limit=')) limit = Math.max(1, Number(a.slice(8)) || 1);
    if (a === '--dry-run') dryRun = true;
    if (a === '--use-pool-letters') usePoolLetters = true;
    if (a === '--tailor-resume') tailorResume = true;
    if (a.startsWith('--status=')) status = a.slice(9).trim() || 'pending';
    if (a === '--resume') resume = true;
    if (a.startsWith('--batch-scope=')) batchScope = normalizeBatchScope(a.slice(14));
  }
  return { minScore, maxScore, limit, dryRun, usePoolLetters, tailorResume, status, resume, batchScope };
}

function scoreOf(rec) {
  return Number(rec.scoreOverall ?? rec.geminiScore ?? 0) || 0;
}

function assessmentResumeRole(rec, status) {
  return assessVacancyForApply(rec, { userApproved: status === 'approved' }).resumeRole || 'devops';
}

function logBatch(msg) {
  const body = `[batch] ${msg}`;
  console.log(formatLogLine(body));
  appendApplyChatLog(body, { withTime: true });
}

/** Ошибки отклика, при которых батч переходит к следующей вакансии. */
function isBatchRecoverableApplyError(message) {
  const m = String(message || '');
  if (/редирект на логин|выполните:\s*npm run login/i.test(m)) return false;
  return (
    /отклик недоступен|в архиве|снята с публикации/i.test(m) ||
    /не удалось открыть форму отклика/i.test(m) ||
    /кнопка «откликнуться»/i.test(m) ||
    /не найдена кнопка «откликнуться»/i.test(m) ||
    /мастер не дошёл до кнопки/i.test(m) ||
    /не выбрано резюме|резюме не переключилось/i.test(m) ||
    /уже отклик|приглашение на hh/i.test(m) ||
    /не в списке работодателя|нет в списке hh\.ru/i.test(m) ||
    /hh-apply-chat exit 1/i.test(m)
  );
}

function runApplyForId(id, { tailorResume, dryRun }) {
  return new Promise((resolve, reject) => {
    const args = ['scripts/hh-apply-chat-letter.mjs', `--id=${id}`];
    if (dryRun) args.push('--dry-run');
    if (tailorResume) args.push('--tailor-resume');
    const batchQAuto = String(process.env.HH_BATCH_QUESTIONNAIRE_AUTO ?? '1').trim() !== '0';
    if (process.env.HH_QUESTIONNAIRE_AUTO === '1' || batchQAuto) args.push('--questionnaire-auto');
    const batchPrefs = loadPreferences();
    const pwEnv = playwrightDisplayEnv('batch', batchPrefs);
    const child = spawnBackground(process.execPath, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...pwEnv,
        HH_BATCH: '1',
        /** Батч: быстрый fill и короткие паузы (как одиночный отклик из дашборда). HH_FAST=0 — «человечный» режим. */
        HH_FAST: String(process.env.HH_FAST ?? '1'),
      },
    });
    setActiveChildPid(child.pid);

    const outputLines = [];
    const forward = (chunk, isErr) => {
      const lines = String(chunk).split(/\r?\n/).filter((l) => l.trim());
      for (const raw of lines) {
        const line = raw.trim();
        outputLines.push(line);
        if (isErr) console.error(line);
        else console.log(line);
        // hh-apply-chat-letter уже пишет в hh-apply-chat.log через appendApplyChatLog
      }
    };
    child.stdout?.on('data', (c) => forward(c, false));
    child.stderr?.on('data', (c) => forward(c, true));

    const stopPoll = setInterval(() => {
      if (shouldStopBatch()) killPid(child.pid);
    }, 1200);

    child.on('error', (e) => {
      clearInterval(stopPoll);
      setActiveChildPid(null);
      reject(e);
    });
    child.on('close', (code) => {
      clearInterval(stopPoll);
      setActiveChildPid(null);
      if (shouldStopBatch()) {
        reject(new Error('BATCH_STOPPED'));
        return;
      }
      const exitCode = code ?? 1;
      const skipReason =
        findBatchSkipReasonInLines(outputLines) ||
        (exitCode !== 0 ? formatApplySkipReasonFromText(outputLines.join('\n'), exitCode) : '');
      resolve({ exitCode, skipReason });
    });
  });
}

function startApplyProgressSync(batchProgress, stepIndex, planned, rec, baseStats) {
  return setInterval(() => {
    if (shouldStopBatch() || getBatchCommand() === 'paused') return;
    const p = readJobProgress(APPLY_CHAT_PROGRESS_FILE);
    if (!p || p.phase === 'error') return;
    const sub = (Number(p.percent) || 0) / 100;
    const title = (rec.title || rec.id || '').slice(0, 55);
    const detail = p.label || p.step || '';
    const stepHuman = p.label || p.step || null;
    batchProgress.runningVacancy(stepIndex, planned, `Отклик ${stepIndex}/${planned}: ${title}`, {
      ...baseStats,
      subProgress: sub,
      detailStep: stepHuman,
      lastLogLine: detail,
      recordId: rec.id,
    });
  }, 2000);
}

async function main() {
  tryAcquireBatchLock();
  let { minScore, maxScore, limit, dryRun, usePoolLetters, tailorResume, status, resume, batchScope } =
    parseArgs();
  const batchSizeCap = getDashboardBatchSizeCap();
  limit = Math.min(batchSizeCap, Math.max(1, limit));

  if (!resume) clearBatchResumeState();

  const saved = resume ? readBatchResumeState() : null;
  if (resume) {
    if (!saved?.resumable || !saved.params) {
      console.error('Нет сохранённого батча для продолжения (сначала запустите батч и остановите).');
      process.exit(1);
    }
    const p = saved.params;
    minScore = p.minScore ?? minScore;
    maxScore = p.maxScore ?? maxScore;
    limit = p.limit ?? limit;
    dryRun = p.dryRun ?? dryRun;
    usePoolLetters = p.usePoolLetters ?? usePoolLetters;
    tailorResume = p.tailorResume ?? tailorResume;
    status = p.status ?? status;
    batchScope = normalizeBatchScope(p.batchScope ?? batchScope);
    logBatch(`Продолжение батча (уже: ok=${saved.done}, ошибок=${saved.failed})`);
  }

  const pool = usePoolLetters ? loadCoverLetterPool() : [];
  if (usePoolLetters && !pool.length) {
    console.error('Нет блоков в config/cover-letter.txt (разделитель --- на отдельной строке).');
    process.exit(1);
  }

  let prefs = {};
  try {
    prefs = loadPreferences();
  } catch {
    /* ignore */
  }
  const strictRemoteWork = prefs.batchRequireRemote !== undefined
    ? prefs.batchRequireRemote !== false
    : prefs.requireRemote !== false;

  const processedIds = new Set(saved?.processedIds ?? []);
  let done = Number(saved?.done) || 0;
  let failed = Number(saved?.failed) || 0;
  let skipped = Number(saved?.skipped) || 0;
  let letterIdx = Number(saved?.letterIdx) || 0;

  const prunedAtStart = pruneRespondedFromActiveQueue();
  if (prunedAtStart.changed > 0) {
    logBatch(
      `Из очереди убрано ${prunedAtStart.changed} вакансий с откликом (статус responded) — не пойдут в этот батч`
    );
  }

  const candidates = filterForBatchScope(
    loadQueue()
      .filter((x) => x.status === status)
      .filter((x) => x.url)
      .filter((x) => !processedIds.has(x.id)),
    batchScope,
    prefs
  )
    .filter((x) => {
      const s = scoreOf(x);
      if (minScore && s < minScore) return false;
      if (maxScore && s > maxScore) return false;
      return true;
    })
    .sort((a, b) => scoreOf(b) - scoreOf(a));

  if (!candidates.length) {
    console.log('Нет вакансий для отклика (очередь, min-score, или все уже обработаны).');
    process.exit(0);
  }

  autoPrepareLettersForBatch({ candidates, prefs, log: logBatch });

  const planned = limit;
  const batchParams = {
    minScore,
    maxScore,
    limit,
    dryRun,
    usePoolLetters,
    tailorResume,
    status,
    batchScope,
  };

  setBatchPid(process.pid);
  initBatchControl({
    ...batchParams,
    planned,
    letterIdx,
    resumed: resume,
  });

  const rates = applyRateLimitsSnapshot();
  console.log(
    `Батч: scope=${batchScope}, кандидатов ${candidates.length}, лимит ${limit}, min=${minScore || '-'}, max=${maxScore || '-'}, dry-run=${dryRun}`
  );
  console.log(
    `Отклики: час ${rates.lastHour}/${rates.maxPerHour}, сутки ${rates.lastDay}/${rates.maxPerDay}, 30д ${rates.lastMonth}/${rates.maxPerMonth}`
  );

  const batchProgress = createBatchProgressTracker({
    total: planned,
    minScore,
    maxScore,
  });

  appendApplyChatRunHeader(
    'BATCH',
    `scope=${batchScope} planned=${planned} min=${minScore || '-'} max=${maxScore || '-'} dry=${dryRun} resume=${resume}`
  );
  batchProgress.start(resume ? `Продолжение батча: ${planned} откликов` : `Подготовка батча: ${planned} откликов`);
  repairProfileIfNeeded((m) => logBatch(m.replace(/^\[batch-preflight\]\s*/, '')));
  runBatchPreflight((m) => logBatch(m.replace(/^\[batch-preflight\]\s*/, '')));
  logBatch(`Старт: цель ${limit} успешных, в очереди ${candidates.length} новых`);

  let stopReason = null;
  let offTargetSkipped = 0;
  const startedAt = new Date().toISOString();
  const resumeUsage = {};
  const skipReasons = {};
  /** @type {Array<{ title?: string, status: string, resumeRole?: string, reason?: string }>} */
  const reportItems = [];

  const bumpSkip = (key) => {
    skipReasons[key] = (skipReasons[key] || 0) + 1;
  };
  const skipOffTarget = String(process.env.HH_BATCH_SKIP_OFF_TARGET ?? '1').trim() !== '0';

  try {
    for (const rec of candidates) {
      if (done >= limit) break;

      const boundary = await waitAtBatchBoundary(() => {
        batchProgress.paused(done, `Пауза — ${done}/${planned} успешных`, { done, failed, skipped });
        logBatch('Пауза — жду «Продолжить» в дашборде');
      });
      if (boundary === 'stop') {
        stopReason = 'stop';
        logBatch('Остановка по кнопке «Стоп»');
        break;
      }

      if (countApplyLaunchesLastMonth() >= getMaxApplyChatPerMonth()) {
        logBatch('Достигнут лимит откликов за 30 дней.');
        break;
      }
      if (countApplyLaunchesLastDay() >= getMaxApplyChatPerDay()) {
        logBatch('Достигнут дневной лимит откликов.');
        break;
      }
      if (countApplyLaunchesLastHour() >= getMaxApplyChatPerHour()) {
        logBatch('Достигнут часовой лимит.');
        break;
      }

      const stepNum = done + failed + skipped + 1;
      const stepTitle = (rec.title || rec.id || '').slice(0, 60);

      if (skipOffTarget && !dryRun) {
        const assessment = assessVacancyForApply(rec, {
          userApproved: status === 'approved',
          strictRemoteWork,
          prefs,
        });
        if (!assessment.eligible) {
          skipped++;
          offTargetSkipped++;
          processedIds.add(rec.id);
          const skipKey =
            assessment.category === 'work-format'
              ? 'формат работы'
              : assessment.category === 'off-target-blue-collar'
                ? 'рабочие специальности'
                : assessment.category === 'off-target-sales'
                  ? 'продажи/presale'
                  : assessment.category === 'off-target-network'
                    ? 'сетевые/телеком'
                    : assessment.category === 'off-target-industrial'
                      ? 'промышленные/полевые'
                      : assessment.category === 'off-target-l1'
                        ? 'L1 поддержка'
                        : assessment.category === 'off-target-no-it-profile'
                          ? 'нет IT-профиля'
                  : assessment.category === 'off-target-promo'
                    ? 'промо/служебные'
                          : 'нецелевая';
          bumpSkip(skipKey);
          logBatchSkipReason(assessment.skipReason || 'нецелевая вакансия');
          const skipTag =
            skipKey === 'формат работы'
              ? 'FORMAT'
              : skipKey === 'рабочие специальности'
                ? 'BLUE-COLLAR'
                : skipKey === 'продажи/presale'
                  ? 'SALES'
                  : skipKey === 'сетевые/телеком'
                    ? 'NETWORK'
                    : skipKey === 'промышленные/полевые'
                      ? 'INDUSTRIAL'
                      : skipKey === 'L1 поддержка'
                        ? 'L1'
                        : skipKey === 'нет IT-профиля'
                          ? 'NO-IT'
                          : skipKey === 'промо/служебные'
                            ? 'PROMO'
                : 'OFF-TARGET';
          logBatch(`${skipTag} ${stepNum}/${planned}: ${stepTitle}`);
          reportItems.push({
            title: stepTitle,
            status:
              assessment.category === 'work-format'
                ? 'work-format'
                : assessment.category === 'off-target-blue-collar'
                  ? 'off-target-blue-collar'
                  : 'off-target',
            resumeRole: assessment.resumeRole,
            reason: assessment.skipReason,
          });
          syncBatchCounters({ done, failed, skipped, letterIdx, processedIds: [...processedIds] });
          batchProgress.step(done, `Пропуск (не IT) ${stepNum}/${planned}`, { done, failed, skipped });
          continue;
        }
      }

      let letter = String(rec.coverLetter?.approvedText || '').trim();
      if (!letter && usePoolLetters) {
        letter = pickCoverLetterForVacancy(rec, letterIdx++);
        const now = new Date().toISOString();
        updateVacancyRecord(rec.id, {
          coverLetter: {
            status: 'approved',
            variants: [],
            approvedText: letter,
            openRouterModel: null,
            updatedAt: now,
          },
        });
        logBatch(`Письмо из пула (#${letterIdx}) для ${rec.title || rec.id}`);
      }

      if (!letter && !dryRun) {
        logBatch(`SKIP ${rec.id}: нет письма`);
        processedIds.add(rec.id);
        skipped++;
        syncBatchCounters({
          done,
          failed,
          skipped,
          letterIdx,
          processedIds: [...processedIds],
        });
        continue;
      }

      if (!dryRun) {
        const plannedRole = assessmentResumeRole(rec, status);
        const preparedLetter = prepareCoverLetterForSend(rec, letter, plannedRole, prefs);
        if (preparedLetter && preparedLetter !== letter) {
          letter = preparedLetter;
          updateVacancyRecord(rec.id, {
            coverLetter: {
              ...rec.coverLetter,
              approvedText: preparedLetter,
              updatedAt: new Date().toISOString(),
            },
          });
        } else {
          letter = preparedLetter;
        }
        const letterCheck = assessLetterQuality(rec, letter, plannedRole, prefs);
        if (!letterCheck.pass) {
          skipped++;
          processedIds.add(rec.id);
          bumpSkip('качество письма');
          logBatchSkipReason(letterCheck.reason || 'некачественное письмо');
          appendLetterMetric('batch_skip_letter', {
            vacancyId: rec.id,
            title: stepTitle,
            reason: letterCheck.reason,
          });
          logBatch(`LETTER ${stepNum}/${planned}: ${stepTitle}`);
          reportItems.push({
            id: rec.id,
            title: stepTitle,
            status: 'letter-quality',
            resumeRole: plannedRole,
            reason: letterCheck.reason,
          });
          syncBatchCounters({
            done,
            failed,
            skipped,
            letterIdx,
            processedIds: [...processedIds],
          });
          batchProgress.step(done, `Пропуск (письмо) ${stepNum}/${planned}`, { done, failed, skipped });
          continue;
        }
      }

      batchProgress.runningVacancy(stepNum, planned, `Отклик ${stepNum}/${planned}: ${stepTitle}`, {
        done,
        failed,
        skipped,
        subProgress: 0.02,
      });
      logBatch(`—— ${stepNum}/${planned} · ${scoreOf(rec)} б. · ${rec.title || rec.url}`);

      let stopSync = null;
      try {
        stopSync = startApplyProgressSync(batchProgress, stepNum, planned, rec, {
          done,
          failed,
          skipped,
        });
        const { exitCode, skipReason } = await runApplyForId(rec.id, { tailorResume, dryRun });
        if (exitCode === HH_APPLY_EXIT_ALREADY_RESPONDED) {
          skipped++;
          pruneVacancyFromActiveQueue(rec.id);
          logBatch(
            `Пропуск ${stepNum}/${planned}: ${skipReason || 'уже отклик или приглашение на hh.ru'}`
          );
          processedIds.add(rec.id);
          batchProgress.step(done, `Пропуск ${stepNum}/${planned}`, { done, failed, skipped });
          continue;
        }
        if (exitCode === HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED) {
          skipped++;
          logBatch(
            `Анкета ${stepNum}/${planned}: «${stepTitle}» — отклик не отправлен, карточка в разделе «Анкета»`
          );
          processedIds.add(rec.id);
          batchProgress.step(done, `Анкета (пропуск) ${stepNum}/${planned}`, { done, failed, skipped });
          continue;
        }
        if (exitCode !== 0) {
          throw new Error(`hh-apply-chat exit ${exitCode}`);
        }
        recordApplyLaunch();
        done++;
        processedIds.add(rec.id);
        const plannedRole = assessmentResumeRole(rec, status);
        resumeUsage[plannedRole] = (resumeUsage[plannedRole] || 0) + 1;
        const afterRec = getVacancyRecord(rec.id);
        const resumeTitle =
          afterRec?.hhApply?.resumeTitleSelected ||
          afterRec?.hhApply?.resumeTitlePlanned ||
          afterRec?.resumeRouting?.label ||
          '';
        reportItems.push({
          title: stepTitle,
          status: 'ok',
          resumeRole: plannedRole,
          resumeTitle: resumeTitle || undefined,
        });
        logBatch(`OK ${stepNum}/${planned}: ${stepTitle}`);
        batchProgress.step(done, `Готово ${done}/${planned}`, { done, failed, skipped });
      } catch (e) {
        processedIds.add(rec.id);
        if (e.message === 'BATCH_STOPPED' || shouldStopBatch()) {
          stopReason = 'stop';
          logBatch('Прервано пользователем во время отклика');
          break;
        }
        if (isBatchRecoverableApplyError(e.message)) {
          skipped++;
          if (/уже отклик|не в списке|недоступно для этой вакансии/i.test(e.message)) {
            pruneVacancyFromActiveQueue(rec.id);
          }
          logBatch(`Пропуск ${stepNum}/${planned}: ${e.message}`);
          batchProgress.step(done, `Пропуск ${stepNum}/${planned}`, { done, failed, skipped });
          continue;
        }
        failed++;
        logBatch(`ОШИБКА ${stepNum}/${planned}: ${e.message}`);
        batchProgress.step(done, `Ошибка на ${stepNum}/${planned}`, {
          done,
          failed,
          skipped,
          lastError: e.message,
        });
        logBatch('Остановка батча из-за ошибки (исправьте и «Продолжить» с --resume).');
        stopReason = 'stop';
        break;
      } finally {
        if (stopSync) clearInterval(stopSync);
        syncBatchCounters({
          done,
          failed,
          skipped,
          letterIdx,
          processedIds: [...processedIds],
        });
      }
    }
  } finally {
    setBatchPid(null);
    releaseBatchLock();
    if (!stopReason && getBatchCommand() === 'stop') stopReason = 'stop';

    if (stopReason === 'stop') {
      finishBatchControl({
        reason: 'stop',
        done,
        failed,
        skipped,
        planned,
        params: batchParams,
      });
      batchProgress.step(done, 'Остановлено', { done, failed, skipped, stopped: true });
      logBatch(`Остановлено: ok=${done}, ошибок=${failed}. «Продолжить» — возобновит с места остановки.`);
    } else {
      finishBatchControl({
        reason: 'complete',
        done,
        failed,
        skipped,
        planned,
        params: batchParams,
      });
      batchProgress.done({ done, failed, skipped, planned });
      logBatch(`Завершено: успешно ${done}, ошибок ${failed}, пропуск ${skipped}.`);
    }
    const prunedEnd = pruneRespondedFromActiveQueue();
    if (prunedEnd.changed > 0) {
      logBatch(`После батча убрано из очереди ещё ${prunedEnd.changed} карточек с откликом (responded)`);
    }
    let prefsSnapshot = null;
    try {
      prefsSnapshot = pickBatchPrefsSnapshot(loadPreferences());
    } catch {
      /* ignore */
    }
    const batchReportPayload = {
      startedAt,
      finishedAt: new Date().toISOString(),
      planned,
      done,
      failed,
      skipped,
      offTargetSkipped,
      stopReason,
      batchScope,
      queueStatus: status,
      resumeUsage,
      skipReasons,
      items: reportItems,
      prefsSnapshot,
    };
    writeBatchRunReport(batchReportPayload);
    writeLetterQualityReport(batchReportPayload);
    try {
      const { notifyBatchComplete } = await import('../lib/batch-notify.mjs');
      await notifyBatchComplete({
        planned,
        done,
        failed,
        skipped,
        offTargetSkipped,
        stopReason,
        batchScope,
      });
    } catch (e) {
      logBatch(`Telegram notify: ${e.message || e}`);
    }
  }
}

main().catch((e) => {
  releaseBatchLock();
  setBatchPid(null);
  console.error(e);
  process.exit(1);
});
