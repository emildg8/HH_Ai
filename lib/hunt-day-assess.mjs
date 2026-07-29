/**
 * Комплексная оценка карточки до ship (без Playwright).
 * Вердикт: go | conditional | no-go.
 */
import { getVacancyRecord, loadQueue } from './store.mjs';
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { assessOnlySitePreflight } from './point-apply-only-preflight.mjs';
import { assessPointApplyBlocked } from './point-apply-gate.mjs';
import { assessLetterQuality } from './letter-quality.mjs';
import { letterTextFromVacancyRecord } from './letter-wave-fingerprint.mjs';
import {
  getPointApplyAutoTracks,
  pointApplyTrackQuotaSummary,
  trackQuotaRemaining,
} from './point-apply-track-quotas.mjs';
import { getExcludedStateIds, loadBasketPacksConfig } from './basket-packs.mjs';
import { resolvePointApplyPool } from './point-apply-precheck.mjs';
import { loadPreferences } from './preferences.mjs';
import { assessVacancyForApply } from './vacancy-targeting.mjs';
import { titleLooksL1HelpdeskRole } from './role-classify.mjs';
import { pointApplyLetterSoftForReady } from './point-apply-prepare-policy.mjs';
import { parseWorkFormatMeta } from './vacancy-work-format.mjs';
import { questionnaireHasLiveProbe } from './hh-questionnaire-auto.mjs';
import { recordNeedsQuestionnaireWork } from './questionnaire-labels.mjs';
import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { huntDayNpmScriptForInstance } from './hunt-day-orchestrator.mjs';
import { textMentions1CRole, passesNot1CRole } from './filters.mjs';
import { prepareHuntDayNegotiations } from './hunt-day-negotiations-prep.mjs';

const TITLE_NOISE =
  /account manager|менеджер по продаж|KAM\b|консультант линии (?:автомобил|поддержки авто)|автовладел|менеджер по работе с клиент|маркетолог|рекрутер/i;
/** Windows / офис — не IT L2. 1С — через textMentions1CRole (\b ломается на кириллице). */
const TITLE_OUT_OF_PROFILE =
  /windows|офисный\s+поддерж|помощник руководителя/i;

/** Live parse — не доверять stale workFormat/remoteNote («удалёнка» при chip «на месте»). */
function liveWorkFormat(rec, prefs) {
  try {
    return parseWorkFormatMeta(rec, prefs || {});
  } catch {
    return null;
  }
}

/**
 * @param {object} rec
 * @param {{ prefs?: object, excludedIds?: Set<string>, forceOnly?: boolean }} [opts]
 */
