import { spawn } from 'child_process';
import path from 'path';
import { ROOT } from './paths.mjs';

/** По умолчанию 90с; откат HH_DELIVER_LETTER_TIMEOUT_MS=0 — без лимита. */
function deliverLetterTimeoutMs() {
  const raw = String(process.env.HH_DELIVER_LETTER_TIMEOUT_MS ?? '90000').trim();
  if (raw === '0' || raw.toLowerCase() === 'off') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

/**
 * Отдельный процесс deliver-letter на свежем Chromium (обход мёртвого apply-контекста).
 * @param {{ recordId: string, instance?: string, log?: (msg: string) => void, timeoutMs?: number }} opts
 * @returns {Promise<number>}
 */
export function runDeliverLetterVacancy(opts) {
  const { recordId, instance = process.env.HH_INSTANCE_ID || 'emil', log } = opts;
  const id = String(recordId || '').trim();
  if (!id) return Promise.reject(new Error('runDeliverLetterVacancy: пустой recordId'));
  const timeoutMs =
    opts.timeoutMs != null && Number.isFinite(Number(opts.timeoutMs))
      ? Number(opts.timeoutMs)
      : deliverLetterTimeoutMs();

  return new Promise((resolve, reject) => {
    log?.(`[spawn-deliver-letter] instance=${instance} id=${id.slice(0, 8)}…`);
    const child = spawn(
      process.execPath,
      [
        path.join(ROOT, 'scripts/run-with-instance.mjs'),
        `--instance=${instance}`,
        '--',
        'node',
        path.join(ROOT, 'scripts/devops-deliver-letter-vacancy.mjs'),
        `--id=${id}`,
      ],
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env } }
    );

    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        log?.(
          `[spawn-deliver-letter] timeout ${timeoutMs}ms — kill pid=${child.pid} id=${id.slice(0, 8)}`
        );
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            if (!child.killed) child.kill('SIGKILL');
          } catch {
            /* ignore */
          }
        }, 3000).unref?.();
        reject(new Error(`deliver-letter timeout ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref?.();
    }

    child.on('error', (err) => {
      clear();
      reject(err);
    });
    child.on('close', (code) => {
      clear();
      if (code === 0) resolve(code ?? 0);
      else reject(new Error(`deliver-letter exit ${code}`));
    });
  });
}
