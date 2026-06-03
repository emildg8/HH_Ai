/**
 * Дополнительные графики для модалки «Воронка и конверсия» (CSS/SVG, без библиотек).
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {{ high?: number, mid?: number, low?: number, none?: number }} buckets */
export function renderScoreBucketChart(buckets) {
  const total = (buckets.high || 0) + (buckets.mid || 0) + (buckets.low || 0) + (buckets.none || 0);
  if (!total) return '';
  const segs = [
    { cls: 'high', n: buckets.high || 0, label: '≥70' },
    { cls: 'mid', n: buckets.mid || 0, label: '50–69' },
    { cls: 'low', n: buckets.low || 0, label: '<50' },
    { cls: 'none', n: buckets.none || 0, label: 'без' },
  ].filter((s) => s.n > 0);
  const bar = segs
    .map(
      (s) =>
        `<span class="funnel-stack__seg funnel-stack__seg--${s.cls}" style="flex:${s.n}" title="${s.label}: ${s.n}"></span>`
    )
    .join('');
  const legend = segs
    .map(
      (s) =>
        `<span class="funnel-stack__legend-item"><i class="funnel-stack__dot funnel-stack__seg--${s.cls}"></i>${s.label} ${s.n}</span>`
    )
    .join('');
  return `<div class="funnel-stack-chart" role="img" aria-label="Распределение по баллам">${bar}</div><div class="funnel-stack__legend">${legend}</div>`;
}

/** @param {{ total?: number, viewed?: number, invited?: number, declined?: number, awaiting?: number }} hh */
export function renderHhStatusChart(hh) {
  const total = Number(hh.total) || 0;
  if (!total) return '';
  const submitted = Math.max(0, total - (hh.viewed || 0) - (hh.invited || 0) - (hh.declined || 0) - (hh.awaiting || 0));
  const segs = [
    { cls: 'viewed', n: hh.viewed || 0, label: 'просм.' },
    { cls: 'invited', n: hh.invited || 0, label: 'пригл.' },
    { cls: 'declined', n: hh.declined || 0, label: 'отказ' },
    { cls: 'awaiting', n: hh.awaiting || 0, label: 'ждём' },
    { cls: 'queue', n: submitted, label: 'отправ.' },
  ].filter((s) => s.n > 0);
  const bar = segs
    .map(
      (s) =>
        `<span class="funnel-stack__seg funnel-stack__seg--${s.cls}" style="flex:${s.n}" title="${s.label}: ${s.n}"></span>`
    )
    .join('');
  const legend = segs
    .map(
      (s) =>
        `<span class="funnel-stack__legend-item"><i class="funnel-stack__dot funnel-stack__seg--${s.cls}"></i>${s.label} ${s.n}</span>`
    )
    .join('');
  return `<div class="funnel-stack-chart funnel-stack-chart--hh" role="img" aria-label="Статусы в кэше hh">${bar}</div><div class="funnel-stack__legend">${legend}</div>`;
}

/**
 * @param {Array<{ value: number, cls: string, label: string }>} segments
 * @param {{ center?: string }} opts
 */
export function renderDonutChart(segments, opts = {}) {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0);
  if (!total) return '<p class="funnel-empty">Нет данных</p>';
  let acc = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = (s.value / total) * 100;
      const start = acc;
      acc += pct;
      return `var(--funnel-${s.cls}, var(--accent)) ${start.toFixed(2)}% ${acc.toFixed(2)}%`;
    })
    .join(', ');
  const legend = segments
    .filter((s) => s.value > 0)
    .map(
      (s) =>
        `<span class="funnel-donut__legend-item"><i class="funnel-donut__dot funnel-donut__dot--${s.cls}"></i>${esc(s.label)} <strong>${s.value}</strong></span>`
    )
    .join('');
  const center = opts.center != null ? `<span class="funnel-donut__center">${esc(String(opts.center))}</span>` : '';
  return `<div class="funnel-donut-wrap">
    <div class="funnel-donut" style="background:conic-gradient(${stops})" role="img" aria-label="Диаграмма">${center}</div>
    <div class="funnel-donut__legend">${legend}</div>
  </div>`;
}

