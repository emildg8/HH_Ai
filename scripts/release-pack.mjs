/**
 * Релизный архив (полная копия рабочей версии для Emil / DevOps v1.0).
 *   npm run release:pack
 *   npm run release:pack -- --name=HH_DevOps_Emil_v1.0
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';
import { createZipFromDir } from '../lib/archive.mjs';

const nameArg = process.argv.find((a) => a.startsWith('--name='));
const ARCHIVE_NAME = (nameArg ? nameArg.slice(7) : 'HH_DevOps_Emil_v1.0').replace(/[^\w.-]+/g, '_');
const staging = path.join(ROOT, 'releases', '.staging', ARCHIVE_NAME);
const zipPath = path.join(ROOT, 'releases', `${ARCHIVE_NAME}.zip`);

const SKIP = new Set([
  'node_modules',
  '.git',
  '.playwright-browsers',
  'playwright-report',
  'test-results',
  'releases',
  'dist',
  'backups',
]);

/**
 * @param {string} src
 * @param {string} dest
 * @param {string} rel
 */
function copyTree(src, dest, rel = '') {
  if (!fs.existsSync(src)) return;
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${ent.name}` : ent.name;
    if (SKIP.has(ent.name)) continue;
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
  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  fs.mkdirSync(path.join(ROOT, 'releases'), { recursive: true });
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  copyTree(ROOT, staging, '');

  fs.writeFileSync(
    path.join(staging, 'RELEASE-MANIFEST.json'),
    JSON.stringify(
      {
        name: ARCHIVE_NAME,
        version,
        packagedAt: new Date().toISOString(),
        profile: 'devops',
        owner: 'Emil',
        note: 'Полный снимок проекта: код, data, config, CV. Не публиковать — могут быть секреты.',
      },
      null,
      2
    )
  );

  const out = createZipFromDir(staging, zipPath);
  fs.rmSync(path.join(ROOT, 'releases', '.staging'), { recursive: true, force: true });
  console.log(`[release-pack] ${ARCHIVE_NAME} v${version}`);
  console.log(`[release-pack] OK: ${out}`);
}

main();
