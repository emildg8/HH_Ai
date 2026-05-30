/**
 * Публичный релиз для передачи другим: export без секретов + zip.
 *   npm run release:public
 *   npm run release:public -- --out=dist/hh-ai-public
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT } from '../lib/paths.mjs';
import { createZipFromDir } from '../lib/archive.mjs';

const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = path.resolve(outArg ? outArg.slice(6) : path.join(ROOT, 'dist', 'hh-ai-public'));

function readVersion() {
  return fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
}

function runExport() {
  const r = spawnSync(process.execPath, ['scripts/export-public.mjs', `--out=${OUT}`], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function writeManifest(version) {
  const releasesDir = path.join(ROOT, 'releases');
  fs.mkdirSync(releasesDir, { recursive: true });
  const manifest = {
    kind: 'public',
    version,
    packagedAt: new Date().toISOString(),
    directory: OUT,
    zip: path.join(releasesDir, `hh-ai-public-v${version}.zip`),
    includes: [
      'lib',
      'scripts',
      'dashboard',
      'config (examples only)',
      'docs',
      'package.json',
      'README.md',
      'CHANGELOG.md',
      'SECURITY.md',
      '.env.example',
    ],
    excludes: [
      'data/session',
      'data/vacancies-*.json',
      'config/profiles/*.env (real)',
      'config/secrets.local.env',
      'CV/',
      'API keys',
    ],
    recipientGuide: 'docs/PUBLIC-RELEASE.md',
    quickStart: ['npm install', 'npx playwright install chromium', 'cp .env.example .env', 'npm run login', 'npm run dashboard'],
  };
  const manifestPath = path.join(releasesDir, `RELEASE-public-v${version}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function main() {
  const version = readVersion();
  console.log(`[release-public] HH Ai v${version} — публичный экспорт`);
  runExport();

  const zipPath = path.join(ROOT, 'releases', `hh-ai-public-v${version}.zip`);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  const archived = createZipFromDir(OUT, zipPath);
  const portableAlias = path.join(ROOT, 'releases', `hh-ru-apply-win-x64-v${version}.zip`);
  try {
    fs.copyFileSync(archived, portableAlias);
    console.log(`[release-public] Portable alias: ${portableAlias}`);
  } catch (e) {
    console.warn(`[release-public] Portable alias skip: ${e.message || e}`);
  }
  const manifest = writeManifest(version);
  manifest.zip = archived;

  console.log(`[release-public] Каталог: ${OUT}`);
  console.log(`[release-public] Zip: ${archived}`);
  console.log(`[release-public] Манифест: releases/RELEASE-public-v${version}.json`);
  console.log('[release-public] Получатель: docs/PUBLIC-RELEASE.md внутри архива');
}

main();
