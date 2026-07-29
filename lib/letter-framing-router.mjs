/**
 * Letter framing router — M0 × huntTrack × JD hook.
 * Разводит достижения кандидата и требования вакансии (SESSION 20.07).
 * SBP L2 hooks (20.07 evening): l2l3/tam lead + devops ban merchant-lead.
 */
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { classifyRoleTier } from './role-ladder.mjs';
import { intersectJdToolsWithInventory } from './cover-letter-vacancy-focus.mjs';
import { letterOpeningBody } from './letter-domain-framing.mjs';
import { SOFTLINE_SLA_ARC } from './basket-letter-templates.mjs';

/** @typedef {{ huntTrack: string, roleTier: string, jdHook: string, stackHit: string[], leadFacts: string[], tailFacts: string[], forbiddenOpening: string[], risks: string[], mitigations: string[] }} FramingBundle */

const JD_HOOK_RULES = [
  { re: /vault|секрет/i, hook: 'секреты/Vault и ротация доступов на платформе', category: 'vault' },
  { re: /\bidp\b|identity/i, hook: 'IDP — доступы, автоматизация и наблюдаемость платформы', category: 'idp' },
  { re: /ЕФО|\befo\b/i, hook: 'автоматизация контуров и CI/CD', category: 'automation' },
  { re: /sbertech|sber\s*tech/i, hook: 'платформенная эксплуатация и стабильность релизов', category: 'platform' },
  { re: /\bsre\b|reliability|надёжност|наблюдаем/i, hook: 'надёжность сервисов, алерты и окна изменений', category: 'sre' },
  { re: /mlops|ml\s*ops|data\s*platform/i, hook: 'пайплайны данных/моделей и автоматизация выката', category: 'cicd' },
  { re: /kubernetes|\bk8s\b|openshift/i, hook: 'сопровождение Kubernetes и автоматизация релизов', category: 'k8s' },
  { re: /terraform|ansible|puppet|salt/i, hook: 'IaC и автоматизация инфраструктуры', category: 'automation' },
  { re: /grafana|prometheus|victoria\s*metrics|zabbix/i, hook: 'наблюдаемость и эксплуатация по метрикам', category: 'sre' },
  { re: /ci\/?cd|gitlab|jenkins|teamcity|арго\s*cd|argocd/i, hook: 'CI/CD и автоматизация деплоя', category: 'cicd' },
  { re: /docker|контейнер/i, hook: 'контейнеры и стабильные релизы на Linux', category: 'k8s' },
  // «автоматизац» только в title — в JD почти у всех DevOps, иначе все письма = automation
  { re: /автоматизац/i, hook: 'автоматизация контуров и CI/CD', category: 'automation', titleOnly: true },
];

const L2_OPENING_MARKERS =
  /инцидент|регламент|zabbix|postgres|postgresql|3\+\s*сервис|разбор\s+инцид|тикет|7000|sla\s+лин|внутренн.*сервис.*инцид/i;

const DEVOPS_OPENING_MARKERS =
  /ci\/?cd|автоматизац|pipeline|пайплайн|vault|секрет|docker|kubernetes|\bk8s\b|platform|платформ|idp|gitlab|наблюдаем|релиз|доступ.*ротац/i;

/** Тикетный СБП lead — запрещён в opening devops/infra (evidence Bandicam). */
const MERCHANT_LEAD_MARKERS =
  /мерчант|регистрац\w*\s+(мерчант|точек|точки)|service\s*manager|\btoad\b|qr[\s-]?код|возврат\w*\s+нспк/i;

const DEVOPS_LEAD_POOL = [
  'До июня 2026 в IT_One сопровождал релизы и CI/CD на контурах СБП: Linux, Docker, Grafana/Kibana, Bash-автоматизация.',
  'До июня 2026 в IT_One настраивал доступы, ротацию секретов и регламенты Linux под платформенные задачи.',
  'В собственных проектах собрал пайплайны CI и gate перед откликом (Playwright, автоматизация рутины).',
];

const DEVOPS_TAIL =
  'PostgreSQL и мониторинг — часть эксплуатации, не отдельная DBA-роль или helpdesk.';

