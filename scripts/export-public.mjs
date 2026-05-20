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
  [/\+7\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, '+7 (900) 000-00-00'],
  [/@emildg8\b/gi, '@your_telegram'],
  [/emilianjob@[a-z.]+/gi, 'email@example.com'],
  [/emil-shahvaladov/gi, 'candidate'],
  [/D:\\Dev\\HH[^\s"']+/gi, 'C:\\Tools\\hh-ai'],
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
      const skipScrub =
        /^scripts\/(export-public|release-public|release-pack|smoke-release|capture-demo-screenshots)\.mjs$/.test(
          relPath.replace(/\\/g, '/')
        );
      if (
        !skipScrub &&
        ['.mjs', '.js', '.json', '.md', '.txt', '.html', '.css', '.yml', '.yaml', '.env', '.example'].some(
          (e) => ent.name.endsWith(e) || ext === e
        )
      ) {
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

**Подробно:** docs/QUICKSTART.md

\`\`\`powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts/install.ps1
npm run login
npm run dashboard
\`\`\`

\`\`\`bash
# macOS / Linux
bash scripts/install.sh
npm run login
npm run dashboard
\`\`\`

Откройте http://127.0.0.1:3849

## Документация

- docs/README.md — оглавление всей документации HH Ai
- docs/PUBLIC-RELEASE.md — релиз для получателя
- docs/SETUP.md, docs/USAGE.md, docs/BATCH.md, docs/DASHBOARD.md
- docs/SECURITY.md — что не публиковать
- CHANGELOG.md — история версий

HH Ai — [github.com/emildg8/HH_Ai](https://github.com/emildg8/HH_Ai). Идея-основа: Steev193/hh-ru-apply (MIT). См. docs/ATTRIBUTION.md.
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
  const demoQueue = path.join(ROOT, 'docs', 'demo', 'vacancies-demo.json');
  const exampleDest = path.join(OUT, 'data', 'vacancies-queue.example.json');
  if (fs.existsSync(demoQueue)) {
    fs.copyFileSync(demoQueue, exampleDest);
  } else {
    fs.writeFileSync(exampleDest, '[]\n', 'utf8');
  }

  writeExportReadme();
  console.log(`[export-public] OK: ${OUT}`);
}

main();
