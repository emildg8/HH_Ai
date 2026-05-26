/**
 * Выбор резюме по тому, что hh.ru реально показывает в форме отклика.
 * Сначала список работодателя → scoring по config/resume-routing.json → radio.check().
 */

import { loadResumeRoutingConfig } from './resume-routing.mjs';
import {
  listResponseFormResumes,
  readCurrentResponseResumeHash,
  readCurrentResponseResumeTitle,
  titleMatchesPreferred,
  selectResumeRadioFromList,
  reloadVacancyResponseWithResume,
} from './hh-resume-upload.mjs';

const MIN_SCORE = 30;
const MIN_FALLBACK_SCORE = 40;

/**
 * @param {Array<{ title: string, hash: string }>} list
 */
export function dedupeEmployerResumes(list) {
  const seen = new Set();
  return list.filter((x) => {
    const key = x.hash || x.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {{ titleOnHh?: string, titleMatch?: string, hash?: string }} entry
 * @param {{ title: string, hash: string }} item
 */
export function resumeEntryMatchesItem(entry, item) {
  if (!entry || !item) return false;
  const hash = String(entry.hash || '').trim();
  if (hash && item.hash === hash) return true;
  const match = String(entry.titleMatch || entry.titleOnHh || '').trim();
  if (match && titleMatchesPreferred(item.title, match)) return true;
  if (entry.titleOnHh && titleMatchesPreferred(item.title, entry.titleOnHh)) return true;
  return false;
}

/**
 * @param {Array<{ title: string, hash: string }>} available
 * @param {string} idealRole
 */
export function pickBestFromEmployerList(available, idealRole) {
  const cfg = loadResumeRoutingConfig();
  const role = String(idealRole || cfg.defaultRole || 'devops');
  const idealEntry = cfg.resumes[role] || cfg.resumes[cfg.defaultRole];
  const idealInList = Boolean(idealEntry && available.some((a) => resumeEntryMatchesItem(idealEntry, a)));

  /** @type {{ title: string, hash: string, role: string, label: string, score: number } | null} */
  let pick = null;
  let bestScore = 0;

  for (const item of available) {
    for (const [r, entry] of Object.entries(cfg.resumes || {})) {
      let score = 0;
      if (item.hash && entry.hash && item.hash === entry.hash) score += 60;
      if (titleMatchesPreferred(item.title, entry.titleMatch)) score += 45;
      if (titleMatchesPreferred(item.title, entry.titleOnHh)) score += 40;
      if (r === role) score += 20;
      else if (r === cfg.defaultRole) score += 5;
      if (score > bestScore) {
        bestScore = score;
        pick = {
          title: item.title,
          hash: item.hash,
          role: r,
          label: String(entry.label || r),
          score,
        };
      }
    }
  }

  return { pick, bestScore, idealInList, idealRole: role, idealEntry };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ title: string, hash: string }} target
 */
async function currentMatchesTarget(page, target) {
  const curHash = await readCurrentResponseResumeHash(page);
  const curTitle = await readCurrentResponseResumeTitle(page);
  if (target.hash && curHash === target.hash) return true;
  if (titleMatchesPreferred(curTitle, target.title)) return true;
  return false;
}

/**
 * Единая точка выбора резюме на форме отклика.
 * @param {import('playwright').Page} page
 * @param {{
 *   idealRole?: string,
 *   preferredTitle?: string,
 *   resumeHash?: string,
 *   vacancyId?: string,
 *   log?: (msg: string) => void,
 * }} opts
 */
export async function pickAndApplyEmployerResume(page, opts = {}) {
  const log = opts.log || (() => {});
  const cfg = loadResumeRoutingConfig();
  const idealRole =
    String(opts.idealRole || '').trim() ||
    (opts.preferredTitle ? inferRoleFromTitle(opts.preferredTitle, cfg) : '') ||
    cfg.defaultRole ||
    'devops';

  let available = dedupeEmployerResumes(await listResponseFormResumes(page));
  if (!available.length) {
    log('[hh-resume] Список резюме на форме пуст — дождитесь загрузки или откройте «Изменить резюме»');
    return {
      ok: false,
      reason: 'empty-list',
      preferred: opts.preferredTitle || '',
      availableResumes: [],
    };
  }

  const names = available.map((a) => a.title || a.hash.slice(0, 8)).join(' · ');
  log(`[hh-resume] hh.ru предлагает (${available.length}): ${names}`);

  const decision = pickBestFromEmployerList(available, idealRole);
  const minScore = decision.idealInList ? MIN_SCORE : MIN_FALLBACK_SCORE;

  if (!decision.pick || decision.bestScore < minScore) {
    const idealLabel = decision.idealEntry?.titleOnHh || decision.idealRole;
    if (available.length === 1 && available[0].title) {
      const only = available[0];
      log(
        `[hh-resume] «${idealLabel}» недоступно — для вакансии единственное резюме на hh.ru: «${only.title}»`
      );
      const picked = await selectResumeRadioFromList(page, only.title, only.hash);
      if (picked || (await currentMatchesTarget(page, only))) {
        return {
          ok: true,
          title: only.title,
          hash: only.hash,
          preferred: idealLabel,
          idealRole: decision.idealRole,
          pickedRole: 'fallback-single',
          fallbackUsed: true,
          availableResumes: available,
        };
      }
    }
    log(
      `[hh-resume] Для вакансии нужно «${idealLabel}», но в списке hh.ru нет подходящего резюме. ` +
        'Пропуск или отклик вручную другим CV.'
    );
    return {
      ok: false,
      notInEmployerList: true,
      title: await readCurrentResponseResumeTitle(page),
      hash: await readCurrentResponseResumeHash(page),
      preferred: decision.idealEntry?.titleOnHh || '',
      idealRole: decision.idealRole,
      availableResumes: available,
    };
  }

  const target = decision.pick;
  const idealLabel = decision.idealEntry?.titleOnHh || decision.idealRole;

  if (!decision.idealInList && target.role !== decision.idealRole) {
    log(
      `[hh-resume] «${idealLabel}» недоступно для этой вакансии на hh.ru → ` +
        `берём из списка: «${target.title}» (${target.label})`
    );
  } else if (!decision.idealInList) {
    log(`[hh-resume] Точного «${idealLabel}» нет; ближайшее в списке: «${target.title}»`);
  }

  if (!(await currentMatchesTarget(page, target))) {
    const picked = await selectResumeRadioFromList(page, target.title, target.hash);
    if (!picked) {
      log(`[hh-resume] Не удалось нажать radio для «${target.title}»`);
    }
  }

  let afterTitle = await readCurrentResponseResumeTitle(page);
  let afterHash = await readCurrentResponseResumeHash(page);
  let ok = await currentMatchesTarget(page, target);

  if (
    !ok &&
    opts.vacancyId &&
    target.hash &&
    decision.idealInList &&
    available.some((a) => a.hash === target.hash)
  ) {
    await reloadVacancyResponseWithResume(page, {
      vacancyId: opts.vacancyId,
      resumeHash: target.hash,
      log,
    });
    available = dedupeEmployerResumes(await listResponseFormResumes(page));
    await selectResumeRadioFromList(page, target.title, target.hash);
    afterTitle = await readCurrentResponseResumeTitle(page);
    afterHash = await readCurrentResponseResumeHash(page);
    ok = await currentMatchesTarget(page, target);
  }

  if (ok) {
    log(`[hh-resume] В форме: «${afterTitle || target.title}» (${target.label}, role=${target.role})`);
    return {
      ok: true,
      title: afterTitle || target.title,
      hash: afterHash || target.hash,
      preferred: idealLabel,
      idealRole: decision.idealRole,
      pickedRole: target.role,
      fallbackUsed: !decision.idealInList,
      availableResumes: available,
    };
  }

  log(
    `[hh-resume] После выбора в форме: «${afterTitle || '—'}», нужно было «${target.title}». ` +
      'Проверьте hash в config/resume-routing.json (npm run devops:list-resumes).'
  );
  return {
    ok: false,
    title: afterTitle,
    hash: afterHash,
    preferred: idealLabel,
    idealRole: decision.idealRole,
    pickedRole: target.role,
    resumeMismatch: true,
    notInEmployerList: !available.some((a) => resumeEntryMatchesItem(decision.idealEntry, a)),
    availableResumes: available,
  };
}

/**
 * @param {string} preferredTitle
 * @param {ReturnType<typeof loadResumeRoutingConfig>} cfg
 */
function inferRoleFromTitle(preferredTitle, cfg) {
  const t = String(preferredTitle || '').toLowerCase();
  for (const [role, entry] of Object.entries(cfg.resumes || {})) {
    if (titleMatchesPreferred(t, entry.titleMatch) || titleMatchesPreferred(t, entry.titleOnHh)) {
      return role;
    }
  }
  return cfg.defaultRole || 'devops';
}
