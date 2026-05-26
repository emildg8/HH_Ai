/**
 * Формат работы, город, язык — для карточки и фильтров.
 */

function includesAny(text, patterns) {
  const t = String(text || '').toLowerCase();
  return (patterns || []).some((p) => t.includes(String(p).toLowerCase()));
}

/**
 * @param {string} blob — title + description + address
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
  ];

  const hasRemote = includesAny(low, remotePositive);
  const hasHybrid = includesAny(low, hybridPatterns);
  const officeOnly = includesAny(low, officeOnlyPatterns) && !hasRemote;

  let city = '';
  if (/москв/i.test(low)) city = 'Москва';
  else if (/санкт[-\s]?петербург|\bспб\b/i.test(low)) city = 'Санкт-Петербург';
  else if (/новосибирск/i.test(low)) city = 'Новосибирск';
  else if (/екатеринбург/i.test(low)) city = 'Екатеринбург';
  else if (/казан/i.test(low)) city = 'Казань';
  else if (/тюмен/i.test(low)) city = 'Тюмень';

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
  if (hasRemote && !officeOnly) format = 'удалёнка';
  else if (hasHybrid) format = hasRemote ? 'удалёнка + гибрид' : 'гибрид';
  else if (officeOnly) format = 'офис';
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
    return { pass: false, reason: 'Только офис без удалёнки (не Москва)' };
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