export async function assessVacancyForShip(rec, opts = {}) {
  const prefs = opts.prefs || loadPreferences();
  /** @type {string[]} */
  const blockers = [];
  /** @type {string[]} */
  const warnings = [];

  if (!rec?.id) {
    return {
      id: null,
      verdict: 'no-go',
      blockers: ['нет карточки'],
      warnings: [],
      track: null,
      score: null,
    };
  }

  const track = String(rec.huntTrack || classifyVacancyHuntTrack(rec) || '').toLowerCase() || null;
  const score = Number(rec.scoreOverall ?? rec.scoreFit ?? rec.geminiScore ?? rec.score ?? 0) || 0;
  const title = String(rec.title || '');
  const company = String(rec.company || rec.employer || '');
  const letter = letterTextFromVacancyRecord(rec);
  const letterLen = letter.trim().length;
  const wfLive = liveWorkFormat(rec, prefs);
  const remote = Boolean(wfLive ? wfLive.hasRemote && !wfLive.officeOnly : rec.workFormat?.hasRemote);
  const hybrid = Boolean(wfLive ? wfLive.hasHybrid && !wfLive.officeOnly : rec.workFormat?.hasHybrid);

  const status = String(rec.status || 'pending');
  if (['applied', 'responded', 'declined', 'archived', 'skipped', 'rejected'].includes(status)) {
    blockers.push(`status=${status}`);
  }
  if (rec.hhApply?.state === 'submitted') {
    blockers.push('hhApply.state=submitted');
  }

  const excluded = opts.excludedIds || getExcludedStateIds(loadBasketPacksConfig());
  if (excluded.has(rec.id)) {
    blockers.push('в state declined/applied pack — не слать');
  }

  if (TITLE_NOISE.test(title)) {
    blockers.push('шумный title (sales/AM) — вне профиля');
  }
  if (TITLE_OUT_OF_PROFILE.test(title) || /мосстройразвитие/i.test(company)) {
    blockers.push('вне профиля (Windows/офис) — не слать');
  }
  const oneC = passesNot1CRole({ title, description: '', employment: '' }, prefs);
  if (!oneC.pass || textMentions1CRole(title)) {
    blockers.push('вне профиля (1С) — не слать');
  }
  if (titleLooksL1HelpdeskRole(title)) {
    blockers.push('L1 поддержка (нужен L2+)');
  }

  // Crypto-роль — только через targeting-policy (не бан компании «Криптонит» / blockchain в имени).
  if (/\bsecurity\b|devsecops|secops|информационн\w*\s+безопас/i.test(title) && !/sre|devops|platform/i.test(title)) {
    blockers.push('targeting: security — minus на apply');
  }
  if (/Infrastructure Security/i.test(title)) {
    blockers.push('targeting: Infrastructure Security — minus на apply');
  }

  try {
    const targeting = assessVacancyForApply(rec, { prefs, userApproved: Boolean(rec.userApproved) });
    if (targeting && targeting.eligible === false) {
      const cat = String(targeting.category || '');
      // work-format alone already covered by remote warning; hard-fail niche categories
      if (/off-target|security|crypto|architect|qa|sales|industrial/i.test(cat + String(targeting.skipReason || ''))) {
        blockers.push(`targeting: ${targeting.skipReason || targeting.category}`);
      }
    }
  } catch {
    /* targeting optional */
  }

  if (!remote && !hybrid) {
    warnings.push('нет удалёнки и гибрида в store');
  }

  const site = assessOnlySitePreflight(rec, { forceOnly: Boolean(opts.forceOnly) });
  if (site.hardSkip) {
    blockers.push(site.reason || `site:${site.code}`);
  } else if (site.softWarn) {
    warnings.push(site.reason || `site:${site.code}`);
  }

  const gate = await assessPointApplyBlocked(rec, {
    prefs,
    force: Boolean(opts.forceOnly),
  });
  if (gate.blocked) {
    for (const r of gate.reasons || []) blockers.push(String(r));
  }
  // Soft-letter: point-gate не режет ready без письма; assess всё же берёт жёсткий fail
  // fit/score/targeting из previewApplyGate (не мягкие «формат не указан»).
  if (gate.gatePass === false) {
    const softLetter = pointApplyLetterSoftForReady(prefs);
    const skip = String(gate.gateSkipReason || '');
    const letterOnlyFail = softLetter && /letter/i.test(skip);
    if (!letterOnlyFail) {
      let added = false;
      for (const r of gate.gateReasons || []) {
        const s = String(r);
        if (softLetter && /письм|letter|не утвержд/i.test(s)) continue;
        if (/Формат не указан|проверьте вручную/i.test(s)) continue;
        if (!blockers.includes(s)) {
          blockers.push(s);
          added = true;
        }
      }
      if (
        !added &&
        /gate_score|gateScore|score/i.test(skip) &&
        gate.gateScore != null
      ) {
        blockers.push(`fit/gate не проходит (score ${gate.gateScore})`);
      }
    }
  }

  if (letterLen < 40) {
    if (pointApplyLetterSoftForReady(prefs)) {
      warnings.push('нет письма — prep до ship (--prepare-letters)');
    } else {
      blockers.push('нет письма (нужен prep --prepare-letters)');
    }
  } else {
    const role =
      classifyVacancyResumeRole(rec) ||
      (track === 'l2l3' ? 'support' : track || 'devops');
    const q = assessLetterQuality(rec, letter, role);
    if (!q.pass) {
      blockers.push(`письмо quality: ${q.reason || 'fail'}`);
    }
  }

  if (track && trackQuotaRemaining(track, prefs) <= 0) {
    blockers.push(`квота маршрута ${track} исчерпана`);
  }

  const needsProbe =
    recordNeedsQuestionnaireWork(rec) && !questionnaireHasLiveProbe(rec);
  if (needsProbe) {
    warnings.push('нужен live probe анкеты до ship');
  }

  if (rec.userApproved) {
    warnings.push('userApproved — ручной GO на нишу/stretch');
  }

  let verdict = 'go';
  if (blockers.length) verdict = 'no-go';
  else if (warnings.length) verdict = 'conditional';

  const npmShip = huntDayNpmScriptForInstance();
  return {
    id: rec.id,
    id8: String(rec.id).slice(0, 8),
    company: company || null,
    title: title || null,
    track,
    score,
    remote,
    hybrid,
    letterLen,
    userApproved: Boolean(rec.userApproved),
    needsProbe: Boolean(needsProbe),
    siteCode: site.code,
    gateScore: gate.gateScore ?? null,
    verdict,
    blockers,
    warnings,
    shipHint:
      verdict === 'go'
        ? `npm run ${npmShip} -- ship --mode=point --go --only=${rec.id} --limit=1`
        : verdict === 'conditional'
          ? 'устранить warnings или принять риск; без --force-only'
          : 'не слать; сначала blocker (не --force-only вслепую)',
  };
}

