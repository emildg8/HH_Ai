/**
 * Статусные метки для карточек и плиток (единая логика).
 */
import { autoRejectChipLabel, isAutoRejectRecord } from './reject-source.mjs';
import { dispatchOpenSettingsForCategory } from './settings-targeting-nav.mjs';

/** @param {{ editRatioPct?: number } | null | undefined} metrics */
function letterMetricsLabel(metrics) {
  if (!metrics || metrics.editRatioPct == null) return '';
  if (metrics.editRatioPct <= 5) return 'без правок';
  return `правки ~${metrics.editRatioPct}%`;
}

function isVacancyDeferredClient(rec, nowMs = Date.now()) {
  const until = Date.parse(String(rec?.deferUntil || ''));
  return Number.isFinite(until) && until > nowMs;
}

/** @param {object} item */
export function vacancyHasHhApply(item) {
  const h = item?.hhApply;
  if (!h) return false;
  if (Boolean(h.responseSubmitted)) return true;
  if (h.questionnaire?.status === 'pending_manual') return false;
  return false;
}

/** @param {object} item */
export function vacancyQuestionnairePending(item) {
  if (item?.hhApply?.responseSubmitted) return false;
  const q = item?.hhApply?.questionnaire;
  if (q?.status === 'pending_manual') return true;
  if (q?.likelyFromVacancyText) return true;
  return Boolean(q?.questions?.length);
}

/**
 * @param {object} item
 * @returns {Array<{ kind: string, label: string, warn?: boolean }>}
 */
export function buildCardStatusChips(item) {
  const chips = [];
  const h = item?.hhApply;

  if (item.targeting?.eligible === false) {
    chips.push({ kind: 'off-target', label: 'нецелевая', warn: true });
  }

  if (item.status === 'rejected' && isAutoRejectRecord(item)) {
    chips.unshift({ kind: 'auto-reject', label: autoRejectChipLabel(item), warn: true });
  }

  if (item.deferUntil && isVacancyDeferredClient(item)) {
    const until = new Date(item.deferUntil).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
    chips.push({ kind: 'deferred', label: `до ${until}`, warn: true });
  }

  if (item.resumeRouting?.label) {
    const warn = h?.resumeMatchOk === false;
    chips.push({
      kind: 'resume',
      label: item.resumeRouting.label.replace(/^Резюме:\s*/i, ''),
      warn,
    });
  }

  const letterMetric = letterMetricsLabel(item.coverLetter?.metrics);
  if (letterMetric && item.coverLetter?.status === 'approved') {
    chips.push({ kind: 'letter-edit', label: letterMetric });
  }

  if (vacancyQuestionnairePending(item)) {
    chips.push({ kind: 'questionnaire', label: 'анкета' });
    return chips;
  }

  if (vacancyHasHhApply(item)) {
    if (h.letterDelivered) chips.push({ kind: 'letter', label: 'письмо ✓' });
    else if (h.chatSent) chips.push({ kind: 'letter', label: 'чат' });
    else if (h.responseSubmitted) chips.push({ kind: 'applied', label: 'отклик' });
  } else if (h?.hhSiteState === 'invited') {
    chips.push({ kind: 'invited', label: 'приглашение' });
  } else if (h?.hhSiteState === 'declined') {
    chips.push({ kind: 'declined', label: 'отказ' });
  } else if (h?.hhSiteState === 'viewed') {
    chips.push({ kind: 'viewed', label: 'просмотр' });
  } else if (h?.hhSiteState === 'awaiting') {
    chips.push({ kind: 'awaiting', label: 'ждём' });
  }

  if (h?.chatSummary?.needsReply || h?.chatSummary?.questionNeedsReply) {
    chips.push({ kind: 'chat', label: 'нужен ответ', warn: true });
  }

  return chips;
}

/**
 * @param {HTMLElement} host
 * @param {object} item
 */
export function renderStatusChips(host, item) {
  if (!host) return;
  const chips = buildCardStatusChips(item);
  const frag = document.createDocumentFragment();
  for (const c of chips) {
    if (c.kind === 'chat') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `status-chip status-chip--${c.kind} status-chip--warn status-chip--clickable`;
      btn.textContent = c.label;
      btn.title = 'Открыть чат в inbox';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent('hh-open-chat-inbox', { detail: { id: item.id } }));
      });
      frag.appendChild(btn);
      continue;
    }
    const span = document.createElement('span');
    span.className = `status-chip status-chip--${c.kind}${c.warn ? ' status-chip--warn' : ''}`;
    span.textContent = c.label;
    frag.appendChild(span);
  }
  if (item.targeting?.eligible === false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'status-chip-link';
    btn.textContent = 'Почему?';
    btn.title = item.targeting?.skipReason || 'Почему не подходит и что изменить в настройках';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dispatchOpenSettingsForCategory(item.targeting?.category);
    });
    frag.appendChild(btn);
  }
  host.replaceChildren(frag);
  host.hidden = chips.length === 0 && item.targeting?.eligible !== false;
}
