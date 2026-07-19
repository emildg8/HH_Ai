/**
 * RU-sanitizer сопроводительных: англицизмы + анти-паттерны framing.
 * Канон: HUNT-BASKET-ROUTE (письмо ≠ пересказ JD) · SESSION-2026-07-15-wave-l2-anti-pattern.
 */

/**
 * Замены до отправки (авто). Не меняет смысл JD — только язык HR.
 * @param {string} text
 */
export function sanitizeCoverLetterRuTerms(text) {
  let t = String(text || '');
  // Markdown из шаблонов LLM (ОТП 19.07) — HR видит ** и ломаные списки
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/(^|\n)\s*[-*]\s+/g, '$1');
  t = t.replace(/\*\*/g, '');
  // on-prem / on‑prem / on premise → локальной инфраструктуры
  t = t.replace(/\bon[-\u2011\u2010\s]?prem(?:ise)?s?\b(\s+инфраструктур\w*)?/gi, (_, infra) =>
    infra ? `локальной${infra}` : 'локальной инфраструктуры'
  );
  t = t.replace(/локальной\s+инфраструктуры\s+инфраструктур\w*/gi, 'локальной инфраструктуры');
  t = t.replace(/локальной\s+локальной/gi, 'локальной');
  // networking → сетевые технологии (типичные падежи)
  t = t.replace(/\bбазов(?:ым|ыми|ого|ой)?\s+networking\b/gi, 'базовыми сетевыми технологиями');
  t = t.replace(/\bnetworking\b/gi, 'сетевыми технологиями');
  // observability / rollout / zero-downtime — частые в DevOps-письмах
  t = t.replace(/\bobservability\b/gi, 'мониторинг и наблюдаемость');
  t = t.replace(/\bzero[-\s]?downtime\b/gi, 'без простоя');
  t = t.replace(/\broll\s*outs?\b/gi, 'выкатки');
  t = t.replace(/\brollouts?\b/gi, 'выкатки');
  // highload → высоконагруженных систем / сопровождение
  t = t.replace(
    /\bhigh[-\s]?load[-\s]?сопровождени\w*/gi,
    'сопровождения высоконагруженных систем'
  );
  t = t.replace(/\bhigh[-\s]?load\b/gi, 'высоконагруженных систем');
  // «болит у команды» — сленг стартап-тона; в письмо HR → нейтральное закрытие
  t = t.replace(
    /Буду\s+рад(?:а)?\s+обсудить,?\s+что\s+сейчас\s+болит\s+у\s+команды\.?/gi,
    'Готов обсудить детали и приоритеты команды.'
  );
  t = t.replace(
    /что\s+сейчас\s+болит\s+у\s+команды\.?/gi,
    'приоритеты команды'
  );
  // Оправдательный дисклеймер K8s/Terraform — убрать; честность = молчать о дыре, не извиняться
  t = t.replace(
    /Коммерческий\s+Kubernetes(?:\s*\/\s*Terraform)?\s+не\s+заявляю[^.!?]*[.!?]\s*/gi,
    ''
  );
  t = t.replace(
    /Kubernetes(?:\s*\/\s*Terraform)?\s+в\s+(?:письме|коммерции)\s+не\s+заявляю[^.!?]*[.!?]\s*/gi,
    ''
  );
  t = t.replace(
    /Коммерческий\s+Kubernetes(?:\s*\/\s*Terraform)?\s+в\s+письме\s+не\s+приписываю[^.!?]*[.!?]\s*/gi,
    ''
  );
  t = t.replace(
    /Kubernetes(?:\s*\/\s*Terraform)?\s+в\s+письме\s+не\s+приписываю[^.!?]*[.!?]\s*/gi,
    ''
  );
  // Cisco / «не веду как основной профиль» — оправдание, не сила
  t = t.replace(
    /Сетевой\s+стек\s+Cisco\s+в\s+коммерции\s+не\s+веду[^.!?]*[.!?]\s*/gi,
    ''
  );
  t = t.replace(
    /[^.!?]*не\s+веду\s+как\s+основной\s+профиль[^.!?]*[.!?]\s*/gi,
    ''
  );
  // Англицизмы вне имён стека
  t = t.replace(/\bbare[-\s]?metal\b/gi, 'физической инфраструктуры');
  t = t.replace(/\bprod\s*\/\s*dev\b/gi, 'продуктивных и тестовых контуров');
  t = t.replace(/\spresale[-\s]?контур\w*/gi, ' контур предпродаж');
  t = t.replace(/\bpresale\b/gi, 'предпродажи');
  // Опечатка «недущего» ← «ведущего» (ГНИВЦ 19.07) — \b не ловит кириллицу
  t = t.replace(/(^|[^\p{L}])недущего(?=$|[^\p{L}])/giu, '$1ведущего');
  t = t.replace(/(^|[^\p{L}])недущий(?=$|[^\p{L}])/giu, '$1ведущий');
  t = t.replace(/(^|[^\p{L}])недущая(?=$|[^\p{L}])/giu, '$1ведущая');
  // Сленг QA: «ловлю дефекты» → «выявляю» (Innovative People 19.07)
  t = t.replace(/критичн\w*\s+дефекты\s+ловлю/gi, 'критичные дефекты выявляю');
  t = t.replace(/(^|[^\p{L}])ловлю\s+до\s+релиза/giu, '$1выявляю до релиза');
  t = t.replace(/дефекты\s+ловлю/gi, 'дефекты выявляю');
  // «pet» / «pet-практика 2026» → собственные проекты без года (партнёр 19.07)
  t = t.replace(/\bpet-практик\w*/gi, 'практика');
  t = t.replace(/\bpet\s+Playwright\b/gi, 'практика Playwright');
  t = t.replace(/\bpet\s+практик\w*/gi, 'практика');
  t = t.replace(/(^|[^\p{L}])pet(?=$|[^\p{L}])/giu, '$1');
  t = t.replace(
    /(?:собственн\w*\s+проект\w*|практик\w*)\s*\(?\s*2026\s*\)?/gi,
    (m) => m.replace(/\s*\(?\s*2026\s*\)?/i, '').trim()
  );
  t = t.replace(/практика\s+Playwright\s*\(?\s*2026\s*\)?/gi, 'практика Playwright');
  t = t.replace(/Playwright\s*\(?\s*2026\s*\)?/gi, 'Playwright');
  t = t.replace(/\s*\(\s*уровень\s+около\s+mid\s*\)/gi, '');
  t = t.replace(/\s*\(\s*около\s+mid\s*\)/gi, '');
  t = t.replace(/\s+около\s+mid(?=$|[^\p{L}])/giu, '');
  // IT_One / СБП завершены — только прошедшее время (канон cover-letter-role-prompt)
  t = fixItOnePresentTense(t);
  t = t.replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