/** Хвост-дисклеймер только если JD тянет в L2/DBA/helpdesk — иначе шаблон «все письма одинаковые». */
function shouldAppendDevopsTail(rec, category) {
  const blob = [
    rec?.title,
    rec?.company,
    rec?.descriptionPreview,
    rec?.descriptionForLlm,
    typeof rec?.description === 'string' ? rec.description : '',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 6000);
  if (/helpdesk|хелпдеск|1[\s-]?й\s*линии|перв(ая|ой)\s+линии|тикетн|service\s*desk/i.test(blob)) {
    return true;
  }
  if (/dba|администратор\s+бд|только\s+postgres|только\s+postgresql/i.test(blob) && category !== 'cicd') {
    return true;
  }
  return false;
}

function jdStackSnippet(rec) {
  const blob = [
    rec?.title,
    rec?.descriptionPreview,
    rec?.descriptionForLlm,
    typeof rec?.description === 'string' ? rec.description : '',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 8000);
  const stack = intersectJdToolsWithInventory(blob, null).slice(0, 3);
  if (!stack.length) return '';
  return `Из стека вакансии опираюсь на опыт с ${stack.join(', ')}.`;
}

function pickVariant(rec, variants) {
  const key = String(rec?.id || rec?.company || rec?.title || 'x');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 997;
  return variants[h % variants.length];
}

function bodyForCategory(rec, category, hook) {
  /** @type {Record<string, string[]>} */
  const pools = {
    vault: [
      `До июня 2026 в IT_One настраивал доступы и ротацию секретов на Linux-контуре, писал Bash под автоматизацию регламентов, сопровождал релизы с мониторингом.`,
      `До июня 2026 в IT_One вёл доступы и секреты на Linux, автоматизировал регламенты Bash'ем и сопровождал выкаты.`,
    ],
    idp: [
      `До июня 2026 в IT_One настраивал доступы и ротацию секретов на Linux, писал Bash под автоматизацию, сопровождал релизы с Grafana/Kibana на рабочем контуре.`,
      `До июня 2026 в IT_One связывал доступы, Linux-регламенты и наблюдаемость Grafana/Kibana вокруг релизов.`,
    ],
    automation: [
      `До июня 2026 в IT_One писал Bash под автоматизацию на Linux, сопровождал релизы; в собственных проектах собрал пайплайны CI на 2+ сервисах.`,
      `В собственных проектах собрал пайплайны CI и gate перед откликом; до июня 2026 в IT_One автоматизировал рутину Bash на Linux.`,
    ],
    platform: [
      `До июня 2026 в IT_One сопровождал релизы и CI/CD на Linux-контуре команды, Grafana/Kibana и Bash-автоматизацию; в Softline — внутренние платформенные сервисы.`,
      `До июня 2026 в IT_One настраивал доступы, ротацию секретов и регламенты Linux под платформенные задачи.`,
    ],
    // Без «СБП» в каждом письме — иначе point-wave режет волну (лимит 1 каркас IT_One+СБП).
    sre: [
      `До июня 2026 в IT_One сопровождал релизы на Linux: Grafana/Kibana, восстановление сервиса и регламенты изменений.`,
      `До июня 2026 в IT_One вёл эксплуатацию по алертам Grafana/Kibana, писал Bash под автоматизацию рутины вокруг релизов.`,
      `До июня 2026 в IT_One сопровождал релизы и CI/CD на Linux-контуре: Docker, Grafana/Kibana, Bash.`,
    ],
    k8s: [
      `До июня 2026 в IT_One сопровождал релизы и эксплуатацию Docker/OpenShift на Linux; писал Bash под автоматизацию.`,
      `До июня 2026 в IT_One сопровождал контейнерные выкаты на Linux (Docker/OpenShift) и автоматизировал рутину Bash'ем.`,
    ],
    cicd: [
      `До июня 2026 в IT_One сопровождал релизы и CI/CD на Linux-контуре: Bash, Grafana/Kibana, регламенты команды.`,
      `В собственных проектах собрал пайплайны CI; до июня 2026 в IT_One сопровождал релизы на Linux с Bash и мониторингом.`,
    ],
    generic: [
      `До июня 2026 в IT_One сопровождал релизы и Bash-автоматизацию на Linux; в собственных проектах собрал пайплайны CI.`,
      `До июня 2026 в IT_One сопровождал релизы на Linux-контуре команды: Bash, Grafana/Kibana, понятные регламенты.`,
    ],
  };
  const list = pools[category] || pools.generic;
  return pickVariant(rec, list);
}

const L2L3_LEAD_POOL = [
  'На ДПСИТ сопровождал жизненный цикл кредитной заявки: находил в контуре, выяснял где зависла (SQL, логи), снимал по базе знаний или эскалировал на L3 с полным разбором.',
  'На СБП вёл регистрацию мерчантов и разбор платежей/QR: SQL, Postman, логи — до закрытия или эскалации смежникам.',
  SOFTLINE_SLA_ARC,
];

