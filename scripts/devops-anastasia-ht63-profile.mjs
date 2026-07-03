#!/usr/bin/env node
/**
 * HT6.3 — полный авто-прогон QA-профиля на hh.ru (как HT.6 у Эмиля).
 *
 *   npm run devops:anastasia-ht63-profile
 *   npm run devops:anastasia-ht63-profile -- --dry-run
 *   npm run devops:anastasia-ht63-profile -- --track=qa-lead --skip-about
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = path.join(ROOT, 'scripts', 'devops-apply-hunt-track-resume-qa.mjs');
const RUNNER = path.join(ROOT, 'scripts', 'run-with-instance.mjs');

const argv = process.argv.slice(2);
const track = String((argv.find((a) => a.startsWith('--track=')) || '').slice(8) || 'qa-lead').trim();
const dryRun = argv.includes('--dry-run');
const skipAbout = argv.includes('--skip-about');
const skipExperience = argv.includes('--skip-experience');
const skipSkills = argv.includes('--skip-skills');
const skipConditions = argv.includes('--skip-conditions');

/** @type {Array<{ flag: string, label: string, skip?: boolean }>} */
const steps = [
  { flag: '--about-only', label: 'О себе (L3 канон)', skip: skipAbout },
  { flag: '--experience-only', label: 'Опыт', skip: skipExperience },
  { flag: '--skills-only', label: 'Навыки', skip: skipSkills },
  { flag: '--conditions-only', label: 'Условия (ЗП, удалёнка)', skip: skipConditions },
  { flag: '--verify-only', label: 'Проверка на hh' },
];

/**
 * @param {string[]} extraArgs
 * @param {string} label
 */
function runStep(extraArgs, label) {
  const args = [
    RUNNER,
    '--instance=anastasia',
    '--',
    'node',
    APPLY,
    `--track=${track}`,
    ...extraArgs,
  ];
  if (dryRun) args.push('--dry-run');

  console.log(`\n=== ${label} ===`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label}: exit ${code}`));
    });
  });
}

async function main() {
  console.log(`[ht63-profile] track=${track} dryRun=${dryRun}`);
  for (const step of steps) {
    if (step.skip) {
      console.log(`\n=== ${step.label} — пропуск ===`);
      continue;
    }
    await runStep([step.flag], step.label);
  }
  console.log('\n[ht63-profile] готово');
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
