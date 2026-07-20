/**
 * Вакансия → «Откликнуться» → мастер модалки → при наличии текста письмо в форму отклика → отправить → чат → письмо в чате.
 *
 * Автоматическая отправка отклика и сообщения может противоречить правилам hh.ru — используйте осознанно.
 *
 *   node scripts/hh-apply-chat-letter.mjs --id=<uuid>
 *   --stay-open   — ждать Enter перед закрытием браузера
 *   --dry-run     — открыть чат, но не вставлять письмо
 *   --no-submit   — только открыть форму отклика, не нажимать «Отправить»
 *
 * HH_HEADLESS=1 — headless (для отладки обычно без headless).
 * HH_FAST=1 — быстрый режим (без «человеческих» пауз и посимвольного ввода).
 * HH_PLAYWRIGHT_CHANNEL=chrome — системный Chrome вместо bundled Chromium (опционально).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { loadEnv } from '../lib/load-env.mjs';
import {
  meaningfulQuestions,
  questionsLookLikeCaptchaMisdetect,
  dedupeQuestionnaireQuestions,
} from '../lib/questionnaire-labels.mjs';
import { mergeQuestionnaire } from '../lib/questionnaire-merge.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath, DATA_DIR } from '../lib/paths.mjs';
import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { betweenMajorSteps, isFastMode } from '../lib/hh-human-delay.mjs';
import {
  deliverCoverLetterPostApply,
  openEmployerChatAfterResponse,
  sendLetterInChat,
  sendLetterOnVacancyCorrespondence,
  verifyLetterVisibleInChat,
} from '../lib/hh-chat-selectors.mjs';
import {
  probeChatikBeforeLetterRepair,
  assertLetterDeliveredOnHh,
  resolveLetterDeliveredTruth,
} from '../lib/cover-letter-deliver-truth.mjs';
import { logCoverLetterPrepared, logCoverLetterOutcome } from '../lib/cover-letter-apply-log.mjs';
import { verifyCoverLetterInForm } from '../lib/hh-response-selectors.mjs';
import {
  completeVacancyResponseForm,
  focusVacancyResponsePage,
  openVacancyResponseFlow,
} from '../lib/hh-response-modal.mjs';
import { assertHhLoggedIn, looksLikeLoginUrl } from '../lib/hh-session-check.mjs';
import {
  ensureNoCaptchaBlocking,
  registerCaptchaVisibleEscalation,
  unregisterCaptchaVisibleEscalation,
} from '../lib/hh-captcha-wait.mjs';
import { escalateHeadlessToVisibleBrowser } from '../lib/hh-captcha-escalate.mjs';
import { ensureTailoredResumePdf } from '../lib/tailor-resume.mjs';
import { resolveResumeForVacancy, classifyVacancyResumeRole } from '../lib/resume-routing.mjs';
import { resumeSelectionMatches } from '../lib/vacancy-targeting.mjs';
import { loadCoverLetterPool, pickCoverLetterFromPool } from '../lib/cover-letter-pool.mjs';
import { prepareCoverLetterForSend } from '../lib/cover-letter-prepare.mjs';
import { assessLetterQuality } from '../lib/letter-quality.mjs';
import { assessLetterQualityForBatch } from '../lib/letter-batch-gate.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import {
  launchPersistentContextSafe,
  closeContextSafe,
  waitForActivePage,
  requireLivePage,
  bringBrowserToFront,
} from '../lib/chromium-session.mjs';
import { appendApplyChatLog } from '../lib/apply-chat-log.mjs';
import { createApplyChatProgressTracker, clearApplyChatProgress } from '../lib/job-progress.mjs';
import { withStepHeartbeat } from '../lib/step-heartbeat.mjs';
import { formatLogLine } from '../lib/log-line.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { isQuestionnaireAutoEnabled } from '../lib/hh-questionnaire-answers.mjs';
import {
  tryAutoFillEmployerQuestionnaireWithWizard,
  recordHasDashboardQuestionnaireAnswers,
} from '../lib/hh-questionnaire-auto.mjs';
import {
  generateAndPersistSuggestedAnswers,
  isBatchQuestionnaireAutoEnabled,
} from '../lib/questionnaire-pipeline.mjs';
import { buildHhApplyAfterSuccess } from '../lib/vacancy-hh-apply.mjs';
import {
  buildHhApplySiteStatePatch,
  detectHhVacancySiteState,
  hhSiteStateSkipReason,
  isVacancyListingPageUrl,
  verifyHhApplyRegisteredOnVacancy,
} from '../lib/hh-vacancy-response-state.mjs';
import { computeModalWallMs, resolveLetterDeliveryOutcome } from '../lib/apply-outcome.mjs';
import { pruneVacancyFromActiveQueue } from '../lib/queue-prune.mjs';
import {
  collectBestQuestionnaire,
  prepareResponseWizardForQuestionnaire,
} from '../lib/hh-questionnaire-probe.mjs';
import {
  HH_APPLY_EXIT_ALREADY_RESPONDED,
  HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED,
  HH_APPLY_EXIT_LETTER_NOT_DELIVERED,
  HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED,
  HH_APPLY_EXIT_PRESUBMIT_BLOCKED,
} from '../lib/hh-apply-exit-codes.mjs';
import { logBatchSkipReason, formatApplySkipReasonFromText } from '../lib/batch-skip-reason.mjs';
import { runDeliverLetterVacancy } from '../lib/spawn-deliver-letter-vacancy.mjs';
import { shouldSkipLetterRepairOnDeclined } from '../lib/point-apply-prepare-policy.mjs';

const BROWSER_OWNER = 'apply-chat';

const isBatchApply = process.env.HH_BATCH === '1';

const STEP_LABELS = {
  prepare: 'Подготовка',
  tailor_resume: 'PDF резюме под вакансию',
  launch_browser: 'Запуск Chromium',
  start: 'Старт отклика',
  open_vacancy: 'Страница вакансии',
  click_response: 'Форма отклика',
  modal_prepare: 'Мастер отклика',
  fill_letter: 'Письмо в форме',
  submit_response: 'Отправка отклика',
  open_chat: 'Чат с работодателем',
  send_chat_done: 'Письмо в чате',
  send_chat_manual_required: 'Отклик OK, чат вручную',
};

function logLine(msg) {
  const body = String(msg ?? '').trimEnd();
  if (!body) return;
  console.log(formatLogLine(body));
  appendApplyChatLog(body, { withTime: true });
}

/**
 * @param {import('playwright').Page} page
 * @param {object} rec
 * @param {ReturnType<typeof createApplyChatProgressTracker>} progress
 */
async function syncHhSiteStateFromPage(page, rec) {
  const det = await detectHhVacancySiteState(page);
  const prev = getVacancyRecord(rec.id)?.hhApply || rec.hhApply || {};
  const hhApply = buildHhApplySiteStatePatch(prev, det);
  updateVacancyRecord(rec.id, { hhApply });
  const src = det.source ? ` (source=${det.source})` : '';
  if (det.state && det.state !== 'none') {
    logLine(`[hh-site-state] ${det.state}${src}${det.label ? ` — ${det.label}` : ''}`);
  } else {
    logLine(`[hh-site-state] ok${src} — можно откликаться`);
  }
  return det;
}

/**
 * @param {ReturnType<typeof createApplyChatProgressTracker>} progress
 * @param {string} reason
 * @param {{ state?: string, label?: string }} [det]
 * @param {object | null} [rec]
 * @param {{ l4Attempted?: boolean }} [opts]
 */
