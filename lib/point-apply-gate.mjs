/**
 * Дополнительные проверки перед auto point apply (HT.7).
 * Не заменяет apply-gate — сужает auto-выстрел по hrStack, нишам и prefer-лестнице.
 */
import { previewApplyGate } from './apply-gate.mjs';
import { loadPreferences } from './preferences.mjs';
import { assessApplyNicheManualOnly, resolveEffectiveSortScore } from './targeting-policy.mjs';
import { formatHrStackMatchSummary } from './hr-stack-detector.mjs';
import {
  assessDeveloperLane,
  assessAiToolsFriendly,
  isAutoDeveloperLaneEligible,
} from './developer-lane.mjs';
import {
  assessDevopsVacancyPrefer,
  devopsAwareSortScore,
} from './devops-vacancy-prefer.mjs';
import {
  analyzePointDayWaveLetterFingerprints,
  letterTextFromVacancyRecord,
  pointWaveFingerprintEnabled,
} from './letter-wave-fingerprint.mjs';

/** @returns {number} */
export function pointApplyHrStackMin() {
  const n = Number(process.env.HH_POINT_APPLY_HRSTACK_MIN ?? 45);
  return Number.isFinite(n) ? n : 45;
}

export function pointApplyNicheCheckEnabled() {
  return String(process.env.HH_POINT_APPLY_NICHE_CHECK ?? '1').trim() !== '0';
}

export function pointApplyForceEnabled() {
  return (
    process.argv.includes('--force-point-apply') ||
    String(process.env.HH_POINT_APPLY_FORCE ?? '').trim() === '1'
  );
}

/**
 * Stretch для auto point: AppSec / рук. отдела БД — не веер без явного approve.
 * @param {string} title
 */
export function isPointApplyStretchTitle(title) {
  const t = String(title || '');
  if (/app\s*sec|application\s*security|devsecops|sast|dast/i.test(t)) return true;
  if (/руководитель\s+отдела\s+поддержки\s+и\s+развития\s+баз/i.test(t)) return true;
  if (/руководитель\s+отдела.{0,40}баз\s+данных/i.test(t)) return true;
  return false;
}

/**
 * Сортировочный ключ ready-пула: geo/fit + devops prefer.
 * @param {object} rec
 */
export function pointApplyFitSortScore(rec) {
  return devopsAwareSortScore(rec, resolveEffectiveSortScore);
}

/**
 * @param {object} rec
 * @returns {{ block: boolean, reason?: string, prefer: ReturnType<typeof assessDevopsVacancyPrefer> }}
 */
export function assessPointApplyPreferBlock(rec) {
  const prefer = assessDevopsVacancyPrefer(rec);
  if (rec?.userApproved) return { block: false, prefer };
  if (!prefer.applies) return { block: false, prefer };
  if (prefer.tier === 'weak') {
    return {
      block: true,
      reason: 'devops prefer=weak — только ручной отклик или userApproved',
      prefer,
    };
  }
  if (prefer.signals?.stretch?.hardProdK8s) {
    return {
      block: true,
      reason: 'hard prod-K8s — только ручной отклик или userApproved',
      prefer,
    };
  }
  const title = String(rec?.title || '');
  if (/platform\s*engineer|platform\s*eng\b|head\s+of\s+devops|devops\s+architect/i.test(title)) {
    return {
      block: true,
      reason: 'Platform/Head/Architect в заголовке — только ручной или userApproved',
      prefer,
    };
  }
  return { block: false, prefer };
}

/**
 * @param {object} rec
 * @param {{ prefs?: object, force?: boolean, waveItems?: Array<{ id?: string, company?: string, letter: string }> }} [opts]
 */
