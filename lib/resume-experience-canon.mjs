/**
 * HT.6.6c+ — канон блоков опыта (индексы = порядок на hh.ru).
 *
 * 7000+ обращений — только IT_One (проект СБП), никогда Softline.
 * В каждом блоке — явная строка «Стек: …» для ATS и HR.
 *
 * Softline/Аплана (16.07.2026): факты из NAS `data-emil/tmp-nas-full-scan-report.md`
 * (vSAN/RackStore–Уфа, DR, Create VM, инвентарь, ЦСИ) — без фейк-K8s и без 7000+.
 */

export const EMPLOYMENT_CANON = {
  itOne: {
    company: 'IT_One',
    client: 'ГПБ (банк)',
    note: 'ПФР: ГПБ-ИТ1 (01.08.2023–30.05.2025) + ИТ1-РЕШЕНИЯ (02.06.2025–29.05.2026); на hh — один бренд',
    pfrSource: 'docs/PFR-EMPLOYMENT-TRUTH-2026-07-16.md',
  },
  itOneSbp: {
    company: 'IT_One',
    /** Дефолт для L2/TAM/support_lead; devops/infra — через getExperienceTitleOnHh */
    titleOnHh: 'Технический эксперт L2',
    project: 'ДПСИТ → контуры СБП (один бренд IT_One; юрлица по ПФР сменились)',
    periodOnHh: 'август 2023 — май 2026',
    startMonth: '2023-08',
    endMonth: '2026-05',
    searchFromRu: 'июль 2026',
    hhIndex: 0,
    facts: ['7000+ обращений и инцидентов (IT_One, СБП)', 'Grafana/Kibana', '−15% MTTR', 'ДПСИТ→СБП внутри IT_One'],
    stackLine:
      'Linux, OpenShift, Camunda, Keycloak, PostgreSQL, Oracle, Grafana, Kibana, Docker, GitLab CI, Postman, Jira, Confluence',
  },
  merger: {
    company: 'Мергер',
    titleOnHh: 'Удаленный руководитель IT',
    periodOnHh: 'декабрь 2019 — апрель 2026',
    endMonth: '2026-04',
    hhIndex: null,
    publicCv: false,
    stackLine: 'Bitrix, Linux, AD, сеть, телефония, ЭЦП',
    note:
      'Самозанятость (не в ПФР). С 18.07.2026 — не на публичном CV: мешает ленте IT_One→Softline→ФБД. Факты частично влиты в ФБД (переезды / связанное направление). Хвост 2021–2026 не показываем.',
  },
  itOneGpbPrior: {
    company: 'IT_One',
    titleOnHh: 'Технический эксперт SL2',
    project: 'ДПСИТ, кредитный контур ГПБ — влит в index 0 с 16.07.2026 вечер',
    periodOnHh: 'август 2023 — май 2025',
    hhIndex: null,
    deprecated: true,
    stackLine:
      'OpenShift, Camunda, Keycloak, Grafana, Kibana, PostgreSQL, SQL, Postman, Jira, Confluence',
  },
  softline: {
    company: 'ГК Softline / Аплана',
    period: 'май 2021 — июль 2023',
    hhIndex: 2,
    /** ПФР: Аплана 18.05.2021–12.01.2023; Софтлайн Интеграция 13.01.2023–05.07.2023 */
    pfr: {
      aplana: { legal: 'ООО Аплана МП', from: '2021-05-18', to: '2023-01-12', title: 'Руководитель службы ТП' },
      softline: {
        legal: 'ООО Софтлайн Интеграция',
        from: '2023-01-13',
        to: '2023-07-05',
        title: 'Руководитель отдела',
      },
    },
    /** Площадки Аплана/АЦР: RackStore (МСК) + Уфа — из оффера и NAS Document */
    sites: ['RackStore (МСК)', 'Уфа'],
    /**
     * Партнёр 20.07: после выкупа Softline — интеграция контура Апланы;
     * массовая миграция сервисов офис→ЦОД без простоя; офис→офис (→Девелоника);
     * сплит Softline РФ/иностранная — только interview. Цифру «N сотен» не фиксировать.
     * Канон: docs/SESSION-2026-07-20-softline-aplana-facts.md
     */
    partnerFacts20260720: {
      contourIntegration: true,
      officeToDcMigration: true,
      officeRelocation: true,
      softlineSplitInterviewOnly: true,
      serviceCountPublic: null,
    },
    stackLine:
      'vSphere, vSAN, Veeam, Zabbix, Jira, Confluence, Nexus, SonarQube, Windows Server, AD, DNS/DHCP, VM, MFA, SLA/OLA, ITIL-практики',
  },
  fbd: {
    company: 'ФБД',
    period: 'декабрь 2016 — май 2021',
    hhIndex: 3,
    /** ПФР: ФБД 05.12.2016–15.03.2018; Лучшие бизнес-решения 02.04.2018–17.05.2021 — на CV только ФБД */
    pfr: {
      fbd: { legal: 'ООО ФБД', from: '2016-12-05', to: '2018-03-15' },
      lbr: { legal: 'ООО Лучшие бизнес-решения', from: '2018-04-02', to: '2021-05-17', titleFrom: '2019-05-20' },
    },
    stackLine:
      'Linux, Proxmox, Zabbix, Windows Server, AD, DNS/DHCP, Veeam, 1С, Bitrix, Asterisk, OTRS',
  },
  archive: {
    note: 'index 5+ (РУС-ЛАН, DEPO и др.) — только лёгкая стилизация, не раздувать',
    maxBullets: 2,
  },
};

