/**
 * Фоновый spawn на Windows: без всплывающего окна cmd.
 */

import { spawn } from 'child_process';

/**
 * @param {import('child_process').SpawnOptions} [base]
 * @returns {import('child_process').SpawnOptions}
 */
/**
 * @param {import('child_process').SpawnOptions} [base]
 * @param {boolean} [hideConsole=true]
 */
export function backgroundSpawnOptions(base = {}, hideConsole = true) {
  const opts = { ...base };
  if (process.platform === 'win32') {
    opts.windowsHide = hideConsole !== false;
  }
  return opts;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions & { hideConsole?: boolean }} [options]
 */
export function spawnBackground(command, args, options = {}) {
  const hideConsole = options.hideConsole !== false;
  const { hideConsole: _drop, ...spawnOpts } = options;
  return spawn(command, args, backgroundSpawnOptions(spawnOpts, hideConsole));
}
