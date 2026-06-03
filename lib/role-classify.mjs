/**
 * Классификация заголовка вакансии: целевые роли vs жёсткий отсев.
 */

/** DevOps / SRE / платформа (не «главный»). */
export function titleLooksDevOpsRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (isClearlyOverqualifiedTitle(title)) return false;
  return (
    /\bdevops\b|\bdev\s*ops\b|\bsre\b|site reliability|platform engineer|платформенн|инженер инфраструктуры|инженер по эксплуатации|mlops|devsecops|инженер open.?shift|контейнерн.*платформ/i.test(
      t
    )
  );
}

/**
 * L1: оператор/специалист helpdesk, чат, без L2/L3/DevOps в названии.
 * @param {string} title
 */
export function titleLooksL1HelpdeskRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (/presale|пресейл|pre[-\s]?sale|менеджер\s+по\s+продаж/i.test(t)) return false;
  if (/\bdevops\b|\bsre\b|\bmlops\b|platform engineer/i.test(t) && !/поддерж/i.test(t)) {
    return false;
  }
  if (
    /\bl2\b|\bl3\b|\/\s*l2\b|\bl2\s*\/|линия\s*l2|линия\s*l3|2\s*линия|3\s*линия|2\s*лини[яи]|3\s*лини[яи]|\bit4it\b|тимлид|team\s*lead|руководитель.*поддерж|head\s+of\s+support/i.test(
      t
    )
  ) {
    return false;
  }
  if (textMentionsFirstSupportLineOnly(title)) return true;
  if (/оператор.*(чат|поддерж)|чат.*поддерж|специалист\s+чата/i.test(t)) return true;
  if (/help\s*desk|helpdesk|service\s*desk|техподдерж/i.test(t)) return true;
  if (
    /(специалист|младший|стаж[её]р|консультант)/i.test(t) &&
    /технич[а-яё]*\s*поддерж|technical support/i.test(t)
  ) {
    return true;
  }
  if (/оператор/i.test(t) && /поддерж/i.test(t)) return true;
  return false;
}

/** Техподдержка L2/L3, системный инженер поддержки, TAM. */
export function titleLooksSupportRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (titleLooksL1HelpdeskRole(title)) return false;
  if (/\bdevops\b|\bsre\b|\bmlops\b|platform engineer|observability/i.test(t)) return false;
  if (/продавец|кассир|мерчендайз|оператор call-?center|колл-?центр.*оператор/i.test(t)) {
    return false;
  }
  // «Системный инженер» без поддержки — infra/devops, не L2
  if (/системный\s+инженер|system engineer/i.test(t)) {
    return /поддерж|support|helpdesk|service\s*desk|l2|l3|сопровож|help desk|it4it/i.test(t);
  }
  return (
    /технич[а-яё]*\s*поддерж|technical support|service\s*desk|help\s*desk|helpdesk|l2|l3|2\s*линия|3\s*линия|2\s*лини[яи]|3\s*лини[яи]|линия\s*l2|линия\s*l3|инженер\s+поддерж|специалист\s+поддерж|руководитель.*поддерж|координатор.*поддерж|консультант.*поддерж|сервис[\s-]*менеджер|прикладн[а-яё]*\s*администратор|account\s+manager|technical\s+account|\btam\b/i.test(
      t
    )
  );
}

export function titleLooksTamRole(title) {
  const t = String(title || '').toLowerCase();
  return /technical\s+account|\btam\b|технический\s+аккаунт|менеджер\s+по\s+работе\s+с\s+клиент/i.test(t);
}

/** Целевой профиль пользователя (DevOps junior+/middle или поддержка L2+). */
export function titleLooksTargetRole(title) {
  return titleLooksDevOpsRole(title) || titleLooksSupportRole(title) || titleLooksTamRole(title);
}

/** Главный / Chief / Principal / Head — выше уровня пользователя. */
export function isClearlyOverqualifiedTitle(title) {
  const t = String(title || '');
  const low = t.toLowerCase();
  if (!t.trim()) return false;
  if (/(?:^|[^\p{L}])(главный|chief|principal|head\s+of|директор|cto|cio)(?:[^\p{L}]|$)/iu.test(t)) {
    return true;
  }
  if (/\b(ведущий|старший)\s+(devops|sre)\b/i.test(low)) return true;
  if (/старший.*\bdevops\b|старший.*\bsre\b|старший.*инфраструктур.*devops/i.test(low)) return true;
  if (/\b(lead|tech\s*lead|team\s*lead)\s+(devops|sre|platform)\b/i.test(low)) return true;
  if (/\b(devops|sre)\s+(lead|architect)\b/i.test(low)) return true;
  return false;
}

