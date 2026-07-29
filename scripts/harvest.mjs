/**
 * Сбор вакансий по ключам (как у vacancies) → парсинг → фильтры → оценка LLM (OpenRouter, при лимите — HH_CUSTOM_LLM_*) → data/vacancies-queue.json для дашборда.
 * Открытие множества вкладок — только npm run vacancies; для очереди+оценки используйте эту команду.
 *
 * Перед запуском: npm run login, в secrets — OpenRouter_API_KEY.
 * Флаги: --skip-llm | --skip-gemini — без вызова LLM (score=0).
 * Лимиты: до 1000 записей за запуск (HH_SESSION_LIMIT / HH_PER_KEYWORD_LIMIT; 0 = без лимита).
 * Выдача: HH_SEARCH_ITEMS_ON_PAGE (20|50|100), HH_SEARCH_SERP_MAX_PAGES (0 = все страницы).
 * Период выдачи hh.ru: HH_SEARCH_PERIOD (7 = неделя, 0 = за всё время — без search_period); CLI: --search-period=30
 * Отдельный файл очереди: HH_VACANCIES_QUEUE_FILE (например data/vacancies-queue-week.json).
 * Квота LLM: HH_LLM_MAX_PER_RUN — макс. вызовов OpenRouter за запуск (по умолчанию 30; дальше — без оценки).
 * Лимиты одного прогона (перебивают .env): --session-limit=N, --per-keyword-limit=N, --keywords-file=path
 * Дашборд: каждые HH_DASHBOARD_TICK_EVERY (20) новых записей — сигнал в data/harvest-dashboard-tick.json для обновления UI.
 * Подсказка анкеты по тексту описания: HH_HARVEST_QUESTIONNAIRE_HINT=0 — отключить.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadEnv } from '../lib/load-env.mjs';
import { loadProfile } from '../lib/load-profile.mjs';
import { loadSearchKeywords } from '../lib/load-keywords.mjs';
import { expandKeywordsWithInventoryLoader } from '../lib/harvest-keywords-inventory.mjs';
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
  bringBrowserToFront,
  waitForActivePage,
  tuckBrowserAway,
  waitForProfileChromiumExit,
  repairChromiumProfileCaches,
} from '../lib/chromium-session.mjs';
import { ensureDataDir } from '../lib/ensure-data-dir.mjs';
import { isGamingModeActive } from '../lib/gaming-mode-env.mjs';
import {
  saveHarvestScoringCheckpoint,
  clearHarvestScoringCheckpoint,
  resolveHarvestScoringResume,
} from '../lib/harvest-checkpoint.mjs';
import { createHarvestProgressTracker, writeHarvestError, readJobProgress, HARVEST_PROGRESS_FILE } from '../lib/job-progress.mjs';
import {
  initHarvestControl,
  waitAtHarvestBoundary,
  shouldStopHarvest,
  finishHarvestControl,
} from '../lib/harvest-control.mjs';
import { ensureNoCaptchaBlocking, registerCaptchaVisibleEscalation, unregisterCaptchaVisibleEscalation } from '../lib/hh-captcha-wait.mjs';
import { escalateHeadlessToVisibleBrowser } from '../lib/hh-captcha-escalate.mjs';
import { resolvePlaywrightDisplay, playwrightDisplayEnv } from '../lib/playwright-display-mode.mjs';

const BROWSER_OWNER = 'harvest';
import { parseVacancyPage, vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { runHardFilters, runTitleOnlyFilters } from '../lib/filters.mjs';
import { collectVacancyCardsFromSearch, hasSerpNextPage } from '../lib/harvest-serp.mjs';
import { detectQuestionnaireHintFromVacancyText } from '../lib/harvest-questionnaire-hint.mjs';
import { buildHhSearchUrl, describeHhSearchUrlPolicy, resolveHhSearchItemsOnPage, resolveHhSearchSerpMaxPages } from '../lib/hh-search.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import {
  createLlmRoutingContext,
  getOpenRouterApiKey,
  hasScoreProviderCredentials,
  isCustomLlmRunnable,
  resolveMaxOpenRouterCallsPerRun,
  scoreVacancyForHarvest,
} from '../lib/openrouter-score.mjs';
import { shouldUseLlmForHarvest } from '../lib/harvest-llm-gate.mjs';
import {
  resolveHarvestScoreRoute,
  spendLlmBudget,
  appendLlmMetric,
  getLlmBudgetStatus,
} from '../lib/llm-budget.mjs';
import { loadRecentSkippedVacancyIds } from '../lib/harvest-skip-ledger.mjs';
import {
  saveHarvestUrlCache,
  loadHarvestUrlCacheIfReuse,
} from '../lib/harvest-url-cache.mjs';
import { addVacancyRecord, knownVacancyIds, loadQueue, flushQueueSave } from '../lib/store.mjs';
import { scoreSource } from '../lib/source-quality.mjs';
import { scoreVacancyLocally, resolveScoreMode } from '../lib/local-vacancy-score.mjs';

loadEnv();
loadProfile();
// Защита очереди при любом входе в harvest (Emil/QA): меньше truncate+Cursor OOM.
if (!String(process.env.HH_QUEUE_SNAPSHOT || '').trim()) {
  process.env.HH_QUEUE_SNAPSHOT = '0';
}
if (!String(process.env.HH_QUEUE_SAVE_EVERY || '').trim()) {
  process.env.HH_QUEUE_SAVE_EVERY = '10';
}
/** CLI после loadProfile — иначе loadEnv внутри профиля затирает --session-limit / --per-keyword-limit */
for (const a of process.argv) {
  const mLimit = /^--session-limit=(\d+)$/.exec(a);
  if (mLimit) process.env.HH_SESSION_LIMIT = mLimit[1];
  const mPerKey = /^--per-keyword-limit=(\d+)$/.exec(a);
  if (mPerKey) process.env.HH_PER_KEYWORD_LIMIT = mPerKey[1];
  const mKeywords = /^--keywords-file=(.+)$/.exec(a);
  if (mKeywords) {
    process.env.HH_KEYWORDS_FILE = mKeywords[1].trim();
    process.env.HH_HARVEST_INVENTORY_KEYWORDS = '0';
  }
  const mPeriod = /^--search-period=(\d+)$/.exec(a);
  if (mPeriod) process.env.HH_SEARCH_PERIOD = mPeriod[1];
}

