/**
 * Честность store: пересчёт workFormat с локального parse + статус из hhApply.
 * Без Playwright. Одна запись очереди в конце (не N× saveQueue).
 * Для chip «на месте» — devops:backfill-work-format.
 *
 *   npm run devops:repair-store-truth -- --dry-run
 *   npm run devops:repair-store-truth:emil
 *   npm run devops:repair-store-truth:emil -- --quiet
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { loadQueue, saveQueue } from '../lib/store.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { parseWorkFormatMeta, buildWorkFormatNote } from '../lib/vacancy-work-format.mjs';
import {
  buildWorkFormatSyncPatch,
  formatNeedsPageVerify,
  statusPatchFromNegotiation,
} from '../lib/work-format-truth.mjs';

function parseArgs(argv) {
  const opts = { limit: 0, dryRun: false, quiet: false };
  for (const a of argv) {
    if (a.startsWith('--limit=')) opts.limit = Math.max(0, Number(a.slice(8)) || 0);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--quiet') opts.quiet = true;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prefs = loadPreferences();
  const queue = loadQueue({ force: true }).map((r) => ({ ...r }));
  let formatSynced = 0;
  let statusSynced = 0;
  let needsBackfill = 0;
  let touched = 0;

  for (let i = 0; i < queue.length; i++) {
    if (opts.limit > 0 && touched >= opts.limit) break;
    const rec = queue[i];

    /** @type {object} */
    const patch = {};
    const meta = parseWorkFormatMeta(rec, prefs);
    const wfPatch = buildWorkFormatSyncPatch(rec, meta);
    if (wfPatch) {
      Object.assign(patch, wfPatch);
      patch.remoteNote = buildWorkFormatNote(meta);
    }

    const neg =
      rec.hhApply?.negotiationStatus ||
      (rec.hhApply?.hhSiteState === 'declined' ? 'declined' : '');
    if (neg === 'declined' || rec.hhApply?.hhSiteState === 'declined') {
      Object.assign(patch, statusPatchFromNegotiation(rec.status, 'declined'));
    } else if (
      rec.hhApply?.hhSiteState &&
      ['already_applied', 'invited', 'viewed', 'awaiting'].includes(rec.hhApply.hhSiteState) &&
      (rec.status === 'pending' || rec.status === 'approved' || !rec.status)
    ) {
      Object.assign(patch, statusPatchFromNegotiation(rec.status, 'awaiting'));
    }

    if (formatNeedsPageVerify(rec, meta)) needsBackfill++;

    if (!Object.keys(patch).length) continue;
    touched++;
    if (wfPatch) formatSynced++;
    if (patch.status) statusSynced++;

    if (!opts.quiet && (opts.dryRun || touched <= 20 || touched % 200 === 0)) {
      const label = `${String(rec.company || '').slice(0, 24)} — ${String(rec.title || '').slice(0, 36)}`;
      console.log(
        `  ${opts.dryRun ? '· dry' : '✓'} ${String(rec.id).slice(0, 8)} status ${rec.status}→${patch.status || rec.status} format ${rec.workFormat?.format}→${meta.format} ${label}`
      );
    }

    if (!opts.dryRun) {
      const next = { ...rec, updatedAt: new Date().toISOString(), ...patch };
      queue[i] = next;
    }
  }

  if (!opts.dryRun && touched > 0) {
    console.log(`[repair-store-truth] пишу очередь (${touched} правок)…`);
    saveQueue(queue);
  }

  console.log(
    `[repair-store-truth] formatSynced=${formatSynced} statusSynced=${statusSynced} needsBackfill=${needsBackfill} dry=${opts.dryRun}`
  );
  return { formatSynced, statusSynced, needsBackfill };
}

main();