export async function assessPointApplyBlocked(rec, opts = {}) {
  const force =
    opts.force === true || (opts.force !== false && pointApplyForceEnabled());
  /** @type {string[]} */
  const reasons = [];
  let niche = null;
  let hrStack = null;
  /** @type {ReturnType<typeof analyzePointDayWaveLetterFingerprints> | null} */
  let waveFingerprint = null;

  let prefs = opts.prefs;
  if (!prefs) {
    try {
      prefs = loadPreferences();
    } catch {
      prefs = {};
    }
  }

  // Stretch + letter quality — даже с --force (force только hrStack/ниша/prefer).
  if (!rec?.userApproved && isPointApplyStretchTitle(rec?.title)) {
    reasons.push('stretch-роль (AppSec / рук. БД) — только userApproved на карточке');
  }

  const gate = await previewApplyGate(rec, { prefs, requireLetter: true });
  hrStack = gate.hrStack;
  if (!gate.pass && gate.skipReason === 'letter_quality') {
    reasons.push(
      gate.letter?.reason || gate.reasons?.[0] || 'письмо не проходит quality'
    );
  }

  if (pointWaveFingerprintEnabled()) {
    const focusLetter = letterTextFromVacancyRecord(rec);
    if (focusLetter) {
      const peers = Array.isArray(opts.waveItems) ? opts.waveItems : [];
      const merged = new Map();
      for (const p of peers) {
        const id = String(p?.id || '').trim();
        const letter = String(p?.letter || letterTextFromVacancyRecord(p) || '').trim();
        if (id && letter) merged.set(id, { id, company: p.company, letter });
      }
      merged.set(String(rec.id || 'focus'), {
        id: String(rec.id || 'focus'),
        company: String(rec.company || rec.employer || '').slice(0, 40),
        letter: focusLetter,
      });
      waveFingerprint = analyzePointDayWaveLetterFingerprints([...merged.values()]);
      if (!waveFingerprint.ok) {
        for (const b of waveFingerprint.blockers) reasons.push(b);
      }
    }
  }

  if (force) {
    return {
      blocked: reasons.length > 0,
      reasons,
      hrStack: null,
      niche: null,
      prefer: assessDevopsVacancyPrefer(rec),
      forced: reasons.length === 0,
      gatePass: gate.pass,
      gateScore: gate.gateScore,
      waveFingerprint,
    };
  }

  if (pointApplyNicheCheckEnabled()) {
    niche = assessApplyNicheManualOnly(rec);
    if (niche.manualOnly) {
      reasons.push(niche.reason || 'Узкая ниша — только ручной отклик');
    }
  }

  const preferBlock = assessPointApplyPreferBlock(rec);
  if (preferBlock.block && preferBlock.reason) {
    reasons.push(preferBlock.reason);
  }

  const devLane = assessDeveloperLane(rec);
  if (!isAutoDeveloperLaneEligible(rec)) {
    reasons.push(
      devLane.reason || 'Корзина B (язык/коммерческий код) — нужен userApproved на карточке'
    );
  }

  const minHr = pointApplyHrStackMin();
  if (
    hrStack?.score != null &&
    hrStack.score < minHr &&
    Array.isArray(hrStack.missing) &&
    hrStack.missing.length
  ) {
    reasons.push(
      hrStack.summary ||
        formatHrStackMatchSummary({
          ...hrStack,
          required: [...(hrStack.matched || []), ...(hrStack.missing || [])],
        })
    );
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    hrStack,
    niche,
    prefer: preferBlock.prefer,
    developerLane: devLane,
    aiToolsFriendly: assessAiToolsFriendly(rec),
    gatePass: gate.pass,
    gateScore: gate.gateScore,
    forced: false,
    waveFingerprint,
  };
}

/**
 * Первый ready-кандидат по prefer-лестнице, проходящий point-apply gate.
 * @param {object[]} readyItems
 * @param {{ skipIds?: Set<string>, getRec?: (id: string) => object | null, waveItems?: Array<{ id?: string, company?: string, letter: string }>, force?: boolean }} [opts]
 */
export async function pickPointApplyCandidate(readyItems, opts = {}) {
  const skipIds = opts.skipIds || new Set();
  const getRec = opts.getRec || ((id) => null);
  const waveItems = opts.waveItems;
  const forceOpt = opts.force;

  const ranked = [...readyItems]
    .map((item) => {
      const rec = getRec(item.id) || item;
      return { item, rec, fit: pointApplyFitSortScore(rec) };
    })
    .filter(({ item }) => item?.id && !skipIds.has(item.id))
    .sort((a, b) => b.fit - a.fit);

  /** @type {Array<{ id: string, title: string, reasons: string[] }>} */
  const blockedSamples = [];

  let shortlistRank = 0;
  for (const { item, rec, fit } of ranked) {
    shortlistRank += 1;
    const gate = await assessPointApplyBlocked(rec, {
      waveItems,
      ...(forceOpt !== undefined ? { force: forceOpt } : {}),
    });
    if (!gate.blocked) {
      const prefer = gate.prefer || assessDevopsVacancyPrefer(rec);
      return {
        picked: {
          item,
          rec,
          gate,
          fitScore: fit,
          shortlistRank,
          shortlistSize: ranked.length,
          preferTier: prefer.tier,
          preferReasons: prefer.reasons || [],
        },
        blockedSamples,
      };
    }
    blockedSamples.push({
      id: item.id,
      title: String(rec.title || item.title || item.id).slice(0, 90),
      reasons: gate.reasons,
    });
  }

  return { picked: null, blockedSamples };
}
