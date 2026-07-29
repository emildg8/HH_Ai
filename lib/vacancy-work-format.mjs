/**
 * Формат работы, город, язык — для карточки и фильтров.
 */

import {
  isThinEmployerSiteChip,
  jdSignalsHybridWorkFormat,
} from './work-format-truth.mjs';

function includesAny(text, patterns) {
  const t = String(text || '').toLowerCase();
  return (patterns || []).some((p) => t.includes(String(p).toLowerCase()));
}

/** Не формат работы, а обязанность / инфраструктура (ложные «удалёнка»). */
const REMOTE_WORK_FALSE_POSITIVE = [
  /удалённ?ая\s+поддержк/i,
  /удаленн?ая\s+поддержк/i,
  /удалённ?ый\s+доступ/i,
  /удаленн?ый\s+доступ/i,
  /удалённ?ое\s+администрирован/i,
  /дистанционн\w*\s+доступ/i,
  /систем\w*\s+телеметри/i,
  /remote\s+desktop/i,
  /\brdp\b/i,
  /выезд\w*\s+к\s+клиент/i,
  /выезды\s+к\s+клиент/i,
  /разъездн\w*\s+характер/i,
];

/** Явный офис / без удалёнки (hh.ru и типичные формулировки). */
const EXPLICIT_OFFICE_RE =
  /формат\s+работы\s*:\s*(?:на\s+месте(?:\s+работодателя)?|в\s+офисе|офис)|(?:^|[\n;])\s*на\s+месте\s+работодателя\b|удалённ?ый\s+формат\s+работы\s+не\s+предусмотрен|удаленн?ый\s+формат\s+работы\s+не\s+предусмотрен|без\s+удалённ?ой\s+работы|без\s+удаленн?ой\s+работы|только\s+офис|работа\s+только\s+в\s+офисе|офис\s+по\s+адресу/i;

/**
 * Chip hh «на месте … или гибрид» / «офисный/гибридный» — не чистый officeOnly.
 * Должен выигрывать у EXPLICIT_OFFICE_RE на той же строке.
 */
const OFFICE_OR_HYBRID_RE =
  /формат\s+работы\s*:\s*на\s+месте(?:\s+работодателя)?\s+или\s+гибрид|офисн\w*\s*\/\s*гибридн|офисн\w*\s+или\s+гибридн|на\s+месте(?:\s+работодателя)?\s+или\s+гибрид/i;

/**
 * Проза JD без «Формат работы: …», но явный офис (часто Москва + метро).
 * Не ставить officeOnly, если уже есть удалёнка/гибрид в тексте.
 */
const OFFICE_PROSE_HINT_RE =
  /офис\w*\s+(?:рядом\s+с|у|возле)\s+м\.|офис\w*\s+в\s+центре\s+москв|(?:комфортн\w*|стильн\w*|нов\w*)\s+офис\w*.{0,80}москв|офис\w*.{0,40}м\.\s*[А-Яа-яA-Za-zЁё-]{3,}/i;

/**
 * Явная удалёнка в блоке «формат работы».
 * Гибрид сюда НЕ входит (отдельный hasHybrid) — иначе chip «гибрид» → ложная удалёнка.
 */
const EXPLICIT_REMOTE_RE =
  /формат\s+работы\s*:\s*(?:удалённ?|удаленн?|дистанцион|remote|из\s+дома)(?!\s*или)|полностью\s+удалённ?|полностью\s+удаленн?|удалённ?ая\s+работа|удаленн?ая\s+работа|работа\s+из\s+дома|(?:^|[\s·])удалённо(?:$|[\s·])|(?:^|[\s·])удаленно(?:$|[\s·])/i;

/** Chip / заголовок формата — явный гибрид (не путать с remote). */
const EXPLICIT_HYBRID_FORMAT_RE =
  /формат\s+работы\s*:\s*гибрид|формат\s+работы\s*:\s*hybrid|\bhybrid\b/i;

function stripRemoteFalsePositives(low) {
  let s = low;
  for (const re of REMOTE_WORK_FALSE_POSITIVE) {
    s = s.replace(re, ' ');
  }
  return s;
}

/**
 * Сколько дней в офисе при гибриде (из текста JD), иначе null.
 * Примеры: «3 дня в офисе», «офис 4 дня», «2/3 гибрид» не парсим как офис-дни.
 * @param {string} low
 * @returns {number | null}
 */
