/**
 * Сбор вакансий по ключам (как у vacancies) → парсинг → фильтры → оценка LLM (OpenRouter, при лимите — HH_CUSTOM_LLM_*) → data/vacancies-queue.json для дашборда.
 * Открытие множества вкладок — только npm run vacancies; для очереди+оценки используйте эту команду.
 *
 * Перед запуском: npm run login, в secrets — OpenRouter_API_KEY.
 * Флаги: --skip-llm | --skip-gemini — без вызова LLM (score=0).
 * Лимиты: до 500 записей за запуск (HH_SESSION_LIMIT / HH_MAX_TOTAL, HH_PER_KEYWORD_LIMIT).
 * Квота LLM: HH_LLM_MAX_PER_RUN — макс. вызовов OpenRouter за запуск (по умолчанию 30; дальше — без оценки).
 * Дашборд: каждые HH_DASHBOARD_TICK_EVERY (20) новых записей — сигнал в data/harvest-dashboard-tick.json для обновления UI.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { loadSearchKeywords } from '../lib/load-keywords.mjs';
import {
  sessionProfilePath,
  ROOT,
  SKIPPED_FILE,
  DATA_DIR,
  HARVEST_DASHBOARD_TICK_FILE,
} from '../lib/paths.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { parseVacancyPage, vacancyIdFromUrl } from '../lib/vacancy-parse.mjs';
import { runHardFilters } from '../lib/filters.mjs';
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

const DEFAULT_KEYWORDS_FILE = path.join(ROOT, 'config', 'search-keywords.txt');

const headless = process.env.HH_HEADLESS === '1';
const skipLlm =
  process.argv.includes('--skip-llm') || process.argv.includes('--skip-gemini');

/** Максимум новых записей за один запуск harvest (см. HH_SESSION_LIMIT / HH_PER_KEYWORD_LIMIT). */
const MAX_RECORDS_PER_HARVEST = 500;

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
  params.set('text', text);
  params.set('ored_clusters', 'true');
  const area = (process.env.HH_AREA || '').trim();
  if (area) params.set('area', area);
  return `https://hh.ru/search/vacancy?${params.toString()}`;
}

async function collectVacancyUrls(page) {
  await page.waitForTimeout(2000);
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

  const ctx = await chromium.launchPersistentContext(profile, {
    headless,
    viewport: { width: 1280, height: 800 },
    locale: 'ru-RU',
  });
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

    for (const key of keywords) {
      if (urls.length >= sessionLimit) break;
      await page.goto(buildSearchUrl(key), { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await sleepMs(randomIntInclusive(searchJitterMin, searchJitterMax));
      const found = await collectVacancyUrls(page);
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
    }

    if (!urls.length) {
      console.log('Нет новых ссылок (все уже в очереди или пустая выдача).');
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
    let added = 0;
    let llmCallsDone = 0;
    let llmQuotaNoteShown = false;
    let newRecordsSinceDashboardTick = 0;
    for (let i = 0; i < urls.length; i++) {
      if (i > 0) {
        const pause = randomIntInclusive(openDelayMin, openDelayMax);
        console.log(`Пауза ${pause} мс…`);
        await sleepMs(pause);
      }

      const { url, query } = urls[i];
      const vacancyId = vacancyIdFromUrl(url);
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

      const canSpendLlmQuota = !skipLlm && llmCallsDone < llmMaxPerRun;

      if (!skipLlm && !canSpendLlmQuota) {
        if (!llmQuotaNoteShown) {
          if (llmMaxPerRun === 0) {
            console.log('  LLM: без вызова API (HH_LLM_MAX_PER_RUN=0).');
          } else {
            console.log(`  LLM: лимит исчерпан (${llmMaxPerRun} за запуск), дальше без API.`);
          }
          llmQuotaNoteShown = true;
        }
        llm = {
          ...llm,
          summary:
            llmMaxPerRun === 0
              ? '(без LLM: HH_LLM_MAX_PER_RUN=0)'
              : '(без LLM: достигнут HH_LLM_MAX_PER_RUN)',
        };
      } else if (canSpendLlmQuota) {
        try {
          llm = await scoreVacancyWithLlm(
            {
              title: parsed.title,
              company: parsed.company,
              salaryRaw: parsed.salaryRaw,
              description: parsed.description,
              url,
            },
            cvBundle,
            prefs,
            llmRouting
          );
          llmCallsDone++;
          const src = llm.llmSource === 'custom' ? 'внутренний LLM' : 'OpenRouter';
          console.log(
            `  ${src}: итог ${llm.scoreOverall} (вакансия ${llm.scoreVacancy}, CV ${llm.scoreCvMatch}) — ${llm.providerModel || '?'}`
          );
        } catch (e) {
          console.error('  LLM error:', e.message);
          llm.summary = `Ошибка LLM: ${e.message}`;
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

    console.log(`\nГотово. Новых записей в очереди: ${added}. Запустите: npm run dashboard`);
  } finally {
    await ctx.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