/** @param {Record<string, number>} rates @param {Record<string, number>} counts */
export function renderConversionGauges(rates, counts) {
  const items = [
    { label: 'Просмотр', pct: rates.viewFromApplied ?? 0, cls: 'viewed' },
    { label: 'Приглашения', pct: rates.inviteFromApplied ?? 0, cls: 'invited' },
    { label: 'Пригл./просм.', pct: rates.inviteFromViewed ?? 0, cls: 'invited-soft' },
    { label: 'Отказы', pct: rates.declineFromApplied ?? 0, cls: 'declined' },
  ];
  return `<div class="funnel-gauge-grid">${items
    .map(
      (it) => `<div class="funnel-gauge funnel-gauge--${it.cls}">
        <div class="funnel-gauge__track"><span class="funnel-gauge__fill" style="width:${Math.min(100, Math.max(0, it.pct))}%"></span></div>
        <span class="funnel-gauge__pct">${it.pct}%</span>
        <span class="funnel-gauge__label">${it.label}</span>
      </div>`
    )
    .join('')}</div>
    <p class="funnel-gauge-summary">Откликов <strong>${counts.applied ?? 0}</strong> · просмотр <strong>${counts.viewed ?? 0}</strong> · пригл. <strong>${counts.invited ?? 0}</strong> · ждём ${counts.awaiting ?? 0}</p>`;
}

/** @param {Record<string, number>} counts */
export function renderOutcomeDonut(counts) {
  const applied = Number(counts.applied) || 0;
  if (!applied) return '<p class="funnel-empty">Нет откликов за период</p>';
  const invited = Number(counts.invited) || 0;
  const viewedOnly = Math.max(0, (Number(counts.viewed) || 0) - invited);
  const declined = Number(counts.declined) || 0;
  const awaiting = Number(counts.awaiting) || 0;
  const silent = Math.max(0, applied - invited - viewedOnly - declined - awaiting);
  return renderDonutChart(
    [
      { value: invited, cls: 'invited', label: 'Приглашения' },
      { value: viewedOnly, cls: 'viewed', label: 'Просмотр' },
      { value: awaiting, cls: 'awaiting', label: 'Ждём' },
      { value: declined, cls: 'declined', label: 'Отказы' },
      { value: silent, cls: 'silent', label: 'Без ответа' },
    ],
    { center: String(applied) }
  );
}

/** @param {Record<string, number>} counts */
export function renderQueueDonut(counts) {
  const total = Number(counts.total) || 0;
  if (!total) return '<p class="funnel-empty">Пустая очередь</p>';
  return renderDonutChart(
    [
      { value: counts.pending || 0, cls: 'pending', label: 'На проверке' },
      { value: counts.approved || 0, cls: 'approved', label: 'Подходят' },
      { value: counts.rejected || 0, cls: 'rejected', label: 'Отклонены' },
      { value: Math.max(0, total - (counts.pending || 0) - (counts.approved || 0) - (counts.rejected || 0)), cls: 'other', label: 'Прочее' },
    ],
    { center: String(total) }
  );
}

/** @param {{ high?: number, mid?: number, low?: number, none?: number }} buckets */
export function renderScoreBarChart(buckets) {
  const rows = [
    { label: '≥70', n: buckets.high || 0, cls: 'high' },
    { label: '50–69', n: buckets.mid || 0, cls: 'mid' },
    { label: '<50', n: buckets.low || 0, cls: 'low' },
    { label: 'без', n: buckets.none || 0, cls: 'none' },
  ];
  const max = Math.max(1, ...rows.map((r) => r.n));
  return `<div class="funnel-vbar-chart" role="img" aria-label="Гистограмма по баллам">${rows
    .map((r) => {
      const h = Math.round((r.n / max) * 100);
      return `<div class="funnel-vbar">
        <span class="funnel-vbar__col funnel-vbar__col--${r.cls}" style="height:${Math.max(r.n ? 8 : 2, h)}%" title="${r.label}: ${r.n}"></span>
        <span class="funnel-vbar__n">${r.n}</span>
        <span class="funnel-vbar__label">${r.label}</span>
      </div>`;
    })
    .join('')}</div>`;
}

/** @param {Array<{ label: string, applied: number, viewPct: number, invitePct: number }>} rows */
export function renderResumeCompareChart(rows) {
  if (!rows?.length) return '<p class="funnel-empty">Нет данных по резюме</p>';
  const max = Math.max(1, ...rows.map((r) => r.applied));
  return `<div class="funnel-hbar-chart" role="img" aria-label="Сравнение резюме">${rows
    .map((r) => {
      const w = Math.round((r.applied / max) * 100);
      return `<div class="funnel-hbar">
        <span class="funnel-hbar__label" title="${esc(r.label)}">${esc(r.label)}</span>
        <div class="funnel-hbar__track">
          <span class="funnel-hbar__fill" style="width:${w}%"></span>
          <span class="funnel-hbar__pin funnel-hbar__pin--view" style="left:${Math.min(100, r.viewPct)}%" title="Просмотр ${r.viewPct}%"></span>
          <span class="funnel-hbar__pin funnel-hbar__pin--inv" style="left:${Math.min(100, r.invitePct)}%" title="Пригл. ${r.invitePct}%"></span>
        </div>
        <span class="funnel-hbar__meta">${r.applied} · ${r.viewPct}% · ${r.invitePct}%</span>
      </div>`;
    })
    .join('')}</div>
    <p class="funnel-hbar-legend"><i class="funnel-hbar__pin funnel-hbar__pin--view"></i> % просмотра · <i class="funnel-hbar__pin funnel-hbar__pin--inv"></i> % приглашений</p>`;
}