function finishAlreadyResponded(progress, reason, det = {}, rec = null, opts = {}) {
  logLine(`[hh-apply-chat] ${reason}`);
  if (opts.l4Attempted) {
    logLine('[hh-apply-chat] L4 на hh.ru уже записан в этой сессии');
  } else {
    logLine('[hh-apply-chat] L4 на hh.ru не выполнялся (статус hh.ru блокирует отклик)');
  }
  const skip = det.state ? hhSiteStateSkipReason(det.state) : 'уже отклик или приглашение на hh.ru';
  if (rec?.id) pruneVacancyFromActiveQueue(rec.id);
  if (isBatchApply) {
    logBatchSkipReason(skip);
    progress.skipped('Пропуск: статус hh.ru');
    return HH_APPLY_EXIT_ALREADY_RESPONDED;
  }
  progress.skipped(det.label || reason || 'Уже отклик');
  return 0;
}

/**
 * Статус hh.ru блокирует отклик — но если письмо не доставлено, пробуем чат (repeat apply).
 * @param {ReturnType<typeof createApplyChatProgressTracker>} progress
 */
async function routeHhBlockExit(progress, rec, page, ctx, opts) {
  const {
    reason,
    det = {},
    letter,
    resumePick,
    tmpFile,
    humanTyping,
    vacancyId,
    l4Attempted = false,
    formResult,
  } = opts;
  const prevHh = getVacancyRecord(rec.id)?.hhApply || rec.hhApply || {};
  const letterPending =
    Boolean(letter) &&
    (!prevHh.responseSubmitted || prevHh.hhDetectedOnly || !prevHh.letterDelivered);
  if (letterPending && shouldSkipLetterRepairOnDeclined(det, reason)) {
    logLine(
      `[hh-apply-chat] ${reason} — отказ на hh: letter-repair пропущен (откат HH_LETTER_REPAIR_ON_DECLINED=1)`
    );
    return finishAlreadyResponded(progress, reason, det, rec, { l4Attempted });
  }
  if (letterPending) {
    logLine(`[hh-apply-chat] ${reason} — пробуем доставить письмо в переписку`);
    page = await requireLivePage(ctx, page, {
      timeoutMs: 12_000,
      log: logLine,
      reason: 'route-block-letter-repair',
    });
    return finishRepeatApply(progress, rec, page, ctx, {
      letter,
      formResult,
      resumePick,
      tmpFile,
      humanTyping,
      vacancyId,
      det,
      l4Attempted,
    });
  }
  return finishAlreadyResponded(progress, reason, det, rec, { l4Attempted });
}

/**
 * Повторный отклик: письмо может уйти в chatik, но это не новый отклик.
 * Канон: probeChatikBeforeLetterRepair → deliverCoverLetterPostApply → resolveLetterDeliveredTruth.
 */
async function finishRepeatApply(progress, rec, page, ctx, opts) {
  const {
    letter,
    formResult,
    resumePick,
    humanTyping,
    vacancyId,
    det: detIn,
    dryRun: dryRunOpt,
    l4Attempted = false,
  } = opts;
  logLine('[hh-apply-chat] Повторный отклик — на hh.ru отклик уже был');
  if (l4Attempted) {
    logLine('[hh-apply-chat] L4 на hh.ru уже записан в этой сессии (повторный отклик)');
  } else {
    logLine('[hh-apply-chat] L4 на hh.ru не выполнялся (статус hh.ru блокирует отклик)');
  }

  const det =
    detIn ||
    (await syncHhSiteStateFromPage(page, rec));

  let chatChannel = '';
  let truth = {
    letterDelivered: false,
    letterInForm: false,
    chatSent: false,
    verifySource: 'none',
  };

  const vacId = String(vacancyId || rec.vacancyId || '').trim();

  if (letter && !dryRunOpt) {
    try {
      page = await requireLivePage(ctx, page, {
        timeoutMs: 12_000,
        log: logLine,
        reason: 'repeat-letter-repair',
      });

      if (!vacId) {
        logLine('[hh-apply-chat] Нет vacancyId — доставка в chatik невозможна');
      } else {
        const probe = await probeChatikBeforeLetterRepair(page, {
          vacancyId: vacId,
          letter,
          log: logLine,
          context: ctx,
        });
        if (probe.page && !probe.page.isClosed?.()) page = probe.page;

        if (probe.approvedInChatik) {
          logLine('[hh-apply-chat] Probe: approved-письмо уже в chatik');
          truth = await assertLetterDeliveredOnHh(page, letter);
          chatChannel = 'repeat-chat:already-delivered';
        } else {
          if (probe.hasResumeExcerptWithoutApproved) {
            logLine(
              '[hh-apply-chat] Probe: в chatik excerpt резюме без approved — только форма «Приложить», не дубль в чат'
            );
          }

          const method = await deliverCoverLetterPostApply(page, {
            text: letter,
            vacancyId: vacId,
            vacancyTitle: rec.title,
            company: rec.company,
            humanTyping,
            context: ctx,
            log: logLine,
          });
          logLine(`[hh-apply-chat] Письмо в chatik (${method})`);
          chatChannel = `repeat-chat:${method}`;

          try {
            truth = await assertLetterDeliveredOnHh(page, letter);
            logLine(`[hh-apply-chat] Письмо подтверждено (источник: ${truth.verifySource})`);
          } catch (verifyErr) {
            truth = await resolveLetterDeliveredTruth(page, letter);
            if (!truth.letterDelivered) {
              logLine(
                `[hh-apply-chat] Письмо не подтверждено: ${String(verifyErr?.message || verifyErr).slice(0, 220)}`
              );
            }
          }
        }
      }
    } catch (e) {
      const code = String(e?.code || '');
      if (code === 'CHAT_DUPLICATE_BLOCKED') {
        logLine(`[hh-apply-chat] Дубль в чат заблокирован: ${String(e?.message || e).slice(0, 220)}`);
      } else {
        logLine(`[hh-apply-chat] Письмо в chatik (повтор): ${String(e?.message || e).slice(0, 220)}`);
      }
      truth = await resolveLetterDeliveredTruth(page, letter).catch(() => truth);
    }
  } else if (letter) {
    truth = await resolveLetterDeliveredTruth(page, letter).catch(() => truth);
  } else if (formResult?.letterInForm) {
    truth = { letterDelivered: false, letterInForm: false, chatSent: false, verifySource: 'no-letter' };
  }

  if (
    letter &&
    !dryRunOpt &&
    vacId &&
    !truth.letterDelivered &&
    process.env.HH_SKIP_SPAWN_DELIVER_LETTER !== '1'
  ) {
    logLine('[hh-apply-chat] Repair в сессии не удался — spawn deliver-letter-vacancy');
    try {
      if (ctx) await closeContextSafe(ctx, BROWSER_OWNER);
      await runDeliverLetterVacancy({
        recordId: rec.id,
        instance: process.env.HH_INSTANCE_ID || 'emil',
        log: logLine,
      });
      const fresh = getVacancyRecord(rec.id);
      if (fresh?.hhApply?.letterDelivered) {
        truth = {
          letterDelivered: true,
          letterInForm: Boolean(fresh.hhApply.letterInForm),
          chatSent: Boolean(fresh.hhApply.chatSent),
          verifySource: 'spawn-deliver-letter',
        };
        chatChannel = 'repeat-chat:spawn-deliver-letter';
        logLine('[hh-apply-chat] spawn deliver-letter: письмо подтверждено на карточке');
      }
    } catch (spawnErr) {
      logLine(
        `[hh-apply-chat] spawn deliver-letter: ${String(spawnErr?.message || spawnErr).slice(0, 220)}`
      );
    }
  }

  const prevHh = getVacancyRecord(rec.id)?.hhApply || rec.hhApply || {};
  const letterDelivered = Boolean(truth.letterDelivered);
  const letterInFormVerified = Boolean(truth.letterInForm);
  const chatVerified = Boolean(truth.chatSent);

  let siteDet =
    det.state && det.state !== 'none'
      ? det
      : { state: 'already_applied', label: det?.label || 'Отклик уже на hh.ru', source: 'repeat-apply' };
  if (letterDelivered && siteDet.state === 'declined') {
    const resync = await syncHhSiteStateFromPage(page, rec).catch(() => siteDet);
    if (resync.state === 'already_applied' || resync.state === 'none' || resync.state === 'awaiting') {
      siteDet = resync;
    } else if (resync.state !== 'declined') {
      siteDet = resync;
    } else {
      siteDet = {
        state: 'already_applied',
        label: 'Отклик уже на hh.ru',
        canApply: false,
        source: 'repeat-apply-letter-delivered',
      };
    }
  }
  const hhApply = buildHhApplySiteStatePatch(prevHh, siteDet);

  updateVacancyRecord(rec.id, {
    hhApply: {
      ...hhApply,
      lastAt: new Date().toISOString(),
      responseSubmitted: letterDelivered ? true : Boolean(prevHh.responseSubmitted && !prevHh.hhDetectedOnly),
      hhDetectedOnly: letterDelivered ? false : true,
      letterInForm: letterInFormVerified,
      chatSent: chatVerified,
      letterDelivered,
      letterPreview: letter ? String(letter).replace(/\s+/g, ' ').trim().slice(0, 120) : undefined,
      resumeRole: resumePick?.role,
      resumeTitleSelected: formResult?.profileResume || resumePick?.title,
    },
  });

  logCoverLetterOutcome(logLine, {
    letter,
    letterFilledInForm: letterInFormVerified,
    chatSent: chatVerified,
    channel: chatVerified ? chatChannel || 'repeat-chat' : '',
  });

  if (rec?.id && letterDelivered) pruneVacancyFromActiveQueue(rec.id);
  if (isBatchApply) {
    logBatchSkipReason('уже отклик на hh.ru');
    progress.skipped('Пропуск: повторный отклик');
    return HH_APPLY_EXIT_ALREADY_RESPONDED;
  }
  progress.skipped(chatVerified ? 'Повтор: письмо в переписке' : det.label || 'Уже отклик на hh.ru');
  return 0;
}