/**
 * Настоящее время про закрытый контур IT_One / СБП → прошедшее.
 * @param {string} text
 */
export function fixItOnePresentTense(text) {
  let t = String(text || '');
  t = t.replace(/На проекте СБП в IT_One работаю/gi, 'До июня 2026 на проекте СБП в IT_One работал');
  t = t.replace(/в IT_One работаю/gi, 'до июня 2026 в IT_One работал');
  t = t.replace(/В IT_One работаю/gi, 'До июня 2026 в IT_One работал');
  t = t.replace(/IT_One сопровождаю/gi, 'до июня 2026 в IT_One сопровождал');
  t = t.replace(
    /в IT_One,\s*где\s+сопровождаю/gi,
    'в IT_One до июня 2026, где сопровождал'
  );
  t = t.replace(/,\s*где\s+сопровождаю/gi, ', где сопровождал');
  t = t.replace(/,\s*где\s+участвую/gi, ', где участвовал');
  t = t.replace(/\sсопровождаю высоконагружен/gi, ' сопровождал высоконагружен');
  t = t.replace(/\sучаствую в релизах/gi, ' участвовал в релизах');
  t = t.replace(
    /чем я занимаюсь последние полтора года в IT_One/gi,
    'чем я занимался до июня 2026 в IT_One'
  );
  t = t.replace(
    /последние полтора года в IT_One\. Там я администрирую/gi,
    'до июня 2026 в IT_One. Там я администрировал'
  );
  t = t.replace(/Там я администрирую/gi, 'Там я администрировал');
  t = t.replace(/,\s*мониторю через/gi, ', мониторил через');
  t = t.replace(/,\s*разбираюсь с инцидентами/gi, ', разбирал инциденты');
  t = t.replace(/Работаю с Proxmox/gi, 'Работал с Proxmox');
  t = t.replace(
    /(IT_One|СБП)([^.!?]{0,100}?),\s*администрирую/gi,
    '$1$2, администрировал'
  );
  t = t.replace(
    /(IT_One|СБП)([^.!?]{0,100}?),\s*настраиваю/gi,
    '$1$2, настраивал'
  );
  t = t.replace(
    /(IT_One|контурами мониторинга[^.!?]{0,40}),\s*администрирую/gi,
    '$1, администрировал'
  );
  t = t.replace(
    /работаю с контурами мониторинга/gi,
    'работал с контурами мониторинга'
  );
  t = t.replace(
    /Большую часть времени провожу с серверами/gi,
    'Большую часть времени занимался серверами'
  );
  return t;
}