/** HT.6.13 — архивный опыт после основных блоков; с 18.07 без Мергера: 0 IT_One, 1 Softline, 2 ФБД → архив с 3. */
export const ARCHIVE_EMPLOYERS = {
  depo: {
    company: 'DEPO Computers',
    hhIndex: 3,
    titleOnHh: 'Системный администратор',
    stackLine: 'Windows Server, Linux, 1С, стенды, сеть, резервное копирование',
    bullets: [
      'Сопровождал серверную инфраструктуру и стенды (в т.ч. обновление серверов 1С, пилоты импортозамещения).',
      'Поддерживал пользователей и типовые инциденты по регламенту.',
    ],
  },
  aaron: {
    company: 'ААРОН АВТО',
    hhIndex: 4,
    titleOnHh: 'Системный администратор',
    stackLine: 'Hyper-V, Windows Server, Active Directory, АТС Panasonic, 1С',
    bullets: [
      'Развернул Hyper-V и сопровождал AD/серверы; АТС Panasonic с записью звонков, банк-клиенты.',
      'Решал инфраструктурные задачи автосалона и инциденты пользователей по регламенту.',
    ],
  },
  ruslan: {
    company: 'РУС-ЛАН',
    hhIndex: 5,
    titleOnHh: 'Старший системный администратор',
    stackLine: 'Hyper-V, VMware, Exchange, Cisco, MikroTik, VPN, Windows Server, Linux, Symantec Backup Exec',
    bullets: [
      'Сопровождал парк ~200 ПК и серверы (физ. + VM на Hyper-V/VMware), Exchange, VPN Cisco/MikroTik.',
      'Вёл СКУД, резервное копирование (Symantec Backup Exec / LTO) и доступы пользователей по регламенту.',
    ],
  },
  asp: {
    company: 'Альянс Спэйр Партс',
    hhIndex: 6,
    titleOnHh: 'Удалённый системный администратор',
    stackLine: 'Windows Server, AD, Exchange, 1С, Cisco, MikroTik',
    bullets: [
      'Удалённо администрировал серверы и рабочие места Windows Server / AD (~50 узлов).',
      'Сопровождал сеть, резервное копирование, 1С и пользовательскую поддержку.',
    ],
  },
  generic: {
    stackLine: 'Windows Server, Linux, сеть',
    bullets: [
      'Администрировал серверную инфраструктуру и рабочие места по регламенту.',
      'Поддерживал пользователей и типовые инциденты.',
    ],
  },
};

const ARCHIVE_FORBIDDEN_RE = /7000|сбп|softline.*20\+/i;

