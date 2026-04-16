/**
 * Пересчёт LLM-оценки для записей очереди (как «Обновить текст» в дашборде).
 * По умолчанию — только карточки с признаками прошлой ошибки в geminiSummary.
 *
 * Запуск из корня: node scripts/rescore-queue.mjs
 * Все pending с url: node scripts/rescore-queue.mjs --all-pending
 * Ограничить число карточек: node scripts/rescore-queue.mjs --limit=20
 * Пауза между вакансиями (мс, снижает 429): HH_RESCORE_DELAY_MS=5000
 */

import { loadEnv } from '../lib/load-env.mjs';

loadEnv();

import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import { fetchVacancyTextFromHh } from '../lib/refresh-vacancy-from-hh.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import {
  hasScoreProviderCredentials,
  scoreVacancyWithLlm,
  createLlmRoutingContext,
} from '../lib/openrouter-score.mjs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const allPending = argSet.has('--all-pending');

let limitN = Infinity;
for (const a of argv) {
  const m = /^--limit=(\d+)$/.exec(a);
  if (m) limitN = Math.max(1, Number(m[1]));
}

const delayMs = Math.max(0, Number(process.env.HH_RESCORE_DELAY_MS) || 4500);

function looksLikePreviousError(rec) {
  const s = String(rec.geminiSummary || '');
  return (
    /Ошибка\s*(LLM|OpenRouter)/i.test(s) ||
    /openrouter\s*\d{3}/i.test(s) ||
    /fetch failed/i.test(s) ||
    /no endpoints found/i.test(s)
  );
}

async function main() {
  if (!hasScoreProviderCredentials()) {
    console.error('Нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL.');
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
  const routing = createLlmRoutingContext();
  const q = loadQueue();

  let items = q.filter((x) => x.status === 'pending' && x.url);
  if (!allPending) {
    items = items.filter(looksLikePreviousError);
  }

  if (!items.length && !allPending) {
    console.log(
      'Нет pending-записей с текстом ошибки в summary. Для пересчёта всех: node scripts/rescore-queue.mjs --all-pending'
    );
    return;
  }

  items = items.slice(0, limitN);
  console.log(
    `Пересчёт: ${items.length} записей (allPending=${allPending}, limit=${Number.isFinite(limitN) ? limitN : '∞'}, delayMs=${delayMs})`
  );

  for (let i = 0; i < items.length; i++) {
    const rec = items[i];
    const label = (rec.title || rec.id).slice(0, 72);
    console.log(`[${i + 1}/${items.length}] ${label}`);
    try {
      const parsed = await fetchVacancyTextFromHh(rec.url);
      const desc = String(parsed.description || '');
      const title = parsed.title || rec.title;
      const company = parsed.company || rec.company;
      const salaryRaw = parsed.salaryRaw || rec.salaryRaw;

      const vacancy = {
        title,
        company,
        salaryRaw,
        description: desc,
        url: rec.url,
      };

      let llm;
      let lastErr;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          llm = await scoreVacancyWithLlm(vacancy, cvBundle, prefs, routing);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const msg = String(e.message || e);
          const retryable =
            /\b429\b/i.test(msg) ||
            /rate\s*limit/i.test(msg) ||
            /\b403\b/i.test(msg) ||
            /capacity/i.test(msg);
          if (!retryable || attempt >= 3) throw e;
          const pause = 20000 + attempt * 25000;
          console.warn(`  … временная ошибка OpenRouter (${msg.slice(0, 80)}…), пауза ${pause} мс и повтор`);
          await sleep(pause);
        }
      }
      if (lastErr) throw lastErr;

      updateVacancyRecord(rec.id, {
        title,
        company,
        salaryRaw,
        descriptionPreview: desc.slice(0, 600),
        descriptionForLlm: desc.slice(0, 6000),
        vacancyBodyRefreshedAt: new Date().toISOString(),
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
      console.log(`  → ${llm.scoreOverall} (${llm.llmSource})`);
    } catch (e) {
      const msg = e.message || String(e);
      console.error(`  → ошибка: ${msg}`);
      updateVacancyRecord(rec.id, {
        geminiSummary: `Ошибка LLM: ${msg}`,
        geminiRisks: '',
      });
    }

    if (i + 1 < items.length && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log('Готово.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