/** Промышленный / строительный / полевой «инженер» (не DevOps / IT-поддержка). */
export function titleLooksIndustrialOrFieldRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (titleLooksDevOpsRole(title) || titleLooksSupportRole(title) || titleLooksTamRole(title)) {
    return false;
  }
  return (
    /сервисн\S*\s+инженер|\bservice engineer\b/i.test(t) ||
    /инженер\s+сервисн\S*\s+служб|сервисн\S*\s+служб/i.test(t) ||
    /инженер\s*(?:п\s*т\s*о|pto)(?:\s|$|[,.(])/i.test(t) ||
    /инженер-?сметчик|(?:^|\s)сметчик(?:\s|$|[,.(])/i.test(t) ||
    /геодез/i.test(t) ||
    /овик|(?:инженер\s+)?овк[\s(]|отоплени\S*\s+вентил|вентиля\S*|кондицион/i.test(t) ||
    /кипиа|kip\s*i\s*a|(?:инженер-)?наладчик/i.test(t) ||
    /гидротех|теплотех|электронщик|электрооборуд/i.test(t) ||
    /асутп|\bscada\b/i.test(t) ||
    /пусконалад|пуско-налад|\bпнр\b|инженер\s+пнр/i.test(t) ||
    /электромонтаж|слаботоч|электроснабж|проектировщик\s+систем/i.test(t) ||
    /строительн\S*\s+контрол|\bпрораб\b|монтаж\S*\s+вентил|мастер\s+ов/i.test(t) ||
    /организац\S*\s+дорожн\S*\s+движени\S*|\bодд\b/i.test(t) ||
    /инженер-механик|механик\S*\s+оборуд|механик\S*\s+транспорт|механик\s*\/\s*инженер/i.test(t) ||
    /инженер\s+ran\b|\bran engineer\b/i.test(t) ||
    /(?:^|[^\p{L}])дгу(?:[^\p{L}]|$)|(?:^|[^\p{L}])гпу(?:[^\p{L}]|$)|генератор\S*\s+установ/iu.test(t) ||
    /электросвяз|(?:^|[^\p{L}])mvno(?:[^\p{L}]|$)|коммутационн\S*\s+оборуд/iu.test(t) ||
    /автодорожн|дорожн\S*\s+строитель/i.test(t) ||
    /инженер-технолог/i.test(t) ||
    /исходно-разрешительн|\birд\b/i.test(t) ||
    /координатор\s+сервисн/i.test(t) ||
    /ремонт\s+робот|автономн\S*\s+транспорт/i.test(t) ||
    /автоматиз\S*\s+процесс\S*\s+разработ/i.test(t) ||
    /инженер\s+по\s+сервису|гарантийн\S*\s+обслуж|\bitso\b|итсо/i.test(t)
  );
}

/** Сетевой инженер телеком / NOC (не DevOps/SRE). */
export function titleLooksTelecomNetworkRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (/devops|sre|platform|kubernetes|cloud engineer|network security/i.test(t)) return false;
  return (
    /сетевой\s+инженер|network engineer|дежурный\s+сетев|network administrator/i.test(t) ||
    /руководитель.*сетевых\s+инженер/i.test(t)
  );
}

/** Продажи / presale (не TAM). */
export function titleLooksSalesOrPresaleRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (/presale|пресейл|pre[-\s]?sale|пресейл[-\s]*инженер|инженер[-\s]*пресейл/i.test(t)) {
    return true;
  }
  if (titleLooksTargetRole(title)) return false;
  return (
    /менеджер\s+по\s+продаж|solution\s+sales|специалист\s+по\s+продаж/i.test(t) ||
    /менеджер\s+по\s+развитию\s+b2b|продаж\s+облач|менеджер\s+по\s+предпродаж/i.test(t)
  );
}

/** Промышленный / телеком / продажи — вне целевого IT-профиля. */
export function titleLooksOffTargetFieldRole(title) {
  return (
    titleLooksIndustrialOrFieldRole(title) ||
    titleLooksTelecomNetworkRole(title) ||
    titleLooksSalesOrPresaleRole(title)
  );
}

/** Senior в названии DevOps/SRE (не поддержка L2). */
export function titleLooksSeniorDevOpsTitle(title) {
  if (titleLooksSupportRole(title) && !titleLooksDevOpsRole(title)) {
    if (/l2|l3|2\s*линия|3\s*линия|руководитель.*поддерж|ведущий.*поддерж/i.test(String(title || '').toLowerCase())) {
      return false;
    }
  }
  const t = String(title || '').toLowerCase();
  return (
    /\bsenior\b|\bсеньор\b|\bсеньёр\b|middle\s*\/\s*senior|senior\s*\/\s*middle/i.test(t) &&
    (/\bdevops\b|\bsre\b|platform/i.test(t) || titleLooksDevOpsRole(title))
  );
}

