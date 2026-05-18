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
  const txt = `# HH Ai — публичный экспорт

Собрано: ${new Date().toISOString()}
Версия: ${fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()}

## Быстрый старт

\`\`\`bash
npm install
npx playwright install chromium
cp .env.example .env
cp config/profiles/custom.env.example config/profiles/my-role.env
# отредактируйте my-role.env, задайте HH_PROFILE=my-role
npm run login
npm run dashboard
\`\`\`

См. docs/SETUP.md и docs/SECURITY.md.
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
