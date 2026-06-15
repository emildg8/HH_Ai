/** Queue Cards (QC v1): краткий и средний вид → полная карточка в модалке. */

import { openVacancyDetail } from './vacancy-detail.mjs';
import { buildCardStatusChips, vacancyQuestionnairePending } from './card-status.mjs';
import { buildScoreHumanHint } from './score-human-hint.mjs';
import { buildSourceBadgeFragment } from './source-badges.mjs';
import { tierShortLabel } from './dashboard-copy-ru.mjs';

const tileTpl = document.getElementById('card-tile-tpl');

const HINT_TAGS = {
  risk: 'Риск',
  questionnaire: 'Анкета',
  invited: 'Приглашение',
  letter: 'Письмо',
  'letter-quality': 'Письмо',
  summary: 'Суть',
  resume: 'Резюме',
  score: 'Балл',
  'off-target': 'Вне профиля',
  neutral: 'Подсказка',
};

/**
 * @param {'tile-compact'|'tile-medium'} mode
 */
export function isTileBrowseMode(mode) {
  return mode === 'tile-compact' || mode === 'tile-medium';
}

export function currentBrowseMode() {
  const layout = document.documentElement.dataset.cardLayout || 'expanded';
  if (layout === 'tile-compact') return 'tile-compact';
  if (layout === 'tile-medium') return 'tile-medium';
  return null;
}

/** @param {string} text @param {number} maxLen */
function clipText(text, maxLen = 180) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
}

/** @param {string} text */
function firstSentence(text, maxLen = 200) {
  const t = String(text || '').trim();
  if (!t) return '';
  const m = t.match(/^[^.!?…]+[.!?…]?/);
  return clipText(m ? m[0] : t, maxLen);
}

/** @param {unknown} overall */
function formatScoreDisplay(overall) {
  if (overall == null || overall === '') return '—';
  const n = Number(overall);
  if (!Number.isFinite(n)) return String(overall);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** @param {object} item */
function formatSalarySnippet(item) {
  if (item.salaryEstimate?.ok) {
    return `≈${item.salaryEstimate.minUsd}–${item.salaryEstimate.maxUsd} USD`;
  }
  const raw = String(item.salaryRaw || '').trim();
  return raw ? clipText(raw, 48) : '';
}

/** @param {string} kind */
function hintPriority(kind) {
  if (['risk', 'questionnaire', 'invited', 'off-target', 'letter', 'letter-quality'].includes(kind))
    return 'high';
  if (['summary', 'resume', 'score'].includes(kind)) return 'mid';
  return 'low';
}

/**
 * Подсказка для среднего вида: длиннее текста, без пустых фраз.
 * @param {object} item
 * @param {number} scoreThreshold
 */
export function buildMediumHint(item, scoreThreshold = 50) {
  const hint = buildTileHint(item, scoreThreshold);
  if (hint.kind === 'letter' && item.coverLetter?.approvedText) {
    hint.text = clipText(item.coverLetter.approvedText, 200);
  } else if (hint.kind === 'letter' && item.coverLetter?.draftText) {
    hint.text = clipText(item.coverLetter.draftText, 180);
  } else if (hint.kind === 'summary') {
    const summary = firstSentence(item.geminiSummary, 200);
    if (summary) hint.text = summary;
    else if (/Подходит по баллу/i.test(hint.text)) return null;
  } else if (hint.kind === 'neutral') {
    return null;
  }
  return hint;
}

/**
 * @param {HTMLElement} metaEl
 * @param {object} item
 * @param {'tile-compact'|'tile-medium'} mode
 */
function renderTileMeta(metaEl, item, mode) {
  if (!metaEl) return;
  const metaText = formatTileMeta(item, mode);
  if (mode === 'tile-compact') {
    metaEl.textContent = metaText;
    metaEl.hidden = !metaText;
    return;
  }

  const company = item.company ? String(item.company).trim() : '';
  const salary = formatSalarySnippet(item);
  const resume = item.resumeRouting?.label
    ? clipText(String(item.resumeRouting.label).replace(/^Резюме:\s*/i, ''), 32)
    : '';

  metaEl.hidden = false;
  metaEl.replaceChildren(buildSourceBadgeFragment(item));
  const parts = [];
  if (company) parts.push({ cls: 'card-tile__meta-company', text: company });
  if (salary) parts.push({ cls: 'card-tile__meta-salary', text: salary });
  if (resume) parts.push({ cls: 'card-tile__meta-resume', text: resume });
  if (!parts.length) return;

  const detail = document.createElement('span');
  detail.className = 'card-tile__meta-detail';
  detail.replaceChildren(
    ...parts.flatMap((part, i) => {
      const nodes = [];
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'card-tile__meta-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '·';
        nodes.push(sep);
      }
      const span = document.createElement('span');
      span.className = `card-tile__meta-part ${part.cls}`;
      span.textContent = part.text;
      nodes.push(span);
      return nodes;
    })
  );
  metaEl.appendChild(detail);
}