/**
 * First apply: отклик ушёл, сопроводительное не доставлено — не SUCCESS для батча.
 * @param {ReturnType<typeof createApplyChatProgressTracker>} progress
 * @param {object} rec
 * @param {{ letter?: string, letterFilledInForm?: boolean, chatSent?: boolean, verifiedInChat?: boolean, resumePick?: object, formResult?: object }} opts
 */
function finishLetterNotDelivered(progress, rec, opts) {
  const { letter, letterFilledInForm, chatSent, verifiedInChat, resumePick, formResult, resumeMatchOk, prevHh } =
    opts;
  logLine('[letter-not-delivered] отклик отправлен, сопроводительное не доставлено (форма и чат)');
  logCoverLetterOutcome(logLine, {
    letter,
    letterFilledInForm,
    chatSent,
    verifiedInChat,
  });
  updateVacancyRecord(rec.id, {
    hhApply: buildHhApplyAfterSuccess(prevHh || rec.hhApply || {}, {
      lastAt: new Date().toISOString(),
      responseSubmitted: true,
      letterInForm: Boolean(letterFilledInForm),
      chatSent: Boolean(chatSent || verifiedInChat),
      letterDelivered: false,
      letterPreview: letter ? String(letter).replace(/\s+/g, ' ').trim().slice(0, 120) : undefined,
      resumeRole: resumePick?.role,
      resumeTitleSelected: formResult?.profileResume || resumePick?.title,
      resumeMatchOk: resumeMatchOk !== false,
    }),
  });
  if (isBatchApply) {
    logBatchSkipReason('сопроводительное не доставлено');
  }
  progress.error('Отклик без сопроводительного');
  return HH_APPLY_EXIT_LETTER_NOT_DELIVERED;
}

/**
 * Мастер вернул submitted (часто http-200), но карточка вакансии не подтверждает отклик.
 * @param {ReturnType<typeof createApplyChatProgressTracker>} progress
 * @param {object} rec
 */
function finishApplyNotVerified(progress, rec, opts) {
  const { formResult, verify, prevHh, letter, letterFilledInForm, resumePick } = opts;
  const label = String(formResult?.label || 'unknown');
  logLine(
    `[hh-apply-chat] ✗ Отклик не подтверждён на hh.ru (${label}, verify=${verify?.reason || 'fail'})`
  );
  updateVacancyRecord(rec.id, {
    applyBlockedReason:
      'нужен ручной отклик: автоотправка не зарегистрировалась на hh.ru (анкета или ложный HTTP 200)',
    hhApply: {
      ...(prevHh || rec.hhApply || {}),
      lastAt: new Date().toISOString(),
      responseSubmitted: false,
      letterDelivered: false,
      letterInForm: Boolean(letterFilledInForm),
      applySubmitUnverified: true,
      applySubmitLabel: label,
      applySubmitVerifyReason: verify?.reason || 'not-registered',
      hhSiteState: verify?.det?.state || 'none',
      hhSiteStateAt: new Date().toISOString(),
      hhSiteStateSource: verify?.det?.source || undefined,
      hhSiteStateLabel: verify?.det?.label || undefined,
      letterPreview: letter ? String(letter).replace(/\s+/g, ' ').trim().slice(0, 120) : undefined,
      resumeRole: resumePick?.role,
      resumeTitlePlanned: resumePick?.title,
    },
  });
  if (isBatchApply) {
    logBatchSkipReason('отклик не подтверждён на hh.ru');
  }
  progress.error('Отклик не подтверждён на hh.ru');
  return HH_APPLY_EXIT_RESPONSE_NOT_VERIFIED;
}

const headless = process.env.HH_HEADLESS === '1';
const captchaEscalate = String(process.env.HH_CAPTCHA_ESCALATE ?? '1').trim() !== '0';
const browserBackground = String(process.env.HH_BROWSER_BACKGROUND || '').trim() === '1';
const stayOpen = process.argv.includes('--stay-open');
const questionnaireWait =
  process.argv.includes('--questionnaire-wait') ||
  process.env.HH_QUESTIONNAIRE_WAIT === '1';
/** Включается в main() после загрузки записи (см. savedAnswers). */
let questionnaireAuto =
  isQuestionnaireAutoEnabled() || (isBatchApply && isBatchQuestionnaireAutoEnabled());
const dryRun = process.argv.includes('--dry-run');
const noSubmit = process.argv.includes('--no-submit');
const tailorResume =
  process.argv.includes('--tailor-resume') || process.env.HH_TAILOR_RESUME === '1';
const usePoolLetter =
  process.argv.includes('--use-pool-letter') || process.env.HH_USE_POOL_LETTER === '1';

function parseArgs() {
  let id = null;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--id=')) id = a.slice(5).trim();
  }
  return { id };
}

function waitEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Сохранить анкету в запись очереди; в батче при пустых подписях — обойти мастер и собрать вопросы.
 */
