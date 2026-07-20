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
  { re: /автоматизац|ЕФО|\befo\b/i, hook: 'автоматизация контуров и CI/CD', category: 'automation' },
  { re: /sbertech|sber\s*tech/i, hook: 'платформенная эксплуатация и стабильность релизов', category: 'platform' },
  { re: /\bsre\b|reliability|надёжност/i, hook: 'надёжность сервисов, алерты и окна изменений', category: 'sre' },
  { re: /kubernetes|\bk8s\b/i, hook: 'сопровождение Kubernetes и автоматизация релизов', category: 'k8s' },
  { re: /ci\/?cd|gitlab|jenkins|teamcity/i, hook: 'CI/CD и автоматизация деплоя', category: 'cicd' },
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
  const blob = `${rec?.title || ''} ${rec?.company || ''}`;
  for (const rule of JD_HOOK_RULES) {
    if (rule.re.test(blob)) {
      return { hook: rule.hook, category: rule.category };
    }
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
  if (huntTrack !== 'devops' && huntTrack !== 'infra') return { ok: true };
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
  const company = String(rec?.company || 'вашу команду').trim();
  const { hook, category } = extractJdHook(rec);

  const open = `Здравствуйте! Откликаюсь на «${title}»${company ? ` в ${company}` : ''}.`;

  /** @type {Record<string, string>} */
  const bodyByCategory = {
    vault: `До июня 2026 в IT_One настраивал доступы и ротацию секретов на Linux-контуре, писал Bash под автоматизацию регламентов, сопровождал релизы с мониторингом. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    idp: `До июня 2026 в IT_One настраивал доступы и ротацию секретов на Linux, писал Bash под автоматизацию, сопровождал релизы с Grafana/Kibana на рабочем контуре. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    automation: `До июня 2026 в IT_One писал Bash и регламенты на Linux, сопровождал релизы и мониторинг на рабочем контуре. В собственных проектах собрал пайплайны CI на 2+ сервисах. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    platform: `До июня 2026 в IT_One сопровождал релизы и CI/CD на Linux-контуре команды, Grafana/Kibana и Bash-автоматизацию; в Softline — внутренние платформенные сервисы. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    sre: `До июня 2026 в IT_One сопровождал релизы на контурах СБП: Linux, Grafana/Kibana, восстановление сервиса и регламенты изменений. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    k8s: `До июня 2026 в IT_One сопровождал релизы и эксплуатацию Docker/OpenShift на Linux; писал Bash под автоматизацию. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    cicd: `До июня 2026 в IT_One сопровождал релизы и CI/CD на Linux-контуре: Bash, Grafana/Kibana, регламенты команды. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
    generic: `До июня 2026 в IT_One сопровождал релизы и Bash-автоматизацию на Linux; в собственных проектах собрал пайплайны CI. Близко к задаче: ${hook}. ${DEVOPS_TAIL}`,
  };

  const body = bodyByCategory[category] || bodyByCategory.generic;
  const close = 'Готов обсудить стек и приоритеты команды.';
  return `${open} ${body} ${close}`.replace(/\s{2,}/g, ' ').trim();
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
