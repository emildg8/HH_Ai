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
import { parseHarvestPeriodDays, applySearchPeriodToParams, harvestPeriodLabel } from '../lib/hh-search-period.mjs';
import {
  launchPersistentContextSafe,
  closeContextSafe,
  clearStaleBrowserLock,
  formatBrowserLaunchError,
} from '../lib/chromium-session.mjs';
import { createHarvestProgressTracker, writeHarvestError } from '../lib/job-progress.mjs';

const BROWSER_OWNER = 'harvest';
import { parseVacancyPage, vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { runHardFilters } from '../lib/filters.mjs';
import { buildHhSearchText } from '../lib/hh-search.mjs';
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

function buildSearchUrl(text) {
  const params = new URLSearchParams();
  params.set('text', buildHhSearchText(text));
  params.set('ored_clusters', 'true');
  const area = (process.env.HH_AREA || '').trim();
  if (area) params.set('area', area);
  applySearchPeriodToParams(params, parseHarvestPeriodDays(process.env.HH_SEARCH_PERIOD));
  const orderBy = (process.env.HH_SEARCH_ORDER_BY || 'publication_time').trim();
  if (orderBy) params.set('order_by', orderBy);
  return `https://hh.ru/search/vacancy?${params.toString()}`;
}

async function collectVacancyUrls(page) {
  await page
    .waitForSelector('a[href*="/vacancy/"]', { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/vacancy/"]')) {
      const href = a.href || '';
      const m = href.match(/\/vacancy\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(`https://hh.ru/vacancy/${id}`);
    }
    return out;
  });
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
    if (looksLikeLoginUrl(page.url())) {
      console.error('Сессия не активна. Выполните: npm run login');
      process.exit(1);
    }

    const seenIds = knownVacancyIds();
    const urls = [];
    const globalSeen = new Set();
    const keywordsTotal = keywords.length;
    let keywordIndex = 0;

    progress.collecting(0, keywordsTotal, { urlsFound: 0 });

    for (const key of keywords) {
      if (urls.length >= sessionLimit) break;
      keywordIndex++;
      progress.collecting(keywordIndex, keywordsTotal, {
        urlsFound: urls.length,
        currentKeyword: key,
      });
      await page.goto(buildSearchUrl(key), { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await sleepMs(randomIntInclusive(searchJitterMin, searchJitterMax));
      const found = await collectVacancyUrls(page);
      if (!found.length) {
        const hint = await page
          .evaluate(() => {
            const t = document.body?.innerText || '';
            if (/ничего не найдено/i.test(t)) return 'ничего не найдено';
            if (/captcha|подтвердите/i.test(t)) return 'капча/проверка';
            return '';
          })
          .catch(() => '');
        if (hint) console.warn(`  [harvest] пустая выдача (${hint}) для «${key}»`);
      }
      let n = 0;
      for (const u of found) {
        if (urls.length >= sessionLimit) break;
        if (n >= perKeyLimit) break;
        const id = vacancyIdFromUrl(u);
        if (!id || globalSeen.has(id) || seenIds.has(id)) continue;
        globalSeen.add(id);
        urls.push({ url: u, query: key });
        n++;
      }
      console.log(`Ключ «${key}»: +${n} URL (в очереди на обход ${urls.length})`);
      progress.collecting(keywordIndex, keywordsTotal, { urlsFound: urls.length, currentKeyword: key });
    }

    if (!urls.length) {
      console.log('Нет новых ссылок (все уже в очереди или пустая выдача).');
      progress.done({ added: 0, message: 'Нет новых ссылок' });
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
      if (i > 0) {
        const pause = randomIntInclusive(openDelayMin, openDelayMax);
        console.log(`Пауза ${pause} мс…`);
        await sleepMs(pause);
      }

      const { url, query } = urls[i];
      const vacancyId = vacancyIdFromUrl(url);
      progress.scoring(
        i + 1,
        urlsTotal,
        { added, skipped, llmCallsDone },
        scoringStartedAt
      );
      console.log(`Парсинг ${i + 1}/${urls.length}`, url);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const parsed = await parseVacancyPage(page);

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

      const record = {
        id: crypto.randomUUID(),
        vacancyId,
        url,
        searchQuery: query,
        title: parsed.title,
        company: parsed.company,
        salaryRaw: parsed.salaryRaw,
        salaryEstimate: filter.salaryEstimate,
        remoteNote: filter.remoteReason,
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
        geminiTags: llm.tags,
        status: 'pending',
        feedbackReason: '',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      };

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

    progress.done({ added, skipped, urlsTotal });
    console.log(`\nГотово. Новых записей в очереди: ${added}. Запустите: npm run dashboard`);
  } finally {
    await closeContextSafe(ctx, BROWSER_OWNER);
  }
}

main().catch((e) => {
  writeHarvestError(e?.message || e);
  console.error(e);
  process.exit(1);
});