export function extractHybridOfficeDaysPerWeek(low) {
  const t = String(low || '').toLowerCase();
  const patterns = [
    /(\d)\s*д(?:н|ень|ня|ней)?\s*(?:в\s+)?(?:недел\w*\s+)?(?:в\s+)?офис/,
    /офис\w*\s*(?:—|-|:)?\s*(\d)\s*д/,
    /(\d)\s*дн(?:я|ей)?\s*офис/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 5) return n;
    }
  }
  return null;
}

function textSuggestsRemoteWork(low, remotePositive) {
  const stripped = stripRemoteFalsePositives(low);
  return includesAny(stripped, remotePositive);
}

/**
 * Адрес/город без явной удалёнки — сигнал физического офиса (не «формат не указан»).
 * @param {string} address
 */
export function addressSuggestsPhysicalOffice(address) {
  const a = String(address || '').trim();
  if (!a || a.length < 3) return false;
  if (inferCityFromAddress(a)) return true;
  if (/ул\.|улиц|шоссе|проспект|пер\.|д\.|корп|микрорайон|м\./i.test(a)) return true;
  // «Йошкар-Ола, бульвар…» без известного города в таблице
  if (a.length >= 8 && /[а-яёa-z]/i.test(a)) return true;
  return false;
}

/**
 * Строка формата из hh API / hhMeta (schedule + work_format chips).
 * @param {object} blob
 */
export function workFormatLineExtrasFromHhMeta(blob) {
  /** @type {string[]} */
  const bits = [];
  const sid = String(blob?.hhMeta?.scheduleId || blob?.scheduleId || '').trim();
  if (sid === 'remote') bits.push('Формат работы: удалённо');
  const names = blob?.hhMeta?.workFormats;
  if (Array.isArray(names) && names.length) {
    bits.push(names.map((x) => String(x || '').trim()).filter(Boolean).join(', '));
  } else if (typeof blob?.workFormat === 'string' && blob.workFormat.trim()) {
    bits.push(blob.workFormat.trim());
  }
  return bits.filter(Boolean).join('\n');
}

function normalizeWorkFormatInput(blob) {
  if (typeof blob === 'string') {
    return { description: blob, address: '', workFormatLine: '', employment: '', title: '', company: '' };
  }
  if (!blob || typeof blob !== 'object') {
    return { description: '', address: '', workFormatLine: '', employment: '', title: '', company: '' };
  }
  const extras = workFormatLineExtrasFromHhMeta(blob);
  const workFormatLine = [blob.workFormatLine, extras].filter((x) => String(x || '').trim()).join('\n');
  return {
    title: blob.title,
    company: blob.company,
    employment: blob.employment,
    address: blob.address,
    workFormatLine,
    description: [blob.description, blob.descriptionPreview, blob.descriptionForLlm]
      .filter(Boolean)
      .join('\n'),
  };
}

/** Город из поля address hh (приоритет над упоминаниями в описании). */
export function inferCityFromAddress(address) {
  const a = String(address || '').trim();
  if (!a) return '';
  const rules = [
    [/москва/i, 'Москва'],
    [/санкт[-\s]?петербург|\bспб\b/i, 'Санкт-Петербург'],
    [/ростов[-\s]на[-\s]дону|\bростов\b/i, 'Ростов-на-Дону'],
    [/новосибирск/i, 'Новосибирск'],
    [/екатеринбург/i, 'Екатеринбург'],
    [/казан/i, 'Казань'],
    [/тюмен/i, 'Тюмень'],
    [/твер/i, 'Тверь'],
  ];
  for (const [re, name] of rules) {
    if (re.test(a)) return name;
  }
  const head = a.split(',')[0]?.trim();
  if (head && head.length <= 48 && !/\d{3,}/.test(head)) return head;
  return '';
}

function inferCityFromText(text) {
  const low = String(text || '').toLowerCase();
  if (/москв/i.test(low)) return 'Москва';
  if (/санкт[-\s]?петербург|\bспб\b/i.test(low)) return 'Санкт-Петербург';
  if (/ростов[-\s]на[-\s]дону|\bростов\b/i.test(low)) return 'Ростов-на-Дону';
  if (/новосибирск/i.test(low)) return 'Новосибирск';
  if (/екатеринбург/i.test(low)) return 'Екатеринбург';
  if (/казан/i.test(low)) return 'Казань';
  if (/тюмен/i.test(low)) return 'Тюмень';
  if (/твер/i.test(low)) return 'Тверь';
  if (/обнинск/i.test(low)) return 'Обнинск';
  if (/калуг/i.test(low)) return 'Калуга';
  // «офис по адресу: г. Обнинск» / «г. Тверь»
  const g = String(text || '').match(/(?:^|[^\p{L}])г\.\s*([А-ЯЁа-яё-]{3,40})/u);
  if (g?.[1] && !/москв/i.test(g[1])) return g[1];
  return '';
}

