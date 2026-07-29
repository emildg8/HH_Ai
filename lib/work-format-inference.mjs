/**
 * Глубокий разбор формата работы: geo × TZ × commute × effectiveSortScore.
 * scoreOverall (fit) не меняем — только effectiveSortScore для сортировки серии/UI.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseWorkFormatMeta } from './vacancy-work-format.mjs';
import { formatNeedsPageVerify } from './work-format-truth.mjs';
import { classifyRoleTier, loadRoleLadder } from './role-ladder.mjs';
import { classifyHybridSoftness } from './hybrid-softness.mjs';
import {
  assessCommuteConvenience,
  buildCommuteSourceBlob,
  classifyChannelTier,
} from './commute-convenience.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** @type {object | null} */
let cachedCommute = null;
/** @type {object | null} */
let cachedPolicy = null;

function loadCommuteZone() {
  if (cachedCommute) return cachedCommute;
  try {
    cachedCommute = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'commute-zone.json'), 'utf8')
    );
  } catch {
    cachedCommute = { commuteCities: ['москва'], commutePatterns: [] };
  }
  return cachedCommute;
}

function loadWorkFormatPolicy() {
  if (cachedPolicy) return cachedPolicy;
  try {
    cachedPolicy = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'config', 'work-format-policy.json'), 'utf8')
    );
  } catch {
    cachedPolicy = {
      coreTzMin: 2,
      coreTzMax: 5,
      reserveSortPenalty: 20,
      coreRemoteSortBonus: 5,
      commuteSortBonus: 0,
    };
  }
  return cachedPolicy;
}

/** @param {string} blob */
export function matchesCommuteZone(blob) {
  const low = String(blob || '').toLowerCase();
  if (!low.trim()) return false;
  const cz = loadCommuteZone();
  if ((cz.commuteCities || []).some((c) => low.includes(String(c).toLowerCase()))) return true;
  for (const pat of cz.commutePatterns || []) {
    try {
      if (new RegExp(pat, 'i').test(low)) return true;
    } catch {
      /* ignore bad pattern */
    }
  }
  return false;
}

const CITY_TZ = [
  [/калининград/i, 2],
  [/москв|\bmsk\b|\bмск\b/i, 3],
  [/санкт[-\s]?петербург|\bспб\b/i, 3],
  [/самар/i, 4],
  [/volgograd|волгоград/i, 4],
  [/екатеринбург/i, 5],
  [/уф[aа]/i, 5],
  [/перм/i, 5],
  [/новосиб/i, 7],
  [/краснояр/i, 7],
  [/иркут/i, 8],
  [/владивост/i, 10],
  [/хабаров/i, 10],
];

/**
 * @param {string} blob
 * @param {string} [cityHint]
 * @returns {number | null}
 */
export function inferTimezoneOffset(blob, cityHint = '') {
  const text = `${blob}\n${cityHint}`;
  const m = text.match(/utc\s*([+-])\s*(\d{1,2})/i);
  if (m) return Number(`${m[1] === '-' ? '-' : ''}${m[2]}`);
  for (const [re, off] of CITY_TZ) {
    if (re.test(text)) return off;
  }
  if (/москв|\bmsk\b|\bмск\b/i.test(text)) return 3;
  return null;
}

/**
 * @param {object} rec
 */
