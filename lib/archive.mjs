/**
 * Создание zip-архива каталога (Windows: Compress-Archive, иначе tar.gz).
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * @param {string} sourceDir — каталог-источник (содержимое, не сам каталог)
 * @param {string} zipPath — путь к .zip
 */
export function createZipFromDir(sourceDir, zipPath) {
  const src = path.resolve(sourceDir);
  const dest = path.resolve(zipPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.unlinkSync(dest);

  if (process.platform === 'win32') {
    const ps = [
      '-NoProfile',
      '-Command',
      `Compress-Archive -LiteralPath '${src.replace(/'/g, "''")}\\*' -DestinationPath '${dest.replace(/'/g, "''")}' -CompressionLevel Optimal -Force`,
    ];
    const r = spawnSync('powershell', ps, { stdio: 'inherit', shell: false });
    if (r.status !== 0) throw new Error(`Compress-Archive failed (${r.status})`);
    return dest;
  }

  const parent = path.dirname(src);
  const base = path.basename(src);
  const r = spawnSync('zip', ['-r', '-q', dest, base], { cwd: parent, stdio: 'inherit' });
  if (r.status === 0) return dest;

  const tgz = dest.replace(/\.zip$/i, '.tar.gz');
  const r2 = spawnSync('tar', ['-czf', tgz, '-C', parent, base], { stdio: 'inherit' });
  if (r2.status !== 0) throw new Error('Neither zip nor tar available for archiving');
  return tgz;
}