/**
 * @param {string|object} blob — текст или { address, workFormatLine, description, … }
 * @param {object} [prefs]
 */
export function parseWorkFormatMeta(blob, prefs = {}) {
  const input = normalizeWorkFormatInput(blob);
  const address = String(input.address || '');
  const workFormatLine = String(input.workFormatLine || '');
  const employment = String(input.employment || '');
  const description = String(input.description || '');

  const formatBlob = [workFormatLine, employment, input.title, input.company].filter(Boolean).join('\n');
  const t =
    typeof blob === 'string'
      ? String(blob)
      : [formatBlob, address, description].filter(Boolean).join('\n');
  const low = t.toLowerCase();
  const formatLow = formatBlob.toLowerCase();

  const remotePositive = prefs.remotePositivePatterns || [
    'удален',
    'удалён',
    'дистанцион',
    'remote',
    'работа из дома',
    'из любой точки',
  ];
  const hybridPatterns = prefs.hybridPatterns || ['гибрид', 'hybrid'];
  const officeOnlyPatterns = prefs.officeOnlyPatterns || [
    'только офис',
    'офис обязателен',
    'работа в офисе компании',
    'в офисе ежедневно',
    'на месте работодателя',
  ];

  const officeOrHybrid = OFFICE_OR_HYBRID_RE.test(formatLow) || OFFICE_OR_HYBRID_RE.test(low);
  const explicitHybridChip =
    EXPLICIT_HYBRID_FORMAT_RE.test(formatLow) || EXPLICIT_HYBRID_FORMAT_RE.test(low);
  // Чистый офис только если нет «или гибрид» / chip гибрид.
  const explicitOffice =
    !officeOrHybrid &&
    !explicitHybridChip &&
    (EXPLICIT_OFFICE_RE.test(formatLow) || EXPLICIT_OFFICE_RE.test(low));
  const explicitRemote = EXPLICIT_REMOTE_RE.test(formatLow) || EXPLICIT_REMOTE_RE.test(low);
  const officeProseHint = OFFICE_PROSE_HINT_RE.test(low);

  let hasRemote;
  let officeOnly;

  // Тонкий chip «на месте» + явный гибрид в JD → не officeOnly (кейс Альфа / неполный SERP).
  const jdHybrid = jdSignalsHybridWorkFormat(description) || jdSignalsHybridWorkFormat(low);
  const thinOfficeChip = isThinEmployerSiteChip(workFormatLine);

  if (officeOrHybrid || explicitHybridChip || (thinOfficeChip && jdHybrid)) {
    // Chip гибрид / «на месте или гибрид» / JD опровергает тонкий chip — не officeOnly.
    hasRemote = false;
    officeOnly = false;
  } else if (explicitOffice && !explicitRemote) {
    hasRemote = false;
    officeOnly = true;
  } else if (explicitRemote) {
    hasRemote = true;
    officeOnly = false;
  } else {
    hasRemote = textSuggestsRemoteWork(low, remotePositive);
    const hybridEarly =
      includesAny(low, hybridPatterns) || explicitHybridChip || officeOrHybrid || jdHybrid;
    const officeHint =
      includesAny(low, officeOnlyPatterns) || explicitOffice || (officeProseHint && !hybridEarly);
    officeOnly = officeHint && !hasRemote;
  }

  let hasHybrid =
    (includesAny(low, hybridPatterns) ||
      explicitHybridChip ||
      officeOrHybrid ||
      (thinOfficeChip && jdHybrid) ||
      jdHybrid) &&
    !officeOnly;

  // Пустой workFormatLine + адрес без remote/hybrid → офис, не geoClass=unknown.
  if (
    !explicitRemote &&
    !hasRemote &&
    !hasHybrid &&
    !officeOnly &&
    addressSuggestsPhysicalOffice(address)
  ) {
    officeOnly = true;
  }
  if (officeOnly) hasHybrid = false;

  /** @type {'explicit'|'inferred'|'unverified_chip'|'address_only'} */
  let formatConfidence = 'inferred';
  if (officeOrHybrid || explicitHybridChip || explicitRemote || (explicitOffice && !thinOfficeChip)) {
    formatConfidence = 'explicit';
  } else if (thinOfficeChip && officeOnly) {
    formatConfidence = 'unverified_chip';
  } else if (officeOnly && !workFormatLine.trim() && addressSuggestsPhysicalOffice(address)) {
    formatConfidence = 'address_only';
  } else if (explicitOffice || hasRemote || hasHybrid || officeOnly) {
    formatConfidence = officeOnly && thinOfficeChip ? 'unverified_chip' : 'inferred';
  }

  let city = inferCityFromAddress(address);
  if (!city && workFormatLine) city = inferCityFromText(workFormatLine);
  if (!city && formatBlob) city = inferCityFromText(formatBlob);
  // Без address — город из описания; с address не даём «Москва» из текста перебить Ростов и т.п.
  if (!city && !address.trim() && description) city = inferCityFromText(description);
  // Офис у метро / «в центре Москвы» без address — город Москва для commute.
  if (!city && officeOnly && officeProseHint && /москв|м\./i.test(low)) city = 'Москва';

  let timezone = '';
  const tz = low.match(/utc\s*([+-])\s*(\d{1,2})/i);
  if (tz) timezone = `UTC${tz[1]}${tz[2]}`;
  else if (/москв|msk|мск/i.test(low)) timezone = 'UTC+3 (МСК)';

  const needsSpokenEnglish =
    /свободн\w*\s+английск|разговорн\w*\s+английск|english\s+is\s+a\s+must|fluent\s+english|native\s+english/i.test(
      low
    ) && !/техническ\w*\s+английск|чтени[ея]\s+документац/i.test(low);

  const nightShift =
    /ночн\w*\s+смен|ночные\s+смен|график.*ночь|сменный.*ноч/i.test(low) &&
    !/без\s+ночн|не\s+ночн/i.test(low);

  // Сутки / 1/3 (сутки через трое) — не 5/2 и не дежурство 2/2
  const dayOnThreeOff =
    /сутки\s*(?:через\s*)?тро|график\s*:?\s*1\s*\/\s*3|сменн\w*\s+график\w*[^\n.]{0,40}1\s*\/\s*3|1\s*\/\s*3\s*\([^)]*офис|рабочие\s+часы\s*:?\s*24\b|часов\s*:?\s*24\b.{0,40}1\s*\/\s*3/i.test(
      low
    );

  const scheduleOk =
    /5\s*\/\s*2|5-2|2\s*\/\s*2|2-2|4\s*\/\s*3|4-3|пятидневк|сменный\s+график|дежурств/i.test(low) ||
    (!/ночн\w*\s+смен/i.test(low) && hasRemote);

  // Не оставлять format=офис, если thin chip снят гибридом из JD.
  const explicitOfficeEffective = Boolean(explicitOffice && !(thinOfficeChip && jdHybrid) && !hasHybrid);

  let format = 'не указан';
  if (officeOnly || (explicitOfficeEffective && !hasRemote)) format = 'офис';
  else if (hasRemote && !officeOnly) format = 'удалёнка';
  else if (hasHybrid) format = hasRemote ? 'удалёнка + гибрид' : 'гибрид';
  else if (hasRemote) format = 'удалёнка';

  const moscowOk = !city || /москв/i.test(city);
  const officeMoscowOnly = officeOnly && moscowOk;
  const hybridMoscow = hasHybrid && moscowOk;
  const hybridOfficeDaysPerWeek = extractHybridOfficeDaysPerWeek(low);

  return {
    format,
    city: city || undefined,
    timezone: timezone || undefined,
    hasRemote,
    hasHybrid,
    officeOnly,
    explicitOffice: explicitOfficeEffective,
    explicitRemote,
    formatConfidence,
    thinOfficeChip: Boolean(thinOfficeChip),
    needsSpokenEnglish,
    nightShift,
    dayOnThreeOff,
    scheduleOk,
    officeMoscowOnly,
    hybridMoscow,
    hybridOfficeDaysPerWeek,
    remoteRussiaOk: hasRemote && !needsSpokenEnglish,
  };
}