/**
 * @param {object} item
 * @param {'tile-compact'|'tile-medium'} mode
 */
function formatTileMeta(item, mode) {
  const src = item.source && item.source !== 'hh' ? String(item.source) : '';
  const tier = item.sourceQualityTier ? tierShortLabel(item.sourceQualityTier) : '';
  const applyTag =
    item.applyMode === 'ats_form' ? 'сайт' : item.applyMode === 'manual_link' ? 'ручн.' : '';
  const srcPrefix = [src, tier, applyTag].filter(Boolean).join(' ');
  const prefix = srcPrefix ? `[${srcPrefix}] ` : '';
  const company = item.company ? String(item.company).trim() : '';
  const salary = formatSalarySnippet(item);
  if (mode === 'tile-compact') {
    if (company && salary) return `${prefix}${company} · ${salary}`;
    return prefix + (company || salary || '');
  }
  const parts = [company, salary].filter(Boolean);
  return parts.join(' · ');
}

/**
 * @param {object} item
 * @param {number} scoreThreshold
 */
export function buildTileHint(item, scoreThreshold = 50) {
  const risks = firstSentence(item.geminiRisks, 140);
  const summary = firstSentence(item.geminiSummary, 160);
  const cl = item.coverLetter;
  const s = Number(item.scoreOverall ?? item.geminiScore ?? 0) || 0;

  if (item.targeting?.eligible === false) {
    const why = clipText(
      item.targeting?.skipReason || item.skipReason || 'Вне целевого профиля',
      140
    );
    return { kind: 'off-target', text: why };
  }
  if (item.status === 'rejected') {
    const hint = buildScoreHumanHint(item);
    if (hint) return { kind: 'off-target', text: hint };
  }
  if (item.readiness?.targetingEligible && item.readiness?.score < 55) {
    const parts = [];
    if (item.letterQuality?.pass === false) {
      parts.push(`письмо: ${clipText(item.letterQuality?.reason || 'проверка', 60)}`);
    } else if (item.readiness?.parts?.letter < 12) {
      parts.push('нет утверждённого письма');
    }
    if (parts.length) {
      return {
        kind: 'letter-quality',
        text: `Готовность ${item.readiness.score}% — ${parts.join('; ')}`,
      };
    }
  }
  if (risks && item.targeting?.eligible !== false) {
    return { kind: 'risk', text: risks };
  }
  if (vacancyQuestionnairePending(item)) {
    return { kind: 'questionnaire', text: 'Требуется анкета работодателя' };
  }
  const l10 = item.letterQuality?.letterScore10 ?? item.readiness?.letterScore10;
  if (item.letterQuality?.fixable) {
    return {
      kind: 'letter-quality',
      text: Number.isFinite(l10)
        ? `Письмо ${l10}/10 — можно улучшить кнопкой «Подготовить»`
        : 'Письмо: автоподготовка (полировка / роль)',
    };
  }
  if (item.letterQuality?.pass && Number.isFinite(l10) && l10 >= 8) {
    return {
      kind: 'letter',
      text: `Письмо ${l10}/10 — готово к батчу`,
    };
  }
  if (item.letterQuality?.pass === false) {
    const scorePart = Number.isFinite(l10) ? `${l10}/10 · ` : '';
    return {
      kind: 'letter-quality',
      text: `Письмо ${scorePart}${clipText(item.letterQuality?.reason || 'нужна проверка', 120)}`,
    };
  }
  if (cl?.status === 'approved' && cl?.approvedText) {
    return { kind: 'letter', text: clipText(cl.approvedText, 120) || 'Письмо подготовлено' };
  }
  if (cl?.status === 'draft' || cl?.status === 'pending') {
    return { kind: 'letter', text: 'Есть черновик письма — проверьте перед откликом' };
  }
  if (item.hhApply?.hhSiteState === 'invited') {
    return { kind: 'invited', text: 'Приглашение от работодателя' };
  }
  if (summary) {
    return { kind: 'summary', text: summary };
  }
  if (item.resumeRouting?.label) {
    return {
      kind: 'resume',
      text: clipText(item.resumeRouting.label.replace(/^Резюме:\s*/i, ''), 80),
    };
  }
  if (s > 0 && s < scoreThreshold) {
    return { kind: 'score', text: `Балл ${formatScoreDisplay(s)} — ниже порога ${scoreThreshold}` };
  }
  if (s >= scoreThreshold) {
    return { kind: 'summary', text: 'Подходит по баллу — откройте для письма и отклика' };
  }
  return { kind: 'neutral', text: 'Откройте карточку для описания и действий' };
}

