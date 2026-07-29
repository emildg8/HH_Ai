/**
 * Классификация заголовка вакансии: целевые роли vs жёсткий отсев.
 */

/** DevOps / SRE / платформа (не «главный»). */
export function titleLooksDevOpsRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (isClearlyOverqualifiedTitle(title)) return false;
  // AHO / здания — не IT «инженер по эксплуатации»
  if (titleLooksFacilityOpsRole(title)) return false;
  return (
    /\bdevops\b|\bdev\s*ops\b|\bsre\b|site reliability|platform engineer|платформенн|инженер инфраструктуры|mlops|devsecops|инженер open.?shift|контейнерн.*платформ/i.test(
      t
    ) ||
    // IT-эксплуатация только с IT-якорем (иначе ловит хаус-мастер / здания)
    (/инженер\s+по\s+эксплуатац/i.test(t) &&
      /linux|unix|openshift|kubernetes|\bk8s\b|платформ|ci\s*\/?\s*cd|контейнер|devops|sre|сервис[а-яё]*\s+it|\bit\b|информацион/i.test(
        t
      ))
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
/**
 * Facility / AHO / эксплуатация зданий (не IT service desk).
 * «Сервис-менеджер» + объекты недвижимости ≠ L2 поддержка ПО.
 * Важно: не `\w` после кириллицы — в JS `\w` = [A-Za-z0-9_], «эксплуатации зданий» не матчилось.
 */
export function titleLooksFacilityOpsRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (
    /devops|sre|kubernetes|\bk8s\b|openshift|linux|help\s*desk|service\s*desk|технич[а-яё]*\s*поддерж|информационн/i.test(
      t
    )
  ) {
    return false;
  }
  const ru = '[а-яё]*';
  return (
    new RegExp(`эксплуатац${ru}\\s+объект`, 'i').test(t) ||
    new RegExp(`объект${ru}\\s+недвижим`, 'i').test(t) ||
    new RegExp(`эксплуатац${ru}\\s+здан`, 'i').test(t) ||
    new RegExp(`эксплуатац${ru}\\s+недвижим`, 'i').test(t) ||
    new RegExp(`эксплуатац${ru}\\s+сооруж`, 'i').test(t) ||
    /специалист\s+по\s+эксплуатац/i.test(t) ||
    /хаус[\s-]*мастер|house\s*master|дом[\s-]*мастер/i.test(t) ||
    /инженер\s+по\s+эксплуатац(?:ии)?\s*\/\s*хаус/i.test(t) ||
    (/инженер\s+по\s+эксплуатац/i.test(t) &&
      /здан|сооруж|недвижим|объект|ахо|жкх|фактилит|facility|хаус/i.test(t)) ||
    // Голый «Инженер по эксплуатации» без хвоста IT/объекта
    /^инженер\s+по\s+эксплуатац(?:ии)?\s*$/i.test(t.trim()) ||
    /facility\s+(?:ops|manager|engineer)|building\s+(?:ops|manager)/i.test(t) ||
    (/сервис[\s-]*менеджер/i.test(t) &&
      new RegExp(`эксплуатац|объект|недвижим|здан|инженерн${ru}\\s+систем`, 'i').test(t))
  );
}

/** Описание: AHO / объекты банка, не IT-сервис. */
export function textLooksFacilityOpsBlob(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;
  const ru = '[а-яё]*';
  const realty = new RegExp(
    `объект${ru}\\s+недвижим|эксплуатац${ru}\\s+здан|эксплуатац${ru}\\s+недвижим|эксплуатац${ru}\\s+сооруж|содержани${ru}\\s+объект|инженерн${ru}\\s+систем${ru}.{0,40}здан|разъездн${ru}\\s+характер|хаус[\\s-]*мастер`,
    'i'
  ).test(t);
  const bankRealty = new RegExp(
    `объект${ru}\\s+(?:банка|недвижим)|поддержани${ru}.{0,40}объект${ru}\\s+недвижим|приемк${ru}\\s+объект`,
    'i'
  ).test(t);
  return realty || bankRealty;
}

