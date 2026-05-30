/**
 * Подготовка ряда «динамика откликов» для графика в модалке.
 */

const PLOT_HEIGHT_PX = 68;
const MAX_DAILY_POINTS = 31;

/**
 * @param {string} iso YYYY-MM-DD
 */
function weekStartKey(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} weekStart
 */
function formatWeekLabel(weekStart) {
  const d = new Date(`${weekStart}T12:00:00`);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (x) =>
    x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }).replace(/\./g, '-');
  return `${fmt(d)}…${fmt(end)}`;
}

/**
 * @param {string} iso
 */
function formatDayLabel(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }).replace(/\./g, '-');
}

/**
 * @param {Array<{ date: string, applied: number, invited: number, viewed: number }>} timeline
 * @param {{ maxDaily?: number }} opts
 */
export function bucketTimelineForDisplay(timeline, opts = {}) {
  const maxDaily = opts.maxDaily ?? MAX_DAILY_POINTS;
  const rows = Array.isArray(timeline) ? timeline.filter((t) => t?.date) : [];
  if (!rows.length) {
    return { points: [], mode: 'empty', plotHeightPx: PLOT_HEIGHT_PX };
  }

  if (rows.length <= maxDaily) {
    return {
      mode: 'day',
      plotHeightPx: PLOT_HEIGHT_PX,
      points: rows.map((t) => ({
        ...t,
        label: formatDayLabel(t.date),
        title: `${t.date}: ${t.applied} откл., ${t.invited} пригл.`,
      })),
    };
  }

  /** @type {Map<string, { date: string, applied: number, invited: number, viewed: number }>} */
  const weeks = new Map();
  for (const t of rows) {
    const key = weekStartKey(t.date);
    const row = weeks.get(key) || { date: key, applied: 0, invited: 0, viewed: 0 };
    row.applied += Number(t.applied) || 0;
    row.invited += Number(t.invited) || 0;
    row.viewed += Number(t.viewed) || 0;
    weeks.set(key, row);
  }

  const points = [...weeks.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      ...t,
      label: formatWeekLabel(t.date),
      title: `Неделя с ${t.date}: ${t.applied} откл., ${t.invited} пригл.`,
    }));

  return { mode: 'week', plotHeightPx: PLOT_HEIGHT_PX, points };
}

/**
 * @param {ReturnType<typeof bucketTimelineForDisplay>} chart
 */
export function renderFunnelTimelineHtml(chart) {
  const points = chart?.points || [];
  if (!points.length) {
    return '<p class="funnel-empty">Нет откликов за выбранный период</p>';
  }

  const max = Math.max(1, ...points.map((t) => Number(t.applied) || 0));
  const plotH = chart.plotHeightPx || PLOT_HEIGHT_PX;
  const modeNote =
    chart.mode === 'week'
      ? '<p class="funnel-timeline__mode">По неделям (длинный период)</p>'
      : '';

  const cols = points
    .map((t) => {
      const applied = Number(t.applied) || 0;
      const barPx = applied > 0 ? Math.max(3, Math.round((applied / max) * plotH)) : 0;
      const inv = Number(t.invited) > 0 ? String(t.invited) : '';
      return `<div class="funnel-timeline__col" title="${t.title || ''}">
        <div class="funnel-timeline__plot">
          <span class="funnel-timeline__bar" style="height:${barPx}px" role="presentation"></span>
        </div>
        <span class="funnel-timeline__inv">${inv}</span>
        <span class="funnel-timeline__date">${t.label || ''}</span>
      </div>`;
    })
    .join('');

  return `${modeNote}<div class="funnel-timeline" role="img" aria-label="Динамика откликов">${cols}</div>`;
}
