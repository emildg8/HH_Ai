/**
 * Сбор вакансий по ключам (как у vacancies) → парсинг → фильтры → оценка LLM (OpenRouter, при лимите — HH_CUSTOM_LLM_*) → data/vacancies-queue.json для дашборда.
 * Открытие множества вкладок — только npm run vacancies; для очереди+оценки используйте эту команду.
 *
 * Перед запуском: npm run login, в secrets — OpenRouter_API_KEY.
 * Флаги: --skip-llm | --skip-gemini — без вызова LLM (score=0).
 * Лимиты: до 1000 записей за запуск (HH_SESSION_LIMIT / HH_MAX_TOTAL, HH_PER_KEYWORD_LIMIT).
 * Период выдачи hh.ru: HH_SEARCH_PERIOD (7 = неделя, 0 = за всё время — без search_period).
 * Отдельный файл очереди: HH_VACANCIES_QUEUE_FILE (например data/vacancies-queue-week.json).
 * Квота LLM: HH_LLM_MAX_PER_RUN — макс. вызовов OpenRouter за запуск (по умолчанию 30; дальше — без оценки).
 * Лимиты одного прогона (перебивают .env): --session-limit=N, --per-keyword-limit=N
 * Дашборд: каждые HH_DASHBOARD_TICK_EVERY (20) новых записей — сигнал в data/harvest-dashboard-tick.json для обновления UI.
 * Подсказка анкеты по тексту описания: HH_HARVEST_QUESTIONNAIRE_HINT=0 — отключить.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadEnv } from '../lib/load-env.mjs';
import { loadSearchKeywords } from '../lib/load-keywords.mjs';
import {
  sessionProfilePath,
  ROOT,
  SKIPPED_FILE,
  DATA_DIR,
  HARVEST_DASHBOARD_TICK_FILE,
} from '../lib/paths.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { parseHarvestPeriodDays, harvestPeriodLabel } from '../lib/hh-search-period.mjs';
import {
  launchPersistentContextSafe,
  closeContextSafe,
  clearStaleBrowserLock,
  formatBrowserLaunchError,
} from '../lib/chromium-session.mjs';
import { createHarvestProgressTracker, writeHarvestError } from '../lib/job-progress.mjs';
import {
  initHarvestControl,
  waitAtHarvestBoundary,
  shouldStopHarvest,
  finishHarvestControl,
} from '../lib/harvest-control.mjs';
import { ensureNoCaptchaBlocking } from '../lib/hh-captcha-wait.mjs';

const BROWSER_OWNER = 'harvest';
import { parseVacancyPage, vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { runHardFilters, runTitleOnlyFilters } from '../lib/filters.mjs';
import { collectVacancyCardsFromSearch } from '../lib/harvest-serp.mjs';
import { detectQuestionnaireHintFromVacancyText } from '../lib/harvest-questionnaire-hint.mjs';
import { buildHhSearchUrl, describeHhSearchUrlPolicy } from '../lib/hh-search.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import {
  createLlmRoutingContext,
  getOpenRouterApiKey,
  hasScoreProviderCredentials,
  isCustomLlmRunnable,
  resolveMaxOpenRouterCallsPerRun,
  scoreVacancyWithLlm,
} from '../lib/openrouter-score.mjs';
import { addVacancyRecord, knownVacancyIds } from '../lib/store.mjs';
import { scoreVacancyLocally, resolveScoreMode } from '../lib/local-vacancy-score.mjs';

loadEnv();
/** CLI после loadEnv: переопределяет .env для одного запуска (иначе override в load-env перебивает shell). */
for (const a of process.argv) {
  const mLimit = /^--session-limit=(\d+)$/.exec(a);
  if (mLimit) process.env.HH_SESSION_LIMIT = mLimit[1];
  const mPerKey = /^--per-keyword-limit=(\d+)$/.exec(a);
  if (mPerKey) process.env.HH_PER_KEYWORD_LIMIT = mPerKey[1];
}

