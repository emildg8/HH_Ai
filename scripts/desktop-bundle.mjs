/**
 * Сборка ресурсов для Tauri installer (фаза 4).
 *   node scripts/desktop-bundle.mjs
 *   BUNDLE_NODE=1 — копировать node.exe (Windows CI / release)
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT } from '../lib/paths.mjs';

const DESKTOP = path.join(ROOT, 'desktop', 'hh-ai-desktop');
const OUT = path.join(DESKTOP, 'src-tauri', 'resources', 'hh-ai');
const NODE_OUT = path.join(DESKTOP, 'bundled', 'node');
const bundleNode = process.env.BUNDLE_NODE === '1' || process.argv.includes('--bundle-node');

function runExport() {
  if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
  const r = spawnSync(process.execPath, ['scripts/export-public.mjs', `--out=${OUT}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function bundleNodeBinary() {
  if (process.platform !== 'win32') {
    console.log('[desktop-bundle] BUNDLE_NODE пропущен (не Windows)');
    return;
  }
  fs.mkdirSync(NODE_OUT, { recursive: true });
  const candidates = [
    process.execPath,
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
  ];
  const src = candidates.find((p) => p && fs.existsSync(p));
  if (!src) {
    console.warn('[desktop-bundle] node.exe не найден — installer потребует Node в PATH');
    return;
  }
  fs.copyFileSync(src, path.join(NODE_OUT, 'node.exe'));
  console.log(`[desktop-bundle] node.exe ← ${src}`);
}

function writeBundleMeta() {
  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  const metaDir = path.join(DESKTOP, 'bundled');
  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(
    path.join(metaDir, 'bundle-meta.json'),
    JSON.stringify({ version, bundledAt: new Date().toISOString(), bundleNode }, null, 2)
  );
}

function main() {
  console.log('[desktop-bundle] экспорт HH Ai для Tauri resources…');
  runExport();
  if (bundleNode) bundleNodeBinary();
  writeBundleMeta();
  if (bundleNode && process.platform === 'win32' && !fs.existsSync(path.join(NODE_OUT, 'node.exe'))) {
    console.error('[desktop-bundle] FAIL: node.exe не скопирован (нужен для NSIS)');
    process.exit(1);
  }
  console.log(`[desktop-bundle] OK: ${OUT}`);
}

main();
