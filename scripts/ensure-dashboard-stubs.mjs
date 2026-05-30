/**
 * Создаёт опциональные локальные файлы дашборда из example (если отсутствуют).
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const pairs = [
  ['dashboard/public/local-dashboard-defaults.example.mjs', 'dashboard/public/local-dashboard-defaults.mjs'],
];

for (const [src, dest] of pairs) {
  const sp = path.join(ROOT, src);
  const dp = path.join(ROOT, dest);
  if (fs.existsSync(sp) && !fs.existsSync(dp)) {
    fs.copyFileSync(sp, dp);
  }
}