/**
 * Настоящее время про IT_One/СБП после ухода — блок качества.
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, hints?: string[] }}
 */
export function detectItOnePresentTense(text) {
  const t = String(text || '');
  const hits = [
    /на проекте СБП в IT_One работаю/i,
    /в IT_One работаю/i,
    /IT_One сопровождаю/i,
    /в IT_One,\s*где\s+(?:сопровождаю|участвую)/i,
    /IT_One[^.!?]{0,100}(?:сопровождаю|участвую|работаю|занимаюсь)/i,
    /(?:сопровождаю|участвую)[^.!?]{0,60}(?:IT_One|СБП)/i,
    /работаю с контурами (?:мониторинга|СБП)/i,
    /занимаюсь последние .{0,20}в IT_One/i,
    /в IT_One\.[^.!?]{0,40}администрирую/i,
    /IT_One[^.!?]{0,80}администрирую/i,
    /IT_One[^.!?]{0,80}настраиваю/i,
    /провожу с серверами[^.!?]{0,80}IT_One/i,
    /IT_One[^.!?]{0,40}\(2025\s*[–—-]\s*н\.?\s*в\.?\)/i,
    /\(2025\s*[–—-]\s*н\.?\s*в\.?\)/i,
  ];
  if (hits.some((re) => re.test(t))) {
    return {
      ok: false,
      reason: 'настоящее время про IT_One/СБП — проект закрыт (нужно прошедшее)',
      hints: [
        'Пишите «до июня 2026 … работал / сопровождал / администрировал»',
        'Не «работаю / администрирую / занимаюсь / сопровождаю» про IT_One',
        'Не «2025–н.в.» — IT_One до июня 2026',
      ],
    };
  }
  return { ok: true };
}

/**
 * «В госкорпорацию» при работодателе-агентстве / частной компании.
 * @param {object} rec
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, hints?: string[] }}
 */
export function detectWrongGovEmployerFraming(rec, text) {
  const t = String(text || '');
  if (!/государственн[а-яё]*\s+корпорац/i.test(t)) return { ok: true };
  const company = String(rec?.company || '');
  if (
    /ГКУ|ГБУ|Правительств|Министерств|госкорпорац|Ростех|Росатом|Роскосмос|РЖД|Почта\s+России/i.test(
      company
    )
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'в письме «госкорпорация», а работодатель на hh — не она',
    hints: [
      'Пишите название компании с карточки (например Marksman), без чужого юрлица',
      'Если найм через агентство — «в команду заказчика» без выдуманной госкорпорации',
    ],
  };
}

/**
 * Убрать ложный framing «госкорпорация» → компания с карточки.
 * @param {object} rec
 * @param {string} text
 */
export function fixWrongGovEmployerFraming(rec, text) {
  const company = String(rec?.company || '').trim();
  let t = String(text || '');
  if (!company || !/государственн[а-яё]*\s+корпорац/i.test(t)) return t;
  if (
    /ГКУ|ГБУ|Правительств|Министерств|госкорпорац|Ростех|Росатом|Роскосмос/i.test(company)
  ) {
    return t;
  }
  t = t.replace(
    /в\s+государственн[а-яё]*\s+корпорац[а-яё]*/gi,
    `в ${company}`
  );
  t = t.replace(
    /государственн[а-яё]*\s+корпорац[а-яё]*/gi,
    company
  );
  return t;
}

/**
 * Узкая ниша в заголовке (PAM и т.п.) должна быть названа в письме.
 * @param {object} rec
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, hints?: string[] }}
 */