export const EXPERIENCE_DATE_PATCHES = [
  {
    index: 0,
    startYear: 2023,
    startMonth: 8,
    endYear: 2026,
    endMonth: 5,
    stillWorking: false,
    label: 'IT_One ПФР: авг 2023 — май 2026 (старт 01.08.2023)',
  },
];

/** @param {string[]} lines @param {string} stackLine */
export function bulletsToText(lines, stackLine) {
  const body = lines.map((l) => (l.startsWith('- ') ? l : `- ${l}`)).join('\n');
  const stack = String(stackLine || '').trim();
  return stack ? `${body}\n\nСтек: ${stack}.` : body;
}

/** IT_One — единый блок ДПСИТ→СБП (hh index 0); объём обращений — только СБП, формулировки варьируем. */
export function buildItOneSbpEntry(trackId) {
  const id = String(trackId || 'devops').toLowerCase();
  /** @type {string[]} */
  let lines;

  if (id === 'devops') {
    lines = [
      'На проекте ДПСИТ (кредитный контур банка, 24/7): сопровождал релизы в OpenShift, процессы Camunda, доступ Keycloak; диагностику по SQL и логам, когда заявка зависала в контуре.',
      'Автоматизировал типовые проверки и рутину: Linux, Docker, bash, пайплайны GitLab CI в контуре банка.',
      'Далее — контуры СБП (пром, тест, эмулятор): эксплуатация сервисов, разбор инцидентов, локализация по логам и SQL, восстановление в рамках SLA.',
      'Настраивал мониторинг и алерты в Grafana и Kibana на контурах СБП; сократил время реагирования более чем на 15%.',
      'Участвовал в окнах изменений на СБП: риски, контроль после выкладки, откат при необходимости, документация для дежурных.',
      'Вёл регламенты реагирования и базу знаний по сценариям эксплуатации СБП для дежурной смены.',
    ];
  } else if (id === 'infra') {
    lines = [
      'На проекте ДПСИТ (кредитный контур): мониторинг, регламентные работы, стыковка со смежниками; OpenShift, Camunda, Keycloak в контуре банка.',
      'Участвовал в релизах и работах на инфраструктурном уровне: окна, документация, контроль рисков.',
      'Далее — контуры СБП (пром, тест, эмулятор): Grafana/Kibana, диагностика по логам и SQL, регламентные изменения до восстановления в SLA.',
      'Настраивал алерты и пороги на контурах СБП; сократил время реагирования более чем на 15%.',
      'Участвовал в окнах изменений на СБП: контроль после выкладки, откат, документация для дежурных.',
      'Актуализировал регламенты и базу знаний по эксплуатации контуров СБП для дежурной смены.',
    ];
  } else if (id === 'l2l3') {
    lines = [
      'На проекте ДПСИТ: сопровождал жизненный цикл кредитной заявки 24/7 — находил заявку в контуре, выяснял где и почему зависла (SQL, логи), снимал типовые инциденты по базе знаний.',
      'Новые инциденты разбирал с полным комплектом для 3-й линии: описание, логи, проверки/тесты; эскалировал после разбора, а не «сырым» тикетом.',
      'Далее — контуры СБП (пром, тест, эмулятор): инциденты 2-й линии, локализация, восстановление в SLA.',
      'Диагностика по PostgreSQL и Oracle (SQL), разбор логов в Kibana; доводил сложные кейсы до корневой причины со смежниками (L3).',
      'Настраивал мониторинг и алерты в Grafana и Kibana; сократил время реагирования более чем на 15%.',
      'Обработал более 7000 обращений и инцидентов: регламенты, база знаний, эскалации и обучение коллег.',
    ];
  } else if (id === 'tam') {
    lines = [
      'На проекте ДПСИТ: координация заявок по кредитным продуктам, статус для смежников и заказчиков, эскалации до закрытия.',
      'Далее — контуры СБП: вёл эскалации и прозрачный статус для партнёров и внутренних заказчиков до восстановления сервиса в SLA.',
      'Координировал партнёров и вендоров: сроки, фиксация в Jira/Confluence, проверки Postman/Swagger.',
      'Ускорил подключение партнёров СБП более чем на 15% за счёт процессов и метрик.',
      'Выстраивал регламенты реагирования и базу знаний для сопровождения партнёров.',
    ];
  } else if (id === 'support_lead') {
    lines = [
      'На проекте ДПСИТ: сопровождение кредитного контура 24/7 — жизненный цикл заявок, приоритеты смены, эскалации на L3 с полным разбором, контроль SLA.',
      'Координировал смежников и обучение коллег по сценариям Camunda/Keycloak; участвовал в релизах OpenShift.',
      'Далее — контуры СБП: вёл сложные эскалации и качество разбора инцидентов 2-й линии до закрытия.',
      'Выстраивал регламенты и базу знаний; держал прозрачный статус для руководства.',
      'Настраивал мониторинг Grafana/Kibana; сократил время реагирования более чем на 15%.',
    ];
  } else {
    lines = [
      'Сопровождал контуры СБП (пром, тест, эмулятор): инциденты, локализация по логам и SQL, восстановление в SLA.',
      'Настраивал мониторинг и алерты в Grafana и Kibana; сократил время реагирования более чем на 15%.',
      'Участвовал в релизах и регламентных работах: окна, риски, документация для дежурных.',
    ];
  }

  return bulletsToText(lines.slice(0, 6), EMPLOYMENT_CANON.itOneSbp.stackLine);
}