/**
 * @param {object} [opts]
 */
export async function buildHuntDayAssess(opts = {}) {
  const fullTracks = Boolean(opts.fullTracks);
  const prefs = opts.prefs || loadPreferences();
  const huntTracks = opts.huntTracks || getPointApplyAutoTracks(prefs);
  const limit = fullTracks
    ? Math.max(1, Number(opts.limit) || 5000)
    : Math.max(1, Number(opts.limit) || 20);
  const skipIds = new Set((opts.skipIds || []).map(String));
  const onlyId = String(opts.onlyId || '').trim();

  /** @type {ReturnType<typeof prepareHuntDayNegotiations> | null} */
  let negotiationsPrep = null;
  if (opts.skipNegotiationsPrep !== true) {
    negotiationsPrep = prepareHuntDayNegotiations({
      sync: opts.sync === true,
      noSync: opts.noSync === true,
      log: opts.log || console.log,
    });
  }

  const excludedIds = getExcludedStateIds(loadBasketPacksConfig());
  const quotas = pointApplyTrackQuotaSummary(huntTracks, prefs);

  /** @type {object[]} */
  let seed = [];

  if (onlyId) {
    const rec =
      getVacancyRecord(onlyId) ||
      loadQueue({ force: true }).find(
        (x) => x.id === onlyId || String(x.id).startsWith(onlyId)
      );
    if (rec) seed = [rec];
  } else if (fullTracks) {
    // Правда по маршрутам охоты: все pending в huntTracks (не other, не весь harvest).
    const q = loadQueue({ force: true });
    const trackSet = new Set(huntTracks.map(String));
    for (const r of q) {
      if (skipIds.has(String(r.id))) continue;
      if (['applied', 'responded', 'declined', 'archived', 'skipped', 'rejected'].includes(String(r.status || ''))) {
        continue;
      }
      if (r.hhApply?.state === 'submitted') continue;
      const track = String(r.huntTrack || classifyVacancyHuntTrack(r) || '');
      if (!trackSet.has(track)) continue;
      seed.push(r);
    }
    seed.sort(
      (a, b) =>
        Number(b.scoreOverall ?? b.scoreFit ?? b.score ?? 0) -
        Number(a.scoreOverall ?? a.scoreFit ?? a.score ?? 0)
    );
  } else {
    const wrap = await (opts.resolvePool || resolvePointApplyPool)({
      huntTracks,
      prefs,
      skipIds: [...skipIds],
    });
    const readyItems = wrap.report?.readyItems || [];
    for (const item of readyItems) {
      if (skipIds.has(String(item.id))) continue;
      const rec = getVacancyRecord(item.id) || item;
      seed.push(rec);
      if (seed.length >= limit) break;
    }

    // Добор по дефицитным трекам: резерв слотов, иначе devops съедает весь limit
    if (seed.length < limit) {
      const have = new Set(seed.map((r) => r.id));
      const q = loadQueue({ force: true });
      const byTrack = Object.fromEntries(huntTracks.map((t) => [t, []]));
      for (const r of q) {
        if (have.has(r.id) || skipIds.has(String(r.id))) continue;
        if (['applied', 'responded', 'declined', 'archived', 'skipped', 'rejected'].includes(String(r.status || ''))) {
          continue;
        }
        const track = String(r.huntTrack || classifyVacancyHuntTrack(r) || '');
        if (!byTrack[track]) continue;
        byTrack[track].push(r);
      }
      const perTrack = Math.max(3, Math.ceil(limit / Math.max(1, huntTracks.length)));
      for (const tid of huntTracks) {
        let added = 0;
        const arr = (byTrack[tid] || [])
          .filter((r) => {
            const t = String(r.title || '');
            if (TITLE_NOISE.test(t) || TITLE_OUT_OF_PROFILE.test(t)) return false;
            if (titleLooksL1HelpdeskRole(t)) return false;
            if (/мосстройразвитие/i.test(String(r.company || ''))) return false;
            return true;
          })
          .sort((a, b) => {
            const letterA = letterTextFromVacancyRecord(a).trim().length > 40 ? 1 : 0;
            const letterB = letterTextFromVacancyRecord(b).trim().length > 40 ? 1 : 0;
            const wfA = liveWorkFormat(a, prefs);
            const wfB = liveWorkFormat(b, prefs);
            const remoteA = wfA?.hasRemote && !wfA?.officeOnly ? 1 : 0;
            const remoteB = wfB?.hasRemote && !wfB?.officeOnly ? 1 : 0;
            return (
              letterB - letterA ||
              remoteB - remoteA ||
              Number(b.scoreOverall ?? b.scoreFit ?? b.score ?? 0) -
                Number(a.scoreOverall ?? a.scoreFit ?? a.score ?? 0)
            );
          });
        for (const r of arr) {
          if (have.has(r.id)) continue;
          seed.push(r);
          have.add(r.id);
          added++;
          if (added >= perTrack || seed.length >= limit) break;
        }
        if (seed.length >= limit) break;
      }
    }
  }

  if (!fullTracks) seed = seed.slice(0, limit);

  /** @type {object[]} */
  const rows = [];
  for (const rec of seed) {
    rows.push(await assessVacancyForShip(rec, { prefs, excludedIds, forceOnly: false }));
  }

  const go = rows.filter((r) => r.verdict === 'go');
  const conditional = rows.filter((r) => r.verdict === 'conditional');
  const noGo = rows.filter((r) => r.verdict === 'no-go');

  const byTrack = {};
  for (const r of rows) {
    const t = r.track || 'other';
    if (!byTrack[t]) byTrack[t] = { go: 0, conditional: 0, noGo: 0 };
    if (r.verdict === 'go') byTrack[t].go++;
    else if (r.verdict === 'conditional') byTrack[t].conditional++;
    else byTrack[t].noGo++;
  }

  return {
    at: new Date().toISOString(),
    slice: 2,
    command: 'assess',
    mode: 'point',
    fullTracks,
    scope: fullTracks
      ? `все pending в маршрутах ${huntTracks.join(',')}`
      : `выборка limit=${limit} (ready + добор)`,
    huntTracks,
    quotas,
    total: rows.length,
    counts: { go: go.length, conditional: conditional.length, noGo: noGo.length },
    byTrack,
    go,
    conditional,
    noGo,
    rows,
    negotiationsPrep,
    message: `assess: go=${go.length} conditional=${conditional.length} no-go=${noGo.length} из ${rows.length}`,
    ritual:
      '1) assess → 2) prep писем для go/conditional → 3) live probe → 4) ship --only= без --force-only → 5) naked → repair',
  };
}