/** @param {ReturnType<typeof buildCardStatusChips>} chips */
function primaryStatusLabel(chips) {
  if (!chips.length) return null;
  const c = chips[0];
  const short = {
    questionnaire: 'анкета',
    invited: 'приглашение',
    applied: 'отклик',
    letter: 'письмо',
    'letter-edit': 'письмо',
    declined: 'отказ',
    viewed: 'просмотр',
    awaiting: 'ждём',
    deferred: 'отложено',
    'off-target': 'нецелевая',
    resume: 'резюме',
    chat: 'ответ',
  };
  return {
    label: short[c.kind] || c.label,
    kind: c.kind,
    warn: c.warn,
  };
}

/**
 * @param {HTMLElement | null} badgeEl
 * @param {HTMLElement | null} chipsHost
 * @param {HTMLElement | null} footEl
 * @param {object} item
 * @param {'tile-compact'|'tile-medium'} mode
 */
function renderTileStatus(badgeEl, chipsHost, footEl, item, mode) {
  const chips = buildCardStatusChips(item);
  const primary = primaryStatusLabel(chips);

  if (mode === 'tile-compact' || mode === 'tile-medium') {
    if (footEl) footEl.hidden = true;
    if (chipsHost) chipsHost.hidden = true;
    if (!badgeEl) return;
    if (!primary) {
      badgeEl.hidden = true;
      badgeEl.textContent = '';
      return;
    }
    badgeEl.textContent = primary.label;
    badgeEl.className = `card-tile__badge card-tile__badge--${primary.kind}${
      primary.warn ? ' card-tile__badge--warn' : ''
    }`;
    badgeEl.hidden = false;
    return;
  }

  if (badgeEl) badgeEl.hidden = true;
  if (footEl) footEl.hidden = false;
  if (!chipsHost) return;
  const shown = chips.slice(0, 2);
  chipsHost.replaceChildren(
    ...shown.map((c) => {
      const span = document.createElement('span');
      span.className = `status-chip status-chip--${c.kind}${c.warn ? ' status-chip--warn' : ''}`;
      span.textContent = c.label;
      return span;
    })
  );
  chipsHost.hidden = shown.length === 0;
}

/**
 * @param {object} item
 * @param {number} scoreThreshold
 * @param {(item: object, opts?: object) => HTMLElement} renderFullCard
 * @param {(node: HTMLElement, item: object) => void} bindDismiss
 * @param {(node: HTMLElement, item: object) => void} [bindCardDecision]
 */