/**
 * @param {ReturnType<import('./funnel-timeline.mjs').bucketTimelineForDisplay>} chart
 */
export function renderTimelineMultiHtml(chart) {
  const points = chart?.points || [];
  if (!points.length) return '<p class="funnel-empty">Нет откликов за выбранный период</p>';
  const max = Math.max(
    1,
    ...points.map((t) => Math.max(Number(t.applied) || 0, Number(t.viewed) || 0, Number(t.invited) || 0))
  );
  const plotH = chart.plotHeightPx || 68;
  const modeNote =
    chart.mode === 'week' ? '<p class="funnel-timeline__mode">По неделям · столбцы: отклики / просмотр / пригл.</p>' : '<p class="funnel-timeline__mode">По дням · столбцы: отклики / просмотр / пригл.</p>';

  const cols = points
    .map((t) => {
      const applied = Number(t.applied) || 0;
      const viewed = Number(t.viewed) || 0;
      const invited = Number(t.invited) || 0;
      const hA = applied > 0 ? Math.max(3, Math.round((applied / max) * plotH)) : 0;
      const hV = viewed > 0 ? Math.max(2, Math.round((viewed / max) * plotH)) : 0;
      const hI = invited > 0 ? Math.max(2, Math.round((invited / max) * plotH)) : 0;
      return `<div class="funnel-timeline__col funnel-timeline__col--multi" title="${esc(t.title || '')}">
        <div class="funnel-timeline__plot funnel-timeline__plot--multi">
          <span class="funnel-timeline__bar funnel-timeline__bar--applied" style="height:${hA}px"></span>
          <span class="funnel-timeline__bar funnel-timeline__bar--viewed" style="height:${hV}px"></span>
          <span class="funnel-timeline__bar funnel-timeline__bar--invited" style="height:${hI}px"></span>
        </div>
        <span class="funnel-timeline__counts">${applied}${viewed ? `/${viewed}` : ''}${invited ? `/${invited}` : ''}</span>
        <span class="funnel-timeline__date">${t.label || ''}</span>
      </div>`;
    })
    .join('');

  return `${modeNote}<div class="funnel-timeline funnel-timeline--multi" role="img" aria-label="Динамика откликов">${cols}</div>`;
}

/** @param {{ total?: number, viewed?: number, invited?: number, declined?: number, awaiting?: number }} hh */
export function renderHhDonut(hh) {
  const total = Number(hh.total) || 0;
  if (!total) return '<p class="funnel-empty">Нет данных кэша</p>';
  const submitted = Math.max(0, total - (hh.viewed || 0) - (hh.invited || 0) - (hh.declined || 0) - (hh.awaiting || 0));
  return renderDonutChart(
    [
      { value: hh.invited || 0, cls: 'invited', label: 'Приглашения' },
      { value: hh.viewed || 0, cls: 'viewed', label: 'Просмотр' },
      { value: hh.declined || 0, cls: 'declined', label: 'Отказы' },
      { value: hh.awaiting || 0, cls: 'awaiting', label: 'Ждём' },
      { value: submitted, cls: 'queue', label: 'Отправлено' },
    ],
    { center: String(total) }
  );
}

/** @param {Array<{ date: string, applied: number, invited: number }>} timeline */
export function renderInviteRateChart(timeline) {
  const rows = (timeline || []).filter((t) => t?.date && t.date !== 'без даты');
  if (rows.length < 2) return '<p class="funnel-empty">Мало данных для тренда</p>';
  const rates = rows.map((t) => {
    const applied = Number(t.applied) || 0;
    const invited = Number(t.invited) || 0;
    return applied ? Math.round((invited / applied) * 1000) / 10 : 0;
  });
  const max = Math.max(1, ...rates);
  const w = 100 / rates.length;
  const points = rates
    .map((r, i) => {
      const x = (i + 0.5) * w;
      const y = 100 - (r / max) * 88 - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `0,100 ${points} 100,100`;
  return `<div class="funnel-spark-wrap">
    <svg class="funnel-spark" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Тренд % приглашений">
      <polygon class="funnel-spark__area" points="${area}"></polygon>
      <polyline class="funnel-spark__line" points="${points}"></polyline>
    </svg>
    <p class="funnel-spark__note">% приглашений от откликов по ${rows.length <= 14 ? 'дням' : 'периоду'} (макс. ${max}%)</p>
  </div>`;
}