const DEFAULT_KEYWORDS_FILE = path.join(ROOT, 'config', 'search-keywords.txt');

const skipLlm =
  process.argv.includes('--skip-llm') || process.argv.includes('--skip-gemini');
const skipQuestionnaireHarvestHint = String(process.env.HH_HARVEST_QUESTIONNAIRE_HINT || '').trim() === '0';

/** CLI после loadEnv: переопределяет .env для одного запуска (иначе override в load-env перебивает shell). */
function harvestSkipVacancyIds() {
  const raw = String(process.env.HH_HARVEST_SKIP_VACANCY_IDS || '').trim();
  return new Set(raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean));
}

/** Максимум новых записей за один запуск harvest (см. HH_SESSION_LIMIT / HH_PER_KEYWORD_LIMIT). */
const MAX_RECORDS_PER_HARVEST = 1000;

function parseHarvestLimit(raw, fallback) {
  const s = String(raw ?? '').trim();
  if (s === '0' || s === 'unlimited' || s === 'all') return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const perKeyLimit = parseHarvestLimit(process.env.HH_PER_KEYWORD_LIMIT, MAX_RECORDS_PER_HARVEST);
const sessionLimitRaw =
  process.env.HH_SESSION_LIMIT ?? process.env.HH_MAX_TOTAL ?? String(MAX_RECORDS_PER_HARVEST);
const sessionLimit = parseHarvestLimit(sessionLimitRaw, MAX_RECORDS_PER_HARVEST);

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
  ensureDataDir(DATA_DIR);
  fs.appendFileSync(SKIPPED_FILE, `${JSON.stringify({ ...payload, at: new Date().toISOString() })}\n`, 'utf8');
}

