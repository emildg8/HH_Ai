/**
 * Цикл обучения: классификация исходов, сводка, снимок для агента.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { computeConversionStats } from './conversion-stats.mjs';
import { classifyAllRecords, classifyRecordOutcome } from './outcome-classifier.mjs';
import { buildEmployerProfiles } from './employer-intelligence.mjs';
import { loadPreferences } from './preferences.mjs';
import { loadMarketSkills, compareMarketVsCv, readCvTextSync } from './market-skills.mjs';
import { listViewedProactiveCandidates } from './viewed-proactive.mjs';
import { scoreSource } from './source-quality.mjs';
import { syncEmployerProfilesToKnowledge } from './employer-dossier.mjs';

export const INTELLIGENCE_DIGEST_FILE = path.join(DATA_DIR, 'intelligence-digest.json');
export const INTELLIGENCE_BASELINE_FILE = path.join(DATA_DIR, 'intelligence-baseline.json');
export const PLAN_SNAPSHOTS_DIR = path.join(DATA_DIR, 'plan-snapshots');

/**
 * @param {{ writeDigest?: boolean, label?: string }} [opts]
 */
export function runIntelligenceLoop(opts = {}) {
  const union = loadAnalyticsUnionRecords();
  const records = union.records;
  const conversion = computeConversionStats();
  const classified = classifyAllRecords(records);
  const employers = buildEmployerProfiles(records).sort((a, b) => b.score - a.score);

  const applied = conversion.applied || 0;
  const cRate = applied ? Math.round((classified.summary.C / applied) * 100) : 0;
  const eRate = applied ? Math.round((classified.summary.E / applied) * 100) : 0;
  const viewedProactive = listViewedProactiveCandidates(records, { minDays: 3, limit: 10 });

  /** @type {Record<string, { added: number, applied: number, viewed: number, invited: number, ghost: number }>} */
  const bySource = {};
  /** @type {Record<string, number> } */
  const byTier = { A: 0, B: 0, C: 0, D: 0 };

  for (const rec of records) {
    const src = String(rec?.source || 'hh').toLowerCase();
    if (!bySource[src]) {
      bySource[src] = { added: 0, applied: 0, viewed: 0, invited: 0, ghost: 0 };
    }
    bySource[src].added++;
    const tier = scoreSource(rec, { allRecords: records }).sourceQualityTier;
    if (byTier[tier] != null) byTier[tier]++;
    const applied =
      rec.hhApply?.responseSubmitted ||
      rec.status === 'responded' ||
      ['already_applied', 'invited', 'declined', 'viewed', 'awaiting'].includes(
        String(rec.hhApply?.hhSiteState || '')
      );
    if (applied) bySource[src].applied++;
    const o = classifyRecordOutcome(rec);
    if (o.bucket === 'E' || o.bucket === 'F') bySource[src].invited++;
    if (o.bucket === 'B') bySource[src].ghost++;
    if (String(rec.hhApply?.hhSiteState || '') === 'viewed') bySource[src].viewed++;
  }

  const digest = {
    at: new Date().toISOString(),
    label: opts.label || 'routine',
    conversion,
    buckets: classified.summary,
    rates: {
      templateRejectPct: cRate,
      slotPct: eRate,
      viewPct: conversion.rates?.viewPct ?? 0,
      invitePct: conversion.rates?.invitePct ?? 0,
    },
    topEmployers: employers.slice(0, 10),
    ghostEmployers: employers.filter((e) => e.applied >= 2 && e.ghost >= e.invited).slice(0, 5),
    viewedProactive,
    bySource,
    byTier,
    prefsSnapshot: {
      batchAutoApproveBestLetter: loadPreferences().batchAutoApproveBestLetter,
      batchLetterMinScore10: loadPreferences().batchLetterMinScore10,
      minKeywordGapScore: loadPreferences().minKeywordGapScore,
      applyIntelligence: {
        enabled: loadPreferences().applyIntelligence?.enabled,
        minGateScore: loadPreferences().applyIntelligence?.minGateScore,
        knowledgeStoreEnabled: loadPreferences().applyIntelligence?.knowledgeStoreEnabled,
      },
    },
    suggestions: [],
  };

  if (cRate > 30) {
    digest.suggestions.push('Отказы >30%: ужесточить отбор или усилить письма/резюме под ключи.');
  }
  if ((conversion.rates?.viewPct ?? 0) < 20 && applied >= 10) {
    digest.suggestions.push('Мало просмотров: поднять резюме, проверить ключевые слова в «О себе».');
  }
  for (const g of digest.ghostEmployers) {
    digest.suggestions.push(`Ghost: ${g.company} — рассмотреть чёрный список.`);
  }
  if (viewedProactive.length) {
    digest.suggestions.push(
      `Просмотр без ответа 3+ дн.: ${viewedProactive.length} — можно отправить короткое напоминание в чат.`
    );
  }
  const tierA = byTier.A || 0;
  const tierC = byTier.C || 0;
  if (tierC > tierA * 2 && tierC > 50) {
    digest.suggestions.push('Много tier-C в очереди — сместить усилия на tier A/B (ATS, свежий hh).');
  }

  const prefs = loadPreferences();
  if (prefs.marketSkillsEnabled) {
    const role = String(process.env.HH_PROFILE || 'devops').trim().toLowerCase();
    const bundle = loadMarketSkills(role);
    if (bundle.skills.length) {
      const marketCmp = compareMarketVsCv(readCvTextSync(), bundle.skills, { topN: 15 });
      digest.marketCoveragePct = marketCmp.coveragePct;
      if (marketCmp.coveragePct < 50) {
        const hint = marketCmp.missing.slice(0, 5).join(', ');
        digest.suggestions.push(
          `Покрытие топ-навыков роли ${marketCmp.coveragePct}% — добавьте в резюме: ${hint} (см. панель «Рынок навыков»).`
        );
      }
    }
  }

  if (opts.writeDigest !== false) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(INTELLIGENCE_DIGEST_FILE, `${JSON.stringify(digest, null, 2)}\n`, 'utf8');
  }

  return digest;
}

/**
 * Снимок состояния для отката и отчётов.
 */
export function capturePlanSnapshot(label = 'manual') {
  fs.mkdirSync(PLAN_SNAPSHOTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const digest = runIntelligenceLoop({ label, writeDigest: true });
  const snapPath = path.join(PLAN_SNAPSHOTS_DIR, `snapshot-${stamp}.json`);
  fs.writeFileSync(snapPath, `${JSON.stringify(digest, null, 2)}\n`, 'utf8');
  return { path: snapPath, digest };
}

export function writeIntelligenceBaseline(opts = {}) {
  const digest = runIntelligenceLoop({ label: opts.label || 'baseline', writeDigest: false });
  try {
    const union = loadAnalyticsUnionRecords();
    digest.employerSync = syncEmployerProfilesToKnowledge(union.records);
  } catch (e) {
    digest.employerSync = {
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const payload = {
    ...digest,
    baselineMeta: {
      capturedAt: digest.at,
      wave: opts.wave || '1',
      note: opts.note || '',
      cliLabel: opts.label || 'baseline',
    },
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INTELLIGENCE_BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}
