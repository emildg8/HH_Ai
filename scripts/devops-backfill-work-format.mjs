/**
 * Дообогащение workFormatLine / address с hh.ru для pending без формата.
 * Без live apply. Playwright (fetchVacancyTextFromHh).
 *
 *   npm run devops:backfill-work-format -- --limit=15
 *   npm run devops:backfill-work-format:emil -- --limit=20 --tracks=devops,infra
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { loadQueue, updateVacancyRecord, getVacancyRecord } from '../lib/store.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import { classifyVacancyHuntTrack } from '../lib/hunt-tracks.mjs';
import { vacancyHhSiteBlocked } from '../lib/vacancy-hh-apply.mjs';
import { fetchVacancyTextFromHh } from '../lib/refresh-vacancy-from-hh.mjs';
import { parseWorkFormatMeta } from '../lib/vacancy-work-format.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import {
  formatNeedsPageVerify,
  isThinEmployerSiteChip,
} from '../lib/work-format-truth.mjs';

function parseArgs(argv) {
  const opts = { limit: 15, tracks: ['devops', 'infra'], dryRun: false, minScore: 60 };
  for (const a of argv) {
    if (a.startsWith('--limit=')) opts.limit = Math.max(1, Number(a.slice(8)) || 15);
    else if (a.startsWith('--tracks=')) {
      opts.tracks = a
        .slice(9)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    } else if (a.startsWith('--min-score=')) opts.minScore = Number(a.slice(12)) || 60;
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

function needsFormatBackfill(rec, prefs) {
  if (rec.formatVerifiedAt) return false;
  if (rec.hhMeta?.scheduleId === 'remote') return false;
  if (Array.isArray(rec.hhMeta?.workFormats) && rec.hhMeta.workFormats.length) return false;
  if (formatNeedsPageVerify(rec) || isThinEmployerSiteChip(rec.workFormatLine)) return true;
  const assess = assessVacancyForApply(rec, { prefs });
  if (/Формат не указан|не подтверждён со страницы/i.test(String(assess.skipReason || ''))) {
    return true;
  }
  // Пустая строка: не трогаем, если адрес уже дал офис/удалёнку/гибрид.
  if (String(rec.workFormatLine || '').trim()) return false;
  const meta = parseWorkFormatMeta(rec, prefs);
  const fmt = String(meta?.format || '');
  return !fmt || fmt === 'не указан';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prefs = loadPreferences();
  const queue = loadQueue({ force: true });

  const candidates = queue
    .filter((r) => r.status === 'pending' && !r.hidden && r.url && !vacancyHhSiteBlocked(r))
    .filter((r) => opts.tracks.includes(classifyVacancyHuntTrack(r) || ''))
    .filter((r) => Number(r.scoreOverall || 0) >= opts.minScore)
    .filter((r) => needsFormatBackfill(r, prefs))
    .sort((a, b) => {
      const aUnk = /Формат не указан/i.test(
        String(assessVacancyForApply(a, { prefs }).skipReason || '')
      )
        ? 0
        : 1;
      const bUnk = /Формат не указан/i.test(
        String(assessVacancyForApply(b, { prefs }).skipReason || '')
      )
        ? 0
        : 1;
      if (aUnk !== bUnk) return aUnk - bUnk;
      // Сначала без адреса (адрес уже даёт office-inference без hh).
      const aa = String(a.address || '').trim() ? 1 : 0;
      const ba = String(b.address || '').trim() ? 1 : 0;
      if (aa !== ba) return aa - ba;
      return Number(b.scoreOverall || 0) - Number(a.scoreOverall || 0);
    })
    .slice(0, opts.limit);

  console.log(
    `[backfill-work-format] кандидатов: ${candidates.length} (limit=${opts.limit}, tracks=${opts.tracks.join(',')}${opts.dryRun ? ', dry-run' : ''})`
  );

  let updated = 0;
  let failed = 0;
  /** @type {object[]} */
  const results = [];

  for (const rec of candidates) {
    const label = `${String(rec.company || '').slice(0, 28)} — ${String(rec.title || '').slice(0, 40)}`;
    if (opts.dryRun) {
      console.log(`  · dry ${rec.id.slice(0, 8)} ${label}`);
      results.push({ id: rec.id, dry: true });
      continue;
    }
    try {
      const parsed = await fetchVacancyTextFromHh(rec.url);
      const workFormatLine = String(parsed.workFormat || '').trim();
      const address = String(parsed.address || rec.address || '').trim();
      const employment = String(parsed.employment || rec.employment || '').trim();
      const patch = {
        workFormatLine: workFormatLine || rec.workFormatLine || '',
        address: address || rec.address || '',
        employment: employment || rec.employment || '',
        updatedAt: new Date().toISOString(),
      };
      if (parsed.description && String(parsed.description).length > 80) {
        patch.descriptionPreview = String(parsed.description).slice(0, 600);
        if (!String(rec.descriptionForLlm || '').trim() || String(rec.descriptionForLlm).length < 200) {
          patch.descriptionForLlm = String(parsed.description).slice(0, 6000);
        }
      }
      const meta = parseWorkFormatMeta({ ...rec, ...patch }, prefs);
      patch.workFormat = meta;
      patch.remoteNote = meta.format || rec.remoteNote;
      patch.formatVerifiedAt = new Date().toISOString();
      patch.formatSource = 'vacancy_page';

      updateVacancyRecord(rec.id, patch);
      const fresh = getVacancyRecord(rec.id);
      const assess = assessVacancyForApply(fresh, { prefs });
      updated++;
      console.log(
        `  ✓ ${rec.id.slice(0, 8)} line="${String(patch.workFormatLine).slice(0, 40)}" format=${meta.format} eligible=${assess.eligible}${assess.eligible ? '' : ` (${assess.skipReason || ''})`}`
      );
      results.push({
        id: rec.id,
        workFormatLine: patch.workFormatLine,
        format: meta.format,
        eligible: assess.eligible,
        reason: assess.skipReason || null,
      });
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${rec.id.slice(0, 8)} ${label}: ${err?.message || err}`);
      results.push({ id: rec.id, error: String(err?.message || err) });
    }
  }

  console.log(`[backfill-work-format] готово: updated=${updated} failed=${failed}`);
  return { updated, failed, results };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
