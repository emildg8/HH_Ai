/**
 * Фоновый spawn на Windows: без всплывающего окна cmd.
 */

import { spawn } from 'child_process';

/**
 * @param {import('child_process').SpawnOptions} [base]
 * @returns {import('child_process').SpawnOptions}
 */
export function backgroundSpawnOptions(base = {}) {
  const opts = { ...base };
  if (process.platform === 'win32') {
    opts.windowsHide = true;
  }
  return opts;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('child_process').SpawnOptions} [options]
 */
export function spawnBackground(command, args, options = {}) {
  return spawn(command, args, backgroundSpawnOptions(options));
}
