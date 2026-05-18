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
import { meaningfulQuestions } from '../lib/questionnaire-labels.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadEnv();
loadDevOpsEnv();

import { sessionProfilePath, DATA_DIR } from '../lib/paths.mjs';
import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { betweenMajorSteps } from '../lib/hh-human-delay.mjs';
import { openEmployerChatAfterResponse, sendLetterInChat } from '../lib/hh-chat-selectors.mjs';
import {
  completeVacancyResponseForm,
  openVacancyResponseFlow,
  resolvePageAfterResponseClick,
} from '../lib/hh-response-modal.mjs';
import { assertHhLoggedIn, looksLikeLoginUrl } from '../lib/hh-session-check.mjs';
import { ensureTailoredResumePdf } from '../lib/tailor-resume.mjs';
import { loadCoverLetterPool, pickCoverLetterFromPool } from '../lib/cover-letter-pool.mjs';
import {
  launchPersistentContextSafe,
  closeContextSafe,
  waitForActivePage,
} from '../lib/chromium-session.mjs';
import { appendApplyChatLog } from '../lib/apply-chat-log.mjs';
import { createApplyChatProgressTracker, clearApplyChatProgress } from '../lib/job-progress.mjs';
import { withStepHeartbeat } from '../lib/step-heartbeat.mjs';
import { formatLogLine } from '../lib/log-line.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { isQuestionnaireAutoEnabled } from '../lib/hh-questionnaire-answers.mjs';
import { tryAutoFillEmployerQuestionnaire } from '../lib/hh-questionnaire-auto.mjs';

const BROWSER_OWNER = 'apply-chat';

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
  const line = formatLogLine(msg);
  console.log(line);
  appendApplyChatLog(line, { withTime: false });
}

const headless = process.env.HH_HEADLESS === '1';
const stayOpen = process.argv.includes('--stay-open');
const questionnaireWait =
  process.argv.includes('--questionnaire-wait') ||
  process.env.HH_QUESTIONNAIRE_WAIT === '1';