export function detectNicheTitleGap(rec, text) {
  const title = String(rec?.title || '');
  const t = String(text || '');
  if (/\bPAM\b|privileged\s+access|привилегир/i.test(title) && !/\bPAM\b|privileged\s+access|привилегир/i.test(t)) {
    return {
      ok: false,
      reason: 'в заголовке PAM, в письме ниша не названа',
      hints: [
        'Упомяните PAM как интерес/контур роли',
        'Не приписывайте коммерческий Privileged Access, если его нет в inventory',
      ],
    };
  }
  // gamedev в title — нужен мост (Android/мобильные/игры), не только банк-стена
  if (
    /gamedev|game\s*dev/i.test(title) &&
    !/gamedev|game\s*dev|Android|iOS|мобильн|игровой|Unity|Unreal|f2p/i.test(t)
  ) {
    return {
      ok: false,
      reason: 'в заголовке gamedev, в письме ниша/мост не названы',
      hints: [
        'Упомяните gamedev / Android / мобильные проекты как интерес к JD',
        'Не приписывайте Unity/Unreal, если нет в inventory',
      ],
    };
  }
  return { ok: true };
}

/**
 * Повтор одного и того же куска (40+ символов) — баг template/humanize.
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, hints?: string[] }}
 */
export function detectRepeatedLetterChunk(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < 80) return { ok: true };

  // Одна и та же шапка факта дважды (Рамблер 17.07: «По коммерческому опыту» ×2 с разными хвостами)
  const leadHits = t.match(/по\s+коммерческому\s+опыту\s*:/gi) || [];
  if (leadHits.length >= 2) {
    return {
      ok: false,
      reason: 'повтор «По коммерческому опыту» в письме',
      hints: ['Один факт с этой шапкой; второй — без префикса или другой формулировкой'],
    };
  }

  // Два одинаковых предложения подряд или один фрагмент 45+ символов дважды
  const sentences = t
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);
  for (let i = 0; i < sentences.length - 1; i++) {
    const a = sentences[i].toLowerCase();
    const b = sentences[i + 1].toLowerCase();
    if (a === b) {
      return {
        ok: false,
        reason: 'повтор предложения в письме',
        hints: ['Уберите дублирующий абзац — одна формулировка факта'],
      };
    }
  }
  const chunkRe = /(.{45,}?)(?:\s+\1)/i;
  if (chunkRe.test(t)) {
    return {
      ok: false,
      reason: 'повтор фрагмента в письме',
      hints: ['Уберите скопированный кусок — одна формулировка факта'],
    };
  }
  return { ok: true };
}

/**
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, hints?: string[] }}
 */
