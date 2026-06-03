/**
 * Формат работы, город, язык — для карточки и фильтров.
 */

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
  /remote\s+desktop/i,
  /\brdp\b/i,
  /выезд\w*\s+к\s+клиент/i,
  /выезды\s+к\s+клиент/i,
];

/** Явный офис / без удалёнки (hh.ru и типичные формулировки). */
const EXPLICIT_OFFICE_RE =
  /формат\s+работы\s*:\s*(?:на\s+месте(?:\s+работодателя)?|в\s+офисе|офис)|(?:^|[\n;])\s*на\s+месте\s+работодателя\b|удалённ?ый\s+формат\s+работы\s+не\s+предусмотрен|удаленн?ый\s+формат\s+работы\s+не\s+предусмотрен|без\s+удалённ?ой\s+работы|без\s+удаленн?ой\s+работы|только\s+офис|работа\s+только\s+в\s+офисе/i;

/** Явная удалёнка / гибрид в блоке «формат работы». */
const EXPLICIT_REMOTE_RE =
  /формат\s+работы\s*:\s*(?:удалённ?|удаленн?|дистанцион|remote|из\s+дома|гибрид|hybrid)|полностью\s+удалённ?|полностью\s+удаленн?|удалённ?ая\s+работа|удаленн?ая\s+работа|работа\s+из\s+дома/i;

function stripRemoteFalsePositives(low) {
  let s = low;
  for (const re of REMOTE_WORK_FALSE_POSITIVE) {
    s = s.replace(re, ' ');
  }
  return s;
}

function textSuggestsRemoteWork(low, remotePositive) {
  const stripped = stripRemoteFalsePositives(low);
  return includesAny(stripped, remotePositive);
}

/**
 * @param {string} blob — title + description + address + employment
 * @param {object} [prefs]
 */
export function parseWorkFormatMeta(blob, prefs = {}) {
  const t = String(blob || '');
  const low = t.toLowerCase();

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

  const explicitOffice = EXPLICIT_OFFICE_RE.test(low);
  const explicitRemote = EXPLICIT_REMOTE_RE.test(low);

  let hasRemote;
  let officeOnly;

  if (explicitOffice && !explicitRemote) {
    hasRemote = false;
    officeOnly = true;
  } else if (explicitRemote) {
    hasRemote = true;
    officeOnly = false;
  } else {
    hasRemote = textSuggestsRemoteWork(low, remotePositive);
    const officeHint = includesAny(low, officeOnlyPatterns) || explicitOffice;
    officeOnly = officeHint && !hasRemote;
  }

  const hasHybrid = includesAny(low, hybridPatterns) && !officeOnly;

  let city = '';
  if (/москв/i.test(low)) city = 'Москва';
  else if (/санкт[-\s]?петербург|\bспб\b/i.test(low)) city = 'Санкт-Петербург';
  else if (/новосибирск/i.test(low)) city = 'Новосибирск';
  else if (/екатеринбург/i.test(low)) city = 'Екатеринбург';
  else if (/казан/i.test(low)) city = 'Казань';
  else if (/тюмен/i.test(low)) city = 'Тюмень';
  else if (/твер/i.test(low)) city = 'Тверь';

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

  const scheduleOk =
    /5\s*\/\s*2|5-2|2\s*\/\s*2|2-2|4\s*\/\s*3|4-3|пятидневк|сменный\s+график|дежурств/i.test(low) ||
    (!/ночн\w*\s+смен/i.test(low) && hasRemote);

  let format = 'не указан';
  if (officeOnly || (explicitOffice && !hasRemote)) format = 'офис';
  else if (hasRemote && !officeOnly) format = 'удалёнка';
  else if (hasHybrid) format = hasRemote ? 'удалёнка + гибрид' : 'гибрид';
  else if (hasRemote) format = 'удалёнка';

  const moscowOk = !city || /москв/i.test(city);
  const officeMoscowOnly = officeOnly && moscowOk;
  const hybridMoscow = hasHybrid && (!city || /москв/i.test(city));

  return {
    format,
    city: city || undefined,
    timezone: timezone || undefined,
    hasRemote,
    hasHybrid,
    officeOnly,
    explicitOffice,
    explicitRemote,
    needsSpokenEnglish,
    nightShift,
    scheduleOk,
    officeMoscowOnly,
    hybridMoscow,
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

/** Строгая проверка перед авто-откликом: нужна удалёнка (или офис Москва, если разрешён). */
export function passesWorkFormatForApply(meta, prefs = {}) {
  return passesWorkFormatRules(meta, {
    ...prefs,
    requireRemote: true,
  });
}
