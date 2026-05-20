/**
 * Публичный экспорт для git: без сессий, секретов, личных данных.
 *   npm run export:public
 *   npm run export:public -- --out=dist/hh-ai-public
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { shouldIgnoreExport } from '../lib/export-ignore.mjs';

const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = path.resolve(outArg ? outArg.slice(6) : path.join(ROOT, 'dist', 'hh-ai-public'));

const SECRET_PATTERNS = [
  [/sk-or-v1-[a-zA-Z0-9._-]+/g, 'sk-or-v1-REDACTED'],
  [/sk-[a-zA-Z0-9]{20,}/g, 'sk-REDACTED'],
  [/\d{8,}:[A-Za-z0-9_-]{30,}/g, 'TELEGRAM_BOT_REDACTED'],
  [/HH_PROFILE_RESUME_HASH=[a-f0-9]+/gi, 'HH_PROFILE_RESUME_HASH='],
  [/OPENROUTER_API_KEY=[^\s#]+/gi, 'OPENROUTER_API_KEY='],
  [/HH_CUSTOM_LLM_API_KEY=[^\s#]+/gi, 'HH_CUSTOM_LLM_API_KEY='],
  [/TELEGRAM_BOT_TOKEN=[^\s#]+/gi, 'TELEGRAM_BOT_TOKEN='],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'email@example.com'],
];

function scrubText(text) {
  let out = text;
  for (const [re, rep] of SECRET_PATTERNS) {
    out = out.replace(re, rep);
  }
  return out;
}

/**
 * @param {string} src
 * @param {string} dest
 * @param {string} rel
 */
function copyPublic(src, dest, rel = '') {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (shouldIgnoreExport(relPath)) continue;
    const srcPath = path.join(src, ent.name);
    const destPath = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyPublic(srcPath, destPath, relPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      const ext = path.extname(ent.name).toLowerCase();
      if (['.mjs', '.js', '.json', '.md', '.txt', '.html', '.css', '.yml', '.yaml', '.env', '.example'].some((e) => ent.name.endsWith(e) || ext === e)) {
        const raw = fs.readFileSync(srcPath, 'utf8');
        fs.writeFileSync(destPath, scrubText(raw), 'utf8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function writeExportReadme() {
  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  const txt = `# HH Ai — публичный экспорт v${version}

Собрано: ${new Date().toISOString()}

Эта копия **без** сессии hh.ru, очередей вакансий, CV, API-ключей и личных \`*.env\`.

## С чего начать

1. Прочитайте **docs/PUBLIC-RELEASE.md** (полная инструкция для нового пользователя).
2. Установите зависимости и Chromium (см. ниже).
3. Создайте \`config/secrets.local.env\` и профиль из \`*.example.env\`.

## Быстрый старт

\`\`\`bash
npm install
npx playwright install chromium
cp .env.example .env
cp config/secrets.example.env config/secrets.local.env
cp config/profiles/devops.env.example config/profiles/devops.env
# отредактируйте devops.env и secrets.local.env
npm run login
npm run dashboard
\`\`\`

Откройте http://127.0.0.1:3849

## Документация

- docs/PUBLIC-RELEASE.md — релиз 2.0 для получателя
- docs/SETUP.md — установка
- docs/SECURITY.md — что не публиковать
- CHANGELOG.md — список изменений 2.0

Основано на [Steev193/hh-ru-apply](https://github.com/Steev193/hh-ru-apply) (MIT). См. docs/ATTRIBUTION.md.
`;
  fs.writeFileSync(path.join(OUT, 'EXPORT-README.md'), txt, 'utf8');
}

function main() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const dir of [
    'lib',
    'scripts',
    'dashboard',
    'config',
    'docs',
    '.github',
    '.cursor',
  ]) {
    copyPublic(path.join(ROOT, dir), path.join(OUT, dir), dir);
  }
  for (const f of [
    'package.json',
    'package-lock.json',
    'README.md',
    'CHANGELOG.md',
    'VERSION',
    'LICENSE',
    '.env.example',
    '.gitignore',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'docker-compose.yml',
  ]) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(OUT, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const raw = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, scrubText(raw), 'utf8');
  }

  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.writeFileSync(
    path.join(OUT, 'data', 'vacancies-queue.example.json'),
    '[]\n',
    'utf8'
  );

  writeExportReadme();
  console.log(`[export-public] OK: ${OUT}`);
}

main();
