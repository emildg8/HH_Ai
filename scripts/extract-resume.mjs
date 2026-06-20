#!/usr/bin/env node
/**
 * Извлечение текста из PDF-резюме и создание кэша .txt
 *
 *   node scripts/extract-resume.mjs --profile anastasia
 *   node scripts/extract-resume.mjs --dir my/resume
 *   node scripts/extract-resume.mjs --file "my/resume/....pdf"
 */

import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import path from 'path';
import fs from 'fs';
import { ROOT } from '../lib/paths.mjs';
import {
  loadResumeBundle,
  loadCandidateProfile,
  writeSidecarCache,
  parseResumeSections,
  resolveResumeSource,
} from '../lib/resume-extract.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

const profileId = arg('--profile') || process.env.HH_RESUME_PROFILE;
const dir = arg('--dir');
const file = arg('--file');

if (file) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.error(`Файл не найден: ${abs}`);
    process.exit(1);
  }
  const { path: sidecar, created, text } = await writeSidecarCache(abs, { force: true });
  const sections = parseResumeSections(text);
  console.log(created ? 'Создан кэш' : 'Обновлён кэш', sidecar);
  console.log('Имя:', sections.name || '—');
  console.log('Опыт (записей):', sections.experience.length);
  console.log('Превью:', text.slice(0, 400).replace(/\n/g, ' '));
  process.exit(0);
}

const bundle = await loadResumeBundle({
  profileId,
  dir: dir ? (path.isAbsolute(dir) ? dir : path.join(ROOT, dir)) : undefined,
});

console.log('Папка:', bundle.dir);
console.log('Профиль:', bundle.profile?.name || profileId || '—');
console.log('Файлы:', bundle.files.join(', ') || '—');
for (const w of bundle.warnings) console.log('!', w);

if (bundle.sections) {
  console.log('\n--- Структура ---');
  console.log('Имя:', bundle.sections.name);
  console.log('Навыков:', bundle.sections.skills.length);
  console.log('Опыт (блоков):', bundle.sections.experience.length);
  for (const e of bundle.sections.experience.slice(0, 4)) {
    console.log(' •', e.title);
  }
}

console.log('\nСимволов текста:', bundle.text.length);
process.exit(bundle.text.length > 100 ? 0 : 1);
