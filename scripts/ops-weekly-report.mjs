#!/usr/bin/env node
/**
 * Черновик еженедельного ops-отчёта (ORG-1/5).
 *   npm run devops:ops-weekly-report
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const reviewsDir = path.join(ROOT, 'data', 'ops-reviews');
const week = new Date().toISOString().slice(0, 10);
const out = path.join(reviewsDir, `patterns-${week}.json`);
const example = path.join(ROOT, 'scripts', 'fixtures', 'ops-patterns-example.json');

fs.mkdirSync(reviewsDir, { recursive: true });

if (fs.existsSync(out)) {
  console.log(`[ops-weekly-report] уже есть: ${path.relative(ROOT, out)}`);
  process.exit(0);
}

const template = JSON.parse(fs.readFileSync(example, 'utf8'));
template.week = week.replace(/-/g, '-W').slice(0, 8); // placeholder; user edits
template.wins = [''];
template.losses = [''];
template.actions = [''];

fs.writeFileSync(out, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
console.log(`[ops-weekly-report] создан черновик: ${path.relative(ROOT, out)}`);
console.log('Заполните wins/losses/actions по ритуалу 20+20 — см. docs/OPS-RHYTHM.md');