export function detectWeakLetterFraming(text) {
  const t = String(text || '');

  const dup = detectRepeatedLetterChunk(t);
  if (!dup.ok) return dup;

  const itOneTense = detectItOnePresentTense(t);
  if (!itOneTense.ok) return itOneTense;

  if (/\*\*/.test(t)) {
    return {
      ok: false,
      reason: 'markdown ** в письме — уберите разметку',
      hints: ['Пишите обычным текстом без **жирного** и markdown-списков'],
    };
  }

  if (/\bhead\s+of\s+support\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм head of support — пишите по-русски',
      hints: ['«руководитель службы поддержки» / «вёл линию ~10 человек»'],
    };
  }

  // Обрыв шаблона: «из инструментов регулярно использую - Softline…» (ОТП 19.07)
  if (/использую\s*[-–—]\s*(?:\*\*)?/i.test(t) || /использую\s*[-–—]\s*[A-ZА-Я]/u.test(t)) {
    return {
      ok: false,
      reason: 'обрыв фразы «использую - …» — шаблонный список без глагола',
      hints: ['Цельное предложение: факты Softline/IT_One без «использую - Компания»'],
    };
  }

  if (/\bon[-\u2011\u2010\s]?prem(?:ise)?s?\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм on-prem в письме — пишите «локальная инфраструктура»',
      hints: ['Замените on-prem / on-premise на «локальная инфраструктура» или «своя площадка»'],
    };
  }

  if (/\bnetworking\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм networking в письме — пишите «сетевые технологии»',
      hints: ['Замените networking на «сетевые технологии» / «базовые сетевые технологии»'],
    };
  }

  if (/\bobservability\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм observability в письме — пишите «мониторинг и наблюдаемость»',
      hints: ['Замените observability на «мониторинг» / «мониторинг и наблюдаемость»'],
    };
  }

  // Обрыв-список: «Docker, Linux, коммерческой эксплуатации» / «…эксплуатации.» без продолжения
  // (Ростелеком 17.07). Не резать честный оборот: «коммерческой эксплуатации SIEM… не вёл».
  if (
    !/\bиз\s+коммерческой\s+эксплуатации/i.test(t) &&
    /(?<![иИ]з\s{0,12})коммерческой\s+эксплуатации(?:\s*[,;.!?]|\s*$)/i.test(t)
  ) {
    return {
      ok: false,
      reason: 'обрыв фразы «…коммерческой эксплуатации» без «из»',
      hints: [
        'Полная фраза: «резервное копирование и восстановление — из коммерческой эксплуатации»',
        'Или уберите обрывок — не оставляйте голый родительный падеж',
      ],
    };
  }

  // Канцелярит-открытие (Рамблер L3 17.07)
  if (/по\s+опыту\s+близки\s+ваши\s+задачи/i.test(t)) {
    return {
      ok: false,
      reason: 'канцелярит «По опыту близки ваши задачи»',
      hints: ['Сразу роль + один факт из опыта, без «близки ваши задачи»'],
    };
  }

  if (/\bhigh[-\s]?load\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм highload в письме — пишите «высоконагруженные системы»',
      hints: [
        'Замените highload / highload-сопровождение на «сопровождение высоконагруженных систем»',
      ],
    };
  }

  if (/болит\s+у\s+команды|что\s+сейчас\s+болит/i.test(t)) {
    return {
      ok: false,
      reason: 'сленг «болит у команды» в письме HR',
      hints: ['Закрытие: «Готов обсудить приоритеты команды» / «Буду рад созвону» — без «болит»'],
    };
  }

  if (/(?:^|[^\p{L}])недущ(?:его|ий|ая|ие|им)(?:$|[^\p{L}])/iu.test(t)) {
    return {
      ok: false,
      reason: 'опечатка «недущего» вместо «ведущего»',
      hints: ['Замените на «ведущего специалиста»'],
    };
  }

  if (
    /(?:^|[^\p{L}])ловлю\s+(?:до\s+релиза|дефект)|дефекты\s+ловлю|критичн\w*\s+дефекты\s+ловлю/iu.test(
      t
    )
  ) {
    return {
      ok: false,
      reason: 'сленг «ловлю» про дефекты — пишите «выявляю»',
      hints: ['«критичные дефекты выявляю до релиза»'],
    };
  }

  // «pet» в письме HR (Настя 19.07) — только «собственные проекты» / «практика»
  if (/(?:^|[^\p{L}])pet(?:-|\s)|pet-практик|pet\s+playwright/iu.test(t)) {
    return {
      ok: false,
      reason: 'в письме «pet» — пишите «собственные проекты» / «практика», без слова pet',
      hints: ['Уберите pet; год собственных проектов в письме не указывайте'],
    };
  }

  // Год на собственных проектах в письме (не коммерция)
  if (
    /(?:собственн\w*\s+проект|практик\w*\s+playwright|playwright\s*\(?\s*2026|pet[^.!]{0,40}2026)/i.test(
      t
    ) && /2026/.test(t)
  ) {
    return {
      ok: false,
      reason: 'год собственных проектов (2026) в письме — уберите',
      hints: ['«практика Playwright» без года'],
    };
  }

  // Англ. mid в письме HR (Innovative 19.07) — без «уровень около mid»
  if (/уровень\s+около\s+mid|около\s+mid|\(\s*mid\s*\)/i.test(t)) {
    return {
      ok: false,
      reason: 'в письме «около mid» / англ. mid — уберите; достаточно «работала с Kotlin на последнем месте»',
      hints: ['На последнем месте работала с Kotlin; …'],
    };
  }

  // «изучала Kotlin» устарело после CV-канона 19.07 — пишем «работала»
  if (/изучал\w*\s+kotlin|kotlin.{0,30}изучал/i.test(t)) {
    return {
      ok: false,
      reason: '«изучала Kotlin» — устарело; на CV работала на последнем месте',
      hints: ['На последнем месте работала с Kotlin; …'],
    };
  }

  // «8+ лет» в opening = overqualified-сигнал (Azur / Innovative 19.07)
  {
    const opening = t
      .replace(/^(?:здравствуйте|добрый\s+день)[!,.]?\s*/i, '')
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(' ');
    if (/8\s*\+\s*лет|более\s+8\s+лет|8\s+лет\s+в\s+qa/i.test(opening)) {
      return {
        ok: false,
        reason: '«8+ лет» в opening — overqualified; начните с задач/стека, не со стажа',
        hints: [
          'Стаж коротко позже или опустите; opening = роль + факты без «8+»',
        ],
      };
    }
  }

  // Postman ≠ «разрабатываю автотесты» (Домклик 19.07)
  if (
    /(?:разрабатыва\w*|пишу|написа)\s+автотест\w*.{0,40}postman|автотест\w*\s+(?:rest\s*)?api\s+через\s+postman|автотест\w*.{0,24}postman/i.test(
      t
    )
  ) {
    return {
      ok: false,
      reason: 'Postman как «автотесты» — звучит как framework; пишите API-проверки / коллекции',
      hints: [
        '«API-проверки / коллекции Postman, SQL, регресс» — без «разрабатываю автотесты через Postman»',
      ],
    };
  }

  if (/\bиз\s+JD\b|\bиз\s+дж(?:и|е)дэ\b/i.test(t)) {
    return {
      ok: false,
      reason: 'мета-ссылка «из JD» в письме для HR',
      hints: ['Не пишите «из JD» — говорите про стек своими словами без канцелярита агента'],
    };
  }

  if (/прод[- ]?опыт\w*\s+нет|нет\s+прод[- ]?опыт/i.test(t) && /закрою\s+на\s+проекте/i.test(t)) {
    return {
      ok: false,
      reason: 'слабый гэп: «прод-опыта нет — закрою на проекте»',
      hints: [
        'Либо опустите второстепенный гэп',
        'Либо: «Kafka/ClickHouse — зона роста; опираюсь на PostgreSQL и highload-эксплуатацию, быстро войду с командой»',
      ],
    };
  }

  if (/закрою\s+на\s+проекте/i.test(t)) {
    return {
      ok: false,
      reason: 'канцелярит «закрою на проекте»',
      hints: ['Лучше: «быстро наращу на проекте с командой» или опустите, если стек не must-have'],
    };
  }

  if (/kubernetes.{0,40}не\s+заявляю|не\s+заявляю.{0,40}kubernetes/i.test(t)) {
    return {
      ok: false,
      reason: 'оправдательный дисклеймер Kubernetes в письме',
      hints: [
        'Не пишите «Kubernetes не заявляю» — это звучит как извинение',
        'Либо не упоминайте K8s, либо одна позитивная опора: Linux, CI/CD, мониторинг',
      ],
    };
  }

  if (/kubernetes.{0,40}не\s+приписываю|не\s+приписываю.{0,40}kubernetes/i.test(t)) {
    return {
      ok: false,
      reason: 'оправдательный дисклеймер «K8s не приписываю»',
      hints: ['Уберите дисклеймер — молчите о дыре; опора на эксплуатацию и CI/CD'],
    };
  }

  if (
    /не\s+веду\s+как\s+основной\s+профиль|cisco.{0,40}не\s+веду|сетевой\s+стек\s+cisco.{0,60}не\s+веду/i.test(
      t
    )
  ) {
    return {
      ok: false,
      reason: 'оправдание про Cisco / «не веду как основной профиль»',
      hints: [
        'Не извиняйтесь за сеть: либо одна позитивная фраза (VPN/VLAN с командой), либо молчание',
      ],
    };
  }

  if (/\bbare[-\s]?metal\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм bare-metal в письме — пишите «физическая инфраструктура»',
      hints: ['Замените bare-metal на «физическая инфраструктура» / «свои серверы»'],
    };
  }

  if (/\bprod\s*\/\s*dev\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм prod/dev в письме',
      hints: ['Замените prod/dev на «продуктивные и тестовые контуры»'],
    };
  }

  // Пересказ стека вакансии через «в вакансии — A, B, C»
  if (
    /в\s+вакансии\s*[—–\-:]\s*.{0,120}(?:кластер|kubernetes|ci\/cd|мониторинг|ansible|prometheus)/i.test(
      t
    )
  ) {
    return {
      ok: false,
      reason: 'пересказ стека через «в вакансии — …»',
      hints: [
        'Не зеркальте список JD: одна задача своими словами + факт из опыта',
        'Пример: «Интересует локальная инфраструктура и Kubernetes с CI/CD и мониторингом — близко к банковским контурам СБП»',
      ],
    };
  }

  // Мишура ИИ: пафосные обещания / ярлыки / штампы (скрины 17.07)
  if (/это\s+мой\s+хлеб/i.test(t)) {
    return {
      ok: false,
      reason: 'мишура: «это мой хлеб»',
      hints: ['Уберите штамп — одна задача из JD + факт из опыта'],
    };
  }
  if (/вижу,?\s+что\s+вам\s+нужен\s+человек/i.test(t)) {
    return {
      ok: false,
      reason: 'мишура: «Вижу, что вам нужен человек…»',
      hints: ['Начните с интереса к роли и одной задачи, без пересказа «кого ищут»'],
    };
  }
  if (/в\s+крови/i.test(t)) {
    return {
      ok: false,
      reason: 'мишура: «в крови»',
      hints: ['Уберите штамп — факт опыта вместо «Linux в крови»'],
    };
  }
  if (/опора\s*:/i.test(t)) {
    return {
      ok: false,
      reason: 'мишура: ярлык «Опора:»',
      hints: ['Стек вплетите в предложение, без заголовка «Опора:»'],
    };
  }
  if (
    /наведу\s+порядок|закрою\s+гэп|унифицирую\s+(?:пайплайн|мониторинг|grafana|prometheus)/i.test(t)
  ) {
    return {
      ok: false,
      reason: 'мишура: «наведу порядок / закрою гэпы / унифицирую»',
      hints: ['Без обещаний на испытательный — факт из опыта + готов обсудить стек'],
    };
  }
  if (/(?:за\s+первые\s+(?:2[–\-]?3\s+)?недел|первым\s+делом\s+разбер)/i.test(t)) {
    return {
      ok: false,
      reason: 'мишура: план «в первые недели / первым делом»',
      hints: ['Уберите план на первые недели — HR ждёт факт, не роадмап'],
    };
  }
  if (/прозрачный\s+статус\s+до\s+восстановлени/i.test(t)) {
    return {
      ok: false,
      reason: 'мишура: «прозрачный статус до восстановления»',
      hints: ['Конкретнее: регламенты смены / статус инцидента — без рекламного штампа'],
    };
  }
  if (/\blive\s+troubleshooting\b/i.test(t)) {
    return {
      ok: false,
      reason: 'англицизм live troubleshooting в письме',
      hints: ['По-русски: «разбор сбоев» / «диагностика инцидентов»'],
    };
  }

  // Known-стек из inventory: нельзя «учиться / освоить» (кейс Айди Партнёр: Mikrotik)
  const knownStackLearnAlt =
    'mikrotik|микротик|routeros|cisco|linux|docker|proxmox|zabbix|grafana|kibana|postgresql|ansible|veeam|windows\\s*server|active\\s*directory|\\bad\\b|bitrix';
  const learnVerbNearKnown = new RegExp(
    `(?:готов\\w{0,6}\\s+)?(?:учитьс\\w*|освоить|изучить|нарастить\\s+с\\s+нул\\w*)[^.]{0,100}(?:${knownStackLearnAlt})|(?:${knownStackLearnAlt})[^.]{0,60}(?:учитьс\\w*|освоить|изучить)`,
    'i'
  );
  if (learnVerbNearKnown.test(t)) {
    return {
      ok: false,
      reason: '«учиться/освоить» про known-стек (Mikrotik, Linux, Cisco…)',
      hints: [
        'Known — факт опыта («Mikrotik в ФБД / дома»), не «готов учиться»',
        'Unknown — отдельно: «быстро войду с командой» или молчание; не «учиться A и B»',
      ],
    };
  }
  // Не паковать known + unknown в одну фразу «учиться A и B»
  const learnPackedKnownAndOther = new RegExp(
    `(?:учитьс\\w*|освоить|изучить)[^.]{0,120}(?:${knownStackLearnAlt})\\s*(?:,|и|/|\\+)\\s*[А-Яа-яA-Za-z]`,
    'i'
  );
  if (learnPackedKnownAndOther.test(t)) {
    return {
      ok: false,
      reason: 'known + unknown в одной фразе «учиться A и B»',
      hints: [
        'Разделите: known-стек — опыт; неизвестный продукт — отдельно или опустите',
      ],
    };
  }

  return { ok: true };
}

