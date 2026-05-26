/** Период воронки: с даты (ISO) или последние N дней. */

export const DEFAULT_FUNNEL_SINCE = '2026-04-01';

/**
 * @param {string|number|Date|undefined} raw
 * @returns {number|null} ms UTC
 */
export function parseSinceMs(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00+03:00` : s;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * @param {{ periodDays?: number, since?: string, sinceDate?: string }} opts
 */
export function parseFunnelPeriodBounds(opts = {}) {
  const envSince = (process.env.HH_FUNNEL_SINCE || process.env.HH_FUNNEL_SINCE_DATE || '').trim();
  const sinceMs =
    parseSinceMs(opts.since ?? opts.sinceDate) ??
    parseSinceMs(envSince) ??
    parseSinceMs(DEFAULT_FUNNEL_SINCE);
  const periodDays = Math.max(0, Number(opts.periodDays) || 0);
  const sinceLabel =
    (opts.since ?? opts.sinceDate ?? '').trim() ||
    (envSince || DEFAULT_FUNNEL_SINCE);
  return { sinceMs, periodDays, sinceLabel };
}

/**
 * @param {string} iso
 * @param {{ sinceMs: number|null, periodDays: number }} bounds
 */
export function isoPassesPeriod(iso, bounds) {
  const { sinceMs, periodDays } = bounds;
  if (!sinceMs && !periodDays) return true;
  if (!iso) return true;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  if (sinceMs && t < sinceMs) return false;
  if (periodDays > 0 && Date.now() - t > periodDays * 86400000) return false;
  return true;
}