export const buildItOneEntry0 = buildItOneSbpEntry;

export const FBD_BLOCK_SHORT = bulletsToText(
  [
    'ФБД (дек 2016 — май 2021; с мая 2019 — директор IT-отдела).',
    'Развернул Linux-инфраструктуру с нуля: Proxmox, Zabbix, Active Directory, DNS/DHCP, Veeam, WSUS.',
    'Поднял телефонию (Asterisk/ВАТС) и helpdesk OTRS; сопровождал 1С и Bitrix на инфраструктурном уровне.',
    'Провёл три переезда большого офиса без простоя критичных сервисов; поднял IT для связанного направления (Bitrix, телефония, офисный контур).',
    'Руководил командой до 4 человек; выстроил мониторинг, резервное копирование и регламенты изменений.',
  ],
  EMPLOYMENT_CANON.fbd.stackLine
);

/** Блоки 1–4: акцент под маршрут (факты общие, подача разная). */
export function buildMergerBlock(trackId) {
  const id = String(trackId || 'devops').toLowerCase();
  /** @type {string[]} */
  let lines;
  if (id === 'support_lead' || id === 'tam') {
    lines = [
      'Самозанятость: параллельно с основной работой запустил с нуля компанию по банковским гарантиям (~20 сотрудников).',
      'Выстроил IT с нуля: закупка техники, офис, сервер, сеть, телефония, Битрикс24.',
      'Управлял командой и внутренними процессами; консультировал клиентов по ЭЦП и криптографии.',
      'Провёл 3 плановых переезда офиса без простоя ключевых сервисов.',
    ];
  } else if (id === 'l2l3') {
    lines = [
      'Самозанятость: параллельно с основной работой запустил с нуля компанию по банковским гарантиям (~20 сотрудников).',
      'Организовал закупку и настройку техники, рабочие места; сопровождал пользователей и внутренний IT.',
      'Сопровождал сервер, сеть, телефонию, почту и Битрикс24; консультировал по ЭЦП.',
    ];
  } else {
    lines = [
      'Самозанятость: параллельно с основной работой запустил с нуля компанию по банковским гарантиям (~20 сотрудников).',
      'Организовал закупку и настройку техники, рабочие места; провёл 3 плановых переезда офиса.',
      'Сопровождал внутренний сервер, защиту данных, сеть, телефонию, почту и Битрикс24.',
      'Консультировал сотрудников и руководство; удалённо помогал клиентам по ЭЦП и криптографии.',
    ];
  }
  return bulletsToText(lines.slice(0, 4), EMPLOYMENT_CANON.merger.stackLine);
}

