#!/usr/bin/env node
/**
 * Операционная готовность перед батчем / волной 1.
 *   npm run devops:ops-readiness
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import {
  hasIntelligenceBaseline,
  isBaselineStale,
  baselineAgeDays,
} from '../lib/ops-baseline.mjs';
import { loadHrScreeningAnswers } from '../lib/hr-screening-answers.mjs';

const HR_PATH = path.join(ROOT, 'config', 'hr-screening-answers.json');
const SECRETS = path.join(ROOT, 'config', 'secrets.local.env');
const NO_LLM = path.join(ROOT, 'config', 'presets', 'no-llm.env');

function line(ok, text, warn = false) {
  const icon = ok ? '✓' : warn ? '⚠' : '✗';
  console.log(`${icon} ${text}`);
  return ok;
}

function main() {
  console.log('Операционная готовность HH Ai\n');
  let fail = 0;
  let warn = 0;

  const hrPersonal = fs.existsSync(HR_PATH);
  if (!line(hrPersonal, 'config/hr-screening-answers.json (личный файл)')) {
    console.log('  → скопируйте из hr-screening-answers.example.json и отредактируйте');
    fail++;
  } else {
    const raw = fs.readFileSync(HR_PATH, 'utf8');
    if (/ВСТАВЬТЕ|example only/i.test(raw)) {
      line(false, 'hr-screening без плейсхолдеров');
      fail++;
    }
  }

  const answers = loadHrScreeningAnswers();
  const required = ['startDate', 'salary', 'careerBridge', 'remote'];
  for (const k of required) {
    if (!String(answers[k] || '').trim()) {
      line(false, `hr-screening: поле ${k}`);
      fail++;
    }
  }

  if (!line(hasIntelligenceBaseline(), 'data/intelligence-baseline.json')) {
    console.log('  → npm run devops:intelligence-baseline');
    fail++;
  } else {
    const age = baselineAgeDays();
    if (isBaselineStale({ maxAgeDays: 90 })) {
      line(false, `baseline старше 90 д (возраст ${age})`, true);
      warn++;
    } else {
      line(true, `baseline свежий (${age} д)`);
    }
  }

  const hasSecrets = fs.existsSync(SECRETS);
  if (!line(hasSecrets || fs.existsSync(NO_LLM), 'secrets.local.env или preset no-llm')) {
    fail++;
  }

  console.log('');
  if (fail) {
    console.log(`Итог: не готово (${fail} блокер(ов), ${warn} предупрежд.)`);
    process.exit(1);
  }
  if (warn) {
    console.log(`Итог: готово с предупреждениями (${warn})`);
    process.exit(0);
  }
  console.log('Итог: готово к операционному циклу');
}

main();