/**
 * Короткий текст для консоли партнёра.
 * @param {object} report
 */
export function formatHuntDayAssessRu(report) {
  const lines = [];
  lines.push(`Оценка до ship · ${report.message}`);
  if (report.scope) lines.push(`Охват: ${report.scope}`);
  lines.push(
    `Квоты: ${(report.quotas || []).map((q) => `${q.track} ${q.used}/${q.quota}`).join(' · ') || '—'}`
  );
  lines.push('');
  lines.push('ГОДНЫ (go):');
  if (!(report.go || []).length) lines.push('  — нет');
  for (const r of report.go || []) {
    lines.push(`  ✓ ${r.score} ${r.id8} [${r.track}] ${r.company} — ${r.title}`);
  }
  lines.push('');
  lines.push('УСЛОВНО (conditional):');
  if (!(report.conditional || []).length) lines.push('  — нет');
  for (const r of report.conditional || []) {
    lines.push(
      `  ~ ${r.score} ${r.id8} [${r.track}] ${r.company} — ${r.title} · ${r.warnings.join('; ')}`
    );
  }
  lines.push('');
  lines.push('НЕ СЛАТЬ (no-go) — топ причин:');
  if (!(report.noGo || []).length) lines.push('  — нет');
  for (const r of (report.noGo || []).slice(0, 15)) {
    lines.push(
      `  ✗ ${r.score} ${r.id8} [${r.track}] ${r.company} — ${(r.blockers || []).join('; ').slice(0, 120)}`
    );
  }
  lines.push('');
  lines.push(`Ритуал: ${report.ritual}`);
  return lines.join('\n');
}