async function persistEmployerQuestionnaireFromApply({
  page,
  formResult,
  rec,
  letter,
  letterFilledInFormQ,
  questionnaireAuto,
  cvText = '',
}) {
  let qNow = formResult.questionnaire;
  let mq = meaningfulQuestions(qNow.questions || []);
  if (isBatchApply && mq.length === 0) {
    logLine('[hh-apply-chat] BATCH: подготовка мастера и сбор текста вопросов…');
    try {
      await prepareResponseWizardForQuestionnaire(page, logLine);
      const collected = await collectBestQuestionnaire(page, { log: logLine, maxSteps: 18 });
      const mq2 = meaningfulQuestions(collected.questions || []);
      if (mq2.length > mq.length) {
        mq = mq2;
        qNow = {
          ...qNow,
          questions: collected.questions,
          reasons:
            collected.reasons && collected.reasons.length ? collected.reasons : qNow.reasons,
        };
      }
    } catch (e) {
      logLine(`[hh-apply-chat] BATCH: collectBestQuestionnaire: ${e.message}`);
    }
  }
  if (mq.length === 0 && questionsLookLikeCaptchaMisdetect(qNow?.questions || [])) {
    logLine(
      '[hh-apply-chat] Похоже на капчу hh.ru («Текст с картинки»), не анкета — не сохраняем в очередь. Решите капчу и повторите.'
    );
    return 0;
  }
  for (const item of mq) {
    logLine(`[hh-apply-chat] Вопрос ${item.index}: ${item.label.slice(0, 200)}`);
  }
  const prevQ = rec.hhApply?.questionnaire || {};
  const storedQuestions =
    mq.length > 0 ? mq : dedupeQuestionnaireQuestions(qNow.questions || []);
  const questionnaire = mergeQuestionnaire(prevQ, {
    status: 'pending_manual',
    questions: storedQuestions,
    reasons: qNow.reasons,
    detectedAt: new Date().toISOString(),
    label: formResult.label,
    autoAttempted: questionnaireAuto,
    needsProbe: mq.length === 0,
    likelyFromVacancyText: false,
  });
  updateVacancyRecord(rec.id, {
    coverLetter: letter
      ? {
          status: 'approved',
          variants: [],
          approvedText: letter,
          openRouterModel: rec.coverLetter?.openRouterModel || 'pool',
          updatedAt: new Date().toISOString(),
        }
      : rec.coverLetter,
    hhApply: {
      ...rec.hhApply,
      lastAt: new Date().toISOString(),
      responseSubmitted: false,
      letterInForm: letterFilledInFormQ,
      questionnaire,
    },
  });
  if (mq.length > 0 && (questionnaireAuto || isBatchApply)) {
    try {
      await generateAndPersistSuggestedAnswers(getVacancyRecord(rec.id) || rec, {
        cvText,
        log: logLine,
      });
    } catch (e) {
      logLine(`[hh-apply-chat] Генерация ответов анкеты: ${e.message}`);
    }
  }
  return mq.length;
}

