/**
 * Интерактивная первичная настройка.
 *   npm run setup
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { spawnSync } from 'child_process';
import { ROOT } from '../lib/paths.mjs';

const PRESETS = [
  { id: '1', file: 'no-llm.env', label: 'Без LLM (локальная оценка)' },
  { id: '2', file: 'openrouter-free.env', label: 'OpenRouter (бесплатные модели)' },
  { id: '3', file: 'ollama.env', label: 'Ollama локально' },
  { id: '4', file: 'openrouter-then-ollama.env', label: 'OpenRouter → Ollama fallback' },
  { id: '0', file: null, label: 'Пропустить (настрою secrets вручную)' },
];

async function ask(rl, q, def = '') {
  const hint = def ? ` [${def}]` : '';
  const ans = (await rl.question(`${q}${hint}: `)).trim();
  return ans || def;
}

function copyIfMissing(src, dest, label) {
  if (fs.existsSync(dest)) return false;
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  console.log(`  + ${label}`);
  return true;
}

function applyPreset(presetFile) {
  const src = path.join(ROOT, 'config', 'presets', presetFile);
  const dest = path.join(ROOT, 'config', 'secrets.local.env');
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠ нет ${src}`);
    return;
  }
  if (fs.existsSync(dest)) {
    console.log(`  ⚠ ${path.relative(ROOT, dest)} уже есть — не перезаписываем`);
    console.log(`    Сравните с config/presets/${presetFile}`);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log(`  + secrets из preset ${presetFile}`);
}

function main() {
  return run();
}

async function run() {
  const rl = readline.createInterface({ input, output });
  console.log('\n[setup] Мастер первичной настройки HH Ai\n');

  copyIfMissing(path.join(ROOT, '.env.example'), path.join(ROOT, '.env'), '.env');
  copyIfMissing(
    path.join(ROOT, 'config', 'cover-letter.example.txt'),
    path.join(ROOT, 'config', 'cover-letter.txt'),
    'config/cover-letter.txt'
  );
  copyIfMissing(
    path.join(ROOT, 'config', 'resume-routing.example.json'),
    path.join(ROOT, 'config', 'resume-routing.json'),
    'config/resume-routing.json'
  );

  console.log('Режим LLM (config/secrets.local.env):');
  for (const p of PRESETS) console.log(`  ${p.id}) ${p.label}`);
  const pick = await ask(rl, 'Выбор', '1');
  const preset = PRESETS.find((p) => p.id === pick) || PRESETS[0];
  if (preset.file) applyPreset(preset.file);

  const profileId = (await ask(rl, 'ID профиля (латиница)', 'devops')).toLowerCase();
  const title = await ask(rl, 'Заголовок резюме на hh.ru (HH_PROFILE_RESUME_TITLE)', 'DevOps');

  const profilesDir = path.join(ROOT, 'config', 'profiles');
  const envPath = path.join(profilesDir, `${profileId}.env`);
  if (!fs.existsSync(envPath)) {
    const r = spawnSync(
      process.execPath,
      ['scripts/profile-init.mjs', `--id=${profileId}`, `--title=${title}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (r.status !== 0) {
      rl.close();
      process.exit(r.status ?? 1);
    }
  } else {
    console.log(`  ✓ профиль уже есть: ${path.relative(ROOT, envPath)}`);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!/HH_PROFILE_RESUME_TITLE=/.test(envContent)) {
    fs.appendFileSync(envPath, `HH_PROFILE_RESUME_TITLE=${title}\n`, 'utf8');
  }

  rl.close();

  console.log('\n[setup] Дальше:\n');
  console.log('  1. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE (как на hh.ru)');
  if (preset.id === '2' || preset.id === '4') {
    console.log('  2. config/secrets.local.env — ключ OpenRouter');
  } else {
    console.log('  2. (опционально) CV/ — resume.pdf для LLM');
  }
  console.log('  3. npm run login');
  console.log('  4. npm run setup:check && npm run dashboard\n');
  console.log('  docs/FIRST-RUN.md · docs/QUICKSTART.md\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
