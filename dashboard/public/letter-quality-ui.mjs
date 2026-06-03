/**
 * Ранжирование variantQuality в UI (зеркало lib/letter-score.mjs).
 */

/**
 * @param {object} q
 */
export function variantQualityRankScore(q) {
  if (!q || typeof q !== 'object') return -1;
  return (
    (q.rawPass ? 2000 : 0) +
    (q.pass ? 1000 : 0) +
    (q.fixable ? 100 : 0) +
    (Number(q.letterScore10) || 0) * 50 +
    Number(q.score || 0)
  );
}

/**
 * @param {Array<{ index?: number }>} variantQuality
 * @param {number} variantCount
 */
export function pickBestVariantIndex(variantQuality, variantCount = 0) {
  if (!Array.isArray(variantQuality) || !variantQuality.length) return 0;
  let bestIdx = 0;
  let bestScore = -1;
  for (const q of variantQuality) {
    const idx = Number(q.index);
    const i = Number.isFinite(idx) ? idx : 0;
    const score = variantQualityRankScore(q);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return Math.max(0, Math.min(bestIdx, Math.max(0, variantCount - 1)));
}

/**
 * @param {object} quality
 */
/**
 * @param {number|null|undefined} n
 * @returns {'great'|'ok'|'warn'|'bad'|'unknown'}
 */
export function letterScore10Tier(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'unknown';
  if (v >= 8) return 'great';
  if (v >= 6) return 'ok';
  if (v >= 4) return 'warn';
  return 'bad';
}

/**
 * @param {number|null|undefined} n
 */
export function letterScore10Class(n) {
  const tier = letterScore10Tier(n);
  return tier === 'unknown' ? '' : `letter-score--${tier}`;
}

/** @param {string} kind */
export function letterIssueKindLabel(kind) {
  if (kind === 'fixable') return 'подготовить';
  if (kind === 'fail') return 'правка';
  if (kind === 'missing') return 'нет письма';
  return kind || '';
}

/** Легенда шкалы 0–10 (DS-26). */
export function renderLetterScaleLegendHtml() {
  return `<div class="letter-scale-legend" role="note">
    <span class="letter-scale-legend__title">Качество письма, 0–10:</span>
    <span class="letter-scale-legend__item letter-score--great">8–10 готово</span>
    <span class="letter-scale-legend__item letter-score--ok">6–7 ок</span>
    <span class="letter-scale-legend__item letter-score--warn">4–5 правка</span>
    <span class="letter-scale-legend__item letter-score--bad">&lt;4 переписать</span>
  </div>`;
}

/**
 * @param {Array<{ label?: string, date?: string, value?: number | null, passRate?: number | null, rate?: number | null, total?: number | null }>} points
 * @param {{ valueKey?: string, suffix?: string, ariaLabel?: string }} [opts]
 */
export function renderSparklineHtml(points, opts = {}) {
  const valueKey = opts.valueKey || 'value';
  const vals = (points || [])
    .map((p) => p[valueKey] ?? p.passRate ?? p.rate ?? p.total)
    .filter((v) => v != null && Number.isFinite(Number(v)));
  if (!vals.length) return '';
  const max = Math.max(...vals.map(Number), 1);
  const bars = (points || [])
    .map((p) => {
      const raw = p[valueKey] ?? p.passRate ?? p.rate ?? p.total;
      const v = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
      const h = v != null ? Math.max(8, Math.round((v / max) * 100)) : 4;
      const title = `${p.label || p.date || ''}: ${v != null ? v : '—'}${opts.suffix || ''}`;
      return `<span class="hub-sparkline__bar${v == null ? ' hub-sparkline__bar--empty' : ''}" style="height:${h}%" title="${title.replace(/"/g, '&quot;')}"></span>`;
    })
    .join('');
  return `<div class="hub-sparkline" role="img" aria-label="${opts.ariaLabel || 'Тренд за 7 дней'}">${bars}</div>`;
}

export function formatLetterQualityBanner(quality) {
  if (!quality || typeof quality !== 'object') {
    return { text: '', className: 'draft-letter-quality' };
  }
  const score10 = Number(quality.letterScore10);
  const scoreHint = Number.isFinite(score10) ? ` · ${score10}/10` : '';
  if (quality.pass && quality.rawPass && !quality.fixable) {
    return {
      text: `Готово к батчу${scoreHint}`,
      className: 'draft-letter-quality draft-letter-quality--ok',
    };
  }
  if (quality.pass && !quality.fixable) {
    return {
      text: `Проходит после «Подготовить»${scoreHint}`,
      className: 'draft-letter-quality draft-letter-quality--ok',
    };
  }
  if (quality.fixable || quality.reason === 'ok после подготовки') {
    return {
      text: `Нужна кнопка «Подготовить»${scoreHint}`,
      className: 'draft-letter-quality draft-letter-quality--warn',
    };
  }
  const hint = Array.isArray(quality.hints) && quality.hints[0] ? ` · ${quality.hints[0]}` : '';
  return {
    text: `${quality.reason || 'нужна правка'}${scoreHint}${hint}`,
    className: 'draft-letter-quality draft-letter-quality--bad',
  };
}
