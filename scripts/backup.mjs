/**
 * Резервная копия данных и конфигов (локально, с секретами — не выкладывать в git).
 *   npm run backup
 *   npm run backup -- --label=before-harvest
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { createZipFromDir } from '../lib/archive.mjs';

const BACKUP_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.playwright-browsers',
  'playwright-report',
  'test-results',
  'backups',
  'releases',
  'dist',
]);

const labelArg = process.argv.find((a) => a.startsWith('--label='));
const label = labelArg ? labelArg.slice(8).trim().replace(/[^\w.-]+/g, '_') : '';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outName = label ? `backup_${stamp}_${label}` : `backup_${stamp}`;
const staging = path.join(ROOT, 'backups', '.staging', outName);
const zipPath = path.join(ROOT, 'backups', `${outName}.zip`);

/**
 * @param {string} src
 * @param {string} dest
 * @param {string} rel
 */
function copyTree(src, dest, rel = '') {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (BACKUP_SKIP_DIRS.has(ent.name)) continue;
    const srcPath = path.join(src, ent.name);
    const destPath = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTree(srcPath, destPath, relPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  fs.mkdirSync(path.join(ROOT, 'backups'), { recursive: true });
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  const version = fs.existsSync(path.join(ROOT, 'VERSION'))
    ? fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()
    : '0.0.0';
  fs.writeFileSync(
    path.join(staging, 'BACKUP-MANIFEST.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        version,
        node: process.version,
        warning: 'Архив может содержать секреты и cookies — храните локально',
      },
      null,
      2
    )
  );

  for (const dir of ['data', 'config', 'CV', 'dashboard']) {
    copyTree(path.join(ROOT, dir), path.join(staging, dir), dir);
  }
  for (const f of ['.env', 'VERSION', 'CHANGELOG.md', 'package.json']) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.join(staging, '_root'), { recursive: true });
      fs.copyFileSync(src, path.join(staging, '_root', f));
    }
  }
  copyTree(path.join(ROOT, 'lib'), path.join(staging, 'lib'), 'lib');
  copyTree(path.join(ROOT, 'scripts'), path.join(staging, 'scripts'), 'scripts');

  const out = createZipFromDir(staging, zipPath);
  fs.rmSync(path.join(ROOT, 'backups', '.staging'), { recursive: true, force: true });
  console.log(`[backup] OK: ${out}`);
}

main();