const TAM_LEAD_POOL = [
  'На СБП вёл прозрачный статус для партнёров и заказчиков: подключение мерчантов, эскалации до восстановления сервиса.',
  'Проверял интеграции в Postman/Swagger, фиксировал договорённости в Jira/Confluence.',
];

function sbpL2HooksEnabled() {
  return String(process.env.HH_LETTER_SBP_L2_HOOKS || '1').trim() !== '0';
}

function merchantLeadBanEnabled() {
  return String(process.env.HH_LETTER_BAN_MERCHANT_LEAD || '1').trim() !== '0';
}

/**
 * @param {object} rec
 * @returns {{ hook: string, category: string }}
 */
export function extractJdHook(rec) {
  // Title+company недостаточно: две «DevOps-инженер» без маркера → один generic (Wolle/Лига).
  const titleCo = `${rec?.title || ''} ${rec?.company || ''}`;
  const blob = [
    rec?.title,
    rec?.company,
    rec?.descriptionPreview,
    rec?.descriptionForLlm,
    typeof rec?.description === 'string' ? rec.description : '',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 8000);
  for (const rule of JD_HOOK_RULES) {
    const hay = rule.titleOnly ? titleCo : blob;
    if (rule.re.test(hay)) {
      return { hook: rule.hook, category: rule.category };
    }
  }
  const stack = intersectJdToolsWithInventory(blob, null);
  if (stack.length) {
    // Не тащить postgres/zabbix в opening — L2-tone gate режет первые 2 фразы.
    const tools = stack
      .filter((t) => !/postgres|postgresql|zabbix/i.test(String(t)))
      .slice(0, 3)
      .join(', ');
    return {
      hook: tools
        ? `CI/CD и автоматизация Linux-контуров (${tools})`
        : 'CI/CD и автоматизация Linux-контуров',
      category: 'generic',
    };
  }
  return { hook: 'автоматизация, CI/CD и эксплуатация Linux-контуров', category: 'generic' };
}

/**
 * @param {object} rec
 * @param {{ huntTrack?: string }} [opts]
 * @returns {FramingBundle}
 */
export function resolveLetterFramingBundle(rec, opts = {}) {
  const huntTrack = opts.huntTrack || rec?.huntTrack || classifyVacancyHuntTrack(rec);
  const roleTier = classifyRoleTier(rec)?.tier || 'R0';
  const { hook: jdHook, category: jdCategory } = extractJdHook(rec);
  const desc = String(rec?.description || rec?.descriptionPreview || rec?.descriptionForLlm || '');
  const stackHit = intersectJdToolsWithInventory(desc, null);

  /** @type {FramingBundle} */
  const bundle = {
    huntTrack,
    roleTier,
    jdHook,
    jdCategory,
    stackHit,
    leadFacts: [],
    tailFacts: [],
    forbiddenOpening: [],
    risks: [],
    mitigations: [],
  };

  if (huntTrack === 'devops' || huntTrack === 'infra') {
    bundle.leadFacts = [...DEVOPS_LEAD_POOL];
    bundle.tailFacts = [DEVOPS_TAIL];
    bundle.forbiddenOpening = [
      'opening только инциденты/регламенты/Zabbix без CI/автоматизации',
      'SLA Softline как lead для DevOps',
      'MSSQL/реплики в первом абзаце',
      '«3+ сервиса» как главный аргумент',
      'мерчанты / Service Manager / Toad как lead DevOps',
    ];
    bundle.risks.push('Hotfix без router → L2-tone (инциденты lead)');
    bundle.mitigations.push('detectL2ToneDevopsOpening + regen через composeDevopsFramedLetter');
    bundle.risks.push('Merchant/SM lead из СБП evidence → тикетный тон');
    bundle.mitigations.push('detectMerchantLeadDevopsOpening');
    if (roleTier === 'R2') {
      bundle.risks.push('R2: title L2 — не подменять на DevOps в opening');
      bundle.mitigations.push('Зеркалить title из JD (M0 anti-pattern)');
    }
    if (jdCategory === 'generic' && !stackHit.length) {
      bundle.risks.push('Слабый JD-hook — письмо может стать generic');
      bundle.mitigations.push('Явный крючок из title в первом предложении');
    }
  } else if (huntTrack === 'l2l3') {
    bundle.leadFacts = sbpL2HooksEnabled()
      ? [...L2L3_LEAD_POOL]
      : [
          'До июня 2026 на проекте СБП в IT_One: инциденты L2, Grafana/Kibana, эскалации.',
          SOFTLINE_SLA_ARC,
        ];
    bundle.forbiddenOpening = ['DevOps/K8s/CI/CD как ядро профиля в opening'];
    bundle.risks.push('Подмена L2 title на DevOps');
    bundle.mitigations.push('STRUCTURE_BY_HUNT_TRACK l2l3 + anti-framing block');
  } else if (huntTrack === 'tam') {
    bundle.leadFacts = sbpL2HooksEnabled()
      ? [...TAM_LEAD_POOL]
      : ['На СБП вёл эскалации и статус для партнёров до восстановления сервиса.'];
    bundle.forbiddenOpening = ['CI/CD/K8s как ядро профиля; тикетный объём 7000+ в opening'];
    bundle.risks.push('TAM без статуса для заказчика → звучит как L1');
    bundle.mitigations.push('composeTamFramedLetter / TAM leadFacts');
  } else if (huntTrack === 'support_lead') {
    bundle.leadFacts = [
      SOFTLINE_SLA_ARC,
      'В банке держал качество разбора и эскалаций: полный пакет на L3, не сырой тикет.',
    ];
    bundle.forbiddenOpening = ['pet HH Ai / Playwright как lead'];
  }

  return bundle;
}