export function renderCardTile(item, scoreThreshold, renderFullCard, bindDismiss, bindCardDecision) {
  const mode = currentBrowseMode() || 'tile-compact';
  const node = tileTpl.content.firstElementChild.cloneNode(true);
  node.dataset.recordId = item.id;
  node.classList.add(mode === 'tile-medium' ? 'card-tile--medium' : 'card-tile--compact');

  const s = Number(item.scoreOverall ?? item.geminiScore ?? 0) || 0;
  if (s > 0) {
    if (s >= scoreThreshold) node.classList.add('card-tile--score-high');
    else node.classList.add('card-tile--score-low');
  } else {
    node.classList.add('card-tile--no-score');
  }

  if (item.targeting?.eligible === false) node.classList.add('card-tile--off-target');
  if (item.hhApply?.hhSiteState === 'invited') node.classList.add('card-tile--invited');
  else if (vacancyQuestionnairePending(item)) node.classList.add('card-tile--questionnaire');

  const title = item.title || item.url || 'Вакансия';
  const overall = item.scoreOverall ?? item.geminiScore;
  const scoreText = formatScoreDisplay(overall);
  const l10 = item.letterQuality?.letterScore10 ?? item.readiness?.letterScore10;

  const scoreEl = node.querySelector('.card-tile__score');
  if (scoreEl) {
    scoreEl.textContent = scoreText;
    if (Number.isFinite(l10)) {
      scoreEl.dataset.letter = String(l10);
      if (l10 < 6) scoreEl.classList.add('card-tile__score--letter-weak');
      else if (l10 >= 8) scoreEl.classList.add('card-tile__score--letter-strong');
    } else delete scoreEl.dataset.letter;
  }
  const ring = node.querySelector('.card-tile__score-ring');
  if (ring) {
    const r = item.readiness?.score;
    const letterSuffix = Number.isFinite(l10) ? ` · письмо ${l10}/10` : '';
    const readySuffix = Number.isFinite(r) ? ` · готовность ${r}%` : '';
    const scoreLabel = (s > 0 ? `Балл ${scoreText}` : 'Без оценки') + letterSuffix + readySuffix;
    ring.title = scoreLabel;
    ring.setAttribute('aria-label', scoreLabel);
    if (Number.isFinite(r) && r < 55) node.classList.add('card-tile--readiness-low');
    else if (Number.isFinite(r) && r >= 75) node.classList.add('card-tile--readiness-ok');
    if (Number.isFinite(l10) && l10 < 6) node.classList.add('card-tile--letter-weak');
    else if (Number.isFinite(l10) && l10 >= 8) node.classList.add('card-tile--letter-strong');
  }

  const titleEl = node.querySelector('.card-tile__title');
  titleEl.textContent = title;

  const hitBtn = node.querySelector('.card-tile__hit');
  if (hitBtn) {
    hitBtn.setAttribute('aria-label', `Открыть: ${clipText(title, 72)}`);
  }

  const metaEl = node.querySelector('.card-tile__meta');
  renderTileMeta(metaEl, item, mode);

  const hintEl = node.querySelector('.card-tile__hint');
  const hintTagEl = node.querySelector('.card-tile__hint-tag');
  const hintTextEl = node.querySelector('.card-tile__hint-text');
  if (mode === 'tile-medium' && hintEl) {
    const hint = buildMediumHint(item, scoreThreshold);
    if (!hint) {
      hintEl.hidden = true;
      delete hintEl.dataset.hintKind;
      hintEl.classList.remove('card-tile__hint--high', 'card-tile__hint--mid');
      if (hintTagEl) {
        hintTagEl.hidden = true;
        hintTagEl.textContent = '';
      }
      if (hintTextEl) hintTextEl.textContent = '';
    } else {
      const priority = hintPriority(hint.kind);
      hintEl.hidden = false;
      hintEl.dataset.hintKind = hint.kind;
      hintEl.classList.toggle('card-tile__hint--high', priority === 'high');
      hintEl.classList.toggle('card-tile__hint--mid', priority === 'mid');
      const tag = HINT_TAGS[hint.kind] || '';
      if (hintTagEl) {
        hintTagEl.textContent = tag;
        hintTagEl.hidden = !tag;
      }
      if (hintTextEl) hintTextEl.textContent = hint.text;
      else hintEl.textContent = hint.text;
      hintEl.title = hint.text;
    }
  } else if (hintEl) {
    hintEl.hidden = true;
    delete hintEl.dataset.hintKind;
    if (hintTagEl) {
      hintTagEl.hidden = true;
      hintTagEl.textContent = '';
    }
    if (hintTextEl) hintTextEl.textContent = '';
  }

  const footEl = node.querySelector('.card-tile__foot');
  renderTileStatus(
    node.querySelector('.card-tile__badge'),
    footEl?.querySelector('.card-tile__status') || node.querySelector('.card-tile__status'),
    footEl,
    item,
    mode
  );

  const hhLink = node.querySelector('.card-tile__hh');
  if (item.url) {
    hhLink.href = item.url;
    hhLink.hidden = false;
  } else {
    hhLink.hidden = true;
  }

  bindDismiss(node, item);

  const approveBtn = node.querySelector('.btn-tile-approve');
  const rejectBtn = node.querySelector('.btn-tile-reject');
  if (mode === 'tile-medium' && item.status === 'pending') {
    if (approveBtn) approveBtn.hidden = false;
    if (rejectBtn) rejectBtn.hidden = false;
    bindCardDecision?.(node, item);
  } else {
    approveBtn?.remove();
    rejectBtn?.remove();
  }

  const openDetail = () => openVacancyDetail(item, renderFullCard);
  const titleText = node.querySelector('.card-tile__title')?.textContent?.trim() || 'Вакансия';

  const hit = node.querySelector('.card-tile__hit');
  if (hit) {
    hit.setAttribute('aria-label', `Открыть: ${titleText}`);
    hit.addEventListener('click', openDetail);
    hit.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail();
      }
    });
  }

  node.querySelector('.card-tile__score-ring')?.addEventListener('click', (e) => {
    if (e.target.closest('.card-dismiss, .card-tile__hh')) return;
    openDetail();
  });

  node.querySelector('.card-tile__open')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openDetail();
  });

  return node;
}
