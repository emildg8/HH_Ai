/**
 * applyIntelligence prefs — resolver (этап 1, минимум для gate).
 */

import { loadPreferences } from './preferences.mjs';

export const DEFAULT_APPLY_INTELLIGENCE = {
  enabled: true,
  minGateScore: 60,
  minGateScoreDream: 45,
  dreamEmployers: [],
  useEmployerScore: true,
  weights: {
    keywordFit: 0.25,
    resumeFit: 0.2,
    letterQuality: 0.15,
    employerHistory: 0.2,
    freshness: 0.1,
    hrStackMatch: 0.1,
  },
};

/**
 * @param {object} [prefs]
 */
export function resolveApplyIntelligence(prefs) {
  let p = prefs;
  if (!p) {
    try {
      p = loadPreferences();
    } catch {
      p = {};
    }
  }
  const envGlueOff = String(process.env.HH_CONVERSION_GLUE ?? '').trim() === '0';
  const envObsOff = String(process.env.HH_OBSERVABILITY ?? '').trim() === '0';
  const envGateOff = String(process.env.HH_APPLY_GATE ?? '').trim() === '0';
  const gluePref = p.conversionGlueEnabled !== false;
  const obsPref = p.observability?.enabled !== false;

  const raw = p.applyIntelligence && typeof p.applyIntelligence === 'object' ? p.applyIntelligence : {};
  const ai = {
    ...DEFAULT_APPLY_INTELLIGENCE,
    ...raw,
    weights: { ...DEFAULT_APPLY_INTELLIGENCE.weights, ...(raw.weights || {}) },
  };

  const company = String(p._gateCompany || '').trim().toLowerCase();
  const dreamList = (ai.dreamEmployers || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  const isDreamEmployer = company ? dreamList.includes(company) : false;

  const baseMin = isDreamEmployer ? Number(ai.minGateScoreDream) : Number(ai.minGateScore);
  const dashMin = Number(p.dashboardMinScoreFilter);
  const effectiveMinGate = Math.max(
    Number.isFinite(baseMin) ? baseMin : DEFAULT_APPLY_INTELLIGENCE.minGateScore,
    Number.isFinite(dashMin) ? dashMin : 0
  );

  const gateEnabled = ai.enabled !== false && !envGateOff;
  const glueOrchestrationEnabled = !envGlueOff && gluePref && !envObsOff && obsPref;

  return {
    ...ai,
    gateEnabled,
    conversionGlueEnabled: gluePref && !envGlueOff,
    observabilityEnabled: obsPref && !envObsOff,
    glueOrchestrationEnabled,
    /** @deprecated используйте glueOrchestrationEnabled */
    enabled: glueOrchestrationEnabled,
    effectiveMinGate,
    isDreamEmployer,
    dreamEmployers: dreamList,
    useEmployerScore: ai.useEmployerScore !== false,
    weights: ai.weights,
  };
}

/**
 * @param {object} [prefs]
 */
export function isConversionGlueEnabled(prefs) {
  return resolveApplyIntelligence(prefs).glueOrchestrationEnabled;
}

/**
 * @param {object} [prefs]
 */
export function isObservabilityEnabled(prefs) {
  const r = resolveApplyIntelligence(prefs);
  return r.observabilityEnabled !== false;
}

/**
 * @param {string} company
 * @param {object} [prefs]
 */
export function resolveApplyIntelligenceForEmployer(company, prefs) {
  const base = prefs || loadPreferences();
  return resolveApplyIntelligence({ ...base, _gateCompany: company });
}