/**
 * @param {object} rec
 * @param {string} [huntTrack]
 */
export function buildLetterFramingPromptBlock(rec, huntTrack) {
  const b = resolveLetterFramingBundle(rec, { huntTrack });
  if (b.huntTrack === 'devops' || b.huntTrack === 'infra') {
    const lines = [
      'БЛОК FRAMING ROUTER (DevOps — обязательно):',
      `JD-крючок: ${b.jdHook}.`,
      'Opening (первые 2 предложения): платформа / CI/CD / автоматизация / секреты — НЕ helpdesk.',
      `Lead-факты (1–2): ${b.leadFacts.slice(0, 2).join(' · ')}`,
      `Хвост (макс. 1 фраза): ${b.tailFacts[0] || DEVOPS_TAIL}`,
      `Запрещено в opening: ${b.forbiddenOpening.join('; ')}.`,
    ];
    if (b.stackHit?.length) {
      lines.push(`Стек JD↔inventory: ${b.stackHit.slice(0, 4).join(', ')}.`);
    }
    return lines.join('\n');
  }
  if (!sbpL2HooksEnabled()) return '';
  if (b.huntTrack === 'l2l3') {
    return [
      'БЛОК FRAMING ROUTER (L2/L3 — обязательно):',
      'Opening: диагностика заявки/платежа (SQL, логи, API) или регистрация мерчанта — НЕ CI/CD/K8s как ядро.',
      `Lead-факты (1–2): ${b.leadFacts.slice(0, 2).join(' · ')}`,
      `Запрещено в opening: ${b.forbiddenOpening.join('; ')}.`,
      'Без hostname, ИНН, внутренних URL.',
    ].join('\n');
  }
  if (b.huntTrack === 'tam') {
    return [
      'БЛОК FRAMING ROUTER (TAM — обязательно):',
      'Opening: статус для заказчика/партнёра, эскалации до закрытия.',
      `Lead-факты (1–2): ${b.leadFacts.slice(0, 2).join(' · ')}`,
      `Запрещено в opening: ${b.forbiddenOpening.join('; ')}.`,
    ].join('\n');
  }
  return '';
}

/** Маркеры крючка JD в opening по category extractJdHook. */
const JD_HOOK_OPENING_MARKERS = {
  vault: /vault|секрет|ротац\w*\s+доступ/i,
  idp: /\bidp\b|identity|доступ|ротац/i,
  automation: /автоматизац|ефо|\befo\b|ci\/?cd|pipeline|пайплайн|релиз/i,
  platform: /платформ|sbertech|релиз|ci\/?cd|наблюдаем/i,
  sre: /\bsre\b|надёжн|алерт|восстановл|reliability/i,
  k8s: /kubernetes|\bk8s\b|docker|openshift|контейнер/i,
  cicd: /ci\/?cd|gitlab|jenkins|teamcity|пайплайн|pipeline|релиз/i,
  generic: /ci\/?cd|автоматизац|pipeline|пайплайн|vault|секрет|docker|kubernetes|\bk8s\b|platform|платформ|релиз|linux/i,
};