const questionnaireAuto = isQuestionnaireAutoEnabled();
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
      else logLine('[hh-apply-chat] HH_QUESTIONNAIRE_AUTO: ответы анкеты из резюме (LLM)');
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
  const ctx = await launchPersistentContextSafe(profile, launchOpts, { owner: BROWSER_OWNER });
  let page = ctx.pages()[0] || (await ctx.newPage());

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
    logLine(`[hh-apply-chat] Открываю вакансию: ${rec.url}`);
    await withStepHeartbeat(logLine, 'загрузка страницы вакансии', async () => {
      await page.goto(rec.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForLoadState('networkidle', { timeout: 25_000 }).catch(() => {});
    });
    await betweenMajorSteps(page);
    step('open_vacancy', 'Страница вакансии открыта', 22);

    if (looksLikeLoginUrl(page.url())) {
      throw new Error('Редирект на логин. Выполните: npm run login');
    }
    await assertHhLoggedIn(page);

    await ensureActivePage('before_click_response');
    const btn = await withStepHeartbeat(logLine, 'открытие формы отклика', () =>
      openVacancyResponseFlow(page, { humanClicks, timeoutMs: 35_000 })
    );
    logLine(`[hh-apply-chat] Отклик: ${btn}`);
    step('click_response', 'Форма отклика', 32);
    page = (await resolvePageAfterResponseClick(ctx, page)) || page;
    await page.waitForTimeout(600);

    if (noSubmit) {
      logLine('[hh-apply-chat] --no-submit: форма открыта, отправку и чат не трогаем.');
      if (stayOpen) await waitEnter('Enter — закрыть браузер: ');
      return;
    }

    page = await ensureActivePage('before_complete_response');
    step('modal_prepare', 'Мастер отклика', 40);

    const formResult = await withStepHeartbeat(logLine, 'мастер отклика (резюме, письмо, отправка)', () =>
      completeVacancyResponseForm(page, {
        resumePdfPath: resumePdfPath && fs.existsSync(resumePdfPath) ? resumePdfPath : undefined,
        letter: letter || undefined,
        humanTyping,
        humanClicks,
        alreadyClicked: true,
        questionnaireAuto,
        record: rec,
        cvText,
        log: logLine,
      })
    );

    if (formResult.questionnaire?.detected) {
      const q = formResult.questionnaire;
      const letterFilledInFormQ = Boolean(formResult.letterInForm);

      if (questionnaireAuto && cvText) {
        const auto = await tryAutoFillEmployerQuestionnaire(page, {
          record: rec,
          cvText,
          log: logLine,
        });
        if (auto.ok) {
          logLine('[hh-apply-chat] Повторная отправка после авто-анкеты…');
          const retry = await completeVacancyResponseForm(page, {
            resumePdfPath: resumePdfPath && fs.existsSync(resumePdfPath) ? resumePdfPath : undefined,
            letter: letter || undefined,
            humanTyping,
            humanClicks,
            alreadyClicked: true,
            questionnaireAuto,
            record: rec,
            cvText,
            log: logLine,
          });
          if (retry.submitted) {
            Object.assign(formResult, retry);
            delete formResult.questionnaire;
          } else if (!retry.questionnaire?.detected) {
            Object.assign(formResult, retry);
          }
        }
      }

      if (!formResult.submitted && formResult.questionnaire?.detected) {
      const mq = meaningfulQuestions(q.questions || []);
      for (const item of mq) {
        logLine(`[hh-apply-chat] Вопрос ${item.index}: ${item.label.slice(0, 200)}`);
      }
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
          lastAt: new Date().toISOString(),
          responseSubmitted: false,
          letterInForm: letterFilledInFormQ,
          questionnaire: {
            status: 'pending_manual',
            questions: mq,
            reasons: q.reasons,
            detectedAt: new Date().toISOString(),
            label: formResult.label,
            autoAttempted: questionnaireAuto,
            needsProbe: mq.length === 0,
          },
        },
      });
      step('questionnaire_wait', 'Анкета работодателя — заполните вручную', 75);
      logLine(
        '[hh-apply-chat] Обнаружена анкета работодателя. Сопроводительное вставлено (если было поле). ' +
          'Заполните ответы в браузере и нажмите «Отправить отклик» на hh.ru.'
      );
      progress.done('Ждём анкету (ручное заполнение)');
      if (stayOpen || questionnaireWait) {
        await waitEnter(
          'Заполните анкету в открытом Chromium и отправьте отклик на hh.ru. Затем Enter — закрыть браузер: '
        );
      } else {
        logLine(
          '[hh-apply-chat] Подсказка: запустите с --questionnaire-wait или --stay-open, чтобы браузер не закрылся сразу.'
        );
      }
      return;
      }
    }

    if (!formResult.submitted) {
      const ambiguousForm =
        /form-still-open|questionnaire/i.test(String(formResult.label || '')) ||
        Boolean(formResult.questionnaire?.detected);
      if (ambiguousForm && (stayOpen || questionnaireWait)) {
        logLine(
          '[hh-apply-chat] Форма отклика ещё открыта (возможна анкета). Заполните вручную в браузере.'
        );
        if (formResult.questionnaire?.detected) {
          const q = formResult.questionnaire;
          const mq = meaningfulQuestions(q.questions || []);
          updateVacancyRecord(rec.id, {
            hhApply: {
              lastAt: new Date().toISOString(),
              responseSubmitted: false,
              letterInForm: Boolean(formResult.letterInForm),
              questionnaire: {
                status: 'pending_manual',
                questions: mq,
                reasons: q.reasons,
                detectedAt: new Date().toISOString(),
                label: formResult.label,
                needsProbe: mq.length === 0,
              },
            },
          });
        }
        progress.done('Ждём завершения отклика вручную');
        await waitEnter(
          'Дозаполните форму/анкету в Chromium и отправьте отклик. Затем Enter — закрыть браузер: '
        );
        return;
      }
      const needResume = String(process.env.HH_PROFILE_RESUME_TITLE || '').trim();
      const hint = needResume
        ? ` Не выбрано резюме «${needResume}» — откройте список резюме на странице отклика или задайте HH_PROFILE_RESUME_HASH в config/devops.env.`
        : '';
      throw new Error(
        `Не удалось отправить отклик: мастер не дошёл до кнопки «Отправить».${hint}`
      );
    }

    const needResumeTitle = String(process.env.HH_PROFILE_RESUME_TITLE || '').trim();
    const needResumeHash = String(process.env.HH_PROFILE_RESUME_HASH || '').trim();
    if (formResult.profileResume && needResumeTitle) {
      const titleOk = formResult.profileResume.toLowerCase().includes(needResumeTitle.toLowerCase());
      if (!titleOk && !needResumeHash) {
        throw new Error(
          `Отклик не отправлен: в форме резюме «${formResult.profileResume}», нужно «${needResumeTitle}».`
        );
      }
    }

    if (formResult.resumeAttached) step('attach_tailored_resume', 'PDF резюме в форме', 46);
    else if (resumePdfPath && fs.existsSync(resumePdfPath)) {
      logLine(
        '[hh-apply-chat] PDF не загружен (нет поля) — использовано резюме из профиля или выберите вручную.'
      );
    }
    if (formResult.profileResume) {
      logLine(`[hh-apply-chat] Резюме в форме: ${formResult.profileResume}`);
    }

    const letterFilledInForm = Boolean(formResult.letterInForm);
    if (letter && !letterFilledInForm) {
      logLine('[hh-apply-chat] Поле письма в форме не найдено — письмо уйдёт в чат после отклика.');
    } else if (letterFilledInForm) {
      step('fill_letter', 'Сопроводительное в форме', 52);
    }

    logLine(`[hh-apply-chat] Отправка отклика: ${formResult.label}`);
    step('submit_response', 'Отклик отправлен', 72);
    let responseSubmitted = true;
    page = (await waitForActivePage(ctx, page, 5000)) || page;
    await betweenMajorSteps(page).catch(() => {});

    if (dryRun) {
      logLine('[hh-apply-chat] --dry-run: чат не открывался.');
      step('done_dry_run', 'Готово (dry-run)', 100);
      if (stayOpen) await waitEnter('Enter — закрыть браузер: ');
      return;
    }

    let chatStepOk = false;
    const chatCtx = {
      vacancyId,
      vacancyTitle: rec.title,
      company: rec.company,
      context: ctx,
      log: logLine,
    };

    if (letter && letterFilledInForm) {
      logLine('[hh-apply-chat] Сопроводительное уже в форме отклика — чат не открываем.');
      chatStepOk = true;
      step('send_chat_skipped_form', 'Письмо в форме отклика', 92);
    }

    try {
      if (!chatStepOk && letter) {
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
        logLine(`[hh-apply-chat] Готово: письмо в чате (${chatMethod || 'ok'}).`);
        step('send_chat_done', 'Письмо в чате', 95);
        chatStepOk = true;
      }
    } catch (e) {
      const msg = String(e?.message || e);
      if (
        letter &&
        !chatStepOk &&
        (/Не удалось вставить письмо в чат|locator\.waitFor: Timeout/i.test(msg) ||
          /Не удалось открыть чат/i.test(msg))
      ) {
        logLine(
          '[hh-apply-chat] Чат недоступен. Отклик отправлен — письмо в чат вручную при необходимости.'
        );
        logLine(`[hh-apply-chat] Детали: ${msg.slice(0, 400)}`);
        step('send_chat_manual_required', 'Отклик OK, чат вручную', 90);
      } else if (
        responseSubmitted &&
        (/has been closed/i.test(msg) || /Страница закрыта/i.test(msg))
      ) {
        logLine('[hh-apply-chat] После отклика вкладка закрылась — чат не открыт автоматически.');
        step('chat_skipped_after_submit', 'Отклик отправлен', 88);
      } else if (!chatStepOk) {
        throw e;
      }
    }

    if (responseSubmitted) {
      updateVacancyRecord(rec.id, {
        hhApply: {
          lastAt: new Date().toISOString(),
          responseSubmitted: true,
          letterInForm: letterFilledInForm,
          chatSent: chatStepOk,
          letterDelivered: letterFilledInForm || chatStepOk,
        },
      });
      if (letter && !letterFilledInForm && !chatStepOk) {
        logLine('[hh-apply-chat] ВНИМАНИЕ: отклик без сопроводительного (форма и чат).');
      }
    }

    progress.done('Отклик отправлен');
    logLine('[hh-apply-chat] SUCCESS: отклик отправлен (exit 0).');

    if (stayOpen) {
      await waitEnter('Enter — закрыть браузер: ');
    }
  } catch (e) {
    progress.error(e?.message || e);
    appendApplyChatLog(`Error: ${e?.message || e}\n`);
    await saveErrorScreenshot(page, e);
    throw e;
  } finally {
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

main().catch((e) => {
  appendApplyChatLog(`Error: ${e?.message || e}\n`);
  console.error(e);
  process.exit(1);
});
