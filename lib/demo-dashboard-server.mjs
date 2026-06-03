/**
 * Запуск дашборда с demo-очередью для тестов и gate-check.
 */
import { spawn } from 'child_process';
import { ROOT } from './paths.mjs';

/**
 * @param {{ port?: number, queueFile?: string, env?: Record<string, string> }} [opts]
 */
export function startDemoDashboard(opts = {}) {
  const port = opts.port ?? 3849;
  const queueFile = opts.queueFile ?? './docs/demo/vacancies-demo.json';
  const child = spawn(
    process.execPath,
    ['scripts/dashboard-server.mjs', `--port=${port}`, `--queue-file=${queueFile}`],
    {
      cwd: ROOT,
      stdio: 'ignore',
      env: { ...process.env, HH_VACANCIES_QUEUE_FILE: queueFile, ...opts.env },
    }
  );
  return { child, port, base: `http://127.0.0.1:${port}`, queueFile };
}

/** @param {string} url @param {number} [ms] */
export async function waitDashboardHttp(url, ms = 30_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** @param {import('child_process').ChildProcess | null} child */
export async function stopDemoDashboard(child) {
  if (!child) return;
  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 600));
}