const DASH_TICK_EVERY = Math.max(1, Number(process.env.HH_DASHBOARD_TICK_EVERY || 20) || 20);
let dashboardTickSeq = 0;

function writeDashboardHarvestTick(addedThisRun) {
  dashboardTickSeq++;
  ensureDataDir(DATA_DIR);
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

  let keywords = loadSearchKeywords(keywordsPath);
  if (!keywords.length) {
    console.error('Нет ключей в', keywordsPath);
    process.exit(1);
  }

  if (String(process.env.HH_HARVEST_INVENTORY_KEYWORDS || '').trim() === '1') {
    const maxExtra = Math.max(0, Number(process.env.HH_HARVEST_INVENTORY_KEYWORDS_MAX || 40) || 40);
    const before = keywords.length;
    keywords = expandKeywordsWithInventoryLoader(keywords, { maxExtra });
    console.log(
      `[harvest] Ключи из inventory: +${keywords.length - before} (всего ${keywords.length}, лимит +${maxExtra})`
    );
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
  const serpItemsOnPage = resolveHhSearchItemsOnPage();
  const serpMaxPages = resolveHhSearchSerpMaxPages();
  const serpPageNote =
    serpItemsOnPage > 0 ? `${serpItemsOnPage} на страницу` : 'размер страницы — как в сессии hh';
  const serpPagesNote = serpMaxPages > 0 ? `до ${serpMaxPages} стр./ключ` : 'все страницы выдачи';
  console.log(`[harvest] Выдача: ${serpPageNote}, ${serpPagesNote}`);
  if (perKeyLimit > 0) {
    console.log(`[harvest] Лимит URL на ключ: ${perKeyLimit}`);
  } else {
    console.log('[harvest] Лимит URL на ключ: без ограничения');
  }
  if (sessionLimit > 0) {
    console.log(`[harvest] Лимит URL за прогон: ${sessionLimit}`);
  } else {
    console.log('[harvest] Лимит URL за прогон: без ограничения');
  }

  const display = resolvePlaywrightDisplay('harvest', prefs);
  Object.assign(process.env, playwrightDisplayEnv('harvest', prefs));
  const headless = display.headless;
  console.log(`[harvest] Окно браузера: ${display.mode}${headless ? ' (headless)' : ''}`);

  let ctx;
  let page;

  function captchaOvernightEnabled() {
    return (
      String(process.env.HH_CAPTCHA_WAIT_FOREVER || process.env.HH_HARVEST_CAPTCHA_OVERNIGHT || '').trim() ===
      '1'
    );
  }

  /** После headless→visible эскалации капчи возвращается новая page; старая закрыта. */
  async function resolveCaptchaPage(activePage, contextLabel) {
    const { page: next } = await ensureNoCaptchaBlocking(activePage, {
      context: contextLabel,
      maxWaitMs: captchaOvernightEnabled() ? 3_600_000 : undefined,
    });
    await tuckBrowserAway(ctx);
    return next;
  }

  function registerHarvestCaptchaHandlers() {
    unregisterCaptchaVisibleEscalation();
    if (!display.captchaEscalate) return;
    if (headless) {
      let escalatedOnce = false;
      registerCaptchaVisibleEscalation(async (p) => {
        if (escalatedOnce) return p;
        escalatedOnce = true;
        const r = await escalateHeadlessToVisibleBrowser(p, ctx, {
          profile,
          owner: BROWSER_OWNER,
          log: (s) => console.log(s),
          launchBase: { viewport: { width: 1280, height: 800 }, locale: 'ru-RU' },
        });
        ctx = r.ctx;
        return r.page;
      });
    } else {
      registerCaptchaVisibleEscalation(async (p) => {
        if (!isGamingModeActive()) {
          console.log('[hh-captcha] Капча: разворачиваю окно Chromium…');
          await bringBrowserToFront(p.context());
        } else {
          console.log('[hh-captcha] Game mode: капча — окно в панели задач, не поднимаю поверх игры.');
        }
        return p;
      });
    }
  }

  async function launchHarvestContext() {
    ctx = await launchPersistentContextSafe(
      profile,
      {
        headless,
        viewport: { width: 1280, height: 800 },
        locale: 'ru-RU',
      },
      { owner: BROWSER_OWNER, skipMinimize: !display.browserBackground }
    );
    registerHarvestCaptchaHandlers();
    page = ctx.pages()[0] || (await ctx.newPage());
  }

  async function gotoApplicantHome() {
    let gotoErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await page.goto('https://hh.ru/applicant', { waitUntil: 'domcontentloaded', timeout: 90_000 });
        gotoErr = null;
        break;
      } catch (e) {
        gotoErr = e;
        if (attempt < 2) {
          console.warn('[harvest] hh.ru не ответил — повтор через 3 с…');
          await page.waitForTimeout(3000).catch(() => {});
        }
      }
    }
    if (gotoErr) {
      throw new Error(
        `${gotoErr.message || gotoErr}. Проверьте интернет/VPN и доступ к hh.ru, затем повторите поиск.`
      );
    }
    await page.waitForTimeout(1500).catch(() => {});
    page = await resolveCaptchaPage(page, 'личный кабинет (harvest)');
    if (looksLikeLoginUrl(page.url())) {
      throw new Error('Сессия не активна. Выполните: npm run login');
    }
  }

  async function relaunchHarvestContext(label = 'recovery') {
    console.log(`[harvest] Перезапуск Chromium (${label})…`);
    unregisterCaptchaVisibleEscalation();
    await closeContextSafe(ctx, BROWSER_OWNER);
    clearStaleBrowserLock();
    await waitForProfileChromiumExit(profile, 30_000, (s) => console.log(s));
    repairChromiumProfileCaches(profile);
    await launchHarvestContext();
    await gotoApplicantHome();
  }

  const maxBrowserRelaunches = Math.max(1, Number(process.env.HH_HARVEST_BROWSER_RELAUNCH_MAX || 5) || 5);
  let browserRelaunchCount = 0;

  async function recoverHarvestBrowser(contextLabel) {
    const alive = await waitForActivePage(ctx, page, 5000);
    if (alive) {
      page = alive;
      return true;
    }
    if (browserRelaunchCount >= maxBrowserRelaunches) {
      throw new Error('Chromium закрыт — исчерпаны попытки перезапуска браузера');
    }
    browserRelaunchCount++;
    await relaunchHarvestContext(contextLabel);
    return true;
  }

  try {
    await launchHarvestContext();
  } catch (e) {
    throw new Error(formatBrowserLaunchError(e));
  }

  if (!headless) {
    console.log('[harvest] Окно Chromium открыто — переход на hh.ru…');
  }

  try {
    await gotoApplicantHome();

    const seenIds = knownVacancyIds();
    const skipRecentDays = Math.max(
      1,
      Number(process.env.HH_HARVEST_SKIP_RECENT_DAYS || 7) || 7
    );
    const recentSkipped = loadRecentSkippedVacancyIds(skipRecentDays);
    for (const id of recentSkipped) seenIds.add(id);
    if (recentSkipped.size) {
      console.log(
        `[harvest] skip-ledger: ${recentSkipped.size} vacancyId за ${skipRecentDays} дн. (пропуск при сборе и разборе)`
      );
    }

    let urls = loadHarvestUrlCacheIfReuse();
    if (urls?.length) {
      console.log(
        `[harvest] Кэш URL: ${urls.length} ссылок (HH_HARVEST_REUSE_URLS=1), этап SERP пропущен`
      );
    } else {
      urls = [];
    }
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

    if (!urls.length) {
      for (const key of keywords) {
      if ((await waitAtHarvestBoundary(() => progress.paused('Пауза — сбор ссылок'))) === 'stop') {
        console.log('[harvest] Остановка по запросу дашборда (сбор ссылок).');
        progress.done({ added: 0, stopped: true });
        return;
      }
      if (urls.length >= sessionLimit && sessionLimit > 0) break;
      keywordIndex++;
      progress.collecting(keywordIndex, keywordsTotal, {
        urlsFound: urls.length,
        currentKeyword: key,
      });
      let keywordUrlCount = 0;
      let serpPage = 0;
      let serpExhausted = false;
      while (!serpExhausted) {
        if (sessionLimit > 0 && urls.length >= sessionLimit) break;
        if (perKeyLimit > 0 && keywordUrlCount >= perKeyLimit) break;
        if (serpMaxPages > 0 && serpPage >= serpMaxPages) break;

        const searchUrl = buildHhSearchUrl(key, prefs, periodDays, { page: serpPage });
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        page = await resolveCaptchaPage(page, 'поиск (harvest)');
        await sleepMs(randomIntInclusive(searchJitterMin, searchJitterMax));
        const found = await collectVacancyCardsFromSearch(page);
        if (!found.length) {
          if (serpPage === 0) {
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
          break;
        }
        let n = 0;
        for (const card of found) {
          if (sessionLimit > 0 && urls.length >= sessionLimit) break;
          if (perKeyLimit > 0 && keywordUrlCount >= perKeyLimit) break;
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
          keywordUrlCount++;
          n++;
        }
        const pageNote = serpPage > 0 ? `, стр. ${serpPage + 1}` : '';
        const skipNote = serp.skippedTitle ? `, отсечено по заголовку ${serp.skippedTitle}` : '';
        console.log(
          `Ключ «${key}»${pageNote}: +${n} URL (в очереди на обход ${urls.length}${skipNote})`
        );
        progress.collecting(keywordIndex, keywordsTotal, {
          urlsFound: urls.length,
          currentKeyword: key,
          ...serpStatsPayload({ newToProcess: urls.length }),
        });

        const hasNext = await hasSerpNextPage(page);
        const pageFull = serpItemsOnPage > 0 && found.length >= serpItemsOnPage;
        if (!hasNext && !pageFull) break;
        if (n === 0 && found.length > 0) break;
        serpPage++;
      }
    }
    }

    saveHarvestUrlCache(urls);

    if (serp.skippedTitle === 0 && urls.length > 500) {
      console.warn(
        `[harvest] ВНИМАНИЕ: urls=${urls.length}, skippedTitle=0 — похоже, фильтр заголовков не отсёк мусор. Проверьте instance/prefs/keywords.`
      );
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
      const budget = getLlmBudgetStatus();
      console.log(
        `LLM: до ${llmMaxPerRun} оценок за запуск; бюджет дня A=${budget.bucketA} B=${budget.bucketB} (gate tier-A-proxy + лестница).`
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
        `Оценка: gate tier-A-proxy, до ${llmMaxPerRun} LLM (лестница OR→local→heuristic), остальное — локально.`
      );
    }
    let added = 0;
    let skipped = 0;
    let llmCallsDone = 0;
    let llmQuotaNoteShown = false;
    let newRecordsSinceDashboardTick = 0;
    const scoringStartedAt = Date.now();
    const urlsTotal = urls.length;
    let loopStart = 0;
    const resume = resolveHarvestScoringResume(urlsTotal, urlsTotal);
    if (resume) {
      loopStart = resume.startIndex;
      added = resume.added;
      skipped = resume.skipped;
      llmCallsDone = resume.llmCallsDone;
      console.log(
        `[harvest] Checkpoint: продолжаем с ${loopStart + 1}/${urlsTotal} (added=${added}, skipped=${skipped})`
      );
      progress.scoring(loopStart, urlsTotal, { added, skipped, llmCallsDone }, scoringStartedAt);
    } else {
      progress.scoring(0, urlsTotal, { added: 0, skipped: 0 }, scoringStartedAt);
    }
    const skipVacancyIds = harvestSkipVacancyIds();
    const checkpointEvery = Math.max(1, Number(process.env.HH_HARVEST_CHECKPOINT_EVERY || 5) || 5);

    function saveScoringCheckpoint(index) {
      const nextIndex = index + 1;
      if (nextIndex % checkpointEvery !== 0 && nextIndex !== urlsTotal) return;
      saveHarvestScoringCheckpoint({
        urlIndex: nextIndex,
        urlsTotal,
        added,
        skipped,
        llmCallsDone,
        cacheCount: urlsTotal,
      });
    }

    for (let i = loopStart; i < urls.length; i++) {
      if (
        (await waitAtHarvestBoundary(() =>
          progress.paused(`Пауза — обработка ${i + 1}/${urls.length}`)
        )) === 'stop'
      ) {
        console.log('[harvest] Остановка по запросу дашборда.');
        if (newRecordsSinceDashboardTick > 0) writeDashboardHarvestTick(added);
        flushQueueSave();
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

      if (vacancyId && skipVacancyIds.has(vacancyId)) {
        console.log(`  SKIP [captcha-trap]: vacancy ${vacancyId} (HH_HARVEST_SKIP_VACANCY_IDS)`);
        skipped++;
        saveScoringCheckpoint(i);
        continue;
      }

      if (vacancyId && recentSkipped.has(vacancyId)) {
        console.log(`  SKIP [skip-ledger]: vacancy ${vacancyId} (недавно отсечён)`);
        skipped++;
        saveScoringCheckpoint(i);
        continue;
      }

      try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      page = await resolveCaptchaPage(page, 'вакансия (harvest)');
      if (page.isClosed()) {
        page = ctx.pages().find((p) => !p.isClosed()) || (await ctx.newPage());
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        page = await resolveCaptchaPage(page, 'вакансия (harvest)');
      }
      const parsed = await parseVacancyPage(page);
      if (serpTitle && !parsed.title) parsed.title = serpTitle;

      const filter = runHardFilters(parsed, loadPreferences());
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
        saveScoringCheckpoint(i);
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
          saveScoringCheckpoint(i);
          continue;
        }
      }

      const vacancyPayload = {
        title: parsed.title,
        company: parsed.company,
        salaryRaw: parsed.salaryRaw,
        description: parsed.description,
        url,
        publishedAt: parsed.publishedAt || parsed.createdAt || null,
      };
      const localScore = scoreVacancyLocally(vacancyPayload, cvBundle);
      const harvestGate = shouldUseLlmForHarvest(parsed, localScore.scoreOverall);
      const canSpendLlmQuota =
        !skipLlm && scoreMode !== 'local' && llmCallsDone < llmMaxPerRun;

      let llm = { ...localScore, llmSource: 'local' };

      if (scoreMode === 'local' || skipLlm) {
        console.log(
          `  Локальная оценка: итог ${llm.scoreOverall} (вакансия ${llm.scoreVacancy}, CV ${llm.scoreCvMatch})`
        );
      } else if (!canSpendLlmQuota) {
        if (!llmQuotaNoteShown) {
          console.log(`  LLM-лимит (${llmMaxPerRun}) — дальше локальная оценка.`);
          llmQuotaNoteShown = true;
        }
        console.log(`  Локальная оценка: итог ${llm.scoreOverall}`);
      } else if (!harvestGate.allow) {
        console.log(`  Локальная оценка (gate): итог ${llm.scoreOverall} — ${harvestGate.reason}`);
      } else {
        const route = resolveHarvestScoreRoute(llmRouting, { llmCallsDone, llmMaxPerRun });
        if (route === 'heuristic') {
          console.log(`  Локальная оценка (лестница): итог ${llm.scoreOverall}`);
        } else {
          try {
            llm = await scoreVacancyForHarvest(
              vacancyPayload,
              cvBundle,
              prefs,
              llmRouting,
              route
            );
            llmCallsDone++;
            if (route === 'dslab') spendLlmBudget('B');
            appendLlmMetric({
              task: 'harvest-score',
              route,
              vacancyId,
              gate: harvestGate.reason,
              score: llm.scoreOverall,
            });
            const src =
              route === 'openrouter'
                ? 'OpenRouter'
                : route === 'local-llm'
                  ? 'локальный LLM'
                  : 'DS Lab';
            console.log(
              `  ${src} [${route}]: итог ${llm.scoreOverall} (gate: ${harvestGate.reason}) — ${llm.providerModel || '?'}`
            );
          } catch (e) {
            console.error('  LLM error:', e.message, '→ локальная оценка');
            llm = { ...scoreVacancyLocally(vacancyPayload, cvBundle), llmSource: 'local' };
            console.log(`  Локальная оценка: итог ${llm.scoreOverall}`);
          }
        }
      }

      const qTextHint = skipQuestionnaireHarvestHint
        ? { likely: false, reasons: [] }
        : detectQuestionnaireHintFromVacancyText(parsed);

      const record = {
        id: crypto.randomUUID(),
        source: 'hh',
        externalKey: vacancyId ? `hh:${vacancyId}` : undefined,
        applyMode: 'hh_auto',
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
        employment: parsed.employment || '',
        workFormatLine: parsed.workFormat || '',
        address: parsed.address || '',
        hhMeta: parsed.hhMeta && typeof parsed.hhMeta === 'object' ? parsed.hhMeta : undefined,
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
        scoreCalibrated: llm.scoreCalibrated === true,
        calibrationNote: llm.calibrationNote || 'none',
        hardGaps: Array.isArray(llm.hardGaps) ? llm.hardGaps : [],
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

      const qMeta = scoreSource(record, { allRecords: loadQueue() });
      Object.assign(record, {
        sourceQualityTier: qMeta.sourceQualityTier,
        sourceQualityScore: qMeta.sourceQualityScore,
        freshnessHours: qMeta.freshnessHours,
        publishedAt: record.createdAt,
      });

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
      } catch (e) {
        const msg = String(e?.message || e);
        console.error(`  ERROR [harvest]: ${msg}`);
        if (/has been closed|PAGE_CLOSED|context.*closed|browser.*closed|newPage.*closed/i.test(msg)) {
          try {
            await recoverHarvestBrowser('вакансия (harvest)');
            console.log('  [harvest] Браузер восстановлен — повтор URL');
            i--;
            continue;
          } catch (recoverErr) {
            saveHarvestScoringCheckpoint({
              urlIndex: i,
              urlsTotal,
              added,
              skipped,
              llmCallsDone,
              cacheCount: urlsTotal,
            });
            throw recoverErr;
          }
        }
        logSkipped({
          vacancyId,
          url,
          query,
          stage: 'harvest-error',
          reason: msg.slice(0, 500),
          title: serpTitle || '',
        });
        skipped++;
        if (/hh-captcha.*Таймаут/i.test(msg) && captchaOvernightEnabled()) {
          console.log('  [harvest] Капча: повторное ожидание (overnight)…');
          page = await resolveCaptchaPage(page, 'вакансия (harvest) retry');
        }
      }
      saveScoringCheckpoint(i);
    }

    if (newRecordsSinceDashboardTick > 0) {
      writeDashboardHarvestTick(added);
    }

    flushQueueSave();
    clearHarvestScoringCheckpoint();
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
    unregisterCaptchaVisibleEscalation();
    await closeContextSafe(ctx, BROWSER_OWNER);
    finishHarvestControl({ reason: shouldStopHarvest() ? 'stop' : 'complete' });
  }
}

main().catch((e) => {
  try {
    flushQueueSave();
  } catch {
    /* ignore */
  }
  const prev = readJobProgress(HARVEST_PROGRESS_FILE);
  if (prev?.phase === 'scoring' && prev.current > 0 && prev.total > prev.current) {
    saveHarvestScoringCheckpoint({
      urlIndex: prev.current,
      urlsTotal: prev.total,
      added: prev.stats?.added ?? 0,
      skipped: prev.stats?.skipped ?? 0,
      llmCallsDone: prev.stats?.llmCallsDone ?? 0,
      cacheCount: prev.total,
    });
  }
  finishHarvestControl({ reason: 'stop' });
  writeHarvestError(e?.message || e);
  console.error(e);
  console.error('[harvest] Checkpoint сохранён — watchdog продолжит с последней позиции.');
  process.exit(1);
});