export function buildItOneGpbPriorBlock(trackId) {
  const id = String(trackId || 'devops').toLowerCase();
  /** @type {string[]} */
  let lines;
  if (id === 'devops' || id === 'infra') {
    lines = [
      'Участвовал в проекте ДПСИТ: поддержка кредитного контура 24/7 до финальных статусов заявок.',
      'Сопровождал релизы в OpenShift; работал с Camunda, Keycloak, Grafana и SQL-диагностикой.',
      'При дефектах оформлял инциденты, собирал логи и метрики в Kibana, эскалировал на 3-ю линию.',
      'Перешёл на проект СБП в том же банке.',
    ];
  } else if (id === 'tam') {
    lines = [
      'Координировал заявки по автокредитованию и кредитным продуктам: статус, сроки, эскалации смежникам.',
      'Сопровождал релизы в OpenShift; фиксировал инциденты и метрики в Jira/Confluence и Kibana.',
      'Работал с Camunda, Keycloak, Grafana; обеспечивал прозрачность для внутренних заказчиков.',
      'Перешёл на проект СБП в том же банке.',
    ];
  } else if (id === 'support_lead') {
    lines = [
      'Руководил сопровождением кредитного контура 24/7: распределение нагрузки, эскалации, SLA.',
      'Оформлял инциденты, собирал логи в Kibana; координировал релизы в OpenShift.',
      'Обучал коллег по сценариям Camunda/Keycloak; перешёл на проект СБП в том же банке.',
    ];
  } else {
    lines = [
      'Участвовал в проекте ДПСИТ: поддержка кредитного контура 24/7 до финальных статусов заявок.',
      'Сопровождал заявки по автокредитованию, кредитным картам, потребительским и залоговым кредитам.',
      'При новых дефектах оформлял инциденты, собирал логи и метрики в Kibana, эскалировал на 3-ю линию.',
      'Диагностика по PostgreSQL и Oracle (SQL); участвовал в релизах и регламентных работах.',
      'Перешёл на проект СБП в том же банке.',
    ];
  }
  return bulletsToText(lines.slice(0, 5), EMPLOYMENT_CANON.itOneGpbPrior.stackLine);
}

