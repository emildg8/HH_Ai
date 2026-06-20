#!/usr/bin/env node
/**
 * Оценка соответствия резюме вакансии.
 *
 *   node scripts/resume-fit.mjs --profile anastasia
 *   node scripts/resume-fit.mjs --profile anastasia --vacancy 133704648
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { loadResumeBundle } from '../lib/resume-extract.mjs';
import { scoreResumeVsVacancy } from '../lib/resume-fit.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const profileId = arg('--profile') || process.env.HH_RESUME_PROFILE || 'anastasia';
const vacancyId = arg('--vacancy') || '133704648';

const bundle = await loadResumeBundle({ profileId });
if (!bundle.text || bundle.text.length < 100) {
  console.error('FAIL: мало текста резюме');
  process.exit(1);
}

let vacancyText = '';
const candidates = [
  path.join(ROOT, 'uploads', `${vacancyId}-0.md`),
  path.join(ROOT, 'uploads', `${vacancyId}.md`),
];
for (const fp of candidates) {
  if (fs.existsSync(fp)) {
    vacancyText = fs.readFileSync(fp, 'utf8');
    break;
  }
}
if (!vacancyText) {
  vacancyText =
    'интеграционное тестирование postgresql kafka xml jira testray .net oracle api rest микросервисы пми пси';
  console.log('!(вакансия не в uploads — использую ключевые слова)');
}

const fit = scoreResumeVsVacancy(bundle.text, vacancyText);

console.log('Профиль:', bundle.profile?.name || profileId);
console.log('Вакансия:', vacancyId);
console.log('Оценка:', fit.score + '%');
console.log('\nСильные стороны:');
for (const s of fit.strengths) console.log('  +', s);
if (fit.gaps.length) {
  console.log('\nПробелы:');
  for (const g of fit.gaps) console.log('  -', g);
}

process.exit(fit.score >= 40 ? 0 : 1);