export function titleLooksSupportRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (titleLooksL1HelpdeskRole(title)) return false;
  if (titleLooksFacilityOpsRole(title)) return false;
  if (/\bdevops\b|\bsre\b|\bmlops\b|platform engineer|observability/i.test(t)) return false;
  // Авто/страховая «линия поддержки» ≠ IT L2 (Правокард и т.п.)
  if (
    /автомобил|автовладел|автомоб[а-яё]*\s+поддерж|линии\s+автомобил|автострахов|каско|осаго/i.test(
      t
    )
  ) {
    return false;
  }
  if (/продавец|кассир|мерчендайз|оператор call-?center|колл-?центр.*оператор/i.test(t)) {
    return false;
  }
  // «Системный инженер» без поддержки — infra/devops, не L2
  if (/системный\s+инженер|system engineer/i.test(t)) {
    return /поддерж|support|helpdesk|service\s*desk|l2|l3|сопровож|help desk|it4it/i.test(t);
  }
  return (
    /технич[а-яё]*\s*поддерж|technical support|service\s*desk|help\s*desk|helpdesk|l2|l3|2\s*линия|3\s*линия|2\s*лини[яи]|3\s*лини[яи]|линия\s*l2|линия\s*l3|инженер\s+поддерж|специалист\s+поддерж|руководитель.*поддерж|координатор.*поддерж|консультант.*поддерж|сервис[\s-]*менеджер|прикладн[а-яё]*\s*администратор|technical\s+account|\btam\b|технический\s+аккаунт/i.test(
      t
    )
  );
}

export function titleLooksTamRole(title) {
  const t = String(title || '').toLowerCase();
  // Только technical TAM — не sales «менеджер по работе с клиентами» (hunt-tracks titlePatterns).
  return /technical\s+account|\btam\b|технический\s+аккаунт/i.test(t);
}

/**
 * Основная роль — software developer (Backend/Frontend/разработчик),
 * даже если в названии есть «уклон в DevOps». Не путать с DevOps-инженер.
 */
export function titleLooksPrimarySoftwareDeveloper(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (
    /(backend|frontend|fullstack|full[\s-]?stack|mobile)\s*[-/]?\s*(разработ|developer|engineer)/i.test(
      t
    )
  ) {
    return true;
  }
  if (!/\b(разработчик|developer|программист)\b/i.test(t)) return false;
  // «DevOps-инженер» / SRE / platform — целевые; «разработчик … DevOps» — нет
  if (/\bdevops[\s-]?(инженер|engineer)|инженер[\s-]+devops\b|\bsre\b|site reliability|platform engineer/i.test(t)) {
    return false;
  }
  return true;
}

/** Целевой профиль пользователя (DevOps junior+/middle или поддержка L2+). */
export function titleLooksTargetRole(title) {
  if (titleLooksPrimarySoftwareDeveloper(title)) return false;
  return titleLooksDevOpsRole(title) || titleLooksSupportRole(title) || titleLooksTamRole(title);
}

export function isQaHuntProfile() {
  const p = String(process.env.HH_PROFILE || '').toLowerCase();
  if (p === 'anastasia' || p === 'qa') return true;
  return /targeting-policy-qa/i.test(String(process.env.HH_TARGETING_POLICY_FILE || ''));
}

export function titleLooksQaRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  return (
    /\bqa\b|aqa|тестиров|quality assurance|sdet|test\s+lead|автоматизац[а-яё]*\s+тест|инженер\s+по\s+тест|head\s+of\s+qa/i.test(
      t
    ) && !/\bdevops\b|\bsre\b/i.test(t)
  );
}

/**
 * Manufacturing / QMS «инженер по качеству» без IT-QA сигналов.
 * Не путать с Quality Assurance / тестировщиком.
 */
export function titleLooksManufacturingQualityRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (titleLooksQaRole(title)) return false;
  if (/quality\s+assurance|\bqa\b|aqa|sdet|тестиров|автотест|инженер\s+по\s+тест/i.test(t)) {
    return false;
  }
  if (/инженер\s+по\s+качеству|инженер\s+качества|\bquality\s+engineer\b/i.test(t)) return true;
  if (/(?:руководитель|менеджер|ведущий\s+инженер).{0,40}качеств/i.test(t)) return true;
  if (/отдел\s+обеспечения\s+качества|инжиниринг\s+качества|рекламац/i.test(t)) return true;
  return false;
}

/** Целевая роль с учётом активного профиля (DevOps-лента vs QA-лента). */
export function titleIsTargetForProfile(title) {
  if (isQaHuntProfile()) return titleLooksQaRole(title);
  return titleLooksTargetRole(title);
}

