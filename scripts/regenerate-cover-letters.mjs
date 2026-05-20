/**
 * Массовая генерация сопроводительных для очереди (новые промпты).
 *
 *   npm run devops:regenerate-letters
 *   npm run devops:regenerate-letters -- --limit=20
 *   npm run devops:regenerate-letters -- --dry-run
 *   npm run devops:regenerate-letters -- --resume
 *
 * Пауза между вакансиями: COVER_LETTER_REGEN_DELAY_MS (по умолчанию 4500)
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

/** Пакетная генерация: только OpenRouter (Ollama часто пустой/битый JSON). */
process.env.COVER_LETTER_OPENROUTER_ONLY = '1';
process.env.COVER_LETTER_TWO_PHASE = process.env.COVER_LETTER_TWO_PHASE ?? '0';
process.env.COVER_LETTER_STYLE_MAX_CHARS = process.env.COVER_LETTER_STYLE_MAX_CHARS ?? '3500';
process.env.COVER_LETTER_STYLE_QUEUE_ITEMS = process.env.COVER_LETTER_STYLE_QUEUE_ITEMS ?? '3';

import { DATA_DIR } from '../lib/paths.mjs';
import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { generateCoverLetterVariants } from '../lib/cover-letter-openrouter.mjs';
import { auditCoverLetterPrompts } from '../lib/cover-letter-prompt-audit.mjs';
import { hasScoreProviderCredentials } from '../lib/openrouter-score.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { runTitleOnlyFilters } from '../lib/filters.mjs';

const STATE_FILE = path.join(DATA_DIR, 'cover-letter-regen-state.json');
const LOG_FILE = path.join(DATA_DIR, 'cover-letter-regen.log');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function logLine(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const opts = {
    dryRun: false,
    resume: false,
    status: 'pending',
    minScore: 0,
    limit: Infinity,
    onlyEmpty: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--resume') opts.resume = true;
    else if (a === '--only-empty') opts.onlyEmpty = true;
    else if (a.startsWith('--status=')) opts.status = a.slice(9);
    else if (a.startsWith('--min-score=')) opts.minScore = Number(a.slice(12)) || 0;
    else if (a.startsWith('--limit=')) opts.limit = Math.max(1, Number(a.slice(8)) || 1);
  }
  return opts;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { processedIds: [], ok: 0, failed: 0, skipped: 0 };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { processedIds: [], ok: 0, failed: 0, skipped: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function hasDescription(rec) {
  return String(rec.descriptionForLlm || rec.descriptionPreview || '').trim().length >= 60;
}

function scoreOf(rec) {
  return Number(rec.scoreOverall ?? rec.geminiScore ?? 0) || 0;
}

function needsLetter(rec) {
  if (rec.coverLetter?.status === 'approved') return false;
  if (!hasDescription(rec)) return false;
  return true;
}

function passesRoleForLetter(rec, prefs) {
  const title = String(rec.title || '').trim();
  if (!title) return { pass: true };
  return runTitleOnlyFilters(title, prefs);
}

async function main() {
  const opts = parseArgs();
  const delayMs = Math.max(1000, Number(process.env.COVER_LETTER_REGEN_DELAY_MS) || 4500);

  if (!hasScoreProviderCredentials()) {
    console.error('Нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_*');
    process.exit(1);
  }

  const cvBundle = await loadCvBundle();
  let prefs = {};
  try {
    prefs = loadPreferences();
  } catch {
    /* ignore */
  }
  const audit = auditCoverLetterPrompts(
    loadQueue().find((x) => x.status === 'pending') || {},
    cvBundle
  );
  if (!audit.ok) {
    console.error('Аудит промптов не пройден:');
    audit.issues.forEach((i) => console.error(`  - ${i}`));
    process.exit(1);
  }

  const queue = loadQueue();
  let candidates = queue
    .filter((x) => x.status === opts.status)
    .filter(needsLetter)
    .filter((x) => scoreOf(x) >= opts.minScore);

  if (opts.onlyEmpty) {
    candidates = candidates.filter((x) => !(x.coverLetter?.variants || []).filter(Boolean).length);
  }

  candidates.sort((a, b) => scoreOf(b) - scoreOf(a));

  const state = opts.resume ? loadState() : { processedIds: [], ok: 0, failed: 0, skipped: 0 };
  const doneSet = new Set(state.processedIds || []);

  if (!opts.resume) {
    fs.writeFileSync(
      LOG_FILE,
      `\n======== REGEN ${new Date().toISOString()} candidates=${candidates.length} ========\n`,
      'utf8'
    );
  }

  let planned = 0;
  for (const rec of candidates) {
    if (planned >= opts.limit) break;
    if (doneSet.has(rec.id)) continue;
    planned++;
  }

  logLine(
    `Старт: к перегенерации ${planned} (в очереди без письма: ${candidates.length}, resume=${opts.resume}, dry=${opts.dryRun})`
  );

  let n = 0;
  for (const rec of candidates) {
    if (n >= opts.limit) break;
    if (doneSet.has(rec.id)) continue;

    n++;
    const title = (rec.title || rec.id || '').slice(0, 70);
    const sc = scoreOf(rec);

    if (opts.dryRun) {
      logLine(`[dry] ${n}/${planned} · ${sc} б. · ${title}`);
      continue;
    }

    const roleCheck = passesRoleForLetter(rec, prefs);
    if (!roleCheck.pass) {
      state.skipped++;
      doneSet.add(rec.id);
      state.processedIds = [...doneSet];
      saveState(state);
      logLine(`ПРОПУСК [${roleCheck.stage}]: ${roleCheck.reason}`);
      continue;
    }

    logLine(`—— ${n}/${planned} · ${sc} б. · ${title}`);

    const generateOnce = async (retry429 = false) => {
      try {
        return await generateCoverLetterVariants(rec, cvBundle);
      } catch (e) {
        if (!retry429 && /\b429\b|rate\s*limit|rate-limited/i.test(String(e.message))) {
          logLine('Лимит OpenRouter (429) — пауза 90 с и повтор…');
          await sleep(90_000);
          return generateOnce(true);
        }
        throw e;
      }
    };

    try {
      const result = await generateOnce();
      const now = new Date().toISOString();
      updateVacancyRecord(rec.id, {
        coverLetter: {
          status: 'pending',
          variants: result.variants,
          approvedText: '',
          openRouterModel: result.providerModel || null,
          updatedAt: now,
        },
      });
      state.ok++;
      logLine(`OK: ${result.variants.length} вариант(ов), модель ${result.providerModel || '—'}`);
    } catch (e) {
      state.failed++;
      logLine(`ОШИБКА: ${String(e.message || e).slice(0, 300)}`);
      if (/\b429\b|rate\s*limit/i.test(String(e.message))) {
        logLine('Лимит API снова — пауза. Продолжите позже: npm run devops:regenerate-letters -- --resume');
        break;
      }
    }

    doneSet.add(rec.id);
    state.processedIds = [...doneSet];
    saveState(state);

    if (n < planned) await sleep(delayMs);
  }

  saveState(state);
  logLine(`Готово: ok=${state.ok}, ошибок=${state.failed}, пропуск=${state.skipped}`);
  console.log(`\nЛог: ${LOG_FILE}`);
  console.log(`Состояние: ${STATE_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
