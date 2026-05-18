/**
 * Периодические сообщения в лог, пока идёт долгий шаг (чат, iframe, мастер отклика).
 * @param {(msg: string) => void} log
 * @param {string} label
 * @param {number} [intervalMs]
 */
export function startStepHeartbeat(log, label, intervalMs = 12_000) {
  const started = Date.now();
  let tick = 0;
  const iv = setInterval(() => {
    tick += 1;
    const sec = Math.round((Date.now() - started) / 1000);
    log(`… всё ещё: ${label} (${sec} с, пинг ${tick})`);
  }, intervalMs);
  return () => clearInterval(iv);
}

/**
 * @template T
 * @param {(msg: string) => void} log
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @param {number} [intervalMs]
 */
export async function withStepHeartbeat(log, label, fn, intervalMs = 12_000) {
  const stop = startStepHeartbeat(log, label, intervalMs);
  try {
    return await fn();
  } finally {
    stop();
  }
}