async function saveErrorScreenshot(page, err) {
  try {
    if (!page || (typeof page.isClosed === 'function' && page.isClosed())) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const shot = path.join(DATA_DIR, `hh-apply-chat-error-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    appendApplyChatLog(`[hh-apply-chat] Скриншот ошибки: ${shot} ${err?.message || err}`);
  } catch {
    /* ignore */
  }
}

async function main() {
  const { id } = parseArgs();
  if (!id) {
    console.error('Укажите --id=<uuid записи из data/vacancies-queue.json>');
    process.exit(1);
  }

  const rec = getVacancyRecord(id);
  if (!rec) {
    console.error('Запись не найдена:', id);
    process.exit(1);
  }

  if (
    !questionnaireAuto &&
    recordHasDashboardQuestionnaireAnswers(rec) &&
    (rec.hhApply?.questionnaire?.questions?.length || 0) > 0
  ) {
    questionnaireAuto = true;
  }

  const resumePick = resolveResumeForVacancy(rec);

  const progress = createApplyChatProgressTracker(rec.id, rec.title || '');
  progress.update('prepare', 'Подготовка отклика…', 5);
  const step = (name, label, percent) => {
    const human = label || STEP_LABELS[name] || name;
    logLine(`[hh-apply-chat] ▶ ${human}`);
    progress.update(name, human, percent);
  };
  let letter = String(rec.coverLetter?.approvedText || '').trim();
  if (!letter && usePoolLetter) {
    const pool = loadCoverLetterPool();
    if (!pool.length) {
      console.error('Пул писем пуст — заполните config/cover-letter.txt');
      process.exit(1);
    }
    const idx = Math.abs(
      String(rec.id || rec.vacancyId || '0')
        .split('')
        .reduce((a, c) => a + c.charCodeAt(0), 0)
    );
    letter = pickCoverLetterFromPool(idx);
    updateVacancyRecord(rec.id, {
      coverLetter: {
        status: 'approved',
        variants: [],
        approvedText: letter,
        openRouterModel: 'pool',
        updatedAt: new Date().toISOString(),
      },
    });
    logLine('[hh-apply-chat] Письмо из пула (авто)');
  }
  if (!letter && !dryRun) {
    console.error(
      'Нет письма. Утвердите в дашборде или запустите с --use-pool-letter / «Авто-отклик».'
    );
    process.exit(1);
  }
  if (letter) {
    const prefs = loadPreferences();
    const role = classifyVacancyResumeRole(rec);
    const prepared = prepareCoverLetterForSend(rec, letter, role, prefs);
    if (prepared !== letter) {
      letter = prepared;
      updateVacancyRecord(rec.id, {
        coverLetter: {
          ...(rec.coverLetter || {}),
          approvedText: letter,
          updatedAt: new Date().toISOString(),
        },
      });
      logLine('[hh-apply-chat] письмо: RU-sanitize/prepare перед fill');
    }
    const q = assessLetterQuality(rec, letter, role, prefs);
    if (!q.pass) {
      console.error(`[hh-apply-chat] письмо не проходит quality: ${q.reason}`);
      process.exit(9);
    }
    const batchQ = assessLetterQualityForBatch(rec, letter, role, prefs);
    if (!batchQ.pass) {
      console.error(`[hh-apply-chat] письмо не проходит batch quality: ${batchQ.reason}`);
      process.exit(9);
    }
    logCoverLetterPrepared(logLine, letter);
  }
  if (!rec.url) {
    console.error('У записи нет url');
    process.exit(1);
  }

  let resumePdfPath = String(rec.tailoredResume?.pdfPath || '').trim();
  if (tailorResume || (resumePdfPath && !fs.existsSync(resumePdfPath))) {
    progress.update('tailor_resume', 'Генерация PDF резюме…', 8);
    try {
      const { pdfPath, mdPath } = await ensureTailoredResumePdf(rec.id, {
        title: rec.title,
        company: rec.company,
        description: String(rec.descriptionForLlm || rec.descriptionPreview || ''),
      });
      resumePdfPath = pdfPath;
      updateVacancyRecord(rec.id, {
        tailoredResume: { pdfPath, mdPath, updatedAt: new Date().toISOString() },
      });
      logLine(`[hh-apply-chat] Резюме под вакансию: ${pdfPath}`);
    } catch (e) {
      logLine(`[hh-apply-chat] Не удалось собрать PDF резюме: ${e.message}`);
    }
  }

  progress.update('launch_browser', 'Открываю Chromium…', 12);

  let cvText = '';
  if (questionnaireAuto) {
    try {
      const cvBundle = await loadCvBundle();
      cvText = String(cvBundle.text || '').trim();
      if (!cvText) logLine('[hh-apply-chat] HH_QUESTIONNAIRE_AUTO: CV пуст — ответы анкеты могут быть слабыми');
      else logLine('[hh-apply-chat] HH_QUESTIONNAIRE_AUTO: ответы анкеты из CV/ (без LLM, если не задан HH_QUESTIONNAIRE_LLM=1)');
    } catch (e) {
      logLine(`[hh-apply-chat] CV для анкеты не загружен: ${e.message}`);
    }
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Профиль не найден. Сначала: npm run login\n', profile);
    process.exit(1);
  }

  const vacancyId = rec.vacancyId || vacancyIdFromUrl(rec.url) || '';

  let tmpDir = null;
  let tmpFile = null;
  if (letter && !dryRun) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-letter-'));
    tmpFile = path.join(tmpDir, 'cover-letter.txt');
    fs.writeFileSync(tmpFile, letter, 'utf8');
  }

  const launchOpts = {
    headless,
    viewport: { width: 1280, height: 900 },
    locale: 'ru-RU',
  };
  const ch = String(process.env.HH_PLAYWRIGHT_CHANNEL || '').trim();
  if (ch) launchOpts.channel = ch;
  let ctx = await launchPersistentContextSafe(profile, launchOpts, {
    owner: BROWSER_OWNER,
    skipMinimize: headless || !browserBackground,
  });

  if (captchaEscalate) {
    if (headless) {
      let escalatedOnce = false;
      registerCaptchaVisibleEscalation(async (p) => {
        if (escalatedOnce) return p;
        escalatedOnce = true;
        const r = await escalateHeadlessToVisibleBrowser(p, ctx, {
          profile,
          owner: BROWSER_OWNER,
          log: logLine,
          launchBase: { viewport: launchOpts.viewport, locale: launchOpts.locale },
        });
        ctx = r.ctx;
        return r.page;
      });
    } else {
      registerCaptchaVisibleEscalation(async (p) => {
        logLine('[hh-captcha] Капча: разворачиваю окно Chromium…');
        await bringBrowserToFront(p.context());
        return p;
      });
    }
  }

  const openPages = ctx.pages();
  for (let i = 1; i < openPages.length; i++) {
    await openPages[i].close().catch(() => {});
  }
  let page = openPages[0] && !openPages[0].isClosed() ? openPages[0] : await ctx.newPage();

  const { dismissChromiumRestorePopup } = await import('../lib/hh-response-modal.mjs');
  await dismissChromiumRestorePopup(page);

  const ensureActivePage = async (stage) => {
    if (!page.isClosed()) return page;
    const revived = await waitForActivePage(ctx, page, 8000);
    if (revived) {
      page = revived;
      console.warn(`[hh-apply-chat] переключение вкладки (stage=${stage})`);
      return page;
    }
    throw new Error(`Страница закрыта до шага ${stage}`);
  };

  try {
    const humanTyping = process.env.HH_FAST !== '1';
    const humanClicks = process.env.HH_FAST !== '1';

    step('start', `Старт: ${rec.title || rec.url}`, 15);
    logLine(
      `[hh-apply-chat] Резюме (${resumePick.reason}): ${resumePick.label} → «${resumePick.title}»` +
        (resumePick.hash ? ` [hash ${resumePick.hash.slice(0, 8)}…]` : '') +
        ' — на форме выберется только из списка hh.ru'
    );
    page = await focusVacancyResponsePage(ctx, page, { log: logLine, closeOtherTabs: true });
    const curOnResponse =
      /applicant\/vacancy_response/i.test(page.url()) &&
      !looksLikeLoginUrl(page.url()) &&
      (!vacancyId || vacancyIdFromUrl(page.url()) === vacancyId);
    if (curOnResponse) {
      logLine('[hh-apply-chat] Уже на форме отклика/анкеты — карточку вакансии не перезагружаю');
    } else {
      logLine(`[hh-apply-chat] Открываю вакансию: ${rec.url}`);
      await withStepHeartbeat(logLine, 'загрузка страницы вакансии', async () => {
        await page.goto(rec.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        if (!isFastMode()) {
          await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
        }
      });
    }
    await betweenMajorSteps(page);
    step('open_vacancy', 'Страница вакансии открыта', 22);

    page = await assertHhLoggedIn(page, { log: logLine, captchaContext: 'страница вакансии' });
    const { ensureApplicantOnboardingDismissed, detectApplicantProfileOnboarding } = await import(
      '../lib/hh-applicant-onboarding.mjs'
    );
    await ensureApplicantOnboardingDismissed(page, { log: logLine });

    const siteDet = await syncHhSiteStateFromPage(page, rec);
    if (!siteDet.canApply) {
      logLine(`[hh-apply-chat] Статус на hh.ru: ${siteDet.label || siteDet.state}`);
      return routeHhBlockExit(progress, rec, page, ctx, {
        reason: siteDet.label || 'Повторный отклик на hh.ru не нужен.',
        det: siteDet,
        letter,
        resumePick,
        tmpFile,
        humanTyping,
        vacancyId,
        l4Attempted: false,
      });
    }

    let l4Attempted = false;
    if (tailorResume && resumePick.hash && !dryRun) {
      page = await assertHhLoggedIn(page, { log: logLine, captchaContext: 'подгонка резюме' });
      await dismissChromiumRestorePopup(page);
      const { applyMicroAboutBeforeApply } = await import('../lib/resume-micro-tailor-apply.mjs');
      const mt = await applyMicroAboutBeforeApply(page, rec, resumePick.hash, { log: logLine });
      if (mt.l4 || mt.ok || mt.partial) l4Attempted = true;
      if (mt.ok) {
        logLine(
          mt.partial
            ? '[hh-apply-chat] L4+ частично записан на hh.ru (см. журнал manifest)'
            : mt.l4
              ? '[hh-apply-chat] L4+ записан на hh.ru перед откликом'
              : '[hh-apply-chat] Блок «О себе» подогнан под вакансию'
        );
      } else if (mt.skipped) {
        logLine(`[hh-apply-chat] L4 пропущен: ${mt.reason || 'не требуется'}`);
      } else {
        logLine(`[hh-apply-chat] Подгонка резюме: ${mt.reason || 'ошибка'}`);
      }
    }

    await ensureActivePage('before_click_response');
    const btn = await withStepHeartbeat(logLine, 'открытие формы отклика', async () => {
      const flow = openVacancyResponseFlow(page, {
        humanClicks,
        timeoutMs: 20_000,
        vacancyUrl: rec.url,
        vacancyId,
        resumeHash: resumePick.hash,
        preferredResumeTitle: resumePick.title,
        record: rec,
        log: logLine,
      });
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Таймаут открытия формы отклика (55 с)')), 55_000);
      });
      return Promise.race([flow, timeout]);
    });
    logLine(`[hh-apply-chat] Отклик: ${btn}`);
    if (btn === 'already-submitted') {
      const det2 = await syncHhSiteStateFromPage(page, rec);
      return routeHhBlockExit(progress, rec, page, ctx, {
        reason: det2.label || 'Уже откликнулись или приглашение на hh.ru — повторный отклик не нужен.',
        det: det2,
        letter,
        resumePick,
        tmpFile,
        humanTyping,
        vacancyId,
        l4Attempted,
      });
    }
    step('click_response', 'Форма отклика', 32);
    page = await focusVacancyResponsePage(ctx, page, { log: logLine, closeOtherTabs: false });
    await page.waitForTimeout(600);
    page = (await ensureNoCaptchaBlocking(page, { log: logLine, context: 'форма отклика' })).page;

    const siteAfterOpen = await syncHhSiteStateFromPage(page, rec);
    if (!siteAfterOpen.canApply) {
      logLine(`[hh-apply-chat] После открытия формы: ${siteAfterOpen.label || siteAfterOpen.state}`);
      return routeHhBlockExit(progress, rec, page, ctx, {
        reason: siteAfterOpen.label || 'Уже откликнулись на hh.ru — повторный отклик не нужен.',
        det: siteAfterOpen,
        letter,
        resumePick,
        tmpFile,
        humanTyping,
        vacancyId,
        l4Attempted,
      });
    }

    page = await focusVacancyResponsePage(ctx, page, { log: logLine, closeOtherTabs: true });

    if (noSubmit) {
      logLine('[hh-apply-chat] --no-submit: форма открыта, отправку и чат не трогаем.');
      if (stayOpen) await waitEnter('Enter — закрыть браузер: ');
      return 0;
    }

    page = await ensureActivePage('before_complete_response');
    step('modal_prepare', 'Мастер отклика', 40);

    const modalWallMs = computeModalWallMs(rec, { l4Attempted });
    logLine(
      `[hh-apply-chat] wall мастера: ${Math.round(modalWallMs / 1000)} с${l4Attempted ? ' (+60 L4)' : ''}`
    );
    let formResult = await withStepHeartbeat(logLine, 'мастер отклика (резюме, письмо, отправка)', async () => {
      const flow = completeVacancyResponseForm(page, {
        context: ctx,
        maxWallMs: modalWallMs,
        resumePdfPath: resumePdfPath && fs.existsSync(resumePdfPath) ? resumePdfPath : undefined,
        letter: letter || undefined,
        humanTyping,
        humanClicks,
        alreadyClicked: true,
        questionnaireAuto,
        record: rec,
        cvText,
        log: logLine,
        vacancyId,
        resumeTarget: resumePick,
        preferredResumeTitle: resumePick.title,
        resumeHash: resumePick.hash,
      });
      const timeout = new Promise((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(`Таймаут мастера отклика (${Math.round(modalWallMs / 1000)} с)`)
            ),
          modalWallMs
        );
      });
      return Promise.race([flow, timeout]);
    });
    if (formResult.page && !formResult.page.isClosed()) {
      page = formResult.page;
    }

    if (
      !formResult.submitted &&
      (formResult.presubmitBlocked || formResult.emptyResumeList || formResult.wizardBlocked)
    ) {
      const code = formResult.presubmitBlocked || formResult.label || 'presubmit';
      logLine(`[hh-apply-chat] Pre-submit stop: ${code}`);
      progress.done(`Pre-submit: ${code}`);
      if (isBatchApply) {
        logBatchSkipReason(formatApplySkipReasonFromText(String(code)));
      }
      return HH_APPLY_EXIT_PRESUBMIT_BLOCKED;
    }

    if (formResult.questionnaire?.detected) {
      const letterFilledInFormQ = Boolean(formResult.letterInForm);

      if (questionnaireAuto && (cvText || recordHasDashboardQuestionnaireAnswers(rec))) {
        page = await focusVacancyResponsePage(ctx, page, { log: logLine, closeOtherTabs: true });
        const auto = await tryAutoFillEmployerQuestionnaireWithWizard(page, {
          record: getVacancyRecord(rec.id) || rec,
          cvText,
          log: logLine,
        });
        if (auto.ok) {
          logLine('[hh-apply-chat] Повторная отправка после авто-анкеты…');
          page = await focusVacancyResponsePage(ctx, page, { log: logLine, closeOtherTabs: true });
          let retry = await completeVacancyResponseForm(page, {
            context: ctx,
            resumePdfPath: resumePdfPath && fs.existsSync(resumePdfPath) ? resumePdfPath : undefined,
            letter: letter || undefined,
            humanTyping,
            humanClicks,
            alreadyClicked: true,
            questionnaireAuto,
            record: rec,
            cvText,
            log: logLine,
            vacancyId,
            resumeTarget: resumePick,
            preferredResumeTitle: resumePick.title,
            resumeHash: resumePick.hash,
          });
          if (retry.page && !retry.page.isClosed()) page = retry.page;
          if (retry.submitted) {
            Object.assign(formResult, retry);
            delete formResult.questionnaire;
          } else if (!retry.questionnaire?.detected) {
            Object.assign(formResult, retry);
          }
        }
      }

      if (!formResult.submitted && formResult.questionnaire?.detected) {
        const questionCount = await persistEmployerQuestionnaireFromApply({
          page,
          formResult,
          rec,
          letter,
          letterFilledInFormQ,
          questionnaireAuto,
          cvText,
        });
        const freshRec = getVacancyRecord(rec.id) || rec;
        if (
          isBatchApply &&
          questionnaireAuto &&
          questionCount > 0 &&
          recordHasDashboardQuestionnaireAnswers(freshRec)
        ) {
          try {
            const auto = await tryAutoFillEmployerQuestionnaireWithWizard(page, {
              record: freshRec,
              cvText,
              log: logLine,
            });
            if (auto.ok) {
              logLine('[hh-apply-chat] BATCH: повторная отправка после авто-анкеты…');
              page = await focusVacancyResponsePage(ctx, page, { log: logLine, closeOtherTabs: true });
              const retry = await completeVacancyResponseForm(page, {
                context: ctx,
                resumePdfPath: resumePdfPath && fs.existsSync(resumePdfPath) ? resumePdfPath : undefined,
                letter: letter || undefined,
                humanTyping,
                humanClicks,
                alreadyClicked: true,
                questionnaireAuto,
                record: rec,
                cvText,
                log: logLine,
                vacancyId,
                resumeTarget: resumePick,
                preferredResumeTitle: resumePick.title,
                resumeHash: resumePick.hash,
              });
              if (retry.submitted) {
                logLine('[hh-apply-chat] BATCH: отклик с анкетой отправлен');
                Object.assign(formResult, retry);
                delete formResult.questionnaire;
              }
            }
          } catch (e) {
            logLine(`[hh-apply-chat] BATCH: авто-анкета не завершила отклик: ${e.message}`);
          }
        }
        if (!formResult.submitted && formResult.questionnaire?.detected) {
        step('questionnaire_wait', 'Анкета работодателя — заполните вручную', 75);
        const hadDashboardAnswers = recordHasDashboardQuestionnaireAnswers(getVacancyRecord(rec.id) || rec);
        logLine(
          '[hh-apply-chat] Обнаружена анкета работодателя. ' +
            (hadDashboardAnswers
              ? 'Ответы в карточке — «Отклик + анкета» или батч по вкладке «Анкета». Проверьте поля на hh.ru.'
              : 'В дашборде: «Загрузить с hh.ru» → «Сгенерировать» → «Сохранить», затем отклик.')
        );
        if (isBatchApply) {
          const skipLabel =
            questionCount > 0
              ? `анкета: ${questionCount} вопр.`
              : 'анкета работодателя (уточнить вопросы в разделе «Анкета»)';
          logBatchSkipReason(skipLabel);
          logLine(
            '[hh-apply-chat] BATCH: отклик не отправлен — карточка в разделе «Анкета»; батч продолжается.'
          );
          progress.done('Анкета (батч, без отклика)');
          return HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED;
        }
        progress.done('Ждём анкету (ручное заполнение)');
        if (stayOpen || questionnaireWait) {
          await waitEnter(
            'Проверьте анкету в Chromium и отправьте отклик на hh.ru. Затем Enter — закрыть браузер: '
          );
        } else {
          logLine(
            '[hh-apply-chat] Браузер закроется сразу — для анкеты используйте «Отклик в браузере» в модалке или кнопку с ожиданием (questionnaireWait).'
          );
        }
        return 0;
        }
      }
    }

    if (formResult.submitted && (formResult.label === 'already-submitted' || formResult.repeatApply)) {
      page = await requireLivePage(ctx, page, {
        timeoutMs: 12_000,
        log: logLine,
        reason: 'before-repeat-repair',
      });
      const listingUrl = vacancyId ? `https://hh.ru/vacancy/${vacancyId}` : rec.url;
      if (listingUrl && !isVacancyListingPageUrl(page.url())) {
        await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await betweenMajorSteps(page);
      }
      const det3 = await syncHhSiteStateFromPage(page, rec);
      return finishRepeatApply(progress, rec, page, ctx, {
        letter,
        formResult,
        resumePick,
        tmpFile,
        humanTyping,
        vacancyId,
        det: det3,
        dryRun,
      });
    }

    if (!formResult.submitted) {
      const ambiguousForm =
        /form-still-open|hh-form-error|questionnaire/i.test(String(formResult.label || '')) ||
        Boolean(formResult.questionnaire?.detected);
      if (ambiguousForm && (stayOpen || questionnaireWait)) {
        logLine(
          '[hh-apply-chat] Форма отклика ещё открыта (возможна анкета). Заполните вручную в браузере.'
        );
        if (formResult.questionnaire?.detected) {
          await persistEmployerQuestionnaireFromApply({
            page,
            formResult,
            rec,
            letter,
            letterFilledInFormQ: Boolean(formResult.letterInForm),
            questionnaireAuto,
            cvText,
          });
        }
        progress.done('Ждём завершения отклика вручную');
        await waitEnter(
          'Дозаполните форму/анкету в Chromium и отправьте отклик. Затем Enter — закрыть браузер: '
        );
        return 0;
      }
      if (isBatchApply && formResult.questionnaire?.detected) {
        const questionCount = await persistEmployerQuestionnaireFromApply({
          page,
          formResult,
          rec,
          letter,
          letterFilledInFormQ: Boolean(formResult.letterInForm),
          questionnaireAuto,
          cvText,
        });
        const skipLabel =
          questionCount > 0
            ? `анкета: ${questionCount} вопр.`
            : 'анкета работодателя (уточнить вопросы в разделе «Анкета»)';
        logBatchSkipReason(skipLabel);
        logLine(
          '[hh-apply-chat] BATCH: анкета без отправки — карточка в разделе «Анкета», батч продолжается.'
        );
        progress.done('Анкета (батч)');
        return HH_APPLY_EXIT_QUESTIONNAIRE_DEFERRED;
      }
      const needResume = resumePick.title;
      if (formResult.presubmitBlocked || formResult.emptyResumeList || formResult.wizardBlocked) {
        const code = formResult.presubmitBlocked || formResult.label || 'presubmit';
        logLine(`[hh-apply-chat] Pre-submit stop: ${code}`);
        progress.done(`Pre-submit: ${code}`);
        if (isBatchApply) {
          logBatchSkipReason(formatApplySkipReasonFromText(String(code)));
        }
        return HH_APPLY_EXIT_PRESUBMIT_BLOCKED;
      }
      if (formResult.resumeMismatch) {
        if (formResult.resumeNotInEmployerList) {
          const detResume = await syncHhSiteStateFromPage(page, rec);
          if (!detResume.canApply) {
            return finishAlreadyResponded(
              progress,
              detResume.label || 'Отклик уже был — нужное резюме недоступно для повторного отклика.',
              detResume,
              rec
            );
          }
          if (isBatchApply) logBatchSkipReason('нужное резюме не в списке работодателя на hh.ru');
          pruneVacancyFromActiveQueue(rec.id);
          throw new Error(
            `Резюме «${needResume}» не предлагает hh.ru для этой вакансии (сейчас: ${formResult.profileResume || '—'}). ` +
              'Батч пропустит вакансию — откликнитесь вручную другим резюме или отклоните карточку.'
          );
        }
        throw new Error(
          `Не удалось выбрать резюме «${needResume}» (сейчас: ${formResult.profileResume || '—'}). ` +
            'Проверьте config/resume-routing.json (npm run devops:preview-resume-routing) и hash: npm run devops:list-resumes.'
        );
      }
      const hint =
        formResult.formError
          ? ` hh.ru: ${formResult.formError}`
          : formResult.resumeMismatch ||
        (needResume &&
          formResult.profileResume &&
          !(
            formResult.profileResume.toLowerCase().includes(needResume.toLowerCase()) ||
            (resumePick.role === 'devops' && /\bdevops\b/i.test(formResult.profileResume)) ||
            (resumePick.role === 'data' && /data engineer/i.test(formResult.profileResume)) ||
            (resumePick.role === 'support' && /поддержк/i.test(formResult.profileResume))
          ))
          ? ` Не выбрано резюме «${needResume}» (${resumePick.label}) — config/resume-routing.json`
          : /form-still-open|hh-form-error/i.test(String(formResult.label || ''))
            ? ' Форма отклика не закрылась после «Откликнуться».'
            : '';
      throw new Error(
        `Не удалось отправить отклик: мастер не дошёл до кнопки «Отправить».${hint}`
      );
    }

    const needResumeTitle = resumePick.title;
    const needResumeHash = resumePick.hash;
    if (formResult.profileResume && needResumeTitle) {
      const titleOk =
        formResult.profileResume.toLowerCase().includes(needResumeTitle.toLowerCase()) ||
        (resumePick.role === 'devops' && /\bdevops\b/i.test(formResult.profileResume)) ||
        (resumePick.role === 'data' && /data engineer/i.test(formResult.profileResume)) ||
        (resumePick.role === 'support' && /поддержк/i.test(formResult.profileResume));
      if (!titleOk && !needResumeHash) {
        throw new Error(
          `Отклик не отправлен: в форме резюме «${formResult.profileResume}», нужно «${needResumeTitle}».`
        );
      }
    }

    if (formResult.resumeAttached) step('attach_tailored_resume', 'PDF резюме в форме', 46);
    else if (resumePdfPath && fs.existsSync(resumePdfPath)) {
      if (formResult.resumeAttachReason === 'no-file-input') {
        logLine(
          '[hh-apply-chat] L4 пишет в резюме профиля hh; форма отклика не принимает PDF — это норма.'
        );
      } else {
        logLine(
          '[hh-apply-chat] PDF не загружен — использовано резюме из профиля или выберите вручную.'
        );
      }
    }
    if (formResult.profileResume) {
      logLine(`[hh-apply-chat] Резюме в форме: ${formResult.profileResume}`);
    }

    let letterFilledInForm = letter ? await verifyCoverLetterInForm(page, letter) : false;
    if (letter && !letterFilledInForm && formResult?.letterInForm) {
      // Мастер формы подтвердил письмо в textarea сопроводительного — после submit модалка пропадает.
      letterFilledInForm = true;
      logLine(
        '[hh-apply-chat] Сопроводительное было в форме при отправке отклика — переписку не открываем.'
      );
      step('fill_letter', 'Сопроводительное в форме', 52);
    } else if (letter && !letterFilledInForm) {
      logLine('[hh-apply-chat] Поле письма в форме не найдено — письмо уйдёт в переписку после отклика.');
    } else if (letterFilledInForm) {
      step('fill_letter', 'Сопроводительное в форме', 52);
    }

    logLine(`[hh-apply-chat] Отправка отклика: ${formResult.label}`);
    step('submit_response', 'Отклик отправлен', 72);
    let responseSubmitted = Boolean(formResult.submitted);
    page = (await waitForActivePage(ctx, page, 5000)) || page;
    await betweenMajorSteps(page).catch(() => {});

    // HTTP 200 / DOM «отправлено» без verify на карточке вакансии = fail (exit 8), не ok.
    if (responseSubmitted && !dryRun) {
      const verify = await verifyHhApplyRegisteredOnVacancy(page, rec.url);
      if (!verify.ok) {
        const prevHh = getVacancyRecord(rec.id)?.hhApply || rec.hhApply || {};
        return finishApplyNotVerified(progress, rec, {
          formResult,
          verify,
          prevHh,
          letter,
          letterFilledInForm,
          resumePick,
        });
      }
      await syncHhSiteStateFromPage(page, rec);
      logLine(
        `[hh-apply-chat] Отклик подтверждён на hh.ru (${verify.det?.state || 'ok'}, source=${verify.det?.source || '?'})`
      );
    }

    if (dryRun) {
      logLine('[hh-apply-chat] --dry-run: чат не открывался.');
      step('done_dry_run', 'Готово (dry-run)', 100);
      if (stayOpen) await waitEnter('Enter — закрыть браузер: ');
      return 0;
    }

    let chatStepOk = false;
    let chatChannel = '';
    const chatCtx = {
      vacancyId,
      vacancyTitle: rec.title,
      company: rec.company,
      context: ctx,
      log: logLine,
    };

    if (letter && letterFilledInForm) {
      logLine('[hh-apply-chat] Сопроводительное в форме отклика — переписку не открываем.');
      step('send_chat_skipped_form', 'Письмо в форме отклика', 92);
    }

    try {
      if (!chatStepOk && letter && !letterFilledInForm && /\/vacancy\/\d+/i.test(page.url())) {
        const vacMethod = await withStepHeartbeat(logLine, 'переписка на странице вакансии', () =>
          sendLetterOnVacancyCorrespondence(page, {
            text: letter,
            tempFilePath: tmpFile,
            humanTyping,
            log: logLine,
            ...chatCtx,
          })
        );
        if (vacMethod) {
          const vacVerified = await verifyLetterVisibleInChat(page, letter);
          if (vacVerified) {
            chatChannel = `vacancy:${vacMethod}`;
            logLine(`[hh-apply-chat] Письмо в переписке на странице вакансии (${vacMethod}).`);
            step('send_vacancy_correspondence', 'Письмо в переписке', 88);
            chatStepOk = true;
          } else {
            logLine(`[hh-apply-chat] Переписка на вакансии: вставка не подтверждена (${vacMethod}).`);
          }
        }
      }

      if (!chatStepOk && letter && !letterFilledInForm) {
        page = await ensureActivePage('before_open_chat');
        await withStepHeartbeat(logLine, 'переход в чат с работодателем', () =>
          openEmployerChatAfterResponse(page, chatCtx)
        );
        step('open_chat', 'Чат с работодателем', 82);
        page = (await waitForActivePage(ctx, page, 3000)) || page;
        await betweenMajorSteps(page);

        const chatMethod = await withStepHeartbeat(logLine, 'вставка письма в чат', () =>
          sendLetterInChat(page, {
            text: letter,
            tempFilePath: tmpFile,
            humanTyping,
            log: logLine,
            ...chatCtx,
          })
        );
        if (chatMethod) {
          const chatVerified = await verifyLetterVisibleInChat(page, letter);
          if (chatVerified) {
            chatChannel = `chat:${chatMethod}`;
            logLine(`[hh-apply-chat] Готово: письмо в чате (${chatMethod}).`);
            step('send_chat_done', 'Письмо в чате', 95);
            chatStepOk = true;
          } else {
            logLine(`[hh-apply-chat] Чат: вставка не подтверждена (${chatMethod}).`);
          }
        }
      }
    } catch (e) {
      const msg = String(e?.message || e);
      if (
        responseSubmitted &&
        (/has been closed/i.test(msg) || /Страница закрыта/i.test(msg))
      ) {
        logLine('[hh-apply-chat] После отклика вкладка закрылась — чат не открыт автоматически.');
        step('chat_skipped_after_submit', 'Отклик отправлен', 88);
      } else if (!chatStepOk && letter && !letterFilledInForm) {
        logLine(`[hh-apply-chat] Письмо в чат не доставлено: ${msg.slice(0, 400)}`);
      } else if (!chatStepOk) {
        throw e;
      }
    }

    let verifiedInChat = Boolean(chatStepOk);
    if (letter && !verifiedInChat && !letterFilledInForm) {
      page = (await waitForActivePage(ctx, page, 4000)) || page;
      verifiedInChat = await verifyLetterVisibleInChat(page, letter);
      if (verifiedInChat) {
        chatStepOk = true;
        chatChannel = chatChannel || 'verified-in-chat';
      }
    }

    const letterDelivery = resolveLetterDeliveryOutcome({
      letter,
      letterInForm: letterFilledInForm,
      chatSent: chatStepOk,
      verifiedInChat,
      responseSubmitted,
    });

    if (responseSubmitted) {
      const prevHh = getVacancyRecord(rec.id)?.hhApply || rec.hhApply || {};
      const resumeMatchOk = resumeSelectionMatches(formResult.profileResume, resumePick);
      if (letterDelivery === 'not_delivered') {
        return finishLetterNotDelivered(progress, rec, {
          letter,
          letterFilledInForm,
          chatSent: chatStepOk,
          verifiedInChat,
          resumePick,
          formResult,
          resumeMatchOk,
          prevHh,
        });
      }
      updateVacancyRecord(rec.id, {
        status: 'applied',
        hhApply: buildHhApplyAfterSuccess(prevHh, {
          lastAt: new Date().toISOString(),
          responseSubmitted: true,
          letterInForm: letterFilledInForm,
          chatSent: Boolean(chatStepOk && verifiedInChat),
          letterDelivered: letterDelivery === 'delivered',
          letterPreview: letter ? String(letter).replace(/\s+/g, ' ').trim().slice(0, 120) : undefined,
          resumeRole: resumePick.role,
          resumeRolePlanned: resumePick.role,
          resumeTitlePlanned: resumePick.title,
          resumeTitleSelected: formResult.profileResume || resumePick.title,
          resumeHashPlanned: resumePick.hash || undefined,
          resumeHashSelected: formResult.profileResumeHash || undefined,
          resumeMatchOk: resumeMatchOk !== false,
        }),
      });
      if (resumeMatchOk === false && formResult.profileResume) {
        logLine(
          `[hh-apply-chat] ⚠ Резюме в форме «${formResult.profileResume}» ≠ план «${resumePick.title}» (${resumePick.label})`
        );
      }
      logCoverLetterOutcome(logLine, {
        letter,
        letterFilledInForm,
        chatSent: chatStepOk && !verifiedInChat,
        verifiedInChat,
        channel: chatChannel,
      });
    }

    progress.done('Отклик отправлен');
    logLine('[hh-apply-chat] SUCCESS: отклик отправлен (exit 0).');

    if (stayOpen) {
      await waitEnter('Enter — закрыть браузер: ');
    }
    return 0;
  } catch (e) {
    if (isBatchApply) {
      try {
        if (page && !page.isClosed()) {
          const { detectApplicantProfileOnboarding } = await import('../lib/hh-applicant-onboarding.mjs');
          if (await detectApplicantProfileOnboarding(page)) {
            logBatchSkipReason('мастер hh.ru «Кем хотите работать» — npm run open-hh');
          }
        }
      } catch {
        /* ignore */
      }
      logBatchSkipReason(formatApplySkipReasonFromText(e?.message || e));
    }
    progress.error(e?.message || e);
    appendApplyChatLog(`Error: ${e?.message || e}`, { withTime: true });
    await saveErrorScreenshot(page, e);
    throw e;
  } finally {
    unregisterCaptchaVisibleEscalation();
    await closeContextSafe(ctx, BROWSER_OWNER);
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }
}

main().then((code) => process.exit(code ?? 0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
