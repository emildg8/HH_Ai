/**
 * Оценка записей очереди только через OpenRouter (без fallback на Ollama).
 * Останавливается при исчерпании квоты (см. shouldStopOpenRouterQuotaRun). 503/пустой ответ — повторы с паузой.
 *
 * Типично после: harvest --skip-llm в отдельный файл очереди.
 *
 * HH_VACANCIES_QUEUE_FILE=data/vacancies-queue-week.json node scripts/score-openrouter-until-quota.mjs
 */

import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import {
  getOpenRouterApiKey,
  scoreVacancyWithOpenRouter,
  shouldStopOpenRouterQuotaRun,
} from '../lib/openrouter-score.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function needsHarvestSkipScoring(rec) {
  if (rec.status !== 'pending' || !rec.url) return false;
  const s = String(rec.geminiSummary || '');
  return (
    s.includes('(LLM отключён') ||
    s.includes('(без LLM: достигнут HH_LLM_MAX_PER_RUN') ||
    s.includes('(без LLM: HH_LLM_MAX_PER_RUN=0)')
  );
}

const argv = process.argv.slice(2);
let limitN = Infinity;
for (const a of argv) {
  const m = /^--limit=(\d+)$/.exec(a);
  if (m) limitN = Math.max(1, Number(m[1]));
}

const delayMs = Math.max(0, Number(process.env.HH_RESCORE_DELAY_MS) || 4500);

async function main() {
  if (!getOpenRouterApiKey()) {
    console.error('Нужен OpenRouter_API_KEY (или OPENROUTER_API_KEY).');
    process.exit(1);
  }

  let cvBundle;
  try {
    cvBundle = await loadCvBundle();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  if (!cvBundle.text.trim()) {
    console.error('Нет текста CV — положите файлы в CV/');
    process.exit(1);
  }

  const prefs = loadPreferences();
  const q = loadQueue();
  const candidates = q.filter(needsHarvestSkipScoring);
  let items = candidates.slice(0, limitN);

  console.log(
    `OpenRouter-only: в очереди ${q.length} записей, кандидатов на первую оценку: ${candidates.length}, к обработке: ${items.length} (delayMs=${delayMs})`
  );

  if (!items.length) {
    console.log('Нет записей с плейсхолдером «LLM отключён» / «без LLM». Нечего оценивать.');
    return;
  }

  let scored = 0;
  for (let i = 0; i < items.length; i++) {
    const rec = items[i];
    const label = (rec.title || rec.id).slice(0, 72);
    console.log(`[${i + 1}/${items.length}] ${label}`);
    const vacancy = {
      title: rec.title,
      company: rec.company,
      salaryRaw: rec.salaryRaw,
      description: String(rec.descriptionForLlm || rec.description || ''),
      url: rec.url,
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const llm = await scoreVacancyWithOpenRouter(vacancy, cvBundle, prefs);
        updateVacancyRecord(rec.id, {
          llmProvider: 'openrouter',
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
        scored++;
        console.log(`  → ${llm.scoreOverall} (openrouter) ${llm.providerModel || ''}`);
        break;
      } catch (e) {
        if (shouldStopOpenRouterQuotaRun(e)) {
          const msg = String(e?.message ?? e);
          console.warn(`\n=== СТОП: лимит OpenRouter / квота (бесплатный маршрут исчерпан) ===\n${msg.slice(0, 420)}\n`);
          const q2 = loadQueue();
          const still = q2.filter(needsHarvestSkipScoring).length;
          console.log(`Оценено за этот прогон (OpenRouter): ${scored}`);
          console.log(`Осталось без оценки (плейсхолдер / ждёт следующий шаг): ${still}`);
          process.exit(0);
        }
        const msg = String(e?.message ?? e);
        const transient =
          /\b503\b|\b502\b|\b504\b|пустой ответ|empty choices|no healthy upstream|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
            msg
          );
        if (transient && attempt < 4) {
          const pause = 6000 + attempt * 7000;
          console.warn(`  … временная ошибка, пауза ${pause} мс и повтор (${attempt + 1}/5): ${msg.slice(0, 140)}`);
          await sleep(pause);
          continue;
        }
        console.error(`  → ошибка: ${msg}`);
        updateVacancyRecord(rec.id, {
          geminiSummary: `Ошибка LLM (OpenRouter): ${msg}`,
          geminiRisks: '',
        });
        break;
      }
    }

    if (i + 1 < items.length && delayMs > 0) await sleep(delayMs);
  }

  const q3 = loadQueue();
  const still = q3.filter(needsHarvestSkipScoring).length;
  console.log(`\nГотово. Оценено за прогон: ${scored}. Осталось с плейсхолдером: ${still}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
