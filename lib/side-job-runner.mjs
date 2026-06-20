/**
 * Обёртка для фоновых скриптов с pid-файлом (дашборд видит завершение).
 */

import path from 'path';
import { ROOT } from './paths.mjs';
import { setSideJobPid } from './browser-guard.mjs';
import { spawnBackground } from './spawn-background.mjs';
import { hideSideJobConsole, sideJobHeadlessEnv } from './side-job-spawn.mjs';

/**
 * @param {'syncResponses'|'syncChats'|'dailyRoutine'|'resumeRaise'|'chatReplySend'} sideKey
 * @param {string} scriptName — scripts/<name>.mjs
 * @param {string[]} [extraArgs]
 * @param {Record<string, string>} [envPatch]
 */
export function spawnSideJob(sideKey, scriptName, extraArgs = [], envPatch = {}) {
  const script = path.join(ROOT, 'scripts', scriptName);
  const child = spawnBackground(process.execPath, [script, ...extraArgs], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    hideConsole: hideSideJobConsole(),
    env: sideJobHeadlessEnv(undefined, envPatch),
  });
  setSideJobPid(sideKey, child.pid);
  child.unref();
  child.on('exit', () => setSideJobPid(sideKey, null));
  return child;
}