/**
 * @param {object} meta — parseWorkFormatMeta
 * @param {object} prefs
 */
export function passesWorkFormatRules(meta, prefs = {}) {
  if (meta.needsSpokenEnglish && prefs.blockSpokenEnglishRequired !== false) {
    return { pass: false, reason: 'Нужен разговорный английский' };
  }
  if (meta.nightShift && prefs.blockNightShiftOnly !== false) {
    return { pass: false, reason: 'Акцент на ночные смены' };
  }
  if (meta.dayOnThreeOff && prefs.blockDayOnThreeOff !== false) {
    return { pass: false, reason: 'График сутки/1/3 (сутки через трое)' };
  }
  if (meta.officeOnly && !meta.hasRemote) {
    if (prefs.allowOfficeMoscow !== false && meta.officeMoscowOnly) {
      return { pass: true, reason: 'Офис в Москве' };
    }
    const where = meta.city ? ` (${meta.city})` : '';
    return { pass: false, reason: `Только офис без удалёнки${where}` };
  }
  if (meta.hasHybrid && prefs.allowHybrid) {
    if (prefs.hybridMoscowOnly !== false && meta.city && !/москв/i.test(meta.city)) {
      return { pass: false, reason: 'Гибрид не в Москве' };
    }
    const maxOfficeDays = Number(prefs.hybridOfficeDaysMax);
    const days = Number(meta.hybridOfficeDaysPerWeek);
    if (
      Number.isFinite(maxOfficeDays) &&
      maxOfficeDays > 0 &&
      Number.isFinite(days) &&
      days > maxOfficeDays
    ) {
      return {
        pass: false,
        reason: `Гибрид: в офисе ${days} дн./нед > лимита ${maxOfficeDays}`,
      };
    }
    return { pass: true, reason: meta.format };
  }
  if (meta.hasRemote) {
    return { pass: true, reason: 'Удалёнка' };
  }
  if (!prefs.requireRemote) {
    return { pass: true, reason: meta.format || 'Формат не указан' };
  }
  return { pass: false, reason: 'Нет явной удалёнки' };
}