/**
 * Только 1-я линия / L1 (L2/L3 в названии — не считаем).
 * @param {string} text
 */
export function textMentionsFirstSupportLineOnly(text) {
  const t = String(text || '');
  const low = t.toLowerCase();
  if (/l2|l3|2\s*линия|3\s*линия|2\s*лини[яи]|3\s*лини[яи]|вторая\s+линия|третья\s+линия/i.test(low)) {
    return false;
  }
  if (/(?<![0-9])1\s*[-–]?\s*линия/i.test(t)) return true;
  if (/1\s*[-–]я\s+линия/i.test(t)) return true;
  if (/первая\s+линия/i.test(low)) return true;
  if (/(?<![0-9])1\s*[-–]?\s*линии/i.test(t)) return true;
  if (/линия\s*l1/i.test(low) || /поддержки\s+l1/i.test(low) || /l1\s*[-/]\s*лини/i.test(low)) {
    return true;
  }
  if (
    /(^|[^a-z0-9])l1([^a-z0-9]|$)/i.test(t) &&
    /поддержк|технич\.\s*поддерж|help\s*desk|service\s*desk/i.test(low)
  ) {
    return true;
  }
  return false;
}

/** Продавец, кассир и т.п. — не IT. */
export function titleLooksNonItRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (titleLooksTargetRole(title)) return false;
  if (titleLooksOffTargetFieldRole(title)) return true;
  return (
    /продавец|кассир|мерчендайз|охранник|водитель|курьер|официант|бариста|уборщик|уборщиц|слесар|сварщик|токар|фрезеровщик|электрик|монтажник|разнорабоч/i.test(
      t
    ) ||
    /менеджер по продаж|региональн.*менеджер|торговый представитель|мерchandis/i.test(t) ||
    /теплотехник|бпла|беспилот|медицинск.*оборудован|эндоскоп|мед\.?\s*оборуд/i.test(t) ||
    /конструктор.*конвейер|механик.*транспорт|овик\b|отоплени.*вентил/i.test(t) ||
    /бухгалтер|юрист\b|hr-?менеджер|рекрутер|кадровик|секретар/i.test(t) ||
    /архитектор\s*\(|архитектор\s+python|data\s+science\s+research/i.test(t)
  );
}

/**
 * Служебные/рекламные карточки hh.ru (не вакансии): подписка, PRO и т.п.
 * @param {string} title
 */
export function titleLooksPlatformPromo(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  return (
    /hh\s*pro|подписк|день\s*рождени\S*\s*hh|промокод|преимущества\s+подписки|резюме\s+напрямую\s+\d+\s+компани/i.test(
      t
    )
  );
}

export const DEFAULT_BLUE_COLLAR_PATTERNS = [
  'слесар',
  'сварщик',
  'токар',
  'фрезеровщик',
  'электрик',
  'монтажник',
  'разнорабоч',
  'оператор станк',
  'чпу',
  'чпу-оператор',
  'наладчик станк',
];

export const DEFAULT_INDUSTRIAL_SIGNAL_PATTERNS = [
  'плк',
  'siemens',
  'omron',
  'delta',
  'owen',
  'scada',
  'кипиа',
  'асутп',
  'пусконалад',
  'сервисное обслуживание оборудования',
  'организации дорожного движения',
];

function normalizeBlueCollarPatterns(patterns) {
  if (!Array.isArray(patterns) || !patterns.length) return DEFAULT_BLUE_COLLAR_PATTERNS;
  return patterns
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Возвращает паттерн рабочей роли, если найден в тексте.
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function detectBlueCollarPattern(text, patterns) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  if (titleLooksTargetRole(t)) return null;
  const list = normalizeBlueCollarPatterns(patterns);
  return list.find((p) => t.includes(p)) || null;
}

/**
 * Возвращает промышленный сигнал в тексте (описание/теги), если найден.
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function detectIndustrialSignalPattern(text, patterns) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  const list =
    Array.isArray(patterns) && patterns.length
      ? patterns.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
      : DEFAULT_INDUSTRIAL_SIGNAL_PATTERNS;
  return list.find((p) => t.includes(p)) || null;
}

/**
 * Явно нецелевая «рабочая» роль в тексте (название/описание/теги).
 * Нужна как страховка для кейсов, где title нейтральный, а в описании «слесарь» и т.п.
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function textLooksBlueCollarRole(text, patterns) {
  return Boolean(detectBlueCollarPattern(text, patterns));
}