export function buildSoftlineBlock(trackId) {
  const id = String(trackId || 'devops').toLowerCase();
  /** @type {string[]} */
  let lines;
  if (id === 'support_lead') {
    lines = [
      'Аплана (май 2021 — янв 2023) → Softline Интеграция (янв — июль 2023): руководил службой технической поддержки более 20 человек: SLA/OLA, каталог услуг, регламенты ЦСИ (L1–L3); вывел SLA линии с ~78% до ~93%.',
      'После выкупа Softline интегрировал контур Апланы: AD и рабочие места, почта, телефония, MFA, закупка и раскатка оборудования, внутренние сервисы — в единый контур ГК.',
      'Перевёл массово проектные и внутренние сервисы из офиса в ЦОД без простоя: этапы, связи и сетевая доступность, БД; физпереезд серверов и виртуальный перенос; затем подготовил новый офис Апланы с командой сисадминов.',
      'Обеспечивал инфраструктуру ТП на RackStore (Москва) и Уфа: vSphere/vSAN, жизненный цикл ВМ, Jira/Confluence; инциденты vSAN и восстановление между площадками.',
    ];
  } else if (id === 'infra') {
    lines = [
      'Аплана → Softline (май 2021 — июль 2023): после выкупа Softline интегрировал организацию Апланы в контур ГК — AD/рабочие места, почта, телефония, MFA, закупки и раскатка оборудования, внутренние сервисы.',
      'Перевёл массово проектные и внутренние сервисы из офиса в ЦОД без простоя: разобрал связи и сетевую доступность, БД; в несколько этапов физически перевёз серверы и виртуально перенёс сервисы и проекты заказчиков.',
      'Сопровождал инфраструктуру RackStore (Москва) и Уфа: vSphere/vSAN (около 10 хостов, крупный парк ВМ), Veeam, Zabbix, AD/DNS/DHCP; жизненный цикл ВМ (Jira → шаблон → домен → резервное копирование → Confluence).',
      'Подготовил переезд офиса Апланы в новый офис с командой сисадминов; параллельно руководил службой 20+: SLA/OLA (~78%→~93%), учёт оборудования.',
    ];
  } else if (id === 'l2l3') {
    lines = [
      'Аплана → Softline (май 2021 — июль 2023): в контуре ЦСИ — Service Desk / Jira, эскалации L2–L3, терминальный доступ (AD, печать, SCCM); участвовал во внедрении MFA и склейке рабочих мест после интеграции контуров.',
      'Вёл сложные эскалации и базу знаний; обучал L2 по типовым сценариям; Atlassian (Jira, Confluence).',
      'Участвовал в переносе сервисов из офиса в ЦОД без простоя ключевых контуров и в восстановлении между площадками.',
      'В службе поддержки более 20 человек отвечал за регламенты ЦСИ и качество разбора сложных обращений (не только L1); SLA линии ~78%→~93%.',
    ];
  } else if (id === 'tam') {
    lines = [
      'Аплана → Softline (май 2021 — июль 2023): выстраивал коммуникацию с заказчиками и отчётность по SLA при склейке контуров после выкупа; планировал бюджет подразделения.',
      'Внедрил Atlassian-стек (Jira, Confluence) и практики SCM (Nexus, SonarQube).',
      'Обеспечивал непрерывность сервисов при переносе из офиса в ЦОД без простоя; сократил поток типовых обращений клиентов более чем на порядок за счёт базы знаний и процессов.',
      'Руководил службой технической поддержки более 20 человек: SLA/OLA и каталог услуг; вывел SLA линии с ~78% до ~93%.',
    ];
  } else {
    // devops / default — без MFA/телефонии в lead; ЦОД как эксплуатационный факт
    lines = [
      'Аплана → Softline (май 2021 — июль 2023): внедрил Atlassian-стек (Jira, Confluence) и практики SCM (Nexus, SonarQube); фон — два ЦОДа, жизненный цикл ВМ, AD/DNS/DHCP, Veeam/Zabbix.',
      'Перевёл проектные и внутренние сервисы из офиса в ЦОД без простоя: этапы, сетевая доступность и зависимости; физпереезд серверов и виртуальный перенос контуров.',
      'Сократил поток типовых обращений более чем на порядок — опыт процессов и метрик для эксплуатации.',
      'Руководил службой технической поддержки более 20 человек: выстроил SLA/OLA и каталог услуг; вывел SLA линии с ~78% до ~93%.',
    ];
  }
  return bulletsToText(lines.slice(0, 4), EMPLOYMENT_CANON.softline.stackLine);
}

export function buildFbdBlock(trackId) {
  const id = String(trackId || 'devops').toLowerCase();
  /** @type {string[]} */
  let lines;
  if (id === 'infra' || id === 'devops') {
    lines = [
      'ФБД: развернул Linux-инфраструктуру с нуля — Proxmox, Zabbix, Active Directory, Veeam, DNS/DHCP, WSUS.',
      'Поднял телефонию (Asterisk/ВАТС) и helpdesk OTRS; Openfire, Bitrix и 1С на инфраструктурном уровне.',
      'Провёл три переезда большого офиса без простоя; поднял IT для связанного направления (Bitrix, телефония, офисный контур).',
      'Руководил командой до 4 человек; выстроил мониторинг, резервное копирование и регламенты.',
    ];
  } else {
    lines = [
      'ФБД: развернул Linux-инфраструктуру с нуля — Proxmox, Zabbix, AD, DNS, Veeam.',
      'Провёл три переезда большого офиса; поднял IT для связанного направления (Bitrix, телефония).',
      'Руководил командой до 4 человек; выстроил мониторинг и практики изменений.',
    ];
  }
  return bulletsToText(lines.slice(0, 4), EMPLOYMENT_CANON.fbd.stackLine);
}