export function targetProfileLabelShort() {
  if (isQaHuntProfile()) return 'QA Lead / Senior / AQA';
  return 'DevOps / поддержка L2+ / TAM';
}

/** Главный / Chief / Principal / Head — выше уровня пользователя. */
export function isClearlyOverqualifiedTitle(title) {
  const t = String(title || '');
  const low = t.toLowerCase();
  if (!t.trim()) return false;
  if (/(?:^|[^\p{L}])(главный|chief|principal|head\s+of|директор|cto|cio)(?:[^\p{L}]|$)/iu.test(t)) {
    return true;
  }
  // \b не ловит кириллицу — «Ведущий DevOps-инженер» (Ренессанс 28.07) уходил в R0
  if (
    /(?:^|[^\p{L}])(ведущий|старший)\s+(devops|sre)(?:[^\p{L}]|$)/iu.test(t) ||
    /(?:^|[^\p{L}])(ведущий|старший)\s+devops[-\s]?инженер/iu.test(t)
  ) {
    return true;
  }
  if (/старший.*\bdevops\b|старший.*\bsre\b|старший.*инфраструктур.*devops/i.test(low)) return true;
  if (/\b(lead|tech\s*lead|team\s*lead)\s+(devops|sre|platform)\b/i.test(low)) return true;
  if (/\b(devops|sre)\s+(lead|architect)\b/i.test(low)) return true;
  return false;
}

/**
 * ПНР / пусконаладка аппаратных СХД (не IT L2 по банку/SQL).
 * «Поддержка + ПНР» иначе рано выходит из industrial из‑за support=true.
 */
export function textLooksHardwarePnrRole(title, blob = '') {
  const t = `${title}\n${blob}`.toLowerCase();
  if (!/\bпнр\b|пусконалад|пуско-налад|пуско\s*налад/i.test(t)) return false;
  if (/\b(sql|oracle|postgresql|банковск\S*\s+по|linux|active directory|help\s*desk|service\s*desk|devops|\bsre\b)\b/i.test(t)) {
    return false;
  }
  return /схд|систем\S*\s+хранен|аппаратн|импортозамещ|дисков\S*\s+массив|storage|накопител|желез/i.test(t)
    || (/\bпнр\b/i.test(String(title || '')) && /пусконалад|внедрен\S*\s+и\s+пуско/i.test(t));
}

/** ADAS / беспилот / «автономные технологии» без IT-инфры. */
export function textLooksAdasSystemsEngRole(title, blob = '') {
  const t = `${title}\n${blob}`.toLowerCase();
  // \w не ловит кириллицу — только \S* / явные буквы
  if (/devops|\bsre\b|kubernetes|linux\s+admin|системн\S*\s+админ/i.test(t) && !/автономн/i.test(t)) {
    return false;
  }
  return (
    /автономн\S*\s+(транспорт|технолог|вожден)/i.test(t) ||
    /\badas\b|self[\s-]?driving|беспилот/i.test(t) ||
    (/системн\S*\s+инженер/i.test(String(title || '')) &&
      /автономн|требования.{0,40}транспорт|архитектур\S*.{0,40}автоном/i.test(t))
  );
}