export function buildWorkFormatSourceBlob(rec) {
  const wf = rec?.workFormat;
  const hhExtras =
    typeof wf === 'string'
      ? ''
      : // schedule/work_format chips из hhMeta (если workFormatLine ещё пуст)
        [
          rec?.hhMeta?.scheduleId === 'remote' ? 'Формат работы: удалённо' : '',
          Array.isArray(rec?.hhMeta?.workFormats) ? rec.hhMeta.workFormats.join(', ') : '',
        ]
          .filter(Boolean)
          .join('\n');
  return [
    rec?.title,
    rec?.employment,
    rec?.workFormatLine,
    hhExtras,
    typeof wf === 'string' ? wf : '',
    rec?.address,
    rec?.description,
    rec?.descriptionForLlm,
    rec?.descriptionPreview,
    rec?.remoteNote,
    typeof wf === 'object' && wf ? wf.format : '',
    typeof wf === 'object' && wf ? wf.city : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {ReturnType<typeof parseWorkFormatMeta>} meta
 * @param {string} blob
 */
export function classifyGeoFormat(meta, blob) {
  const policy = loadWorkFormatPolicy();
  const tz = inferTimezoneOffset(blob, meta.city || '');
  const commute = matchesCommuteZone(blob);
  const hasMoscow = /москв/i.test(blob);
  const spbPrimary =
    Boolean(meta.city && /санкт|спб/i.test(meta.city)) ||
    (/санкт[-\s]?петербург|\bспб\b/i.test(blob) && !hasMoscow);
  const coreMin = Number(policy.coreTzMin ?? 2);
  const coreMax = Number(policy.coreTzMax ?? 5);
  const reservePenalty = Number(policy.reserveSortPenalty ?? 20);
  const coreBonus = Number(policy.coreRemoteSortBonus ?? 5);

  /** @type {'coreRemote'|'reserveRemote'|'commuteZone'|'outOfZone'|'unknown'} */
  let geoClass = 'unknown';
  let batchSortPenalty = 0;
  let batchSortBonus = 0;

  // Гибрид + город офиса вне Москвы — не «чистая удалёнка»: иначе channel/sort
  // и assessWorkFormatForApply обходят hybridMoscowOnly (кейс РТЛабс Воронеж, 19.07).
  const hybridOutsideMoscow =
    Boolean(meta.hasHybrid) && Boolean(meta.city) && !/москв/i.test(String(meta.city));

  if (meta.hasRemote && !meta.officeOnly && !hybridOutsideMoscow) {
    if (spbPrimary && !hasMoscow) {
      geoClass = 'outOfZone';
    } else if (tz == null || (tz >= coreMin && tz <= coreMax)) {
      geoClass = 'coreRemote';
      batchSortBonus = coreBonus;
    } else if (tz > coreMax) {
      geoClass = 'reserveRemote';
      batchSortPenalty = reservePenalty;
    } else {
      geoClass = 'coreRemote';
      batchSortBonus = coreBonus;
    }
  } else if (
    meta.hasHybrid ||
    meta.officeOnly ||
    (meta.hasRemote && meta.explicitOffice) ||
    hybridOutsideMoscow
  ) {
    if (commute || meta.officeMoscowOnly || meta.hybridMoscow) {
      geoClass = 'commuteZone';
      batchSortBonus = Number(policy.commuteSortBonus ?? 0);
    } else {
      geoClass = 'outOfZone';
    }
  } else if (meta.format === 'не указан') {
    geoClass = 'unknown';
  } else {
    geoClass = 'outOfZone';
  }

  return { geoClass, timezoneOffset: tz, batchSortPenalty, batchSortBonus, commuteMatch: commute };
}

/**
 * Зелёная ветка в шаговой доступности — втянуть в commute-зону даже без city match.
 * @param {ReturnType<typeof classifyGeoFormat>} geo
 * @param {ReturnType<typeof assessCommuteConvenience>} commuteConvenience
 */
function applyGreenLineCommuteUpgrade(geo, commuteConvenience) {
  if (geo.geoClass !== 'outOfZone') return geo;
  if (!commuteConvenience?.greenLine?.walkable) return geo;
  return {
    ...geo,
    geoClass: 'commuteZone',
    commuteMatch: true,
    batchSortBonus: Math.max(Number(geo.batchSortBonus || 0), 0),
  };
}

/**
 * @param {object} rec
 * @param {{ prefs?: object, fallbackLevel?: number }} [opts]
 */
export function inferWorkFormatAssessment(rec, opts = {}) {
  const blob = buildWorkFormatSourceBlob(rec);
  const commuteBlob = buildCommuteSourceBlob(rec) || blob;
  const meta = parseWorkFormatMeta(rec, {});
  const commuteConvenience = assessCommuteConvenience(rec, {
    blob: commuteBlob,
    prefs: opts.prefs,
    fallbackLevel: opts.fallbackLevel,
  });
  let geo = classifyGeoFormat(meta, blob);
  geo = applyGreenLineCommuteUpgrade(geo, commuteConvenience);
  const hybridSoftness = classifyHybridSoftness(rec, { blob, meta });

  let confidence = 'unknown';
  if (meta.formatConfidence === 'unverified_chip') confidence = 'unverified_chip';
  else if (meta.explicitRemote || meta.explicitOffice) confidence = 'explicit';
  else if (meta.hasRemote || meta.hasHybrid || meta.officeOnly) confidence = 'inferred';
  if (meta.formatConfidence === 'address_only' && confidence === 'inferred') {
    confidence = 'address_only';
  }

  /** @type {string[]} */
  const evidence = [];
  if (meta.explicitRemote) evidence.push('явная удалёнка в формате');
  if (meta.explicitOffice) evidence.push('явный офис в формате');
  if (meta.hasHybrid) evidence.push('гибрид в тексте');
  if (geo.commuteMatch) evidence.push('адрес в commute-зоне МО');
  if (geo.timezoneOffset != null) evidence.push(`TZ UTC${geo.timezoneOffset >= 0 ? '+' : ''}${geo.timezoneOffset}`);
  if (hybridSoftness.tier && hybridSoftness.tier !== 'not_hybrid') {
    evidence.push(`мягкость гибрида: ${hybridSoftness.tier}`);
  }
  if (commuteConvenience.reasons?.length) {
    evidence.push(`доезд: ${commuteConvenience.reasons.join('; ')}`);
  } else if (commuteConvenience.verdict === 'reject') {
    evidence.push('доезд: эвристика выше порога');
  }

  const softBonus = Number(hybridSoftness.sortBonus || 0);
  const commuteBonus = Number(commuteConvenience.sortBonus || 0);
  const channelTier = classifyChannelTier({
    geoClass: geo.geoClass,
    meta,
    hybridSoftness,
    commuteConvenience,
  });
  evidence.push(`канал: ${channelTier.label}`);
  const scoreOverall = Number(rec?.scoreOverall ?? rec?.geminiScore ?? 0) || 0;
  // channelRank доминирует: remote → soft hybrid → hybrid medium → near office
  const effectiveSortScore = Math.max(
    0,
    Number(channelTier.rank || 0) +
      scoreOverall +
      geo.batchSortBonus -
      geo.batchSortPenalty +
      softBonus +
      commuteBonus
  );

  return {
    format: meta.format,
    confidence,
    geoClass: geo.geoClass,
    timezoneOffset: geo.timezoneOffset,
    batchSortPenalty: geo.batchSortPenalty,
    batchSortBonus: geo.batchSortBonus + softBonus + commuteBonus + Number(channelTier.rank || 0),
    hybridSoftness,
    commuteConvenience,
    channelTier,
    effectiveSortScore,
    commuteMatch: geo.commuteMatch,
    evidence,
    meta,
  };
}

function loadWorkFormatByTier() {
  try {
    const ladder = loadRoleLadder();
    return ladder.workFormatByTier || {};
  } catch {
    return {};
  }
}

/**
 * @param {object} rec
 * @param {{ prefs?: object, userApproved?: boolean, strictApply?: boolean }} [opts]
 */
export function assessWorkFormatForApply(rec, opts = {}) {
  const assessment = inferWorkFormatAssessment(rec, {
    prefs: opts.prefs,
    fallbackLevel: opts.fallbackLevel ?? opts.prefs?.commuteFallbackLevel,
  });
  const { tier } = classifyRoleTier(rec);
  const tierRules = loadWorkFormatByTier()[tier] || loadWorkFormatByTier().default || {};
  const allowHybrid = tierRules.allowHybrid !== false && opts.prefs?.allowHybrid !== false;
  const requireRemote = tierRules.requireRemote === true || opts.strictApply !== false;
  const userApproved = Boolean(opts.userApproved || rec?.userApproved);

  const { geoClass, meta, confidence } = assessment;

  // Не выдавать «только офис» / office Moscow за правду по неполному chip без verify страницы.
  if (formatNeedsPageVerify(rec, meta) && !userApproved) {
    return {
      pass: false,
      reason:
        'Формат не подтверждён со страницы hh (chip «на месте» без verify) — npm run devops:backfill-work-format',
      workFormatAssessment: { ...assessment, confidence: 'unverified_chip' },
    };
  }

  // Паритет с passesWorkFormatRules: hasHybrid + hybridMoscowOnly + город ≠ Москва → стоп.
  // Не завязывать на allowHybrid (у R2 он false) и не ждать coreRemote — после classify
  // такой кейс уже outOfZone.
  if (
    meta.hasHybrid &&
    opts.prefs?.hybridMoscowOnly !== false &&
    meta.city &&
    !/москв/i.test(String(meta.city))
  ) {
    if (userApproved) {
      return {
        pass: true,
        reason: 'Гибрид вне Москвы — одобрено',
        workFormatAssessment: assessment,
      };
    }
    return {
      pass: false,
      reason: 'Гибрид не в Москве',
      workFormatAssessment: assessment,
    };
  }

  if (geoClass === 'coreRemote') {
    return { pass: true, reason: 'Удалёнка (core TZ)', workFormatAssessment: assessment };
  }
  if (geoClass === 'reserveRemote') {
    if (tierRules.allowReserveRemote === false) {
      return {
        pass: false,
        reason: 'Удалёнка вне core TZ (резерв)',
        workFormatAssessment: assessment,
      };
    }
    return {
      pass: true,
      reason: `Удалёнка (резерв TZ${assessment.timezoneOffset != null ? ` UTC+${assessment.timezoneOffset}` : ''})`,
      workFormatAssessment: assessment,
    };
  }
  if (geoClass === 'commuteZone') {
    const cc = assessment.commuteConvenience;
    // Офис only: жёсткий доезд — пропускаем удобные; известный «далеко» — режем
    if (meta.officeOnly && opts.prefs?.allowOfficeMoscow !== false) {
      if (cc?.verdict === 'reject') {
        return {
          pass: false,
          reason: 'Офис: доезд выше порога (эвристика от Горки Парк / Взлётная)',
          workFormatAssessment: assessment,
        };
      }
      if (cc?.officeOk) {
        return {
          pass: true,
          reason: 'Офис: ближний доезд (запасной канал)',
          workFormatAssessment: assessment,
        };
      }
      return { pass: true, reason: 'Офис в commute-зоне', workFormatAssessment: assessment };
    }
    if (meta.hasHybrid && allowHybrid) {
      if (cc?.softOk) {
        return {
          pass: true,
          reason: 'Гибрид: средний доезд от дома',
          workFormatAssessment: assessment,
        };
      }
      return { pass: true, reason: 'Гибрид в commute-зоне', workFormatAssessment: assessment };
    }
    if (tier === 'R2' && !userApproved) {
      return {
        pass: false,
        reason: 'Гибрид/офис для R2 — нужно одобрение',
        workFormatAssessment: assessment,
      };
    }
    if (allowHybrid || opts.prefs?.allowOfficeMoscow !== false) {
      return { pass: true, reason: assessment.format, workFormatAssessment: assessment };
    }
  }
  if (geoClass === 'unknown') {
    if (confidence === 'inferred' && meta.hasRemote && !requireRemote) {
      return { pass: true, reason: 'Формат inferred', workFormatAssessment: assessment };
    }
    if (!requireRemote) {
      return { pass: true, reason: 'Формат не указан — широкий режим', workFormatAssessment: assessment };
    }
    // config/work-format-policy.json — экспертный override (канон: false).
    // Откат/тест: HH_AUTO_APPLY_UNKNOWN_FORMAT=1
    const policy = loadWorkFormatPolicy();
    const autoUnknown =
      policy.autoApplyUnknownFormat === true ||
      String(process.env.HH_AUTO_APPLY_UNKNOWN_FORMAT || '').trim() === '1';
    if (autoUnknown) {
      return {
        pass: true,
        reason: 'Формат не указан — autoApplyUnknownFormat',
        workFormatAssessment: assessment,
      };
    }
    return {
      pass: false,
      reason: 'Формат не указан — проверьте вручную',
      workFormatAssessment: assessment,
    };
  }

  return {
    pass: false,
    reason: meta.officeOnly
      ? `Офис вне commute-зоны${meta.city ? ` (${meta.city})` : ''}`
      : 'Формат работы не подходит',
    workFormatAssessment: assessment,
  };
}

/** @param {object} rec */
export function effectiveSortScoreOf(rec) {
  if (rec?.workFormatAssessment?.effectiveSortScore != null) {
    return Number(rec.workFormatAssessment.effectiveSortScore);
  }
  return Number(rec?.scoreOverall ?? rec?.geminiScore ?? 0) || 0;
}
