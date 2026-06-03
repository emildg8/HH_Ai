/** Экспорт аналитики воронки: CSV (Excel) и печать PDF. */

function csvCell(v) {
  const s = String(v ?? '');
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(';');
}

function periodLabel(filters) {
  if (filters?.since) return `с ${filters.since}`;
  if (filters?.periodDays) return `${filters.periodDays} дн.`;
  return 'всё время';
}

/** @param {Record<string, unknown>} data */
export function buildFunnelExportCsv(data) {
  if (!data) return '\ufeffНет данных';
  const lines = [];
  const filters = data.filters || {};
  const counts = data.counts || {};
  const rates = data.rates || {};

  lines.push(csvRow(['Воронка и конверсия']));
  lines.push(csvRow(['Период', periodLabel(filters)]));
  lines.push(csvRow(['Охват', filters.scope || 'applied']));
  if (filters.minScore) lines.push(csvRow(['Мин. балл', filters.minScore]));
  lines.push(csvRow(['Откликов', counts.applied ?? 0]));
  lines.push('');

  lines.push(csvRow(['По резюме']));
  lines.push(csvRow(['Резюме', 'Откл.', 'Просм.', 'Пригл.', 'Отказ', '% просм.', '% пригл.']));
  for (const r of data.byResume || []) {
    lines.push(csvRow([r.label, r.applied, r.viewed, r.invited, r.declined, r.viewPct, r.invitePct]));
  }
  lines.push('');

  lines.push(csvRow(['Воронка']));
  lines.push(csvRow(['Шаг', 'Кол-во', '%']));
  for (const s of data.steps || []) {
    const pct = s.pctOfApplied ?? s.pctOfPrev ?? s.pctOfBase ?? '';
    lines.push(csvRow([s.label, s.count, pct]));
  }
  lines.push('');
  lines.push(csvRow(['Просмотр от откликов', `${rates.viewFromApplied ?? 0}%`]));
  lines.push(csvRow(['Приглашения от откликов', `${rates.inviteFromApplied ?? 0}%`]));
  lines.push(csvRow(['Приглашения от просмотров', `${rates.inviteFromViewed ?? 0}%`]));
  lines.push('');

  const stale = data.staleFollowUp || [];
  if (stale.length) {
    lines.push(csvRow([`Follow-up ${data.staleFollowUpDays || 7}+ дней без ответа`]));
    lines.push(csvRow(['Вакансия', 'Компания', 'Дней']));
    for (const it of stale) {
      lines.push(csvRow([it.title || '—', it.company || '', it.days ?? '']));
    }
    lines.push('');
  }

  const timeline = data.timeline || [];
  if (timeline.length) {
    lines.push(csvRow(['Динамика откликов']));
    lines.push(csvRow(['Период', 'Откликов']));
    for (const t of timeline) {
      lines.push(csvRow([t.label || t.date || t.period || '—', t.count ?? t.applied ?? 0]));
    }
    lines.push('');
  }

  const hh = data.hhNegotiations || {};
  lines.push(csvRow(['Кэш hh.ru']));
  lines.push(csvRow(['Всего', hh.total ?? 0]));
  lines.push(csvRow(['Просмотр', hh.viewed ?? 0]));
  lines.push(csvRow(['Приглашения', hh.invited ?? 0]));
  lines.push(csvRow(['Отказы', hh.declined ?? 0]));
  lines.push(csvRow(['Ждём', hh.awaiting ?? 0]));

  return `\ufeff${lines.join('\r\n')}`;
}

/** @param {Record<string, unknown>} data */
export function downloadFunnelExcel(data) {
  const csv = buildFunnelExportCsv(data);
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `funnel-analytics-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function printFunnelPdf() {
  document.body.classList.add('funnel-print-mode');
  const cleanup = () => document.body.classList.remove('funnel-print-mode');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  setTimeout(cleanup, 2000);
}
