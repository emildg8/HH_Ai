/**
 * Letter framing router — M0 × huntTrack × JD hook.
 * Разводит достижения кандидата и требования вакансии (SESSION 20.07).
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

const DEVOPS_LEAD_POOL = [
  'До июня 2026 в IT_One сопровождал релизы и CI/CD на контурах СБП: Linux, Docker, Grafana/Kibana, Bash-автоматизация.',
  'До июня 2026 в IT_One настраивал доступы, ротацию секретов и регламенты Linux под платформенные задачи.',
  'В собственных проектах собрал пайплайны CI и gate перед откликом (Playwright, автоматизация рутины).',
];

const DEVOPS_TAIL =
  'PostgreSQL и мониторинг — часть эксплуатации, не отдельная DBA-роль или helpdesk.';

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
    ];
    bundle.risks.push('Hotfix без router → L2-tone (инциденты lead)');
    bundle.mitigations.push('detectL2ToneDevopsOpening + regen через composeDevopsFramedLetter');
    if (roleTier === 'R2') {
      bundle.risks.push('R2: title L2 — не подменять на DevOps в opening');
      bundle.mitigations.push('Зеркалить title из JD (M0 anti-pattern)');
    }
    if (jdCategory === 'generic' && !stackHit.length) {
      bundle.risks.push('Слабый JD-hook — письмо может стать generic');
      bundle.mitigations.push('Явный крючок из title в первом предложении');
    }
  } else if (huntTrack === 'l2l3') {
    bundle.leadFacts = [
      'До июня 2026 на проекте СБП в IT_One: инциденты L2, Grafana/Kibana, эскалации.',
      SOFTLINE_SLA_ARC,
    ];
    bundle.forbiddenOpening = ['DevOps/K8s/CI/CD как ядро профиля в opening'];
    bundle.risks.push('Подмена L2 title на DevOps');
    bundle.mitigations.push('STRUCTURE_BY_HUNT_TRACK l2l3 + anti-framing block');
  }

  return bundle;
}

/**
 * @param {object} rec
 * @param {string} [huntTrack]
 */
export function buildLetterFramingPromptBlock(rec, huntTrack) {
  const b = resolveLetterFramingBundle(rec, { huntTrack });
  if (b.huntTrack !== 'devops' && b.huntTrack !== 'infra') return '';
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
  }

  return {
    bundle,
    pipelineRisks: bundle.risks,
    activeRisks,
    mitigations: bundle.mitigations,
    ok: !letter || activeRisks.length === 0,
  };
}