const DEFAULT_KEYWORDS_FILE = path.join(ROOT, 'config', 'search-keywords.txt');

/** По умолчанию headless: headed Chromium на Windows часто падает сразу после launch. */
const headless = process.env.HH_HEADLESS !== '0';
const skipLlm =
  process.argv.includes('--skip-llm') || process.argv.includes('--skip-gemini');
const skipQuestionnaireHarvestHint = String(process.env.HH_HARVEST_QUESTIONNAIRE_HINT || '').trim() === '0';

/** Максимум новых записей за один запуск harvest (см. HH_SESSION_LIMIT / HH_PER_KEYWORD_LIMIT). */
const MAX_RECORDS_PER_HARVEST = 1000;

const perKeyLimit = Math.min(
  MAX_RECORDS_PER_HARVEST,
  Math.max(1, Number(process.env.HH_PER_KEYWORD_LIMIT || MAX_RECORDS_PER_HARVEST) || MAX_RECORDS_PER_HARVEST)
);
const sessionLimitRaw =
  process.env.HH_SESSION_LIMIT ?? process.env.HH_MAX_TOTAL ?? String(MAX_RECORDS_PER_HARVEST);
const sessionLimit = Math.min(
  MAX_RECORDS_PER_HARVEST,
  Math.max(1, Number(sessionLimitRaw) || MAX_RECORDS_PER_HARVEST)
);

/** Вызовов OpenRouter за один harvest; 0 = не звать LLM (как --skip-llm по квоте). */
const DEFAULT_LLM_CALLS_PER_RUN = 30;
const rawLlmMax = process.env.HH_LLM_MAX_PER_RUN;
const llmMaxPerRun =
  rawLlmMax === undefined || String(rawLlmMax).trim() === ''
    ? DEFAULT_LLM_CALLS_PER_RUN
    : Math.max(0, Number(rawLlmMax) || 0);

const openDelayMin = Math.max(0, Number(process.env.HH_OPEN_DELAY_MIN_MS || 3000) || 3000);
const openDelayMax = Math.max(openDelayMin, Number(process.env.HH_OPEN_DELAY_MAX_MS || 5000) || 5000);
const searchJitterMin = Math.max(0, Number(process.env.HH_SEARCH_JITTER_MIN_MS || 1000) || 1000);
const searchJitterMax = Math.max(searchJitterMin, Number(process.env.HH_SEARCH_JITTER_MAX_MS || 2000) || 2000);

const keywordsPath = path.resolve(
  process.cwd(),
  (process.env.HH_KEYWORDS_FILE || '').trim() || DEFAULT_KEYWORDS_FILE
);

function randomIntInclusive(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function looksLikeLoginUrl(url) {
  const u = url.toLowerCase();
  return u.includes('/account/login') || u.includes('oauth.hh.ru') || u.includes('/logon');
}

function logSkipped(payload) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(SKIPPED_FILE, `${JSON.stringify({ ...payload, at: new Date().toISOString() })}\n`, 'utf8');
}

const DASH_TICK_EVERY = Math.max(1, Number(process.env.HH_DASHBOARD_TICK_EVERY || 20) || 20);
let dashboardTickSeq = 0;

function writeDashboardHarvestTick(addedThisRun) {
  dashboardTickSeq++;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    HARVEST_DASHBOARD_TICK_FILE,
    `${JSON.stringify({
      sequence: dashboardTickSeq,
      addedThisRun,
      at: new Date().toISOString(),
      every: DASH_TICK_EVERY,
    })}\n`,
    'utf8'
  );
  console.log(`  [дашборд] сигнал обновления #${dashboardTickSeq} (+${addedThisRun} новых за прогон к этому моменту)`);
}

