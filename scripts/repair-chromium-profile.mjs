/**
 * Резервная копия повреждённого профиля + новый пустой chromium-profile.
 * Сессия hh.ru — заново npm run login / open-hh.
 *
 *   npm run repair-profile
 */

import fs from 'fs';
import path from 'path';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { sessionProfilePath } from '../lib/paths.mjs';
import { clearStaleBrowserLock } from '../lib/chromium-session.mjs';

function backupProfile(profilePath) {
  if (!fs.existsSync(profilePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bak = `${profilePath}.bak-${stamp}`;
  fs.renameSync(profilePath, bak);
  return bak;
}

async function main() {
  clearStaleBrowserLock();
  const profile = sessionProfilePath();
  const bak = backupProfile(profile);
  fs.mkdirSync(profile, { recursive: true });
  console.log(bak ? `[repair] Старый профиль: ${bak}` : '[repair] Профиля не было.');
  console.log('[repair] Новый пустой профиль:', profile);
  console.log('[repair] Дальше: npm run open-hh  или  npm run login');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