/** Промышленный / строительный / полевой «инженер» (не DevOps / IT-поддержка). */
export function titleLooksIndustrialOrFieldRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (titleLooksFacilityOpsRole(title)) return true;
  // ПНР в title — не глушить early-return support («поддержка и ПНР»)
  const hasPnr = /\bпнр\b|пусконалад|пуско-налад|инженер\s+пнр/i.test(t);
  if (titleLooksDevOpsRole(title) || titleLooksTamRole(title)) return false;
  if (titleLooksSupportRole(title) && !hasPnr) return false;
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
    /ремонт\s+робот|автономн\S*\s+транспорт|автономн\S*\s+технолог/i.test(t) ||
    /автоматиз\S*\s+процесс\S*\s+разработ/i.test(t) ||
    /инженер\s+по\s+сервису|гарантийн\S*\s+обслуж|\bitso\b|итсо/i.test(t) ||
    titleLooksManufacturingQualityRole(title)
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
  // Sales account / CS — не technical TAM (кейс BetBoom 28.07).
  if (
    /(?:^|[\s/·|])(?:аккаунт[\s-]*менеджер|account\s+manager)(?:$|[\s/·|,])/i.test(t) ||
    /аккаунт[\s-]*менеджер|account\s+manager/i.test(t)
  ) {
    if (!/technical\s+account|технический\s+аккаунт|\btam\b/i.test(t)) return true;
  }
  if (titleLooksTargetRole(title)) return false;
  return (
    /менеджер\s+по\s+продаж|solution\s+sales|специалист\s+по\s+продаж|исполнитель\s+по\s+продаж/i.test(
      t
    ) ||
    /менеджер\s+по\s+развитию\s+b2b|продаж\s+облач|менеджер\s+по\s+предпродаж/i.test(t) ||
    /по\s+продаж[а-яё]*\s+инвестиц|кредитн[а-яё]*.{0,24}продаж|продаж[а-яё]*\s+инвестиц/i.test(t) ||
    /региональн\S*\s+представител|торгов\S*\s+представител|commercial\s+representative/i.test(t)
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
 * Только 1-я линия / L1 (L2/L3 в названии роли — не считаем).
 * Эскалация «на 2 и 3 линии» ≠ работа на L2/L3.
 * @param {string} text
 */
export function textMentionsFirstSupportLineOnly(text) {
  let t = String(text || '');
  // Эскалация на старшие линии не отменяет L1 в JD
  t = t.replace(
    /эскалир[а-яё]{0,20}.{0,60}(?:на\s+)?(?:2|3|втор[а-яё]*|треть[а-яё]*)\s*(?:и\s+(?:2|3|втор[а-яё]*|треть[а-яё]*)\s*)?лини/gi,
    ' '
  );
  t = t.replace(/на\s+2\s+и\s+3\s+линии\s+поддерж/gi, ' ');
  const low = t.toLowerCase();
  // Явная роль L2/L3 в тексте (не эскалация)
  if (
    /\b(?:инженер|специалист)\s+(?:2|3)[-–]?\s*лини/i.test(t) ||
    /\b(?:2|3)[-–]?я\s+линия\s+(?:поддерж|технич)/i.test(t) ||
    /\bl2\b|\bl3\b|линия\s*l2|линия\s*l3/i.test(low)
  ) {
    // Если одновременно явно L1 — всё равно L1 (роль = 1-я линия)
    const explicitL1 =
      /1\s*[-–]?\s*я\s+лини/i.test(t) ||
      /первая\s+линия/i.test(low) ||
      /линия\s*l1/i.test(low) ||
      /поддержки\s+l1/i.test(low);
    if (!explicitL1) return false;
  }
  // «1-я линия» / опечатка «линяя»
  if (/(?<![0-9])1\s*[-–]?\s*линия/i.test(t)) return true;
  if (/1\s*[-–]я\s+лин(?:ия|ии|ию|ией|яя)/i.test(t)) return true;
  if (/первая\s+лин(?:ия|яя)/i.test(low)) return true;
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
    /менеджер по продаж|региональн.*менеджер|торговый представитель|региональн\S*\s+представител|мерchandis/i.test(t) ||
    /агроном|агрохимик|земледел/i.test(t) ||
    /теплотехник|бпла|беспилот|медицинск.*оборудован|эндоскоп|мед\.?\s*оборуд/i.test(t) ||
    /конструктор.*конвейер|механик.*транспорт|овик\b|отоплени.*вентил/i.test(t) ||
    /бухгалтер|юрист\b|hr-?менеджер|рекрутер|кадровик|секретар/i.test(t) ||
    /учител|преподавател|педагог|воспитател|логопед|олигофренопедагог/i.test(t) ||
    /вахт[её]р|вахтер/i.test(t) ||
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

export const DEFAULT_AGRO_SALES_SIGNAL_PATTERNS = [
  'с.-х.',
  'с/х',
  'сзр',
  'агроном',
  'агрохим',
  'пестицид',
  'защит растен',
  'земледел',
  'агросопровожден',
  'средств защиты растений',
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
 * Агро / полевые продажи (СЗР, дилеры) — вне IT-профиля.
 * @param {string} text
 * @param {string[]} [patterns]
 */
export function detectAgroSalesSignalPattern(text, patterns) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  if (titleLooksTargetRole(t)) return null;
  const list =
    Array.isArray(patterns) && patterns.length
      ? patterns.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)
      : DEFAULT_AGRO_SALES_SIGNAL_PATTERNS;
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
