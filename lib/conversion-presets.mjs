/**
 * Пресеты конверсии (gate + пороги отклика + письма).
 * Патч — dot-path для PATCH /api/settings.
 */

/** @type {Record<string, { label: string, hint: string, patch: Record<string, unknown> }>} */
export const CONVERSION_PRESETS = {
  balanced: {
    label: 'Сбалансированный',
    hint: 'Gate 60, порог «Авто» 50, письма 7/10 — рабочий режим по умолчанию',
    patch: {
      'applyIntelligence.enabled': true,
      'applyIntelligence.minGateScore': 60,
      'applyIntelligence.minGateScoreDream': 45,
      dashboardMinScoreFilter: 50,
      batchLetterMinScore10: 7,
      minKeywordGapScore: 40,
    },
  },
  quality: {
    label: 'Качество',
    hint: 'Строже gate и письма — меньше слабых откликов',
    patch: {
      'applyIntelligence.enabled': true,
      'applyIntelligence.minGateScore': 70,
      'applyIntelligence.minGateScoreDream': 55,
      dashboardMinScoreFilter: 55,
      batchLetterMinScore10: 8,
      minKeywordGapScore: 50,
    },
  },
  explore: {
    label: 'Разведка',
    hint: 'Ниже пороги — больше карточек в зоне авто (без гарантии отклика)',
    patch: {
      'applyIntelligence.enabled': true,
      'applyIntelligence.minGateScore': 45,
      'applyIntelligence.minGateScoreDream': 35,
      dashboardMinScoreFilter: 40,
      batchLetterMinScore10: 6,
      minKeywordGapScore: 30,
    },
  },
  gateOff: {
    label: 'Без gate',
    hint: 'Только targeting и red flags, без оценки gateScore',
    patch: {
      'applyIntelligence.enabled': false,
      dashboardMinScoreFilter: 50,
    },
  },
};

/**
 * @param {string} id
 */
export function getConversionPresetPatch(id) {
  return CONVERSION_PRESETS[id]?.patch || null;
}

export function listConversionPresetsForClient() {
  return Object.entries(CONVERSION_PRESETS).map(([id, p]) => ({
    id,
    label: p.label,
    hint: p.hint,
    patch: p.patch,
  }));
}
