/**
 * HTML sparkline «отклики за N дней» для sidebar.
 * @param {Array<{ date: string, applied: number, label: string, isToday?: boolean }>} points
 */
export function renderDailySparklineHtml(points) {
  const rows = Array.isArray(points) ? points : [];
  if (!rows.length) return '';
  const max = Math.max(1, ...rows.map((p) => Number(p.applied) || 0));
  const total = rows.reduce((s, p) => s + (Number(p.applied) || 0), 0);
  const bars = rows
    .map((p) => {
      const n = Number(p.applied) || 0;
      const h = n ? Math.max(8, Math.round((n / max) * 100)) : 2;
      const cls = p.isToday ? ' daily-sparkline__bar--today' : '';
      return `<div class="daily-sparkline__bar-wrap" title="${p.date}: ${n} откл.">
        <div class="daily-sparkline__bar${cls}" style="height:${h}%"></div>
        <span class="daily-sparkline__day">${escapeAttr(p.label || p.date.slice(5))}</span>
      </div>`;
    })
    .join('');
  return `<div class="daily-sparkline" role="img" aria-label="Отклики за ${rows.length} дней: всего ${total}">
    <div class="daily-sparkline__head">
      <span>Отклики / день</span>
      <span class="daily-sparkline__total">${total} за ${rows.length} дн.</span>
    </div>
    <div class="daily-sparkline__bars">${bars}</div>
  </div>`;
}

/** @param {string} s */
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
