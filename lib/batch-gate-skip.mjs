/**
 * Маппинг вердикта PreApplyGate → пропуск в батче (лог, отчёт, счётчики).
 */

import { GATE_SKIP_REASON } from './apply-gate.mjs';

const CATEGORY_SKIP = {
  'work-format': { key: 'формат работы', tag: 'FORMAT', status: 'work-format' },
  'off-target-blue-collar': { key: 'рабочие специальности', tag: 'BLUE-COLLAR', status: 'off-target-blue-collar' },
  'off-target-sales': { key: 'продажи/presale', tag: 'SALES', status: 'off-target' },
  'off-target-network': { key: 'сетевые/телеком', tag: 'NETWORK', status: 'off-target' },
  'off-target-industrial': { key: 'промышленные/полевые', tag: 'INDUSTRIAL', status: 'off-target' },
  'off-target-l1': { key: 'L1 поддержка', tag: 'L1', status: 'off-target' },
  'off-target-no-it-profile': { key: 'нет IT-профиля', tag: 'NO-IT', status: 'off-target' },
  'off-target-promo': { key: 'промо/служебные', tag: 'PROMO', status: 'off-target' },
};

/**
 * @param {import('./apply-gate.mjs').GATE_SKIP_REASON | string | null} skipReason
 * @param {object} [targeting]
 */
function fromTargeting(skipReason, targeting) {
  const cat = targeting?.category;
  if (cat && CATEGORY_SKIP[cat]) return CATEGORY_SKIP[cat];
  if (skipReason === GATE_SKIP_REASON.WORK_FORMAT) {
    return { key: 'формат работы', tag: 'FORMAT', status: 'work-format' };
  }
  return { key: 'нецелевая', tag: 'OFF-TARGET', status: 'off-target' };
}

/**
 * @param {Awaited<ReturnType<import('./apply-gate.mjs').previewApplyGate>>} gate
 * @returns {{ key: string, tag: string, status: string, reason: string } | null}
 */
export function mapGateVerdictToBatchSkip(gate) {
  if (!gate || gate.pass) return null;
  const reason = gate.reasons?.[0] || gate.letter?.reason || gate.targeting?.skipReason || gate.skipReason || '';
  if (gate.skipReason === GATE_SKIP_REASON.RED_FLAG) {
    return { key: 'стоп-сигнал', tag: 'RED-FLAG', status: 'red-flag', reason };
  }
  if (gate.skipReason === GATE_SKIP_REASON.LETTER_QUALITY) {
    return { key: 'качество письма', tag: 'LETTER', status: 'letter-quality', reason };
  }
  if (gate.skipReason === GATE_SKIP_REASON.GATE_SCORE) {
    return {
      key: 'gate score',
      tag: 'GATE',
      status: 'gate-score',
      reason: reason || `gate ${gate.gateScore} < ${gate.effectiveMinGate}`,
    };
  }
  return { ...fromTargeting(gate.skipReason, gate.targeting), reason };
}

/**
 * Ключ blocked.* для batch-precheck.
 * @param {Awaited<ReturnType<import('./apply-gate.mjs').previewApplyGate>>} gate
 */
export function mapGateVerdictToPrecheckKey(gate) {
  if (!gate || gate.pass) return null;
  if (gate.skipReason === GATE_SKIP_REASON.GATE_SCORE) return 'gateScore';
  if (gate.skipReason === GATE_SKIP_REASON.LETTER_QUALITY) return 'letterQuality';
  if (gate.skipReason === GATE_SKIP_REASON.RED_FLAG) return 'red-flag';
  return gate.targeting?.category || gate.skipReason || 'gate';
}
