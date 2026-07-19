/**
 * Fingerprint волны писем: одна метрика / один каркас на весь pack → ИИ/HR режет.
 * Канон: SESSION-2026-07-16-duplicate-apply-postmortem · ME letter review.
 * Point-day (20.07): строже IT_One — soft-block при ≥2 в волне.
 */

/** @param {string} text */
export function letterHasMttr15Fingerprint(text) {
  const t = String(text || '');
  return (
    /(?:mttr|время\s+реакц\w*|сократил\w*\s+время).{0,40}15\s*%/i.test(t) ||
    /15\s*%.{0,40}(?:mttr|реакц|алерт)/i.test(t) ||
    /примерно\s+на\s+15\s*%/i.test(t) ||
    /−\s*15\s*%|-\s*15\s*%/i.test(t)
  );
}

/**
 * Каркас IT_One + СБП (+ Grafana/логи) — в т.ч. «До июня 2026 в IT_One…».
 * @param {string} text
 */
export function letterHasSameItOneOpeningFingerprint(text) {
  const t = String(text || '');
  const itOneSbp =
    /(?:в\s+)?IT_One.{0,80}(?:СБП|контурах\s+СБП)|(?:До\s+\w+\s+20\d{2}.{0,40})?IT_One.{0,60}СБП|на\s+контурах\s+СБП.{0,40}IT_One/i.test(
      t
    ) || /в\s+IT_One\s+на\s+контурах\s+СБП/i.test(t);
  const stackHint = /Grafana\/Kibana|логи\s+и\s+SQL|Grafana|Kibana|релизы.{0,20}регламент/i.test(t);
  return itOneSbp && stackHint;
}

/**
 * @param {Array<{ id?: string, company?: string, letter: string }>} items
 * @returns {{ ok: boolean, blockers: string[], warnings: string[], stats: object }}
 */
export function analyzeWaveLetterFingerprints(items) {
  const list = (items || []).filter((x) => String(x?.letter || '').trim());
  const blockers = [];
  const warnings = [];
  if (list.length < 2) {
    return { ok: true, blockers, warnings, stats: { n: list.length } };
  }

  const with15 = list.filter((x) => letterHasMttr15Fingerprint(x.letter));
  const withItOneOpen = list.filter((x) => letterHasSameItOneOpeningFingerprint(x.letter));

  const max15 = list.length >= 4 ? 2 : 1;
  if (with15.length > max15) {
    blockers.push(
      `wave: метрика «~15%/MTTR» в ${with15.length}/${list.length} письмах (лимит ${max15}) — ` +
        with15.map((x) => x.company || x.id?.slice?.(0, 8) || '?').join(', ')
    );
  } else if (with15.length === list.length && list.length >= 2) {
    blockers.push('wave: все письма с одной метрикой «~15%» — разведите факты');
  }

  if (withItOneOpen.length >= 3 && withItOneOpen.length >= Math.ceil(list.length * 0.6)) {
    warnings.push(
      `wave: одинаковый каркас IT_One+СБП+Grafana в ${withItOneOpen.length} письмах — ослабьте шаблон`
    );
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    stats: {
      n: list.length,
      mttr15: with15.length,
      itOneOpen: withItOneOpen.length,
    },
  };
}

/** @returns {boolean} */
export function pointWaveFingerprintEnabled() {
  return String(process.env.HH_POINT_WAVE_FINGERPRINT ?? '1').trim() !== '0';
}

/**
 * Точечная волна дня: те же 15%-blockers + IT_One soft-block при ≥2.
 * @param {Array<{ id?: string, company?: string, letter: string }>} items
 */
export function analyzePointDayWaveLetterFingerprints(items) {
  const base = analyzeWaveLetterFingerprints(items);
  const list = (items || []).filter((x) => String(x?.letter || '').trim());
  const blockers = [...base.blockers];
  const warnings = [...base.warnings];
  const withItOneOpen = list.filter((x) => letterHasSameItOneOpeningFingerprint(x.letter));
  if (withItOneOpen.length >= 2) {
    blockers.push(
      `point-wave: каркас IT_One+СБП в ${withItOneOpen.length} письмах волны (лимит 1) — ` +
        withItOneOpen.map((x) => x.company || x.id?.slice?.(0, 8) || '?').join(', ')
    );
  }
  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    stats: {
      ...base.stats,
      n: list.length,
      itOneOpen: withItOneOpen.length,
      mode: 'point-day',
    },
  };
}

/**
 * Текст письма из карточки очереди.
 * @param {object} rec
 */
export function letterTextFromVacancyRecord(rec) {
  const cl = rec?.coverLetter || {};
  return String(cl.approvedText || cl.text || cl.draftText || '').trim();
}

/**
 * Волна дня для point gate: только applied за сутки + focus + явный shortlist.
 * Не тянем все pending с письмом (ложный IT_One block на весь день).
 * @param {object[]} records
 * @param {{ now?: Date, focusId?: string, focusLetter?: string, focusCompany?: string, shortlistIds?: string[] | Set<string> }} [opts]
 */
export function collectPointDayWaveLetterItems(records, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayMs = dayStart.getTime();
  const shortlist = new Set(
    [...(opts.shortlistIds || [])].map((x) => String(x || '').trim()).filter(Boolean)
  );
  const focusId = String(opts.focusId || '').trim();

  /** @type {Map<string, { id: string, company?: string, letter: string }>} */
  const byId = new Map();

  for (const rec of records || []) {
    const id = String(rec?.id || '').trim();
    if (!id) continue;
    const letter = letterTextFromVacancyRecord(rec);
    if (!letter) continue;
    const status = String(rec.status || '').toLowerCase();
    const appliedAt = rec.hhApply?.appliedAt || rec.appliedAt;
    const appliedMs = appliedAt ? Date.parse(String(appliedAt)) : NaN;
    const appliedToday =
      (status === 'applied' || status === 'responded') &&
      Number.isFinite(appliedMs) &&
      appliedMs >= dayMs;
    const inShortlist = shortlist.has(id);
    const isFocus = focusId && id === focusId;
    if (appliedToday || inShortlist || isFocus) {
      byId.set(id, {
        id,
        company: String(rec.company || rec.employer || '').slice(0, 40),
        letter,
      });
    }
  }

  if (focusId && opts.focusLetter) {
    byId.set(focusId, {
      id: focusId,
      company: String(opts.focusCompany || byId.get(focusId)?.company || '').slice(0, 40),
      letter: String(opts.focusLetter),
    });
  }

  return [...byId.values()];
}