/**
 * L1.1: в первых предложениях нет крючка из title (Vault/IDP/…).
 * Soft: только devops/infra; откат HH_LETTER_JD_HOOK=0.
 * @param {object} rec
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, jdHookMissing?: boolean }}
 */
export function detectMissingJdHook(rec, text) {
  if (String(process.env.HH_LETTER_JD_HOOK || '1').trim() === '0') return { ok: true };
  const huntTrack = rec?.huntTrack || classifyVacancyHuntTrack(rec);
  if (huntTrack !== 'devops' && huntTrack !== 'infra') return { ok: true };

  const { category, hook } = extractJdHook(rec);
  const opening = letterOpeningBody(text);
  if (!opening || opening.length < 40) return { ok: true };

  const re = JD_HOOK_OPENING_MARKERS[category] || JD_HOOK_OPENING_MARKERS.generic;
  if (!re.test(opening)) {
    return {
      ok: false,
      jdHookMissing: true,
      reason:
        category === 'generic'
          ? 'DevOps: в opening нет CI/CD, автоматизации или Linux-контура (JD-hook)'
          : `DevOps: в opening нет крючка JD («${hook}») — добавьте маркер из заголовка в первые предложения`,
    };
  }
  return { ok: true };
}

/**
 * DevOps/infra opening с тикетным СБП (мерчант/SM/Toad) как lead.
 * Откат: HH_LETTER_BAN_MERCHANT_LEAD=0
 * @param {object} rec
 * @param {string} text
 */
export function detectMerchantLeadDevopsOpening(rec, text) {
  if (!merchantLeadBanEnabled()) return { ok: true };
  const huntTrack = rec?.huntTrack || classifyVacancyHuntTrack(rec);
  if (huntTrack !== 'devops' && huntTrack !== 'infra') return { ok: true };

  const opening = letterOpeningBody(text);
  if (!opening || opening.length < 40) return { ok: true };

  if (MERCHANT_LEAD_MARKERS.test(opening)) {
    return {
      ok: false,
      merchantLeadOpening: true,
      reason:
        'DevOps/infra: opening как тикетный СБП (мерчант/SM/Toad) — lead: CI/CD, релизы, автоматизация; мерчанты только хвост или l2l3',
    };
  }
  return { ok: true };
}

/**
 * DevOps opening звучит как L2 (инциденты lead без CI/платформы).
 * @param {object} rec
 * @param {string} text
 */
export function detectL2ToneDevopsOpening(rec, text) {
  const huntTrack = rec?.huntTrack || classifyVacancyHuntTrack(rec);
  // Infra/syseng: L2-tone в opening нормален; правило только для devops.
  if (huntTrack !== 'devops') return { ok: true };
  if (String(process.env.HH_LETTER_ALLOW_L2_OPENING || '').trim() === '1') return { ok: true };

  const opening = letterOpeningBody(text);
  if (!opening || opening.length < 40) return { ok: true };

  const hasL2 = L2_OPENING_MARKERS.test(opening);
  const hasDevops = DEVOPS_OPENING_MARKERS.test(opening);
  if (hasL2 && !hasDevops) {
    return {
      ok: false,
      reason:
        'DevOps: opening как L2 (инциденты/регламенты/Zabbix) — lead: CI/CD, автоматизация, платформа, секреты',
      l2ToneOpening: true,
    };
  }
  if (/postgres|zabbix|мониторинг/i.test(opening) && !DEVOPS_OPENING_MARKERS.test(opening)) {
    return {
      ok: false,
      reason: 'DevOps: opening только БД/мониторинг — добавьте CI/CD или автоматизацию в первые предложения',
      l2ToneOpening: true,
    };
  }
  return { ok: true };
}

/**
 * Детерминированный DevOps-first текст (regen без LLM).
 * @param {object} rec
 * @param {{ huntTrack?: string }} [opts]
 */
