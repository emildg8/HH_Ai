#!/usr/bin/env node
/**
 * Проверка извлечения резюме Анастасии (кириллица, ключевые слова).
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { loadResumeBundle, parseResumeSections } from '../lib/resume-extract.mjs';
import { scoreResumeVsVacancy } from '../lib/resume-fit.mjs';
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const MUST_HAVE = ['Добрынина', 'Kafka', 'PostgreSQL', 'интеграц', 'ВТБ'];
let failed = 0;

const bundle = await loadResumeBundle({ profileId: 'anastasia' });
if (!bundle.text || bundle.text.length < 500) {
  console.error('FAIL: мало текста из резюме');
  process.exit(1);
}

for (const word of MUST_HAVE) {
  if (!bundle.text.includes(word)) {
    console.error(`FAIL: нет «${word}» в тексте`);
    failed++;
  } else {
    console.log('OK:', word);
  }
}

if (bundle.text.includes('\uFFFD')) {
  console.error('FAIL: битая кириллица (символ замены)');
  failed++;
} else {
  console.log('OK: кириллица без битых символов');
}

if (!bundle.sections?.name?.includes('Добрынина')) {
  console.error('FAIL: имя не распознано в секциях');
  failed++;
} else {
  console.log('OK: имя', bundle.sections.name);
}

const vacancyPath = path.join(ROOT, 'uploads', '133704648-0.md');
let vacancyText = '';
if (fs.existsSync(vacancyPath)) {
  vacancyText = fs.readFileSync(vacancyPath, 'utf8');
} else {
  vacancyText = 'интеграционное тестирование postgresql kafka xml jira testray .net';
}

const fit = scoreResumeVsVacancy(bundle.text, vacancyText);
console.log('Оценка соответствия:', fit.score + '%');
console.log('Сильные стороны:', fit.strengths.join('; '));
if (fit.gaps.length) console.log('Пробелы:', fit.gaps.join('; '));

if (fit.score < 40) {
  console.error('FAIL: слишком низкая оценка соответствия');
  failed++;
}

console.log(failed ? `\n${failed} проверок не пройдено` : '\nВсе проверки пройдены');
process.exit(failed ? 1 : 0);
