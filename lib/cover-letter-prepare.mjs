/**
 * Подготовка утверждённого/батчевого письма: полировка, плейсхолдеры, мягкий «крючок» под роль.
 */

import { polishCoverLetter } from './cover-letter-polish.mjs';
import { prepareHumanText } from './ai-writing-audit.mjs';
import { assessLetterQuality, getRoleKeywordPattern } from './letter-quality.mjs';
import { injectCompanyNameIfNeeded } from './cover-letter-company-name.mjs';

const PLACEHOLDER_ROLE_RE = /\{\{\s*ROLE\s*\}\}/gi;

/** Одна фраза — если в письме нет маркеров роли, а в заголовке вакансии они есть. */
const ROLE_HOOKS = {
  data: 'По опыту близки задачи data engineering: SQL, ETL/DWH и сопровождение пайплайнов данных.',
  support:
    'Опыт L2/L3 поддержки прикладных систем, SLA и разбор инцидентов в highload-среде — в том числе связка с разработкой.',
  tam: 'Привык вести техническое сопровождение клиентов: от инцидентов до согласования изменений и прозрачной коммуникации.',
  devops:
    'По стеку близки Linux, контейнеры, CI/CD и мониторинг — могу усилить команду в эксплуатации и релизах.',
  dba: 'Опыт администрирования СУБД (PostgreSQL, MongoDB), резервное копирование, мониторинг и сопровождение в проде.',
  platform:
    'Близки платформенные задачи: Kubernetes/OpenShift, CI/CD, наблюдаемость и стабильность релизного контура.',
};

/**
 * @param {string} text
 * @param {object} rec
 */
function replaceRolePlaceholders(text, rec) {
  const title = String(rec?.title || 'эту позицию').trim();
  return String(text || '').replace(PLACEHOLDER_ROLE_RE, title);
}

/**
 * @param {string} text
 * @param {object} rec
 * @param {string} resumeRole
 */
function injectRoleHookIfNeeded(text, rec, resumeRole) {
  const role = String(resumeRole || '').toLowerCase();
  const roleRe = getRoleKeywordPattern(role);
  if (!roleRe || roleRe.test(text)) return text;

  const titleBlob = [
    rec?.title,
    rec?.geminiSummary,
    ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
  ]
    .filter(Boolean)
    .join(' ');
  if (!roleRe.test(titleBlob)) return text;

  const hook = ROLE_HOOKS[role];
  if (!hook || text.includes(hook.slice(0, 40))) return text;

  const trimmed = text.replace(/\s+$/, '');
  const sep = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${sep}${hook}`;
}

/**
 * Полировка + плейсхолдеры + опциональный крючок под роль (для батча и approve).
 * @param {object} rec
 * @param {string} letter
 * @param {string} resumeRole
 * @param {object} [prefs]
 * @param {{ injectHook?: boolean }} [opts]
 */
export function prepareCoverLetterForSend(rec, letter, resumeRole, prefs = {}, opts = {}) {
  const injectHook = opts.injectHook !== false;
  let t = replaceRolePlaceholders(letter, rec);
  t = polishCoverLetter(t);
  const human = prepareHumanText(t, { prefs });
  t = human.text;
  if (injectHook) t = injectRoleHookIfNeeded(t, rec, resumeRole);
  t = injectCompanyNameIfNeeded(t, rec);
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Первый вариант из списка, проходящий assessLetterQuality после prepare.
 * @param {string[]} variants
 * @param {object} rec
 * @param {string} resumeRole
 * @param {object} [prefs]
 */
export function pickBestPreparedVariant(variants, rec, resumeRole, prefs = {}) {
  const list = Array.isArray(variants) ? variants.filter(Boolean) : [];
  if (!list.length) return '';

  let best = '';
  let bestScore = -1;
  for (const raw of list) {
    const prepared = prepareCoverLetterForSend(rec, raw, resumeRole, prefs);
    const q = assessLetterQuality(rec, prepared, resumeRole, prefs);
    const len = prepared.length;
    const score = (q.pass ? 100 : 0) + Math.min(20, Math.floor(len / 80));
    if (q.pass && score > bestScore) {
      bestScore = score;
      best = prepared;
    }
  }
  if (best) return best;
  return prepareCoverLetterForSend(rec, list[0], resumeRole, prefs);
}
