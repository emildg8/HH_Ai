/**
 * Честность формата работы: не выдавать chip «на месте» / stale workFormat за истину hh.
 */

/** Chip hh без «или гибрид» — часто неполный относительно страницы вакансии. */
export function isThinEmployerSiteChip(workFormatLine) {
  const t = String(workFormatLine || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;
  if (/или\s+гибрид|\/\s*гибрид|гибридн/i.test(t)) return false;
  return /^(формат\s+работы\s*:\s*)?на\s+месте(?:\s+работодателя)?\.?$/i.test(t);
}

/**
 * Явный гибрид как формат работы в JD (не «hybrid cloud»).
 * @param {string} blob
 */
export function jdSignalsHybridWorkFormat(blob) {
  const t = String(blob || '');
  if (!t.trim()) return false;
  return (
    /формат\s+работы\s*[:=]?\s*[^\n.]{0,60}гибрид/i.test(t) ||
    /гибридн\w*\s+(?:формат|график|режим|форм[аы]\s+работ)/i.test(t) ||
    /режим\s+гибрид|работа\s+в\s+гибрид|гибридн\w*\s+форм/i.test(t) ||
    /на\s+месте(?:\s+работодателя)?\s+или\s+гибрид/i.test(t) ||
    /офисн\w*\s*\/\s*гибридн|офис\s*\/\s*дом|office\s*\/\s*home/i.test(t) ||
    /\bhybrid\s+(?:work|format|schedule)\b/i.test(t)
  );
}

/**
 * @param {object} rec
 */
export function vacancyFormatTextBlob(rec) {
  if (!rec || typeof rec !== 'object') return '';
  return [
    rec.workFormatLine,
    rec.employment,
    rec.address,
    rec.description,
    rec.descriptionPreview,
    rec.descriptionForLlm,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Нужна догрузка chip/JD со страницы hh перед тем, как верить «только офис».
 * Не блокируем, если JD уже явно опроверг тонкий chip (гибрид в тексте).
 * @param {object} rec
 * @param {{ officeOnly?: boolean, hasHybrid?: boolean, formatConfidence?: string }} [meta]
 */
export function formatNeedsPageVerify(rec, meta = null) {
  if (!rec || typeof rec !== 'object') return false;
  if (rec.formatVerifiedAt) return false;
  if (Array.isArray(rec.hhMeta?.workFormats) && rec.hhMeta.workFormats.length) return false;
  if (String(rec.hhMeta?.scheduleId || '') === 'remote') return false;
  if (!isThinEmployerSiteChip(rec.workFormatLine)) return false;
  if (jdSignalsHybridWorkFormat(vacancyFormatTextBlob(rec))) return false;
  if (meta?.hasHybrid && !meta?.officeOnly) return false;
  return true;
}

/**
 * Статус карточки из переговоров hh — не оставлять pending при отказе.
 * @param {string} curStatus
 * @param {string} negStatus
 * @returns {{ status?: string }}
 */
export function statusPatchFromNegotiation(curStatus, negStatus) {
  const cur = String(curStatus || '').trim();
  const neg = String(negStatus || '').trim();
  if (neg === 'declined') {
    if (!cur || ['pending', 'approved', 'applied', 'responded'].includes(cur)) {
      return { status: 'declined' };
    }
    return {};
  }
  if (!cur || cur === 'pending' || cur === 'approved') {
    return { status: 'applied' };
  }
  return {};
}

/**
 * Пересчитать workFormat с живого parse — чинит stale officeOnly при уже полном line/JD.
 * @param {object} rec
 * @param {object} meta — результат parseWorkFormatMeta
 */
export function buildWorkFormatSyncPatch(rec, meta) {
  const prev = rec?.workFormat && typeof rec.workFormat === 'object' ? rec.workFormat : null;
  const changed =
    !prev ||
    Boolean(prev.officeOnly) !== Boolean(meta.officeOnly) ||
    Boolean(prev.hasHybrid) !== Boolean(meta.hasHybrid) ||
    Boolean(prev.hasRemote) !== Boolean(meta.hasRemote) ||
    String(prev.format || '') !== String(meta.format || '');
  if (!changed) return null;
  return {
    workFormat: meta,
    remoteNote: [meta.format, meta.city, meta.timezone].filter(Boolean).join(' · '),
    updatedAt: new Date().toISOString(),
  };
}
