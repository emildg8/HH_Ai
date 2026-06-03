/**
 * Человекочитаемая причина оценки / отклонения (AI-01).
 */

/** @param {string} text @param {number} max */
function clip(text, max = 140) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * @param {object} item
 * @returns {string}
 */
export function buildScoreHumanHint(item) {
  if (!item || typeof item !== 'object') return '';

  if (item.status === 'rejected') {
    const risks = clip(item.geminiRisks, 120);
    if (risks) return `Отклонено: ${risks}`;
    const summary = clip(item.geminiSummary, 120);
    if (summary) return `Отклонено: ${summary}`;
    if (item.rejectSource === 'auto') return 'Отклонено автоматически по правилам таргетинга';
    return 'Отклонено вручную';
  }

  const score = Number(item.scoreOverall ?? item.geminiScore);
  if (Number.isFinite(score) && score < 50) {
    const risks = clip(item.geminiRisks, 100);
    if (risks) return `Низкий балл: ${risks}`;
  }

  const summary = clip(item.geminiSummary, 140);
  if (summary) return summary;

  return '';
}