/** @deprecated используйте buildMergerBlock(trackId) */
export const MERGER_BLOCK = buildMergerBlock('devops');
/** @deprecated */
export const IT_ONE_GPB_PRIOR_BLOCK = buildItOneGpbPriorBlock('devops');
/** @deprecated */
export const SOFTLINE_BLOCK = buildSoftlineBlock('devops');

export const MERGERGROUP_BLOCK = MERGER_BLOCK;

/** Должность в шапке блока опыта по индексу и маршруту. С 18.07: без Мергера — 0 IT_One, 1 Softline, 2 ФБД. */
export const EXPERIENCE_TITLE_BY_TRACK_INDEX = {
  devops: {
    0: 'DevOps-инженер',
    1: 'Руководитель службы технической поддержки',
    2: 'Директор / руководитель отдела ИТ',
  },
  infra: {
    0: 'Системный инженер',
    1: 'Системный инженер',
    2: 'Системный администратор / руководитель ИТ',
  },
  l2l3: {
    0: 'Технический эксперт L2',
    1: 'Руководитель службы технической поддержки',
  },
  tam: {
    0: 'Ведущий специалист по работе с партнёрами',
    1: 'Руководитель службы технической поддержки',
  },
  support_lead: {
    0: 'Ведущий специалист / координатор смены',
    1: 'Руководитель службы технической поддержки',
  },
};

/** Должность в блоке опыта index 0 — отдельно от title резюме. HT.6.9b */
export const EXPERIENCE_TITLE_ON_HH_BY_TRACK = {
  devops: 'DevOps-инженер',
  infra: 'Системный инженер',
  l2l3: 'Технический эксперт L2',
  tam: 'Ведущий специалист по работе с партнёрами',
  support_lead: 'Ведущий специалист / координатор смены',
};

/**
 * @param {string} trackId
 * @param {number} [index]
 */
export function getExperienceTitleOnHh(trackId, index = 0) {
  const id = String(trackId || 'devops').toLowerCase();
  const idx = Number(index) || 0;
  const byTrack = EXPERIENCE_TITLE_BY_TRACK_INDEX[id];
  if (byTrack && byTrack[idx]) return byTrack[idx];
  if (idx === 0) {
    return (
      EXPERIENCE_TITLE_ON_HH_BY_TRACK[id] ||
      EMPLOYMENT_CANON.itOneSbp.titleOnHh ||
      'Технический эксперт L2'
    );
  }
  if (idx === 1) return 'Руководитель службы технической поддержки';
  if (idx === 2) {
    if (id === 'infra') return 'Системный администратор / руководитель ИТ';
    return 'Директор / руководитель отдела ИТ';
  }
  return '';
}

export const SKILLS_BY_TRACK = {
  devops: ['Linux', 'Docker', 'GitLab CI', 'OpenShift', 'Grafana', 'PostgreSQL', 'Bash'],
  infra: ['Linux', 'vSphere', 'Veeam', 'Zabbix', 'Proxmox', 'Active Directory', 'Bash'],
  l2l3: ['Linux', 'Grafana', 'PostgreSQL', 'Oracle', 'Jira', 'Kibana', 'SQL'],
  tam: ['Jira', 'Confluence', 'Grafana', 'Postman', 'Linux'],
  support_lead: ['Jira', 'Confluence', 'ITIL', 'Veeam', 'Zabbix', 'Linux'],
};