/**
 * Письмо обещает «удалёнку», а вакансия — гибрид/офис без remote (Марс Ступино 19.07).
 * Смотрит `rec.work` (если есть) и эвристики по workFormat / JD / адресу — в store часто нет поля `work`.
 * @param {object} rec
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, hints?: string[] }}
 */
export function detectWorkFormatLetterMismatch(rec, text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return { ok: true };
  const claimsFullRemote =
    /готов\s+к\s+(?:полностью\s+)?удал[её]нн[а-яё]*\s+формату|полностью\s+удал[её]нн|только\s+удал[её]нн/i.test(
      t
    );
  if (!claimsFullRemote) return { ok: true };

  const work = rec?.work || {};
  const jd = [
    rec?.workFormat,
    rec?.workFormatLine,
    rec?.descriptionPreview,
    rec?.descriptionForLlm,
    rec?.address,
    rec?.area,
  ]
    .map((x) => String(x || ''))
    .join(' ');

  const hybridFromJd = /гибрид|hybrid|офис\s+при\s+фабрик/i.test(jd);
  const remoteFromJd = /удал[её]нн|remote|полностью\s+удал/i.test(
    `${rec?.workFormat || ''} ${rec?.workFormatLine || ''}`
  );
  const hybridNoRemote =
    (work.hasHybrid === true && work.hasRemote !== true) ||
    (hybridFromJd && !remoteFromJd && work.hasRemote !== true);
  const remoteBlocked =
    (work.remoteRussiaOk === false && (work.hasHybrid === true || hybridFromJd)) ||
    (hybridFromJd && /ступин|воронеж|обнинск|казань/i.test(jd) && !remoteFromJd);

  if (!hybridNoRemote && !remoteBlocked) return { ok: true };

  return {
    ok: false,
    reason:
      'в письме «удалённый формат», а вакансия гибрид/офис без удалёнки — замените на «обсудить гибрид/график»',
    hints: ['Готов обсудить гибридный формат и график поддержки.'],
  };
}