/** Harvest: мягче — не требовать удалёнку; офис/гибрид в очередь, gate на apply. */
export function passesWorkFormatForHarvest(blob, prefs = {}) {
  const harvestStrict = prefs.harvestRequireRemote === true;
  if (harvestStrict) {
    return passesWorkFormatRules(parseWorkFormatMeta(blob, prefs), prefs);
  }
  const meta = parseWorkFormatMeta(blob, prefs);
  if (meta.needsSpokenEnglish && prefs.blockSpokenEnglishRequired !== false) {
    return { pass: false, reason: 'Нужен разговорный английский' };
  }
  if (meta.nightShift && prefs.blockNightShiftOnly !== false) {
    return { pass: false, reason: 'Акцент на ночные смены' };
  }
  if (meta.dayOnThreeOff && prefs.blockDayOnThreeOff !== false) {
    return { pass: false, reason: 'График сутки/1/3 (сутки через трое)' };
  }
  return { pass: true, reason: meta.format || 'Harvest: формат не режем' };
}

/** Строгая проверка перед авто-откликом: нужна удалёнка (или офис Москва, если разрешён). */
export function passesWorkFormatForApply(meta, prefs = {}) {
  return passesWorkFormatRules(meta, {
    ...prefs,
    requireRemote: true,
  });
}

/**
 * Короткая заметка для remoteNote (после live parse).
 * @param {ReturnType<typeof parseWorkFormatMeta>} meta
 */
export function buildWorkFormatNote(meta) {
  if (!meta) return '';
  const parts = [meta.format];
  if (meta.city) parts.push(meta.city);
  if (meta.timezone) parts.push(meta.timezone);
  if (meta.hasRemote && !meta.officeOnly) parts.push('удалёнка явно');
  if (meta.officeOnly) parts.push('только офис');
  return parts.filter(Boolean).join(' · ');
}

/**
 * Пересчитать workFormat/remoteNote с workFormatLine+address (лечит stale «удалёнка» при chip «на месте»).
 * @param {object} rec
 * @param {object} [prefs]
 */
export function syncRecordWorkFormatFields(rec, prefs = {}) {
  const workFormat = parseWorkFormatMeta(rec, prefs);
  return {
    workFormat,
    remoteNote: buildWorkFormatNote(workFormat),
  };
}