export const STYLE_GUIDE_RU = {
  tense: 'Опыт — прошедшее время. «О себе» — настоящее.',
  sevenThousand:
    'Объём обращений — только L2/L3 (и то не в opening письма). На DevOps/infra/TAM/lead в IT_One — без «7000» в первых буллетах.',
  softlineNas:
    'Softline/Аплана: интеграция контура после выкупа (AD/MFA/почта/телефония); массовая миграция сервисов офис→ЦОД без простоя; RackStore+Уфа; офисный переезд — опц.; сплит Softline РФ/иностранная — только собес. На IC-резюме руководство не первым буллетом. Без цифры «N сотен» до сверки.',
  fbdSameEmployer:
    'ПФР: ФБД → Лучшие бизнес-решения — одно место. На hh/CV: только «ФБД» (шапка и текст), без «Лучшие бизнес-решения» и без скобок про юрлицо.',
  noEmployerSwitchPhrase: 'Не писать «без смены работодателя».',
  noLegalEntityAside:
    'Не писать в публичном CV: «Лучшие бизнес-решения», «одно место, смена юрлица», «смена юрлица» у ФБД — это ПФР для агента, не для HR.',
  mergerNote:
    'Мергер — не на публичном CV (с 18.07.2026). Факты для собесе — inventory; на hh лента IT_One→Softline→ФБД.',
  atsSkills: 'Теги skills на hh = топливо ATS; сверять с SKILLS_BY_TRACK при каждой заливке.',
  stackLine: 'Каждый блок 0–2 заканчивается строкой «Стек: …».',
  archivePolicy:
    'index 3+ не раздувать: макс. 2 буллета + стек одной строкой; не дублировать СБП/7000.',
  oneEmployerPerBlock:
    'Не повторять работодателя в буллете — уже в шапке (ME: ДПСИТ → СБП без «IT_One» в тексте).',
  perResumeEntry0: 'СБП (index 0) и блоки Softline/ФБД различаются по треку — один факт, разная подача.',
  experienceTitleDevops:
    'devops/infra: должность в опыте index 0 — DevOps-инженер, не «Технический эксперт L2» (HT.6.9b).',
};

/**
 * @param {string} employerKey
 * @param {string} [rawHint]
 */
export function buildArchiveExperienceText(employerKey, rawHint = '') {
  const key = String(employerKey || 'generic').toLowerCase();
  const entry = ARCHIVE_EMPLOYERS[key] || ARCHIVE_EMPLOYERS.generic;
  const hint = String(rawHint || '').trim();
  let bullets = [...(entry.bullets || ARCHIVE_EMPLOYERS.generic.bullets)].slice(
    0,
    EMPLOYMENT_CANON.archive.maxBullets || 2
  );
  if (hint && !ARCHIVE_FORBIDDEN_RE.test(hint)) {
    const hintLine = hint.startsWith('- ') ? hint.slice(2) : hint;
    if (hintLine.length > 12) {
      bullets = [hintLine, bullets[bullets.length - 1]].filter(Boolean).slice(0, 2);
    }
  }
  const stackLine = entry.stackLine || ARCHIVE_EMPLOYERS.generic.stackLine;
  const text = bulletsToText(bullets, stackLine);
  if (ARCHIVE_FORBIDDEN_RE.test(text)) {
    throw new Error(`archive text for ${key} must not contain 7000/SBP/Softline-lead`);
  }
  return text;
}

/** @returns {{ index: number, employerKey: string, text: string }[]} */
export function getArchiveExperiencePatches() {
  return Object.entries(ARCHIVE_EMPLOYERS)
    .filter(([key]) => key !== 'generic')
    .map(([key, entry]) => ({
      index: Number(entry.hhIndex),
      employerKey: key,
      text: buildArchiveExperienceText(key),
    }))
    .filter((p) => Number.isFinite(p.index) && p.index >= 3)
    .sort((a, b) => a.index - b.index);
}

export function getCanonExperienceEntries(trackId, opts = {}) {
  const id = String(trackId || 'devops').toLowerCase();
  /** С 18.07.2026 без Мергера: 0 IT_One, 1 Softline, 2 ФБД */
  const entries = [
    {
      index: 0,
      employerKey: 'itOneSbp',
      employer: 'IT_One',
      titleOnHh: getExperienceTitleOnHh(id, 0),
      text: buildItOneSbpEntry(id),
    },
    {
      index: 1,
      employerKey: 'softline',
      employer: 'Softline',
      titleOnHh: getExperienceTitleOnHh(id, 1),
      text: buildSoftlineBlock(id),
    },
  ];
  if (opts.includeFbd !== false && (id === 'devops' || id === 'infra')) {
    entries.push({
      index: 2,
      employerKey: 'fbd',
      employer: 'ФБД',
      titleOnHh: getExperienceTitleOnHh(id, 2),
      text: buildFbdBlock(id),
    });
  }
  return entries;
}