/**
 * Переписать remote-claim под гибрид JD.
 * @param {object} rec
 * @param {string} text
 */
export function rewriteRemoteClaimVsWorkFormat(rec, text) {
  let t = String(text || '');
  const check = detectWorkFormatLetterMismatch(rec, t);
  if (check.ok) return t;
  t = t.replace(
    /Готов к удал[её]нному формату и сменному графику поддержки\.?/gi,
    'Готов обсудить гибридный формат и график поддержки.'
  );
  t = t.replace(
    /Готов к удал[её]нному формату[^.]{0,60}\.?/gi,
    'Готов обсудить гибридный формат и график.'
  );
  t = t.replace(
    /полностью удал[её]нн\w*\s+формат\w*/gi,
    'гибридный формат'
  );
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitize + soft checks combined for prepare pipeline.
 * @param {string} text
 */
export function prepareCoverLetterRuFraming(text) {
  const sanitized = sanitizeCoverLetterRuTerms(text);
  const weak = detectWeakLetterFraming(sanitized);
  return { text: sanitized, framing: weak };
}

/**
 * Lead-тон на Middle/IC / AQA (не qa-lead). Домклик 19.07.
 * @param {object} [rec]
 * @param {string} letter
 * @param {string} [huntTrack]
 */
export function detectQaIcLeadTone(rec, letter, huntTrack) {
  const track =
    String(huntTrack || rec?.huntTrack || rec?.coverLetter?.huntTrack || '').toLowerCase();
  if (track === 'qa-lead' || track === 'qa_lead') return { ok: true };
  const title = String(rec?.title || '');
  const isLeadJd = /ведущ|lead|head|руководитель/i.test(title);
  if (isLeadJd) return { ok: true };

  const t = String(letter || '');
  if (
    /(?:работаю|работала|работаю\s+как)\s+ведущ[а-яё]*\s+специалист/i.test(t) ||
    /последние\s+\d+\s+год[а-яё]*\s+работа[а-яё]*\s+ведущ/i.test(t)
  ) {
    return {
      ok: false,
      reason: 'lead-тон «ведущий специалист» на IC/AQA — hands-on факты без лид-формулировки',
      hints: [
        '«работаю тестировщиком / инженером по тестированию: API, регресс, …» — без «ведущим»',
      ],
    };
  }
  return { ok: true };
}

/**
 * Cursor/LLM в письме только если JD про AI/авто с ИИ (АЙ-ТЕКО SDET 19.07 — шум на классическом AQA).
 * @param {object} [rec]
 * @param {string} letter
 */
export function detectQaCursorLlmNoise(rec, letter) {
  const t = String(letter || '');
  if (!/cursor|\bllm\b|ии-инструмент|chatgpt|copilot/i.test(t)) return { ok: true };
  const jd = [
    rec?.title,
    rec?.description,
    rec?.descriptionPreview,
    rec?.descriptionForLlm,
    rec?.geminiSummary,
  ]
    .map((x) => String(x || ''))
    .join('\n');
  if (/(?:cursor|\bllm\b|chatgpt|copilot|ии-инструмент|генеративн|ai[- ]?assist|с\s+помощью\s+ии)/i.test(jd)) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'Cursor/LLM в письме без опоры в JD — уберите или оставьте только Kotlin/API вход',
    hints: [
      'На классическом AQA/SDET без AI в JD: Kotlin/API + план входа; Cursor — только если JD про ИИ-инструменты',
    ],
  };
}

