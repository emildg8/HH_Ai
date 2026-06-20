/**
 * Employer RAG — контекст dossier работодателя для промптов LLM.
 */

import { getEmployerDossier } from './employer-dossier.mjs';
import { loadPreferences } from './preferences.mjs';

/**
 * @param {object | null | undefined} dossier
 * @param {{ maxChars?: number }} [opts]
 */
export function buildEmployerRagBlock(dossier, opts = {}) {
  if (!dossier) return '';
  const live = dossier.live || dossier.stored?.signals || {};
  const applied = Number(live.applied) || 0;
  if (!applied) return '';

  const invited = Number(live.invited) || 0;
  const ghost = Number(live.ghost) || 0;
  const declined = Number(live.declined) || 0;
  const score = Number(dossier.score) || 0;
  const invitePct = Math.round((invited / applied) * 100);

  /** @type {string[]} */
  const lines = [
    `РАБОТОДАТЕЛЬ «${dossier.company}» (HR score ${score}/100):`,
    `История: откликов ${applied}, приглашений ${invited} (${invitePct}%), тишина ${ghost}, отказы ${declined}.`,
  ];

  for (const hint of (dossier.hints || []).slice(0, 3)) {
    if (hint?.text) lines.push(`• ${hint.text}`);
  }

  if (invitePct >= 50 || invited >= 1) {
    lines.push(
      'Для письма: уверенный тон, конкретика из резюме — у работодателя уже был позитивный исход.'
    );
  } else if (applied >= 2 && ghost >= invited && ghost >= 2) {
    lines.push(
      'Для письма: коротко, сильный hook в первой строке, без воды — часто «тишина» после отклика.'
    );
  } else if (declined >= 1 && invited === 0) {
    lines.push('Для письма: другой угол и акценты, не generic DevOps-шаблон — раньше был отказ.');
  } else if (applied === 1) {
    lines.push('Для письма: первая попытка — опирайся на JD и факты резюме, без домыслов о компании.');
  }

  const maxChars = Math.max(200, Number(opts.maxChars) || 1400);
  const block = `\n${lines.join('\n')}\n`;
  return block.length > maxChars ? `${block.slice(0, maxChars - 1)}…\n` : block;
}

/**
 * @param {object} [prefs]
 */
function isEmployerRagEnabled(prefs) {
  const p = prefs || loadPreferences();
  const ai = p?.applyIntelligence;
  if (ai?.employerRagEnabled === false) return false;
  if (ai?.knowledgeStoreEnabled === false) return false;
  return true;
}

/**
 * @param {string | null | undefined} company
 * @param {{ prefs?: object, records?: object[], storeOpts?: object, maxChars?: number }} [opts]
 */
export function loadEmployerRagBlock(company, opts = {}) {
  const name = String(company || '').trim();
  if (!name || name === '—') return '';

  const prefs = opts.prefs || loadPreferences();
  if (!isEmployerRagEnabled(prefs)) return '';

  try {
    const dossier = getEmployerDossier(name, {
      records: opts.records,
      prefs,
      storeOpts: opts.storeOpts,
    });
    return buildEmployerRagBlock(dossier, opts);
  } catch {
    return '';
  }
}

/**
 * @param {object | null | undefined} record
 * @param {object} [opts]
 */
export function loadEmployerRagBlockForRecord(record, opts = {}) {
  return loadEmployerRagBlock(record?.company, opts);
}
