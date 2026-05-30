/**
 * Проверки перед батчем откликов.
 */

import fs from 'fs';
import {
  clearStaleBrowserLock,
  getBrowserLockInfo,
  repairChromiumProfileCaches,
} from './chromium-session.mjs';
import { sessionProfilePath } from './paths.mjs';
import { applyRateLimitsSnapshot } from './hh-apply-rate.mjs';

/**
 * @param {(s: string) => void} [log]
 */
export function runBatchPreflight(log = (s) => console.log(s)) {
  const warnings = [];
  clearStaleBrowserLock();
  const lock = getBrowserLockInfo();
  if (lock.held) {
    warnings.push(`Профиль Chromium занят (${lock.owner}, pid=${lock.pid})`);
  }

  const profile = sessionProfilePath();
  if (!fs.existsSync(profile)) {
    warnings.push('Нет профиля Chromium — выполните npm run login');
  }

  const rates = applyRateLimitsSnapshot();
  if (rates.lastDay >= rates.maxPerDay) {
    warnings.push(`Дневной лимит откликов исчерпан (${rates.lastDay}/${rates.maxPerDay})`);
  }

  for (const w of warnings) log(`[batch-preflight] ⚠ ${w}`);
  if (!warnings.length) log('[batch-preflight] OK: lock свободен, лимиты в норме');

  return { ok: warnings.every((w) => !/исчерпан|Нет профиля/i.test(w)), warnings, rates, lock };
}

/**
 * Лёгкий repair кэшей профиля (если прошлый запуск падал на старте Chromium).
 * @param {(s: string) => void} [log]
 */
export function repairProfileIfNeeded(log = () => {}) {
  const { removed } = repairChromiumProfileCaches(sessionProfilePath());
  if (removed > 0) log(`[batch-preflight] Сброшены кэши профиля (${removed} кат.)`);
}