async function main() {
  const progress = createHarvestProgressTracker();
  initHarvestControl();
  progress.starting();
  const prefs = loadPreferences();

  const needsLlmCredentials = !skipLlm && llmMaxPerRun > 0;
  if (needsLlmCredentials && !hasScoreProviderCredentials()) {
    console.error(
      'Нужен канал оценки: OpenRouter_API_KEY либо свой LLM (HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL). См. config/secrets.example.env и config/OPENROUTER.md'
    );
    console.error('Либо: npm run harvest -- --skip-llm  |  HH_LLM_MAX_PER_RUN=0');
    process.exit(1);
  }

  if (!fs.existsSync(keywordsPath)) {
    console.error('Файл ключей не найден:', keywordsPath);
    process.exit(1);
  }

  const keywords = loadSearchKeywords(keywordsPath);
  if (!keywords.length) {
    console.error('Нет ключей в', keywordsPath);
    process.exit(1);
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    console.error('Нет профиля Chromium. Сначала: npm run login');
    process.exit(1);
  }

  const cvBundle = await loadCvBundle();
  for (const w of cvBundle.warnings) console.warn('[CV]', w);
  if (!cvBundle.text.trim()) {
    console.error('Нет текста CV — положите .pdf или .txt в папку CV/');
    process.exit(1);
  }

  const periodDays = parseHarvestPeriodDays(process.env.HH_SEARCH_PERIOD);
  console.log(`[harvest] Период на hh.ru: ${harvestPeriodLabel(periodDays)}`);
  console.log(`[harvest] Поиск: ${describeHhSearchUrlPolicy(prefs)}`);

  let ctx;
  try {
    ctx = await launchPersistentContextSafe(
      profile,
      {
        headless,
        viewport: { width: 1280, height: 800 },
        locale: 'ru-RU',
      },
      { owner: BROWSER_OWNER }
    );
  } catch (e) {
    throw new Error(formatBrowserLaunchError(e));
  }
  const page = ctx.pages()[0] || (await ctx.newPage());

  try {
    await page.goto('https://hh.ru/applicant', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1500);
    await ensureNoCaptchaBlocking(page, { context: 'личный кабинет (harvest)' });
    if (looksLikeLoginUrl(page.url())) {
      console.error('Сессия не активна. Выполните: npm run login');
      process.exit(1);
    }

    const seenIds = knownVacancyIds();
    const urls = [];
    const globalSeen = new Set();
    const keywordsTotal = keywords.length;
    let keywordIndex = 0;
    const serp = {
      cards: 0,
      skippedKnown: 0,
      skippedTitle: 0,
      emptyKeywords: 0,
    };

    const serpStatsPayload = (extra = {}) => ({
      knownIds: seenIds.size,
      serpCards: serp.cards,
      skippedKnown: serp.skippedKnown,
      skippedTitle: serp.skippedTitle,
      emptyKeywords: serp.emptyKeywords,
      ...extra,
    });

    progress.collecting(0, keywordsTotal, { urlsFound: 0, ...serpStatsPayload() });

    for (const key of keywords) {
      if ((await waitAtHarvestBoundary(() => progress.paused('Пауза — сбор ссылок'))) === 'stop') {
        console.log('[harvest] Остановка по запросу дашборда (сбор ссылок).');
        progress.done({ added: 0, stopped: true });
        return;
      }
      if (urls.length >= sessionLimit) break;
      keywordIndex++;
      progress.collecting(keywordIndex, keywordsTotal, {
        urlsFound: urls.length,
        currentKeyword: key,
      });
      await page.goto(buildHhSearchUrl(key, prefs, periodDays), {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await ensureNoCaptchaBlocking(page, { context: 'поиск (harvest)' });
      await sleepMs(randomIntInclusive(searchJitterMin, searchJitterMax));
      const found = await collectVacancyCardsFromSearch(page);
      if (!found.length) {
        const hint = await page
          .evaluate(() => {
            const t = document.body?.innerText || '';
            if (/ничего не найдено/i.test(t)) return 'ничего не найдено';
            if (/captcha|подтвердите/i.test(t)) return 'капча/проверка';
            return '';
          })
          .catch(() => '');
        if (hint === 'ничего не найдено') serp.emptyKeywords++;
        if (hint) console.warn(`  [harvest] пустая выдача (${hint}) для «${key}»`);
      }
      let n = 0;
      for (const card of found) {
        if (urls.length >= sessionLimit) break;
        if (n >= perKeyLimit) break;
        const id = vacancyIdFromUrl(card.url);
        if (!id) continue;
        serp.cards++;
        if (globalSeen.has(id) || seenIds.has(id)) {
          serp.skippedKnown++;
          continue;
        }
        const titleFilter = runTitleOnlyFilters(card.title, prefs);
        if (!titleFilter.pass) {
          serp.skippedTitle++;
          logSkipped({
            vacancyId: id,
            url: card.url,
            query: key,
            stage: titleFilter.stage,
            reason: titleFilter.reason,
            title: card.title,
          });
          continue;
        }
        globalSeen.add(id);
        urls.push({ url: card.url, query: key, serpTitle: card.title });
        n++;
      }
      const skipNote = serp.skippedTitle ? `, отсечено по заголовку ${serp.skippedTitle}` : '';
      console.log(`Ключ «${key}»: +${n} URL (в очереди на обход ${urls.length}${skipNote})`);
      progress.collecting(keywordIndex, keywordsTotal, {
        urlsFound: urls.length,
        currentKeyword: key,
        ...serpStatsPayload({ newToProcess: urls.length }),
      });
    }

    if (!urls.length) {
      const message =
        serp.cards > 0 && serp.skippedKnown > 0
          ? `Нет новых: на выдаче ${serp.cards}, уже в очереди ${serp.skippedKnown}`
          : serp.cards === 0 && serp.emptyKeywords > 0
            ? 'Пустая выдача по ключам (проверьте фильтры/период)'
            : 'Нет новых ссылок';
      console.log(
        `${message}${serp.skippedTitle ? `, отсечено по заголовку ${serp.skippedTitle}` : ''} (известно ID: ${seenIds.size}).`
      );
      progress.done({ added: 0, message, ...serpStatsPayload() });
      return;
    }

    if (!skipLlm && llmMaxPerRun > 0) {
      console.log(
        `LLM: не более ${llmMaxPerRun} оценок за этот запуск (остальные записи без LLM — HH_LLM_MAX_PER_RUN).`
      );
    } else if (!skipLlm && llmMaxPerRun === 0) {
      console.log('LLM: вызовы отключены (HH_LLM_MAX_PER_RUN=0).');
    }
    if (!skipLlm && llmMaxPerRun > 0 && isCustomLlmRunnable()) {
      const n = resolveMaxOpenRouterCallsPerRun();
      if (n === 0) {
        console.log(
          'Маршрут оценки: только HH_CUSTOM_LLM_* (OpenRouter не вызывается при пустом HH_OPENROUTER_MAX_CALLS_PER_RUN или =0).'
        );
      } else if (getOpenRouterApiKey()) {
        const cap = n === Number.POSITIVE_INFINITY ? '∞' : String(n);
        console.log(
          `Маршрут оценки: сначала OpenRouter (до ${cap} успешных вызовов), затем внутренний LLM (HH_OPENROUTER_MAX_CALLS_PER_RUN).`
        );
      }
    }

    const llmRouting = createLlmRoutingContext();
    const scoreMode = resolveScoreMode();
    if (scoreMode === 'local') {
      console.log('Оценка: только локальная (HH_SCORE_MODE=local), без OpenRouter.');
    } else if (scoreMode === 'local-first') {
      console.log(
        `Оценка: до ${llmMaxPerRun} вызовов LLM, остальное — локальная эвристика (HH_SCORE_MODE=local-first).`
      );
    }
    let added = 0;
    let skipped = 0;
    let llmCallsDone = 0;
    let llmQuotaNoteShown = false;
    let newRecordsSinceDashboardTick = 0;
    const scoringStartedAt = Date.now();
    const urlsTotal = urls.length;
    progress.scoring(0, urlsTotal, { added: 0, skipped: 0 }, scoringStartedAt);

    for (let i = 0; i < urls.length; i++) {
      if (
        (await waitAtHarvestBoundary(() =>
          progress.paused(`Пауза — обработка ${i + 1}/${urls.length}`)
        )) === 'stop'
      ) {
        console.log('[harvest] Остановка по запросу дашборда.');
        if (newRecordsSinceDashboardTick > 0) writeDashboardHarvestTick(added);
        progress.done({ added, skipped, urlsTotal, stopped: true });
        return;
      }
      if (i > 0) {
        const pause = randomIntInclusive(openDelayMin, openDelayMax);
        console.log(`Пауза ${pause} мс…`);
        await sleepMs(pause);
      }

      const { url, query, serpTitle } = urls[i];
      const vacancyId = vacancyIdFromUrl(url);
      progress.scoring(
        i + 1,
        urlsTotal,
        { added, skipped, llmCallsDone },
        scoringStartedAt
      );
      console.log(`Парсинг ${i + 1}/${urls.length}`, url);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await ensureNoCaptchaBlocking(page, { context: 'вакансия (harvest)' });
      const parsed = await parseVacancyPage(page);
      if (serpTitle && !parsed.title) parsed.title = serpTitle;

      const filter = runHardFilters(parsed, prefs);
      if (!filter.pass) {
        console.log(`  SKIP [${filter.stage}]: ${filter.reason}`);
        logSkipped({
          vacancyId,
          url,
          query,
          stage: filter.stage,
          reason: filter.reason,
          title: parsed.title,
        });
        skipped++;
        continue;
      }

      const localMin = Math.max(0, Number(process.env.HH_LOCAL_SCORE_MIN) || 0);
      const vacancyPayloadEarly = {
        title: parsed.title,
        company: parsed.company,
        salaryRaw: parsed.salaryRaw,
        description: parsed.description,
        url,
      };
      if (localMin > 0) {
        const preview = scoreVacancyLocally(vacancyPayloadEarly, cvBundle);
        if (preview.scoreOverall < localMin) {
          console.log(`  SKIP [localScore]: итог ${preview.scoreOverall} < ${localMin}`);
          logSkipped({
            vacancyId,
            url,
            query,
            stage: 'localScore',
            reason: `Локальная оценка ${preview.scoreOverall} ниже порога ${localMin}`,
            title: parsed.title,
          });
          skipped++;
          continue;
        }
      }

      let llm = {
        score: 0,
        scoreVacancy: 0,
        scoreCvMatch: 0,
        scoreOverall: 0,
        summary: skipLlm ? '(LLM отключён — npm run harvest -- --skip-llm)' : '',
        risks: '',
        matchCv: 'unknown',
        tags: [],
        providerModel: null,
      };

      const vacancyPayload = {
        title: parsed.title,
        company: parsed.company,
        salaryRaw: parsed.salaryRaw,
        description: parsed.description,
        url,
      };
      const canSpendLlmQuota =
        !skipLlm && scoreMode !== 'local' && llmCallsDone < llmMaxPerRun;

      if (scoreMode === 'local' || skipLlm) {
        llm = scoreVacancyLocally(vacancyPayload, cvBundle);
        console.log(
          `  Локальная оценка: итог ${llm.scoreOverall} (вакансия ${llm.scoreVacancy}, CV ${llm.scoreCvMatch})`
        );
      } else if (!canSpendLlmQuota) {
        if (!llmQuotaNoteShown) {
          console.log(`  LLM-лимит (${llmMaxPerRun}) — дальше локальная оценка.`);
          llmQuotaNoteShown = true;
        }
        llm = scoreVacancyLocally(vacancyPayload, cvBundle);
        console.log(`  Локальная оценка: итог ${llm.scoreOverall}`);
      } else {
        try {
          llm = await scoreVacancyWithLlm(vacancyPayload, cvBundle, prefs, llmRouting);
          llmCallsDone++;
          const src = llm.llmSource === 'custom' ? 'внутренний LLM' : 'OpenRouter';
          console.log(
            `  ${src}: итог ${llm.scoreOverall} (вакансия ${llm.scoreVacancy}, CV ${llm.scoreCvMatch}) — ${llm.providerModel || '?'}`
          );
        } catch (e) {
          console.error('  LLM error:', e.message, '→ локальная оценка');
          llm = scoreVacancyLocally(vacancyPayload, cvBundle);
          console.log(`  Локальная оценка: итог ${llm.scoreOverall}`);
        }
      }

      const qTextHint = skipQuestionnaireHarvestHint
        ? { likely: false, reasons: [] }
        : detectQuestionnaireHintFromVacancyText(parsed);

      const record = {
        id: crypto.randomUUID(),
        vacancyId,
        url,
        searchQuery: query,
        title: parsed.title,
        company: parsed.company,
        salaryRaw: parsed.salaryRaw,
        salaryEstimate: filter.salaryEstimate,
        remoteNote: filter.workFormatNote || filter.remoteReason,
        workFormat: filter.workFormat,
        salaryNote: filter.salaryReason,
        descriptionPreview: parsed.description.slice(0, 600),
        descriptionForLlm: parsed.description.slice(0, 6000),
        llmProvider:
          llm.llmSource === 'local'
            ? 'local-heuristic'
            : llm.llmSource === 'custom'
              ? 'openai-compatible'
              : 'openrouter',
        openRouterModel: llm.providerModel || null,
        scoreVacancy: llm.scoreVacancy,
        scoreCvMatch: llm.scoreCvMatch,
        scoreOverall: llm.scoreOverall,
        geminiScore: llm.scoreOverall ?? llm.score,
        geminiSummary: llm.summary,
        geminiRisks: llm.risks,
        geminiMatchCv: llm.matchCv,
        geminiTags: qTextHint.likely
          ? [...(Array.isArray(llm.tags) ? llm.tags : []), 'анкета?']
          : llm.tags,
        status: 'pending',
        feedbackReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: null,
        ...(qTextHint.likely
          ? {
              hhApply: {
                questionnaire: {
                  likelyFromVacancyText: true,
                  likelyReasons: qTextHint.reasons,
                  likelyDetectedAt: new Date().toISOString(),
                  needsProbe: true,
                  questions: [],
                },
              },
            }
          : {}),
      };

      if (qTextHint.likely) {
        console.log(
          `  [анкета] по тексту описания (эвристика): ${qTextHint.reasons.slice(0, 4).join('; ')}`
        );
      }

      if (addVacancyRecord(record)) {
        added++;
        newRecordsSinceDashboardTick++;
        console.log('  → В очередь дашборда');
        if (newRecordsSinceDashboardTick >= DASH_TICK_EVERY) {
          newRecordsSinceDashboardTick = 0;
          writeDashboardHarvestTick(added);
        }
      } else {
        console.log('  → Уже была в очереди, пропуск');
      }
    }

    if (newRecordsSinceDashboardTick > 0) {
      writeDashboardHarvestTick(added);
    }

    progress.done({
      added,
      skipped,
      urlsTotal,
      message: `Добавлено ${added}`,
      ...serpStatsPayload({ newToProcess: urlsTotal }),
    });
    console.log(`\nГотово. Новых записей в очереди: ${added}. Запустите: npm run dashboard`);
    try {
      const { notifyHarvestComplete } = await import('../lib/harvest-notify.mjs');
      const tg = await notifyHarvestComplete({ added, skipped, urlsTotal });
      if (tg?.ok) console.log('[harvest] Telegram: уведомление отправлено');
    } catch (e) {
      console.warn('[harvest] Telegram:', e.message || e);
    }
  } finally {
    await closeContextSafe(ctx, BROWSER_OWNER);
    finishHarvestControl({ reason: shouldStopHarvest() ? 'stop' : 'complete' });
  }
}

main().catch((e) => {
  finishHarvestControl({ reason: 'stop' });
  writeHarvestError(e?.message || e);
  console.error(e);
  process.exit(1);
});