export function composeDevopsFramedLetter(rec, opts = {}) {
  const title = String(rec?.title || 'DevOps').trim();
  // Точки в названии компании («Газпромбанк. IT&Digital…») рвут opening на «предложения» → JD-hook не виден.
  const company = String(rec?.company || 'вашу команду')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const { hook, category } = extractJdHook(rec);
  const stackLine = jdStackSnippet(rec);
  const tail = shouldAppendDevopsTail(rec, category) ? ` ${DEVOPS_TAIL}` : '';

  const open = `Здравствуйте! Откликаюсь на «${title}»${company ? ` в ${company}` : ''}.`;
  // JD-hook сразу во 2-й фразе — иначе batch quality: «в opening нет крючка JD».
  const hookLine = `Близко к задаче: ${hook}.`;
  const body = bodyForCategory(rec, category, hook);
  const close = (() => {
    const co = String(company || '').trim();
    /** @type {Record<string, string>} */
    const closes = {
      vault: 'Готов обсудить контур секретов и доступов.',
      idp: 'Готов обсудить IDP и автоматизацию доступов.',
      automation: co
        ? `Готов обсудить, как автоматизация закрывает задачи ${co}.`
        : 'Готов обсудить приоритеты автоматизации.',
      platform: 'Готов обсудить платформенные сервисы и релизы.',
      sre: 'Готов обсудить надёжность и окна изменений.',
      k8s: 'Готов обсудить контейнерный контур и релизы без оверинженеринга.',
      cicd: 'Готов обсудить пайплайны и практики выката.',
      generic: co ? `Готов обсудить стек и приоритеты ${co}.` : 'Готов обсудить стек и приоритеты команды.',
    };
    return closes[category] || closes.generic;
  })();
  let letter = `${open} ${hookLine} ${body}${stackLine ? ` ${stackLine}` : ''}${tail} ${close}`
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Gate писем: минимум ~320 симв. — без шаблонного helpdesk-хвоста.
  if (letter.length < 320) {
    letter = `${letter.slice(0, -close.length).trim()} Опираюсь на Linux, Bash и понятные регламенты изменений вокруг релизов. ${close}`
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return letter;
}

/**
 * Детерминированный L2/L3 текст (ДПСИТ + СБП мерчанты).
 * @param {object} rec
 */
export function composeL2l3FramedLetter(rec) {
  const title = String(rec?.title || 'позицию').trim();
  const company = String(rec?.company || 'вашу команду').trim();
  if (!sbpL2HooksEnabled()) {
    return [
      `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
      `До июня 2026 на проекте СБП в IT_One вёл вторую линию: инциденты, логи и SQL, эскалации в разработку, мониторинг Grafana/Kibana.`,
      SOFTLINE_SLA_ARC,
      `Опираюсь на Linux, сетевую диагностику, Windows Server/AD и понятные регламенты изменений.`,
      `Готов обсудить формат смен и ваш стек.`,
    ].join(' ');
  }
  return [
    `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
    `На ДПСИТ сопровождал жизненный цикл кредитной заявки: находил в контуре, выяснял где зависла (SQL, логи), снимал по базе знаний или эскалировал на L3 с полным разбором.`,
    `На СБП вёл регистрацию мерчантов и разбор платежей/QR: SQL, Postman, логи — до закрытия или эскалации.`,
    SOFTLINE_SLA_ARC,
    `Готов обсудить формат смен и ваш стек.`,
  ].join(' ');
}

/**
 * @param {object} rec
 */
export function composeTamFramedLetter(rec) {
  const title = String(rec?.title || 'позицию').trim();
  const company = String(rec?.company || 'вашу команду').trim();
  return [
    `Здравствуйте! Откликаюсь на «${title}» в ${company}.`,
    `На СБП вёл прозрачный статус для партнёров: подключение мерчантов, эскалации до восстановления сервиса.`,
    `Проверял интеграции в Postman, фиксировал договорённости в Jira/Confluence.`,
    `Готов обсудить формат сопровождения и приоритеты заказчиков.`,
  ].join(' ');
}

/**
 * Оценка рисков framing для prep/логов.
 * @param {object} rec
 * @param {string} [letter]
 */
export function assessLetterFramingRisks(rec, letter = '') {
  const bundle = resolveLetterFramingBundle(rec);
  /** @type {string[]} */
  const activeRisks = [];

  if (letter) {
    const l2 = detectL2ToneDevopsOpening(rec, letter);
    if (!l2.ok) activeRisks.push(l2.reason || 'L2-tone opening');
    const jd = detectMissingJdHook(rec, letter);
    if (!jd.ok) activeRisks.push(jd.reason || 'JD-hook missing');
    const merch = detectMerchantLeadDevopsOpening(rec, letter);
    if (!merch.ok) activeRisks.push(merch.reason || 'merchant-lead opening');
  }

  return {
    bundle,
    pipelineRisks: bundle.risks,
    activeRisks,
    mitigations: bundle.mitigations,
    ok: !letter || activeRisks.length === 0,
  };
}
