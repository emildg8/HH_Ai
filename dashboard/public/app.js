import { vacancyMatchesSearch } from './vacancy-search.mjs';
import { bucketTimelineForDisplay, renderFunnelTimelineHtml } from './funnel-timeline.mjs';
import { initFloatingTooltips } from './tooltips.mjs';
import { initModalLayer, openModalEl, closeModalEl } from './modals.mjs';
import { initUiScaleControls } from './ui-scale.mjs';
import { initThemeControls } from './ui-theme.mjs';
import { initCardTuningControls } from './ui-card-tuning.mjs';
import { applyLocalDashboardDefaults } from './load-local-defaults.mjs';
import {
  meaningfulQuestions,
  itemHasMeaningfulQuestionnaire,
  itemQuestionnaireNeedsProbe,
  itemQuestionnaireShouldAutoProbe,
  recordNeedsQuestionnaireWork,
  recordLooksLikeCaptchaQuestionnaire,
  questionsLookLikeCaptchaMisdetect,
} from './questionnaire-labels.mjs';
import {
  isChoiceQuestion,
  matchAnswerToOption,
  normalizeChoiceOptionLabel,
} from './questionnaire-choice.mjs';
import { buildQuestionnaireAnswersMap } from './questionnaire-merge.mjs';

const listEl = document.getElementById('list');
const tpl = document.getElementById('card-tpl');

const vacancyTabsEl = document.querySelector('.vacancy-tabs');
const applyViewTabsEl = document.querySelector('.apply-view-tabs');
const filterSearchEl = document.getElementById('filter-search');
const filterCompanyEl = document.getElementById('filter-company');
const filterMinScoreEl = document.getElementById('filter-min-score');
const filterSortEl = document.getElementById('filter-sort');
const filterSalaryEl = document.getElementById('filter-salary');
const scoreThresholdInputEl = document.getElementById('score-threshold-input');
const batchLimitEl = document.getElementById('batch-limit');
const prefMaxHourEl = document.getElementById('pref-max-hour');
const prefMaxDayEl = document.getElementById('pref-max-day');
const prefMaxMonthEl = document.getElementById('pref-max-month');
const settingsSaveHintEl = document.getElementById('settings-save-hint');
const applyRateMetersEl = document.getElementById('apply-rate-meters');

let currentStatus = 'pending';
let currentApplyView = 'queue';
let currentScoreBand = 'high';
let currentAppliedFunnel = 'all';
let chatTemplatesCache = null;
let scoreThreshold = 50;
let batchSizeCap = 100;
/** @type {Record<string, { min: number, max: number }>} */
let prefBounds = {};
let settingsHydrated = false;
let preferencesSaveAvailable = null;
let lastHarvestTickSeq = 0;
let applyLogPollTimer = null;
let applyChatWasRunning = false;
let harvestWasRunning = false;
let cachedRawItems = [];
let cachedCounts = null;
/** Открыть первую анкету после перехода на вкладку «Анкета». */
let openQuestionnaireOnNextLoad = false;

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function readFiltersFromUI() {
  return {
    search: (filterSearchEl?.value || '').trim(),
    company: (filterCompanyEl?.value || '').trim(),
    minScore: filterMinScoreEl?.value?.trim() ?? '',
    sort: filterSortEl?.value || 'score-desc',
    onlySalary: Boolean(filterSalaryEl?.checked),
  };
}

function vacancyHhSiteBlocked(item) {
  const s = item?.hhApply?.hhSiteState;
  return (
    s === 'already_applied' ||
    s === 'invited' ||
    s === 'declined' ||
    s === 'archived' ||
    s === 'unavailable'
  );
}

function vacancyShownInAppliedTab(item) {
  if (vacancyHasHhApply(item)) return true;
  const s = item?.hhApply?.hhSiteState;
  return s === 'already_applied' || s === 'invited' || s === 'declined' || s === 'viewed' || s === 'awaiting';
}

function hhSiteStateBadgeText(item) {
  const h = item?.hhApply;
  const st = h?.hhSiteState;
  if (!st || st === 'none') return '';
  const labels = {
    invited: 'Приглашение на hh.ru',
    declined: 'Отказ на hh.ru',
    already_applied: 'Отклик уже на hh.ru',
    viewed: 'Резюме просмотрели',
    awaiting: 'Ждём ответа',
    archived: 'Вакансия в архиве',
    unavailable: 'Отклик недоступен',
  };
  const label = h.hhSiteStateLabel || labels[st] || st;
  const when = h.hhSiteStateAt
    ? new Date(h.hhSiteStateAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return when ? `${label} · ${when}` : label;
}

async function setHhSiteStateManual(item, state) {
  await api('/api/hh-site-state', {
    method: 'POST',
    body: JSON.stringify({ id: item.id, state }),
  });
  showToast(
    state === 'invited'
      ? 'Отмечено: приглашение — вакансия уйдёт из очереди батча'
      : state === 'declined'
        ? 'Отмечено: отказ'
        : 'Статус hh.ru сброшен',
    'good'
  );
  await loadItems();
}

function filterItemsForApplyView(items, view = currentApplyView) {
  const active = items.filter((x) => x.status !== 'responded');
  if (view === 'applied') {
    return items.filter((x) => vacancyShownInAppliedTab(x));
  }
  if (view === 'noQuestionnaire') {
    return active.filter(
      (x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x) && !recordNeedsQuestionnaireWork(x)
    );
  }
  if (view === 'questionnaire') {
    return active.filter(
      (x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x) && recordNeedsQuestionnaireWork(x)
    );
  }
  return active.filter((x) => !vacancyHasHhApply(x) && !vacancyHhSiteBlocked(x));
}

function applyClientFilters(items, filters) {
  let out = filterItemsForApplyView([...items]);
  const q = filters.search.toLowerCase();
  if (q) {
    out = out.filter((it) => vacancyMatchesSearch(it, q));
  }
  const comp = filters.company.toLowerCase();
  if (comp) {
    out = out.filter((it) => (it.company || '').toLowerCase().includes(comp));
  }
  const min = Number(filters.minScore);
  if (Number.isFinite(min) && min > 0) {
    out = out.filter((it) => scoreOf(it) >= min);
  }
  if (filters.onlySalary) {
    out = out.filter((it) => it.salaryEstimate?.ok);
  }
  if (currentApplyView === 'applied' && currentAppliedFunnel !== 'all') {
    out = out.filter((it) => {
      const st = it?.hhApply?.hhSiteState;
      if (currentAppliedFunnel === 'invited') return st === 'invited';
      if (currentAppliedFunnel === 'viewed') return st === 'viewed';
      if (currentAppliedFunnel === 'awaiting') return st === 'awaiting';
      if (currentAppliedFunnel === 'declined') return st === 'declined';
      return true;
    });
  }
  switch (filters.sort) {
    case 'score-asc':
      out.sort((a, b) => scoreOf(a) - scoreOf(b));
      break;
    case 'date-desc':
      out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    case 'title-asc':
      out.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
      break;
    default:
      out.sort((a, b) => scoreOf(b) - scoreOf(a));
  }
  return out;
}

function renderApplyRateMeters(rates) {
  if (!applyRateMetersEl || !rates) return;
  const rows = [
    { key: 'hour', label: 'ч', used: rates.lastHour, max: rates.maxPerHour },
    { key: 'day', label: 'сут', used: rates.lastDay, max: rates.maxPerDay },
    { key: 'month', label: '30д', used: rates.lastMonth, max: rates.maxPerMonth },
  ];
  applyRateMetersEl.innerHTML = rows
    .map(({ label, used, max }) => {
      const u = Number(used) || 0;
      const m = Math.max(1, Number(max) || 1);
      const pct = Math.min(100, Math.round((u / m) * 100));
      const barClass =
        pct >= 100 ? 'rate-meter__bar--full' : pct >= 85 ? 'rate-meter__bar--warn' : '';
      return `<div class="rate-meter" title="${label}: ${u} из ${m}">
        <span class="rate-meter__label">${label}</span>
        <span class="rate-meter__track"><span class="rate-meter__bar ${barClass}" style="width:${pct}%"></span></span>
        <span class="rate-meter__nums">${u}/${m}</span>
      </div>`;
    })
    .join('');
}

function applyPreferencesToSettingsUI(preferences, bounds) {
  if (bounds && typeof bounds === 'object') prefBounds = bounds;
  const p = preferences || {};
  const setNum = (el, key, fallback) => {
    if (!el) return;
    const b = prefBounds[key];
    if (b) {
      el.min = String(b.min);
      el.max = String(b.max);
    }
    const n = Number(p[key]);
    el.value = String(Number.isFinite(n) ? n : fallback);
  };
  setNum(scoreThresholdInputEl, 'dashboardMinScoreFilter', 50);
  setNum(batchLimitEl, 'dashboardBatchSize', 10);
  setNum(prefMaxHourEl, 'hhApplyChatMaxPerHour', 50);
  setNum(prefMaxDayEl, 'hhApplyChatMaxPerDay', 1000);
  setNum(prefMaxMonthEl, 'hhApplyChatMaxPerMonth', 5000);
  const defMin = Number(p.dashboardMinScoreFilter);
  if (Number.isFinite(defMin) && defMin >= 0) scoreThreshold = defMin;
  const batchN = Number(p.dashboardBatchSize);
  batchSizeCap = Number.isFinite(batchN) && batchN >= 1 ? Math.min(100, batchN) : 100;
  if (batchLimitEl && prefBounds.dashboardBatchSize) {
    batchLimitEl.max = String(prefBounds.dashboardBatchSize.max);
  }
  updateScoreBandTabLabels();
  settingsHydrated = true;
}

function readSettingsPatchFromUI() {
  /** @type {Record<string, number>} */
  const patch = {};
  for (const el of document.querySelectorAll('[data-pref]')) {
    const key = el.dataset.pref;
    if (!key) continue;
    const n = Number(el.value);
    if (Number.isFinite(n)) patch[key] = n;
  }
  return patch;
}

let settingsHintClearTimer = null;

function setSettingsHint(text, variant = '') {
  if (!settingsSaveHintEl) return;
  if (settingsHintClearTimer) {
    clearTimeout(settingsHintClearTimer);
    settingsHintClearTimer = null;
  }
  const t = String(text || '').trim();
  settingsSaveHintEl.textContent = t;
  settingsSaveHintEl.hidden = !t;
  settingsSaveHintEl.classList.remove('settings-hint--saved', 'settings-hint--err');
  if (variant) settingsSaveHintEl.classList.add(`settings-hint--${variant}`);
}

function flashSettingsSaved() {
  setSettingsHint('Сохранено', 'saved');
  settingsHintClearTimer = setTimeout(() => {
    settingsHintClearTimer = null;
    if (settingsSaveHintEl?.textContent === 'Сохранено') setSettingsHint('');
  }, 1800);
}

async function probePreferencesSaveApi() {
  try {
    const data = await api('/api/preferences/save');
    return Boolean(data?.preferencesSave ?? data?.ok);
  } catch {
    return false;
  }
}

async function patchPreferencesApi(patch) {
  const body = JSON.stringify({ patch });
  const tries = [
    () => api('/api/preferences/save', { method: 'POST', body }),
    () => api('/api/preferences', { method: 'POST', body }),
    () => api('/api/preferences', { method: 'PATCH', body }),
  ];
  let lastErr;
  for (const fn of tries) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (e.status !== 404) throw e;
    }
  }
  throw lastErr;
}

async function saveSettingsFromUI() {
  if (preferencesSaveAvailable === false) {
    setSettingsHint('Перезапустите дашборд: npm run devops:dashboard, затем F5', 'err');
    return;
  }
  const patch = readSettingsPatchFromUI();
  try {
    const res = await patchPreferencesApi(patch);
    if (res.preferences) applyPreferencesToSettingsUI(res.preferences, prefBounds);
    if (res.applyRates) renderApplyRateMeters(res.applyRates);
    flashSettingsSaved();
    if (currentScoreBand !== 'all') load({ preserveScroll: true });
  } catch (e) {
    const hint =
      e.status === 404
        ? 'Сервер без сохранения лимитов — перезапустите: npm run devops:dashboard, затем F5'
        : e.message || 'Ошибка сохранения';
    setSettingsHint(hint, 'err');
  }
}

const scheduleSaveSettings = debounce(() => {
  if (!settingsHydrated || preferencesSaveAvailable === false) return;
  saveSettingsFromUI();
}, 500);

function getBatchLimitForRun() {
  const cap = Number(batchLimitEl?.max) || batchSizeCap || 100;
  return Math.min(cap, Math.max(1, Number(batchLimitEl?.value) || 10));
}

async function loadDashboardSettings() {
  try {
    const data = await api('/api/preferences');
    const fromGet = data.apiFeatures?.preferencesSave === true;
    preferencesSaveAvailable = fromGet || (await probePreferencesSaveApi());
    applyPreferencesToSettingsUI(data.preferences, data.bounds);
    if (data.applyRates) renderApplyRateMeters(data.applyRates);
    if (!preferencesSaveAvailable) {
      setSettingsHint('Сохранение недоступно — перезапустите дашборд (npm run devops:dashboard)', 'err');
    }
  } catch {
    settingsHydrated = true;
    preferencesSaveAvailable = false;
  }
}

function updateScoreBandTabLabels() {
  const t = scoreThreshold;
  document.querySelectorAll('.tab-band[data-band="high"]').forEach((el) => {
    el.textContent = `Авто ≥${t}`;
  });
  document.querySelectorAll('.tab-band[data-band="low"]').forEach((el) => {
    el.textContent = `<${t}`;
  });
  const autoBtn = document.getElementById('btn-batch-auto');
  if (autoBtn) autoBtn.textContent = `Батч: авто (≥${t})`;
  const manualBtn = document.getElementById('btn-batch-manual');
  if (manualBtn) manualBtn.textContent = `Батч: ручной (<${t})`;
}

/** Запасные фильтры ролей (если дашборд без актуального API). */
function itemRoleFilterBlob(item) {
  return [
    item.title,
    item.company,
    item.searchQuery,
    item.descriptionPreview,
    item.geminiSummary,
    ...(Array.isArray(item.geminiTags) ? item.geminiTags : []),
  ]
    .filter(Boolean)
    .join('\n');
}

function itemLooksSeniorOrLead(item) {
  const blob = itemRoleFilterBlob(item);
  return /\bsenior\b|\bсеньор\b|\btech\s*lead\b|\bteam\s*lead\b|\btechlead\b|\bтех\s*лид\b|\bтим\s*лид\b|\blead\s+(go|golang|python|java|ml|mlops|devops|sre)\b|\b(go|golang|python|java|ml|mlops|devops|sre)\s+lead\b/i.test(
    blob
  );
}

function itemLooks1CRole(item) {
  const blob = itemRoleFilterBlob(item);
  if (/\b1\s*[-:.]?\s*[сc]\b/i.test(blob) || /1[сc]:/i.test(blob)) return true;
  if (/\b(ит[-\s]?)?архитектор\b/i.test(blob) && /\b1\s*[-.]?\s*[сc]\b/i.test(blob)) return true;
  return /\b1с:предприятие\b|\bархитектор\s+1[сc]\b|\bит[-\s]?архитектор\b|\bпрограммист\s+1[сc]\b|\berp\s+1[сc]\b/i.test(
    blob
  );
}

function itemPassesRoleFilters(item) {
  return !itemLooksSeniorOrLead(item) && !itemLooks1CRole(item);
}

function vacancyHasHhApply(item) {
  const h = item?.hhApply;
  if (!h) return false;
  if (Boolean(h.responseSubmitted)) return true;
  if (h.questionnaire?.status === 'pending_manual') return false;
  return false;
}

function vacancyQuestionnairePending(item) {
  if (item?.hhApply?.responseSubmitted) return false;
  const q = item?.hhApply?.questionnaire;
  if (q?.status === 'pending_manual') return true;
  if (q?.likelyFromVacancyText) return true;
  return false;
}

function hhApplyBadgeText(item) {
  const h = item?.hhApply;
  if (!h?.lastAt && !vacancyQuestionnairePending(item)) return '';
  const parts = [];
  if (h.hhSiteState === 'invited') parts.push('приглашение hh.ru');
  else if (h.hhSiteState === 'declined') parts.push('отказ hh.ru');
  else if (h.hhSiteState === 'viewed') parts.push('просмотрели');
  else if (h.hhSiteState === 'awaiting') parts.push('ждём ответа');
  else if (h.hhSiteState === 'already_applied') parts.push('отклик на hh.ru');
  if (h.letterDelivered) parts.push('письмо доставлено');
  else if (h.letterInForm) parts.push('письмо в форме');
  else if (h.chatSent) parts.push('письмо в чате');
  else if (h.responseSubmitted) parts.push('отклик без письма');
  const when = new Date(h.lastAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Отклик: ${parts.join(' · ') || 'отправлен'} · ${when}`;
}

/** Нормализованные веса для подсказки к скору (как в lib/openrouter-score.mjs) */
let scoreWeights = { vacancy: 0.35, cvMatch: 0.65 };

/** @type {{ id: string, variants: string[], selectedIndex: number } | null} */
let draftModalState = null;

document.addEventListener('click', () => {
  document.querySelectorAll('.model-info-panel').forEach((p) => {
    p.hidden = true;
  });
});

function showToast(message, variant = 'neutral') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${variant}`;
  t.setAttribute('role', 'status');
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--visible'));
  const hide = () => {
    t.classList.remove('toast--visible');
    setTimeout(() => t.remove(), 280);
  };
  setTimeout(hide, 2600);
}

async function api(path, opts = {}) {
  const url =
    typeof path === 'string' && path.startsWith('/')
      ? new URL(path, window.location.origin).toString()
      : path;
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const looksHtml = /^\s*</.test(text);
    const hint =
      r.status === 404 && (text.trim() === 'Not found' || looksHtml)
        ? 'Ответ не JSON (часто 404 у статики). Запустите дашборд: npm run dashboard и откройте http://127.0.0.1:3849'
        : text.slice(0, 400) || r.statusText;
    const err = new Error(hint);
    err.status = r.status;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function requestCoverLetterGenerate(id, force = false) {
  return api('/api/cover-letter/generate', {
    method: 'POST',
    body: JSON.stringify({ id, force }),
  });
}

function closeDraftModal() {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;
  closeModalEl(modal);
  draftModalState = null;
}

function closeApprovedLetterModal() {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function closeApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function closeTopModal() {
  const service = document.getElementById('service-drawer');
  if (service && !service.hidden) {
    closeServiceDrawer();
    return true;
  }
  const settings = document.getElementById('settings-modal');
  if (settings && !settings.hidden) {
    closeModalEl(settings);
    return true;
  }
  const funnel = document.getElementById('funnel-modal');
  if (funnel && !funnel.hidden) {
    closeFunnelModal();
    return true;
  }
  const questionnaire = document.getElementById('questionnaire-modal');
  if (questionnaire && !questionnaire.hidden) {
    closeQuestionnaireModal();
    return true;
  }
  const approved = document.getElementById('approved-letter-modal');
  if (approved && !approved.hidden) {
    closeApprovedLetterModal();
    return true;
  }
  const log = document.getElementById('apply-log-modal');
  if (log && !log.hidden) {
    closeApplyLogModal();
    return true;
  }
  const draft = document.getElementById('draft-modal');
  if (draft && !draft.hidden) {
    closeDraftModal();
    return true;
  }
  return false;
}

function closeModalById(modalId) {
  if (modalId === 'draft-modal') {
    closeDraftModal();
    return true;
  }
  if (modalId === 'apply-log-modal') {
    closeApplyLogModal();
    return true;
  }
  if (modalId === 'approved-letter-modal') {
    closeApprovedLetterModal();
    return true;
  }
  if (modalId === 'questionnaire-modal') {
    closeQuestionnaireModal();
    return true;
  }
  if (modalId === 'settings-modal') {
    const m = document.getElementById('settings-modal');
    if (m && !m.hidden) {
      closeModalEl(m);
      return true;
    }
  }
  if (modalId === 'funnel-modal') {
    closeFunnelModal();
    return true;
  }
  return closeTopModal();
}

/** @type {{ id: string, item: object } | null} */
let questionnaireModalState = null;

function questionnaireAnswersMap(item) {
  const q = item?.hhApply?.questionnaire;
  const { map } = buildQuestionnaireAnswersMap(
    q?.questions || [],
    q?.suggestedAnswers || [],
    q?.savedAnswers || []
  );
  return map;
}

function closeQuestionnaireModal() {
  const modal = document.getElementById('questionnaire-modal');
  if (!modal) return;
  closeModalEl(modal);
  questionnaireModalState = null;
}

function formatMatchCv(v) {
  const map = {
    both: 'Оба CV подходят',
    primary: 'Основное CV',
    secondary: 'Дополнительное CV',
    none: 'Слабое совпадение с CV',
  };
  return map[v] || (v ? `CV: ${v}` : '');
}

function readCardDensityMode() {
  return document.documentElement.dataset.cardDensity || 'medium';
}

/** Разбивка длинного текста на абзацы для карточки (полный/средний режим). */
function splitCardParagraphs(text, max = 4) {
  const t = String(text || '').trim();
  if (!t) return [];
  const byNewline = t.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline.slice(0, max);
  const sentences = t.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [t];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (out.length >= max) break;
    const next = (buf + s).trim();
    if (!buf || next.length <= 200) buf = next;
    else {
      out.push(buf);
      buf = s.trim();
    }
  }
  if (buf && out.length < max) out.push(buf);
  return out.length ? out.slice(0, max) : [t.slice(0, 600)];
}

function fillDescBlock(container, text, maxParas) {
  if (!container) return;
  const parts = splitCardParagraphs(text, maxParas);
  if (!parts.length) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  container.hidden = false;
  container.replaceChildren(
    ...parts.map((chunk) => {
      const p = document.createElement('p');
      p.className = 'card-para card-para--desc';
      p.textContent = chunk;
      return p;
    })
  );
  if (text.length > 400) container.title = text;
}

function buildCardFacts(item) {
  const density = readCardDensityMode();
  const lines = [];
  if (item.remoteNote) lines.push(item.remoteNote);
  if (item.workFormat?.city && !String(item.remoteNote || '').includes(item.workFormat.city)) {
    lines.push(`Город: ${item.workFormat.city}`);
  }
  if (item.workFormat?.timezone) lines.push(item.workFormat.timezone);
  if (item.salaryNote && !item.salaryEstimate?.ok) lines.push(item.salaryNote);
  const mc = formatMatchCv(item.geminiMatchCv);
  if (mc) lines.push(mc);
  const cl = item.coverLetter;
  if (cl?.status === 'approved') lines.push('Сопроводительное: утверждено');
  else if (cl?.status === 'pending' && (cl.variants || []).length) lines.push('Сопроводительное: черновик');
  else if (cl?.status === 'declined') lines.push('Сопроводительное: отклонено');
  const factLimit = { compact: 3, medium: 5, full: 8 };
  return lines.slice(0, factLimit[density] ?? 5);
}

function renderQuestionnaireModalBody(modal, item) {
  const body = modal.querySelector('.modal-questionnaire-body');
  const meta = modal.querySelector('.questionnaire-meta');
  if (!body) return;

  const q = item.hhApply?.questionnaire;
  const raw = q?.questions || [];
  const { questions, map: answers } = buildQuestionnaireAnswersMap(
    raw,
    q?.suggestedAnswers || [],
    q?.savedAnswers || []
  );
  const clearCaptchaBtn = modal.querySelector('.btn-questionnaire-clear-captcha');
  if (clearCaptchaBtn) {
    clearCaptchaBtn.hidden = !recordLooksLikeCaptchaQuestionnaire(item);
  }

  body.innerHTML = '';
  if (!questions.length && questionsLookLikeCaptchaMisdetect(raw)) {
    body.innerHTML =
      '<p class="questionnaire-warn">Похоже на <strong>капчу hh.ru</strong> («Текст с картинки»), а не на анкету работодателя. Нажмите <strong>«Это капча, не анкета»</strong> — карточка вернётся в «Без анкет» / «Очередь». После решения капчи повторите отклик.</p>';
    if (meta) meta.textContent = (raw.map((x) => x.label).join(' · ') || '').slice(0, 200);
    return;
  }
  if (!questions.length) {
    const needsProbe = itemQuestionnaireNeedsProbe(item) || raw.length > 0;
    body.innerHTML = needsProbe
      ? '<p class="questionnaire-warn">В JSON нет текста вопросов (заглушка «Писать тут», «Текстовое поле N» или текст мастера отклика). Загрузка с hh.ru запускается автоматически; при необходимости нажмите <strong>«Загрузить с hh.ru»</strong> ещё раз.</p>'
      : '<p class="questionnaire-empty">Вопросов пока нет. Откроется Chromium и форма отклика (нужна сессия <code>npm run login</code>).</p>';
    if (meta) meta.textContent = '';
    return;
  }

  const parts = [];
  if (q.answersGeneratedAt) {
    parts.push(`LLM: ${q.answersModel || '—'} · ${new Date(q.answersGeneratedAt).toLocaleString('ru-RU')}`);
  }
  if (q.probedAt) parts.push(`с hh.ru: ${new Date(q.probedAt).toLocaleString('ru-RU')}`);
  if (meta) meta.textContent = parts.join(' · ');

  questions.forEach((question, pos) => {
    const field = document.createElement('fieldset');
    field.className = 'questionnaire-q';
    const legend = document.createElement('legend');
    legend.textContent = `${pos + 1}. ${question.label}`;
    field.appendChild(legend);

    if (isChoiceQuestion(question)) {
      const savedRaw = answers.get(question.index) || '';
      const matched = matchAnswerToOption(savedRaw, question.options);
      const want = normalizeChoiceOptionLabel(matched?.label || savedRaw);
      const optsWrap = document.createElement('div');
      optsWrap.className = 'questionnaire-choice';
      const groupName = `questionnaire-q-${question.index}`;
      const inputType = question.type === 'checkbox' ? 'checkbox' : 'radio';

      (question.options || []).forEach((opt, oi) => {
        const optLabel = normalizeChoiceOptionLabel(opt.label);
        const id = `q-${question.index}-opt-${oi}`;
        const lbl = document.createElement('label');
        lbl.className = 'questionnaire-choice-opt';
        lbl.htmlFor = id;
        const inp = document.createElement('input');
        inp.type = inputType;
        inp.name = groupName;
        inp.id = id;
        inp.className = 'questionnaire-a questionnaire-a--choice';
        inp.dataset.index = String(question.index);
        inp.value = optLabel;
        if (want && (optLabel === want || optLabel.toLowerCase() === want.toLowerCase())) {
          inp.checked = true;
        }
        const span = document.createElement('span');
        span.textContent = opt.label;
        lbl.appendChild(inp);
        lbl.appendChild(span);
        optsWrap.appendChild(lbl);
      });
      field.appendChild(optsWrap);
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'field-input questionnaire-a';
      ta.rows = question.type === 'textarea' ? 4 : 2;
      ta.dataset.index = String(question.index);
      ta.value = answers.get(question.index) || '';
      ta.placeholder = 'Черновик ответа';
      field.appendChild(ta);
    }

    body.appendChild(field);
  });
}

function collectQuestionnaireAnswersFromModal(modal) {
  const byIndex = new Map();
  for (const el of modal.querySelectorAll('.questionnaire-a')) {
    const index = Number(el.dataset.index);
    if (!index) continue;
    if (el.type === 'radio' || el.type === 'checkbox') {
      if (el.checked) byIndex.set(index, String(el.value || '').trim());
    } else {
      byIndex.set(index, String(el.value || '').trim());
    }
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, answer]) => ({ index, answer }));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setQuestionnaireModalBusy(modal, busy, message) {
  const body = modal.querySelector('.modal-questionnaire-body');
  if (busy && body) {
    body.innerHTML = `<p class="questionnaire-loading">${message || 'Загружаю вопросы с hh.ru…'}</p>`;
  }
  modal.querySelectorAll('.questionnaire-actions .btn').forEach((btn) => {
    btn.disabled = busy;
  });
}

async function runQuestionnaireProbe(opts = {}) {
  const modal = questionnaireModalEl;
  if (!modal || !questionnaireModalState?.id) return null;
  if (questionnaireModalState.probeInFlight) return null;

  questionnaireModalState.probeInFlight = true;
  const probeBtn = modal.querySelector('.btn-questionnaire-probe');
  if (probeBtn) probeBtn.disabled = true;
  setQuestionnaireModalBusy(modal, true, 'Открываю hh.ru и читаю анкету… (до ~1 мин)');
  if (!opts.silentToast) {
    showToast('Открываю hh.ru и читаю анкету… (до ~1 мин)', 'neutral');
  }

  try {
    const res = await api('/api/questionnaire/probe', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id }),
    });
    if (!opts.silentToast) {
      showToast(`Загружено вопросов: ${res.questionCount || 0}`, 'good');
    }
    await load();
    const fresh = cachedRawItems.find((x) => x.id === questionnaireModalState.id);
    if (fresh) {
      questionnaireModalState.item = fresh;
      setQuestionnaireModalBusy(modal, false);
      renderQuestionnaireModalBody(modal, fresh);
    }
    return res;
  } catch (e) {
    setQuestionnaireModalBusy(modal, false);
    const body = modal.querySelector('.modal-questionnaire-body');
    const msg = String(e.message || 'Ошибка загрузки').trim();
    if (body) {
      body.innerHTML = `<p class="questionnaire-warn">${escapeHtml(msg)}</p><p class="questionnaire-empty">Проверьте <code>npm run login</code>, закройте другие окна Chromium и нажмите «Загрузить с hh.ru» снова.</p>`;
    }
    showToast(msg, 'bad');
    return null;
  } finally {
    questionnaireModalState.probeInFlight = false;
    const probeBtnDone = modal.querySelector('.btn-questionnaire-probe');
    if (probeBtnDone) probeBtnDone.disabled = false;
  }
}

async function openQuestionnaireModal(item, options = {}) {
  const { autoProbe = true } = options;
  const modal = document.getElementById('questionnaire-modal');
  if (!modal) return;
  questionnaireModalState = { id: item.id, item, probeInFlight: false };
  modal.querySelector('.modal-vacancy-questionnaire').textContent = item.title || item.url || '';
  renderQuestionnaireModalBody(modal, item);
  openModalEl(modal);
  if (autoProbe && itemQuestionnaireShouldAutoProbe(item)) {
    await runQuestionnaireProbe({ silentToast: false });
  }
}

function getApplyLogSource() {
  const checked = document.querySelector('input[name="log-source"]:checked');
  return checked?.value === 'harvest' ? 'harvest' : 'apply';
}

const APPLY_LOG_PIN_PX = 48;
let applyLogFollowTail = true;
let applyLogScrollBound = false;

function applyLogPreEl() {
  return applyLogModalEl?.querySelector('.apply-log-pre') || null;
}

function isApplyLogAtBottom(pre) {
  if (!pre) return true;
  return pre.scrollHeight - pre.scrollTop - pre.clientHeight <= APPLY_LOG_PIN_PX;
}

function setApplyLogFollowTail(on) {
  applyLogFollowTail = Boolean(on);
  const cb = document.getElementById('apply-log-follow-tail');
  if (cb) cb.checked = applyLogFollowTail;
}

function scrollApplyLogToEnd(pre = applyLogPreEl()) {
  if (!pre) return;
  pre.scrollTop = pre.scrollHeight;
  setApplyLogFollowTail(true);
}

function bindApplyLogScrollGuard() {
  if (applyLogScrollBound) return;
  const pre = applyLogPreEl();
  if (!pre) return;
  applyLogScrollBound = true;
  pre.addEventListener(
    'scroll',
    () => {
      const atBottom = isApplyLogAtBottom(pre);
      if (atBottom !== applyLogFollowTail) setApplyLogFollowTail(atBottom);
    },
    { passive: true }
  );
}

/**
 * @param {{ silent?: boolean, showLoading?: boolean, scrollToEnd?: boolean }} [opts]
 * silent — фоновое обновление: без «Загрузка…», сохраняем позицию прокрутки
 */
async function refreshApplyLogModal(opts = {}) {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  const pre = applyLogPreEl();
  if (!pre) return;
  bindApplyLogScrollGuard();

  const pathEl = modal.querySelector('.apply-log-path');
  const metaEl = document.getElementById('apply-log-meta');
  const source = getApplyLogSource();
  const lastRun = document.getElementById('apply-log-last-run')?.checked !== false;
  const lineCount = 400;
  const endpoint =
    source === 'harvest'
      ? `/api/harvest-log?lines=${lineCount}&lastRun=${lastRun ? '1' : '0'}`
      : `/api/hh-apply-chat-log?lines=${lineCount}&lastRun=${lastRun ? '1' : '0'}`;

  const prevScrollTop = pre.scrollTop;
  const wasAtBottom = isApplyLogAtBottom(pre);
  const followTail = opts.scrollToEnd ?? applyLogFollowTail;
  const cacheKey = `${source}|${lastRun ? 1 : 0}`;

  if (opts.showLoading) {
    pre.textContent = 'Загрузка…';
    if (metaEl) metaEl.textContent = '';
  }

  try {
    const data = await api(endpoint);
    const rel = data.relativePath || (source === 'harvest' ? 'data/harvest-run.log' : 'data/hh-apply-chat.log');
    pathEl.textContent = data.absolutePath || rel;
    pathEl.title = data.absolutePath || rel;
    if (metaEl && data.exists) {
      const parts = [];
      if (data.modifiedAt) {
        parts.push(`обновлён ${new Date(data.modifiedAt).toLocaleString('ru-RU')}`);
      }
      if (data.sizeBytes != null) parts.push(`${Math.round(data.sizeBytes / 1024)} КБ`);
      if (data.lastRunHeader) parts.push(data.lastRunHeader.slice(0, 72));
      metaEl.textContent = parts.length ? ` · ${parts.join(' · ')}` : '';
    }
    if (!data.exists) {
      pre.textContent =
        source === 'harvest'
          ? 'Лог сбора пуст. Нажмите «Собрать вакансии».'
          : 'Лог отклика пуст. Нажмите «Авто-отклик» на карточке.';
      pre.dataset.logCacheKey = '';
      pre.dataset.logContent = '';
      return;
    }

    const newText = data.text || '(пусто)';
    if (opts.silent && pre.dataset.logCacheKey === cacheKey && pre.dataset.logContent === newText) {
      return;
    }

    pre.dataset.logCacheKey = cacheKey;
    pre.dataset.logContent = newText;
    pre.textContent = newText;

    const pinToEnd =
      opts.scrollToEnd === true || (opts.scrollToEnd !== false && followTail && wasAtBottom);
    if (pinToEnd) {
      scrollApplyLogToEnd(pre);
    } else {
      pre.scrollTop = Math.min(prevScrollTop, Math.max(0, pre.scrollHeight - pre.clientHeight));
    }
  } catch (e) {
    pre.textContent = `Ошибка: ${e.message}`;
  }
}

function openApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  setApplyLogFollowTail(true);
  openModalEl(modal);
  refreshApplyLogModal({ showLoading: true, scrollToEnd: true });
  refreshJobStatus();
}

function openApprovedLetterModal(item) {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  const text = String(item.coverLetter?.approvedText || '').trim();
  modal.querySelector('.modal-vacancy-approved').textContent = item.title || item.url || '';
  modal.querySelector('.modal-approved-text').textContent = text;
  openModalEl(modal);
}

function openDraftModal(item) {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;
  const body = modal.querySelector('.modal-draft-body');
  const vacEl = modal.querySelector('.modal-vacancy');
  vacEl.textContent = item.title || item.url || '';
  body.innerHTML = '';

  const raw = item.coverLetter?.variants || [];
  const variants = raw.length ? raw.map((s) => String(s)) : [];
  if (!variants.length) {
    const p = document.createElement('p');
    p.className = 'modal-empty';
    p.textContent = 'Нет вариантов.';
    body.appendChild(p);
    openModalEl(modal);
    draftModalState = null;
    return;
  }

  const name = `draft-v-${item.id}`;
  let selectedIndex = 0;

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'modal-draft-fieldset';
  const legend = document.createElement('legend');
  legend.textContent = 'Вариант';
  fieldset.appendChild(legend);

  variants.forEach((_, i) => {
    const row = document.createElement('div');
    row.className = 'modal-draft-variant-row';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.id = `${name}-${i}`;
    input.value = String(i);
    if (i === 0) input.checked = true;
    const label = document.createElement('label');
    label.htmlFor = `${name}-${i}`;
    label.textContent = `Вариант ${i + 1}`;
    row.appendChild(input);
    row.appendChild(label);
    fieldset.appendChild(row);
  });

  const lbl = document.createElement('label');
  lbl.className = 'modal-letter-label';
  lbl.htmlFor = `${name}-edit`;
  lbl.textContent = 'Текст (правки сохраняются и учитываются при следующей генерации)';

  const ta = document.createElement('textarea');
  ta.className = 'modal-letter-edit';
  ta.id = `${name}-edit`;
  ta.rows = 12;
  ta.value = variants[0] || '';

  const actions = document.createElement('div');
  actions.className = 'modal-draft-actions';

  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn';
  btnSave.textContent = 'Сохранить правки';

  const btnApprove = document.createElement('button');
  btnApprove.type = 'button';
  btnApprove.className = 'btn ok';
  btnApprove.textContent = 'Утвердить';

  const btnDecline = document.createElement('button');
  btnDecline.type = 'button';
  btnDecline.className = 'btn bad';
  btnDecline.textContent = 'Отклонить';

  actions.appendChild(btnSave);
  actions.appendChild(btnApprove);
  actions.appendChild(btnDecline);

  body.appendChild(fieldset);
  body.appendChild(lbl);
  body.appendChild(ta);
  body.appendChild(actions);

  draftModalState = { id: item.id, variants, selectedIndex: 0 };

  function syncTextareaToVariant() {
    if (!draftModalState) return;
    draftModalState.variants[draftModalState.selectedIndex] = ta.value;
  }

  fieldset.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name !== name || t.type !== 'radio') return;
    syncTextareaToVariant();
    const idx = Number(t.value);
    const max = draftModalState.variants.length - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx > max) return;
    draftModalState.selectedIndex = idx;
    ta.value = draftModalState.variants[idx] ?? '';
  });

  btnSave.addEventListener('click', async () => {
    syncTextareaToVariant();
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/save-draft', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, variants: draftModalState.variants }),
      });
      showToast('Правки сохранены', 'good');
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnApprove.addEventListener('click', async () => {
    syncTextareaToVariant();
    const text = ta.value.trim();
    if (!text) {
      alert('Введите или выберите текст письма.');
      return;
    }
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/action', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, action: 'approve', text }),
      });
      showToast('Письмо утверждено', 'good');
      closeDraftModal();
      await load();
    } catch (e) {
      alert(e.message);
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnDecline.addEventListener('click', async () => {
    if (!confirm('Отклонить черновик?')) return;
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/action', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, action: 'decline' }),
      });
      showToast('Черновик отклонён', 'neutral');
      closeDraftModal();
      await load();
    } catch (e) {
      alert(e.message);
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  openModalEl(modal);
}

const draftModalEl = document.getElementById('draft-modal');
const approvedModalEl = document.getElementById('approved-letter-modal');
const applyLogModalEl = document.getElementById('apply-log-modal');
const questionnaireModalEl = document.getElementById('questionnaire-modal');

questionnaireModalEl?.querySelector('.btn-questionnaire-probe')?.addEventListener('click', () => {
  void runQuestionnaireProbe({ silentToast: false });
});

questionnaireModalEl?.querySelector('.btn-questionnaire-clear-captcha')?.addEventListener('click', async () => {
  if (!questionnaireModalState?.id) return;
  try {
    const res = await api('/api/questionnaire/clear-captcha', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id }),
    });
    showToast(`Сброшено (капча): ${res.fixed || 1}`, 'good');
    closeModalEl(questionnaireModalEl);
    await load();
  } catch (e) {
    showToast(e.message || String(e), 'bad');
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-generate')?.addEventListener('click', async () => {
  if (!questionnaireModalState?.id) return;
  const modal = questionnaireModalEl;
  const btn = modal.querySelector('.btn-questionnaire-generate');
  const prevLabel = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Генерация…';
  }
  modal.querySelectorAll('.questionnaire-actions .btn').forEach((b) => {
    b.disabled = true;
  });
    showToast('Подставляю ответы из резюме (CV/)…', 'neutral');
  try {
    const res = await api('/api/questionnaire/generate', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id }),
    });
    const n = res.answerCount ?? res.questionnaire?.suggestedAnswers?.length ?? 0;
    if (res.questionnaire && questionnaireModalState.item) {
      const item = {
        ...questionnaireModalState.item,
        hhApply: {
          ...questionnaireModalState.item.hhApply,
          questionnaire: res.questionnaire,
        },
      };
      questionnaireModalState.item = item;
      renderQuestionnaireModalBody(modal, item);
    }
    const src =
      res.model === 'cv-heuristic' || String(res.model || '').startsWith('cv')
        ? 'из резюме'
        : res.model || 'LLM';
    showToast(`Ответы: ${n} шт. (${src})`, 'good');
    await load();
    const fresh = cachedRawItems.find((x) => x.id === questionnaireModalState.id);
    if (fresh) {
      questionnaireModalState.item = fresh;
      renderQuestionnaireModalBody(modal, fresh);
    }
  } catch (e) {
    const body = modal.querySelector('.modal-questionnaire-body');
    const msg = String(e.message || 'Ошибка LLM').trim();
    if (body && !body.querySelector('.questionnaire-q')) {
      body.insertAdjacentHTML(
        'afterbegin',
        `<p class="questionnaire-warn">${escapeHtml(msg)}</p>`
      );
    }
    showToast(msg, 'bad');
  } finally {
    modal.querySelectorAll('.questionnaire-actions .btn').forEach((b) => {
      b.disabled = false;
    });
    if (btn) {
      btn.textContent = prevLabel || 'Сгенерировать ответы';
    }
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-save')?.addEventListener('click', async () => {
  if (!questionnaireModalState?.id) return;
  const btn = questionnaireModalEl.querySelector('.btn-questionnaire-save');
  const answers = collectQuestionnaireAnswersFromModal(questionnaireModalEl);
  btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/save-answers', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id, answers }),
    });
    const msg =
      res.learnedEdits > 0
        ? `Сохранено; ${res.learnedEdits} пример(ов) для следующих генераций`
        : 'Ответы сохранены в очереди';
    showToast(msg, 'good');
    await load();
  } catch (e) {
    showToast(e.message || 'Ошибка сохранения', 'bad');
  } finally {
    btn.disabled = false;
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-copy')?.addEventListener('click', async () => {
  const item = questionnaireModalState?.item;
  if (!item) return;
  const questions = meaningfulQuestions(item.hhApply?.questionnaire?.questions || []);
  const answers = collectQuestionnaireAnswersFromModal(questionnaireModalEl);
  const byIdx = new Map(answers.map((a) => [a.index, a.answer]));
  const text = questions
    .map((q) => `${q.index}. ${q.label}\n${byIdx.get(q.index) || ''}`)
    .join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано в буфер', 'good');
  } catch {
    showToast('Не удалось скопировать', 'bad');
  }
});

questionnaireModalEl?.querySelector('.btn-questionnaire-apply')?.addEventListener('click', async () => {
  const state = questionnaireModalState;
  if (!state?.id) return;
  const item = state.item;
  const btn = questionnaireModalEl.querySelector('.btn-questionnaire-apply');
  const approvedLetter = String(item?.coverLetter?.approvedText || '').trim();
  btn.disabled = true;
  try {
    const answers = collectQuestionnaireAnswersFromModal(questionnaireModalEl);
    if (answers.some((a) => a.answer)) {
      await api('/api/questionnaire/save-answers', {
        method: 'POST',
        body: JSON.stringify({ id: state.id, answers }),
      });
    }
  } catch (e) {
    showToast(`Не удалось сохранить ответы: ${e.message}`, 'bad');
    btn.disabled = false;
    return;
  }
  closeQuestionnaireModal();
  try {
    const res = await api('/api/hh-launch-apply-chat', {
      method: 'POST',
      body: JSON.stringify({
        id: state.id,
        usePoolLetter: !approvedLetter,
        tailorResume: true,
        questionnaireWait: true,
        questionnaireAuto: true,
      }),
    });
    const pid = res.pid != null ? ` PID ${res.pid}.` : '';
    showToast(`Отклик с анкетой запущен.${pid}`, 'good');
    openApplyLogModal();
    startJobLogPoll();
    refreshJobStatus();
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
  }
});

document.querySelector('.btn-log-apply')?.addEventListener('click', () => openApplyLogModal());

applyLogModalEl?.querySelector('.btn-refresh-apply-log')?.addEventListener('click', () =>
  refreshApplyLogModal({ showLoading: true, scrollToEnd: applyLogFollowTail })
);
applyLogModalEl?.querySelector('.btn-apply-log-jump')?.addEventListener('click', () => {
  scrollApplyLogToEnd();
});
document.getElementById('apply-log-follow-tail')?.addEventListener('change', (e) => {
  setApplyLogFollowTail(e.target.checked);
  if (applyLogFollowTail) scrollApplyLogToEnd();
});
applyLogModalEl?.querySelectorAll('input[name="log-source"]').forEach((el) => {
  el.addEventListener('change', () => {
    setApplyLogFollowTail(true);
    refreshApplyLogModal({ showLoading: true, scrollToEnd: true });
  });
});
document.getElementById('apply-log-last-run')?.addEventListener('change', () => {
  setApplyLogFollowTail(true);
  refreshApplyLogModal({ showLoading: true, scrollToEnd: true });
});

approvedModalEl?.querySelector('.btn-copy-approved')?.addEventListener('click', async () => {
  const pre = approvedModalEl.querySelector('.modal-approved-text');
  const t = pre?.textContent || '';
  try {
    await navigator.clipboard.writeText(t);
    showToast('Скопировано в буфер', 'good');
  } catch {
    showToast('Не удалось скопировать', 'bad');
  }
});

function bindDismiss(node, item) {
  const dismissBtn = node.querySelector('.card-dismiss');
  if (!dismissBtn) return;
  dismissBtn.addEventListener('click', async () => {
    if (!confirm('Удалить эту запись из очереди? (без «подходит / не подходит»)')) return;
    dismissBtn.disabled = true;
    try {
      await api('/api/dismiss', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      });
      showToast('Запись удалена из очереди', 'neutral');
      await load();
    } catch (e) {
      alert(e.message);
      dismissBtn.disabled = false;
    }
  });
}

function scoreOf(item) {
  return Number(item.scoreOverall ?? item.geminiScore ?? 0) || 0;
}

function renderCard(item) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.recordId = item.id;
  const s = scoreOf(item);
  if (s >= scoreThreshold) node.classList.add('card--score-high');
  else if (s > 0) node.classList.add('card--score-low');

  bindDismiss(node, item);

  const scoreEl = node.querySelector('.score');
  const overall = item.scoreOverall ?? item.geminiScore;
  const displayOverall = overall != null && overall !== '' ? String(overall) : '—';
  scoreEl.textContent = displayOverall;
  scoreEl.setAttribute(
    'aria-label',
    displayOverall === '—'
      ? 'Нет скора'
      : `Итоговый балл ${displayOverall}, наведи для расшифровки`
  );

  const tooltip = node.querySelector('.score-tooltip');
  const wv = scoreWeights.vacancy;
  const wc = scoreWeights.cvMatch;
  const sv = item.scoreVacancy;
  const scm = item.scoreCvMatch;
  const so = item.scoreOverall ?? item.geminiScore;
  if (Number.isFinite(Number(sv)) && Number.isFinite(Number(scm))) {
    tooltip.innerHTML = [
      '<strong>Вакансия</strong> (оценка модели): ',
      String(sv),
      '<br><strong>Сходство с твоими CV</strong>: ',
      String(scm),
      '<br><strong>Итог на карточке</strong>: ',
      so != null && so !== '' ? String(so) : '—',
      '<br><br>Если модель не вернула свой <code>scoreOverall</code>, итог считается как ',
      `<code>${wv.toFixed(2)}×</code>вакансия + <code>${wc.toFixed(2)}×</code>CV (веса из preferences.json).`,
    ].join('');
  } else {
    tooltip.textContent =
      'Нет разбивки по компонентам. Добавь записи через npm run harvest с включённым LLM (без --skip-llm).';
  }

  const modelBtn = node.querySelector('.model-info-btn');
  const modelPanel = node.querySelector('.model-info-panel');
  const modelName = item.openRouterModel ? String(item.openRouterModel).trim() : '';
  if (modelName) {
    modelBtn.hidden = false;
    modelPanel.textContent = `Модель OpenRouter: ${modelName}`;
    modelPanel.addEventListener('click', (e) => e.stopPropagation());
    modelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = modelPanel.hidden;
      document.querySelectorAll('.model-info-panel').forEach((p) => {
        p.hidden = true;
      });
      if (open) modelPanel.hidden = false;
    });
  }

  const a = node.querySelector('.title-link');
  a.href = item.url;
  a.textContent = item.title || item.url;

  const density = readCardDensityMode();
  const metaCompact = node.querySelector('.meta--compact');
  const metaDetail = node.querySelector('.card-meta-detail');
  const salaryLine =
    item.salaryEstimate?.ok
      ? `≈${item.salaryEstimate.minUsd}–${item.salaryEstimate.maxUsd} USD/мес`
      : item.salaryRaw || '';
  const parts = [item.company, salaryLine, item.searchQuery ? `запрос: ${item.searchQuery}` : '']
    .filter(Boolean);
  if (metaCompact) {
    const metaParts = [...new Set(parts)];
    if (item.resumeRouting?.label) metaParts.push(`Резюме: ${item.resumeRouting.label}`);
    metaCompact.textContent = metaParts.join(' · ');
  }

  const setMetaLine = (sel, label, value) => {
    const el = node.querySelector(sel);
    if (!el) return;
    const v = String(value || '').trim();
    if (!v) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = label ? `${label}: ${v}` : v;
  };

  if (density === 'full') {
    if (metaCompact) metaCompact.hidden = true;
    if (metaDetail) metaDetail.hidden = false;
    setMetaLine('.meta-line--company', 'Компания', item.company);
    setMetaLine('.meta-line--salary', 'Зарплата', salaryLine);
    setMetaLine('.meta-line--search', 'Поиск', item.searchQuery);
  } else {
    if (metaCompact) metaCompact.hidden = false;
    if (metaDetail) metaDetail.hidden = true;
  }

  const factsEl = node.querySelector('.card-facts');
  const facts = buildCardFacts(item);
  if (factsEl && facts.length) {
    factsEl.hidden = false;
    factsEl.replaceChildren(
      ...facts.map((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        return li;
      })
    );
  }

  const descBlock = node.querySelector('.card-desc-block');
  const desc = String(item.descriptionPreview || '').trim();
  if (descBlock && desc && density === 'medium') {
    fillDescBlock(descBlock, desc, 2);
  } else if (descBlock && desc && density === 'full') {
    fillDescBlock(descBlock, desc, 8);
  } else if (descBlock) {
    descBlock.hidden = true;
    descBlock.replaceChildren();
  }

  const applyBadge = node.querySelector('.hh-apply-badge');
  const qBanner = node.querySelector('.questionnaire-banner');
  const qSlot = node.querySelector('.card-slot--questionnaire');
  const meaningfulQs = meaningfulQuestions(item.hhApply?.questionnaire?.questions);
  const needsProbe = itemQuestionnaireNeedsProbe(item);
  const showQuestionnaireBlock =
    qBanner &&
    currentApplyView !== 'noQuestionnaire' &&
    recordNeedsQuestionnaireWork(item) &&
    (meaningfulQs.length > 0 || needsProbe);

  if (showQuestionnaireBlock) {
    const textEl = qBanner.querySelector('.questionnaire-banner__text');
    if (meaningfulQs.length > 0) {
      const hasAnswers =
        (item.hhApply.questionnaire?.savedAnswers?.length ?? 0) > 0 ||
        (item.hhApply.questionnaire?.suggestedAnswers?.length ?? 0) > 0;
      if (textEl) {
        textEl.textContent = hasAnswers
          ? `${meaningfulQs.length} вопросов · ответы в дашборде — открыть`
          : `${meaningfulQs.length} вопросов работодателя — открыть и сгенерировать ответы`;
      }
    } else if (textEl) {
      textEl.textContent = item.hhApply?.questionnaire?.likelyFromVacancyText
        ? 'В описании похоже на анкету — «Вопросы» → загрузить с hh.ru'
        : 'Анкета на hh.ru — открыть «Вопросы» и загрузить с сайта';
    }
    qBanner.hidden = false;
    qSlot?.classList.add('card-slot--questionnaire-active');
    qBanner.addEventListener('click', () => openQuestionnaireModal(item));
    if (applyBadge) applyBadge.hidden = true;
    node.classList.add('card--questionnaire');
  } else if (qBanner) {
    qBanner.hidden = true;
  }

  if (!showQuestionnaireBlock && applyBadge && vacancyHasHhApply(item)) {
    applyBadge.hidden = false;
    applyBadge.textContent = hhApplyBadgeText(item);
    node.classList.add('card--applied');
  }

  const siteBadge = node.querySelector('.hh-site-badge');
  const siteOnly =
    !showQuestionnaireBlock &&
    !vacancyHasHhApply(item) &&
    item?.hhApply?.hhSiteState &&
    item.hhApply.hhSiteState !== 'none';
  if (siteBadge && siteOnly) {
    siteBadge.hidden = false;
    siteBadge.textContent = hhSiteStateBadgeText(item);
    siteBadge.classList.add(`hh-site-badge--${item.hhApply.hhSiteState}`);
    node.classList.add('card--applied');
    if (item.hhApply.hhSiteState === 'invited') node.classList.add('card--hh-invited');
    if (item.hhApply.hhSiteState === 'declined') node.classList.add('card--hh-declined');
    if (item.hhApply.hhSiteState === 'viewed') node.classList.add('card--hh-viewed');
  }

  const interviewBtn = node.querySelector('.btn-interview-prep');
  if (interviewBtn && item.hhApply?.hhSiteState === 'invited') {
    interviewBtn.hidden = false;
    interviewBtn.addEventListener('click', async () => {
      interviewBtn.disabled = true;
      try {
        const res = await api('/api/interview-prep', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        const p = res.interviewPrep;
        const lines = [
          ...(p?.checklist || []),
          '',
          p?.llm?.pitch ? `Питч: ${p.llm.pitch}` : '',
          (p?.llm?.techQuestions || []).map((q) => `• ${q}`).join('\n'),
        ].filter(Boolean);
        alert(lines.join('\n') || 'Пакет сохранён в карточке');
        await load();
      } catch (e) {
        alert(e.message);
      } finally {
        interviewBtn.disabled = false;
      }
    });
  }

  const negOnlyBadge = node.querySelector('.negotiation-only-badge');
  if (item.negotiationOnly || item.hhApply?.negotiationOnly) {
    if (negOnlyBadge) negOnlyBadge.hidden = false;
    node.classList.add('card--negotiation-only');
    node.querySelectorAll('.btn-apply-auto, .btn-apply-chat, .btn-apply-questionnaire').forEach((b) => {
      b.disabled = true;
    });
  }

  const chatBlock = node.querySelector('.card-chat-block');
  const chatMsgs = item.hhApply?.chatMessages;
  const chatEditor = chatBlock?.querySelector('.chat-reply-editor');
  const chatOpen = chatBlock?.querySelector('.btn-chat-open-hh');
  if (chatBlock && Array.isArray(chatMsgs) && chatMsgs.length) {
    chatBlock.hidden = false;
    const ul = chatBlock.querySelector('.chat-messages');
    if (ul) {
      ul.replaceChildren(
        ...chatMsgs.slice(-8).map((m) => {
          const li = document.createElement('li');
          li.className = `chat-msg chat-msg--${m.kind || 'other'}`;
          const who = m.kind === 'question' ? 'Работодатель' : m.kind === 'answer' ? 'Вы' : 'Сообщение';
          li.textContent = `${who}: ${m.text}`;
          return li;
        })
      );
    }
    const savedDraft = item.hhApply?.chatReplyDraft?.reply;
    if (chatEditor && savedDraft) chatEditor.value = savedDraft;
    const chatUrl = item.hhApply?.chatUrl;
    if (chatOpen && chatUrl) {
      chatOpen.href = chatUrl;
      chatOpen.hidden = false;
    }
    chatBlock.querySelector('.btn-chat-copy')?.addEventListener('click', async () => {
      const text = chatEditor?.value?.trim();
      if (!text) return alert('Сначала сгенерируйте черновик («Ответ в чат»)');
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
      showToast('Скопировано', 'good');
    });
    const tplRow = chatBlock.querySelector('.chat-template-row');
    if (tplRow) {
      ensureChatTemplates().then((templates) => {
        tplRow.replaceChildren(
          ...templates.map((t) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-ghost btn-xs chat-tpl-btn';
            b.textContent = t.label;
            b.title = t.text.slice(0, 120);
            b.addEventListener('click', () => {
              if (chatEditor) chatEditor.value = t.text;
            });
            return b;
          })
        );
      });
    }
  }

  const chatDraftBtn = node.querySelector('.btn-chat-reply-draft');
  const chatSummary = item.hhApply?.chatSummary;
  const hasChat =
    chatSummary?.needsReply ||
    chatSummary?.questionCount > 0 ||
    (Array.isArray(chatMsgs) && chatMsgs.some((m) => m.kind === 'question'));
  if (chatDraftBtn && hasChat) {
    chatDraftBtn.hidden = false;
    chatDraftBtn.addEventListener('click', async () => {
      chatDraftBtn.disabled = true;
      try {
        const res = await api('/api/chat-reply-draft', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        if (chatEditor) chatEditor.value = res.reply || '';
        else if (navigator.clipboard) await navigator.clipboard.writeText(res.reply);
        showToast(
          res.source === 'llm' ? 'Черновик в поле ниже — проверьте и вставьте в чат hh.ru' : 'Шаблонный черновик',
          'good'
        );
      } catch (e) {
        alert(e.message);
      } finally {
        chatDraftBtn.disabled = false;
      }
    });
  }

  const hiddenBadge = node.querySelector('.hidden-role-badge');
  const hiddenReasons = item.hiddenRoleReasons || [];
  if (hiddenBadge && hiddenReasons.length) {
    hiddenBadge.hidden = false;
    hiddenBadge.textContent = `Скрыто фильтром: ${hiddenReasons.join(', ')}`;
    node.classList.add('card--hidden-role');
  }

  const summaryText = String(item.geminiSummary || '').trim();
  const summaryEl = node.querySelector('.summary');
  const summaryLabel = node.querySelector('.card-label--summary');
  if (summaryEl) {
    summaryEl.textContent = summaryText;
    if (summaryText) summaryEl.title = summaryText;
  }
  if (summaryLabel) summaryLabel.hidden = !summaryText;

  const risksText = String(item.geminiRisks || '').trim();
  const risksEl = node.querySelector('.risks');
  const risksBox = node.querySelector('.risks-box');
  const risksLabel = node.querySelector('.card-label--risks');
  const risksSlot = node.querySelector('.card-slot--risks');
  if (risksText && risksEl) {
    risksEl.textContent = risksText;
    risksEl.title = risksText;
    if (risksBox) risksBox.hidden = false;
    if (risksLabel) risksLabel.hidden = false;
    risksSlot?.classList.add('card-slot--risks-active');
    node.classList.add('card-has-risks');
  } else {
    if (risksBox) risksBox.hidden = true;
    if (risksLabel) risksLabel.hidden = true;
  }

  const tags = node.querySelector('.tags');
  (item.geminiTags || []).forEach((t) => {
    const s = document.createElement('span');
    s.className = 'tag';
    s.textContent = t;
    tags.appendChild(s);
  });

  const cl = item.coverLetter;
  const draftBtn = node.querySelector('.cover-draft-btn');
  const regenBtn = node.querySelector('.btn-regenerate-letter');
  const viewLetterBtn = node.querySelector('.btn-view-approved');

  if (cl?.status === 'pending' && (cl?.variants || []).length) {
    draftBtn.hidden = false;
    draftBtn.addEventListener('click', () => openDraftModal(item));
  }

  if (cl?.status === 'declined') {
    regenBtn.hidden = false;
    regenBtn.addEventListener('click', async () => {
      regenBtn.disabled = true;
      try {
        await requestCoverLetterGenerate(item.id, false);
        showToast('Новые варианты готовы', 'good');
        await load();
      } catch (e) {
        if (e.status === 409) {
          const ok = confirm(
            'Уже есть утверждённое письмо. Пересоздать и заменить черновиком?'
          );
          if (ok) {
            try {
              await requestCoverLetterGenerate(item.id, true);
              showToast('Новые варианты готовы', 'good');
              await load();
            } catch (e2) {
              alert(e2.message);
            }
          }
        } else {
          alert(e.message);
        }
      } finally {
        regenBtn.disabled = false;
      }
    });
  }

  if (cl?.status === 'approved' && String(cl?.approvedText || '').trim()) {
    viewLetterBtn.hidden = false;
    viewLetterBtn.addEventListener('click', () => openApprovedLetterModal(item));
  }

  const tailorBtn = node.querySelector('.btn-tailor-resume');
  tailorBtn?.addEventListener('click', async () => {
    tailorBtn.disabled = true;
    try {
      const res = await api('/api/tailor-resume', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      });
      showToast(`PDF: ${res.tailoredResume?.pdfPath || 'готово'}`, 'good');
    } catch (e) {
      alert(e.message);
    } finally {
      tailorBtn.disabled = false;
    }
  });

  const applyAutoBtn = node.querySelector('.btn-apply-auto');
  const applyChatBtn = node.querySelector('.btn-apply-chat');
  const approvedLetter =
    cl?.status === 'approved' && String(cl?.approvedText || '').trim();

  const launchApply = async (
    btn,
    { usePoolLetter, tailorResume = true, questionnaireWait = false, questionnaireAuto = false }
  ) => {
    btn.disabled = true;
    try {
      const res = await api('/api/hh-launch-apply-chat', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          usePoolLetter,
          tailorResume,
          questionnaireWait,
          questionnaireAuto,
        }),
      });
      const pid = res.pid != null ? ` PID ${res.pid}.` : '';
      showToast(
        `Отклик запущен.${pid} Должно открыться окно Chromium — смотрите лог и панель прогресса.`,
        'good'
      );
      openApplyLogModal();
      startJobLogPoll();
      refreshJobStatus();
    } catch (e) {
      alert(e.message);
      btn.disabled = false;
    }
  };

  const invitedBtn = node.querySelector('.btn-hh-invited');
  const declinedBtn = node.querySelector('.btn-hh-declined');
  if (item.status === 'pending' && !vacancyHasHhApply(item)) {
    if (invitedBtn) {
      invitedBtn.hidden = false;
      invitedBtn.addEventListener('click', async () => {
        invitedBtn.disabled = true;
        try {
          await setHhSiteStateManual(item, 'invited');
        } catch (e) {
          alert(e.message);
          invitedBtn.disabled = false;
        }
      });
    }
    if (declinedBtn) {
      declinedBtn.hidden = false;
      declinedBtn.addEventListener('click', async () => {
        declinedBtn.disabled = true;
        try {
          await setHhSiteStateManual(item, 'declined');
        } catch (e) {
          alert(e.message);
          declinedBtn.disabled = false;
        }
      });
    }
  }

  if (item.status === 'pending' && applyAutoBtn) {
    const hhBlocked = vacancyHhSiteBlocked(item);
    applyAutoBtn.disabled = hhBlocked;
    if (hhBlocked) {
      applyAutoBtn.title = hhSiteStateBadgeText(item) || 'Повторный отклик на hh.ru не нужен';
    } else if (currentApplyView === 'hidden') {
      applyAutoBtn.disabled = false;
      applyAutoBtn.title = 'Скрыта фильтром — отклик на ваш риск';
    } else {
      applyAutoBtn.disabled = false;
    }
    if (!hhBlocked) {
      applyAutoBtn.addEventListener('click', () =>
        launchApply(applyAutoBtn, {
          usePoolLetter: true,
          tailorResume: true,
          questionnaireAuto: true,
          questionnaireWait:
            vacancyQuestionnairePending(item) ||
            (item.hhApply?.questionnaire?.savedAnswers?.length ?? 0) > 0,
        })
      );
    }
  }

  if (approvedLetter) {
    applyChatBtn.disabled = false;
    applyChatBtn.removeAttribute('title');
    applyChatBtn.addEventListener('click', () =>
      launchApply(applyChatBtn, { usePoolLetter: false, tailorResume: true })
    );
  }

  const questionnaireBtn = node.querySelector('.btn-apply-questionnaire');
  if (questionnaireBtn && item.status === 'pending' && !vacancyHasHhApply(item) && !vacancyHhSiteBlocked(item)) {
    questionnaireBtn.hidden = false;
    questionnaireBtn.disabled = false;
    questionnaireBtn.addEventListener('click', () =>
      launchApply(questionnaireBtn, {
        usePoolLetter: !approvedLetter,
        tailorResume: true,
        questionnaireWait: true,
        questionnaireAuto: true,
      })
    );
  }

  const qViewBtn = node.querySelector('.btn-questionnaire-view');
  if (qViewBtn) {
    const showQ =
      vacancyQuestionnairePending(item) ||
      itemHasMeaningfulQuestionnaire(item) ||
      itemQuestionnaireNeedsProbe(item) ||
      currentApplyView === 'questionnaire';
    if (showQ) {
      qViewBtn.hidden = false;
      if (itemQuestionnaireNeedsProbe(item)) {
        qViewBtn.textContent = 'Анкета ↓';
        qViewBtn.dataset.tip = 'Загрузить текст вопросов с hh.ru';
      }
      qViewBtn.addEventListener('click', () => openQuestionnaireModal(item));
    }
  }

  const actions = node.querySelector('.actions');
  const doneReason = node.querySelector('.done-reason');

  if (item.status === 'pending') {
    actions.hidden = false;
    const ta = actions.querySelector('.reason');
    const ok = actions.querySelector('.ok');
    const bad = actions.querySelector('.bad');
    const coverBtn = actions.querySelector('.btn-cover');
    const refreshBtn = actions.querySelector('.btn-refresh-vacancy');

    if (coverBtn) {
      coverBtn.addEventListener('click', async () => {
      coverBtn.disabled = true;
      if (refreshBtn) refreshBtn.disabled = true;
      try {
        await requestCoverLetterGenerate(item.id, false);
        showToast('Сгенерированы варианты сопроводительного', 'good');
        await load();
      } catch (e) {
        if (e.status === 409) {
          const confirmed = confirm(
            'Письмо уже утверждено. Пересоздать черновик? (утверждённый текст будет сброшен до нового согласования)'
          );
          if (confirmed) {
            try {
              await requestCoverLetterGenerate(item.id, true);
              showToast('Новые варианты готовы', 'good');
              await load();
            } catch (e2) {
              alert(e2.message);
            }
          }
        } else {
          alert(e.message);
        }
      } finally {
        coverBtn.disabled = false;
        if (refreshBtn) refreshBtn.disabled = false;
      }
    });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      if (coverBtn) coverBtn.disabled = true;
      if (ok) ok.disabled = true;
      if (bad) bad.disabled = true;
      try {
        const refreshRes = await api('/api/vacancy/refresh-body', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        if (refreshRes.scoreUpdated) {
          showToast('Текст с hh.ru и оценка (OpenRouter) обновлены', 'good');
        } else if (refreshRes.scoreError) {
          showToast(`Текст обновлён с hh.ru. Оценка: ${refreshRes.scoreError}`, 'neutral');
        } else {
          showToast('Текст вакансии обновлён с hh.ru', 'good');
        }
        await load();
      } catch (e) {
        alert(e.message);
        refreshBtn.disabled = false;
        if (coverBtn) coverBtn.disabled = false;
        if (ok) ok.disabled = false;
        if (bad) bad.disabled = false;
      }
    });
    }

    const send = async (action) => {
      if (ok) ok.disabled = true;
      if (bad) bad.disabled = true;
      try {
        const data = await api('/api/action', {
          method: 'POST',
          body: JSON.stringify({
            id: item.id,
            action,
            reason: ta.value.trim(),
          }),
        });
        if (action === 'approve') {
          showToast('Сохранено: подходит', 'good');
        } else {
          const n = Array.isArray(data?.autoRejected) ? data.autoRejected.length : 0;
          if (n > 0) {
            showToast(`Отклонено + ещё ${n} похожих («${ta.value.trim()}»)`, 'bad');
          } else {
            showToast('Сохранено: не подходит', 'bad');
          }
        }
        await load({ preserveScroll: true, anchorCardId: item.id });
      } catch (e) {
        alert(e.message);
        if (ok) ok.disabled = false;
        if (bad) bad.disabled = false;
      }
    };
    ok?.addEventListener('click', () => send('approve'));
    bad?.addEventListener('click', () => send('reject'));
  } else {
    doneReason.textContent = item.feedbackReason
      ? `Комментарий: ${item.feedbackReason}`
      : '';
  }

  return node;
}

function syncVacancyTabs() {
  vacancyTabsEl?.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.status === currentStatus);
  });
}

function syncScoreBandTabs() {
  document.querySelectorAll('#panel-score-band .tab-band').forEach((b) => {
    b.classList.toggle('active', b.dataset.band === currentScoreBand);
  });
}

function batchScopeForCurrentView() {
  if (currentApplyView === 'hidden') return 'hidden';
  if (currentApplyView === 'questionnaire') return 'questionnaire';
  if (currentApplyView === 'noQuestionnaire') return 'noQuestionnaire';
  if (currentApplyView === 'queue') return 'queue';
  return null;
}

function batchScopeUiLabel(scope) {
  if (scope === 'hidden') return 'Скрытые';
  if (scope === 'questionnaire') return 'Анкета';
  if (scope === 'noQuestionnaire') return 'Без анкет';
  if (scope === 'queue') return 'Очередь';
  return '';
}

function updateBatchButtonsForView() {
  const scope = batchScopeForCurrentView();
  const autoBtn = document.getElementById('btn-batch-auto');
  const manualBtn = document.getElementById('btn-batch-manual');
  const disabled = !scope;
  for (const btn of [autoBtn, manualBtn]) {
    if (!btn) continue;
    btn.disabled = disabled;
    btn.classList.toggle('btn--disabled', disabled);
  }
  if (autoBtn && scope) {
    autoBtn.dataset.tip =
      scope === 'hidden'
        ? `Авто-батч по разделу «Скрытые» (≥${scoreThreshold}) — с предупреждением`
        : `Авто-батч · раздел «${batchScopeUiLabel(scope)}» · балл ≥${scoreThreshold}`;
  }
  if (manualBtn && scope) {
    manualBtn.dataset.tip =
      scope === 'hidden'
        ? `Ручной батч по разделу «Скрытые» (<${scoreThreshold}) — с предупреждением`
        : `Ручной батч · раздел «${batchScopeUiLabel(scope)}» · балл <${scoreThreshold}`;
  }
}

function syncApplyViewTabs() {
  if (!applyViewTabsEl) return;
  applyViewTabsEl.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.applyView === currentApplyView);
  });
  const hideQueueFilters =
    currentApplyView === 'applied' || currentApplyView === 'questionnaire';
  const queueFiltersEl = document.getElementById('sidebar-queue-filters');
  if (queueFiltersEl) queueFiltersEl.hidden = hideQueueFilters;

  updateBatchButtonsForView();

  const onQ = currentApplyView === 'questionnaire';
  const onApplied = currentApplyView === 'applied';
  const prepBtn = document.getElementById('btn-questionnaire-prep-batch');
  const reprobeBtn = document.getElementById('btn-questionnaire-reprobe-batch');
  const qActions = document.getElementById('context-questionnaire-actions');
  if (prepBtn) prepBtn.hidden = !onQ;
  if (reprobeBtn) reprobeBtn.hidden = !onQ;
  if (qActions) qActions.hidden = !onQ;
  document.querySelectorAll('[data-service-q-only]').forEach((el) => {
    el.hidden = !onQ;
  });

  const funnelEl = document.getElementById('applied-funnel-tabs');
  if (funnelEl) funnelEl.hidden = !onApplied;

  const contextBar = document.getElementById('main-context-bar');
  if (contextBar) contextBar.hidden = !onApplied && !onQ;
}

function mergeBatchAndApplyProgress(st) {
  const batch = st.batchProgress;
  const chat = st.applyChatProgress;
  const batchActive = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
  if (!batchActive || !batch) return batch;
  if (!chat || chat.phase === 'done' || chat.phase === 'error') return batch;
  const floor = Math.max(0, Math.floor(Number(batch.current) || 0));
  const current = Math.min(batch.total || 1, floor + (Number(chat.percent) || 0) / 100);
  const stepLabel = chat.label || '';
  return {
    ...batch,
    current,
    label: stepLabel && batch.label ? `${batch.label} — ${stepLabel}` : batch.label || stepLabel,
    detailStep: chat.step || batch.detailStep,
    lastLogLine: stepLabel || batch.lastLogLine,
  };
}

function startJobLogPoll() {
  if (applyLogPollTimer) clearInterval(applyLogPollTimer);
  applyLogPollTimer = setInterval(() => {
    const modal = document.getElementById('apply-log-modal');
    if (modal && !modal.hidden) refreshApplyLogModal({ silent: true });
    refreshJobStatus();
  }, 1200);
}

function pickJobProgressPayload(st) {
  const batchActive = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
  const batchMerged = batchActive ? mergeBatchAndApplyProgress(st) : st.batchProgress;
  if (batchActive && batchMerged) {
    return { ...batchMerged, title: 'Батч откликов' };
  }
  if (st.batchProgress?.phase === 'running' || st.batchProgress?.phase === 'paused') {
    return { ...st.batchProgress, title: 'Батч откликов' };
  }
  if (st.applyChat?.running && st.applyChatProgress) {
    return { ...st.applyChatProgress, title: 'Отклик в браузере' };
  }
  if (st.harvest?.running && st.harvestProgress) {
    return { ...st.harvestProgress, title: 'Сбор вакансий' };
  }
  if (st.applyChatProgress?.phase === 'done' || st.applyChatProgress?.phase === 'error') {
    return { ...st.applyChatProgress, title: 'Отклик в браузере' };
  }
  if (st.harvestProgress?.phase === 'done' || st.harvestProgress?.phase === 'error') {
    return { ...st.harvestProgress, title: 'Сбор вакансий' };
  }
  if (st.batchProgress?.phase === 'done' || st.batchProgress?.phase === 'error') {
    return { ...st.batchProgress, title: 'Батч откликов' };
  }
  return null;
}

function paintJobProgressBox(box, p, st, { scoped = false } = {}) {
  if (!box) return;
  const titleEl = scoped
    ? box.querySelector('.job-progress-title')
    : document.getElementById('job-progress-title');
  const pctEl = scoped ? box.querySelector('.job-progress-pct') : document.getElementById('job-progress-pct');
  const bar = scoped ? box.querySelector('.job-progress-bar') : document.getElementById('job-progress-bar');
  const labelEl = scoped
    ? box.querySelector('.job-progress-label')
    : document.getElementById('job-progress-label');
  const metaEl = scoped ? box.querySelector('.job-progress-meta') : document.getElementById('job-progress-meta');
  const track = box.querySelector('.job-progress-track');

  if (!p) {
    box.hidden = true;
    return;
  }

  box.hidden = false;
  box.classList.toggle('job-progress--done', p.phase === 'done');
  box.classList.toggle('job-progress--error', p.phase === 'error');
  box.classList.toggle('job-progress--paused', p.phase === 'paused');

  const pct = Math.min(100, Math.max(0, Number(p.percent) || 0));

  if (titleEl) titleEl.textContent = p.title || 'Выполнение';
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (bar) bar.style.width = `${pct}%`;
  if (track) {
    track.setAttribute('aria-valuenow', String(pct));
    track.setAttribute('aria-valuetext', `${pct}%`);
  }
  if (labelEl) labelEl.textContent = p.label || '';

  const parts = [];
  if (p.current != null && p.total) {
    const cur =
      Number.isInteger(p.current) || p.current === Math.floor(p.current)
        ? `${p.current}`
        : p.current.toFixed(1);
    parts.push(`${cur} / ${p.total}`);
  }
  if (p.elapsedSec != null) parts.push(`прошло ${p.elapsedSec} с`);
  if (p.etaLabel) parts.push(`осталось ${p.etaLabel}`);
  if (p.detailStep) parts.push(`шаг: ${p.detailStep}`);
  const s = p.stats || {};
  if (s.added != null) parts.push(`в очередь: ${s.added}`);
  if (s.skipped != null) parts.push(`пропущено: ${s.skipped}`);
  if (s.urlsFound != null) parts.push(`новых URL: ${s.urlsFound}`);
  if (s.newToProcess != null && s.urlsFound == null) parts.push(`на обход: ${s.newToProcess}`);
  if (s.serpCards != null) parts.push(`выдача: ${s.serpCards}`);
  if (s.skippedKnown != null && s.skippedKnown > 0) parts.push(`уже в очереди: ${s.skippedKnown}`);
  if (s.skippedTitle != null && s.skippedTitle > 0) parts.push(`фильтр заголовка: ${s.skippedTitle}`);
  if (s.knownIds != null) parts.push(`известно ID: ${s.knownIds}`);
  if (s.done != null) parts.push(`откликов: ${s.done}`);
  if (s.failed) parts.push(`ошибок: ${s.failed}`);
  if (metaEl) metaEl.textContent = parts.join(' · ');

  if (!scoped) {
    const logEl = document.getElementById('job-progress-log');
    if (logEl) {
      const tail = st?.applyLog?.tail || '';
      const batchActive = Boolean(st?.batchActive ?? st?.batch?.running ?? st?.batchControl?.batchRunning);
      const showLog = (batchActive || st?.applyChat?.running) && tail.trim();
      logEl.hidden = !showLog;
      if (showLog) {
        logEl.textContent = tail;
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  }
}

function renderJobProgress(st) {
  const p = pickJobProgressPayload(st);
  paintJobProgressBox(document.getElementById('job-progress'), p, st);
  const logModal = document.getElementById('apply-log-modal');
  if (logModal && !logModal.hidden) {
    paintJobProgressBox(document.getElementById('apply-log-progress'), p, st, { scoped: true });
  }
}

/** @type {'idle'|'harvest'|'batch'} */
let activeJobControl = 'idle';

function updateJobControlButtons(st) {
  const row = document.getElementById('job-control-row');
  const labelEl = document.getElementById('job-control-label');
  const pauseBtn = document.getElementById('btn-job-pause');
  const stopBtn = document.getElementById('btn-job-stop');
  const resumeBtn = document.getElementById('btn-job-resume');
  const bc = st.batchControl || {};
  const hc = st.harvestControl || {};
  const harvestRunning = Boolean(st.harvest?.running);
  const batchRunning = Boolean(st.batchActive ?? st.batch?.running ?? bc.batchRunning);

  if (harvestRunning) {
    activeJobControl = 'harvest';
    const paused = hc.command === 'paused';
    if (row) row.hidden = false;
    if (labelEl) labelEl.textContent = paused ? 'Сбор · пауза' : 'Сбор';
    if (pauseBtn) pauseBtn.disabled = paused;
    if (stopBtn) stopBtn.disabled = false;
    if (resumeBtn) {
      resumeBtn.disabled = !paused;
      resumeBtn.title = paused ? 'Продолжить сбор' : 'Сбор не на паузе';
    }
    return;
  }

  if (batchRunning || bc.canResume) {
    activeJobControl = 'batch';
    const paused = batchRunning && bc.command === 'paused';
    if (row) row.hidden = false;
    if (labelEl) labelEl.textContent = paused ? 'Батч · пауза' : 'Батч';
    if (pauseBtn) pauseBtn.disabled = !batchRunning || paused;
    if (stopBtn) stopBtn.disabled = !batchRunning;
    if (resumeBtn) {
      resumeBtn.disabled = paused ? false : !bc.canResume;
      resumeBtn.title = paused
        ? 'Снять паузу батча'
        : bc.canResume
          ? 'Продолжить прерванный батч'
          : 'Нет сохранённого батча';
    }
    return;
  }

  activeJobControl = 'idle';
  if (row) row.hidden = true;
}

async function postBatchControl(action) {
  const payload = JSON.stringify({ action });
  try {
    return await api('/api/batch-control', { method: 'POST', body: payload });
  } catch (e) {
    if (e.status !== 404) throw e;
    return await api('/api/hh-launch-apply-batch', { method: 'POST', body: payload });
  }
}

async function postHarvestControl(action) {
  return await api('/api/harvest-control', { method: 'POST', body: JSON.stringify({ action }) });
}

async function sendJobControl(action) {
  try {
    if (activeJobControl === 'harvest') {
      const res = await postHarvestControl(action);
      showToast(res.message || action, 'neutral');
    } else {
      const res = await postBatchControl(action);
      if (res.needsRelaunch) {
        const launch = await api('/api/hh-launch-apply-batch', {
          method: 'POST',
          body: JSON.stringify({ resume: true }),
        });
        showToast(launch.message || 'Батч продолжен', 'good');
        openApplyLogModal();
        startJobLogPoll();
      } else {
        showToast(res.message || action, 'neutral');
      }
    }
    refreshJobStatus();
  } catch (e) {
    const hint =
      e.status === 404
        ? 'Пауза/Стоп: перезапустите дашборд (npm run devops:dashboard) и обновите страницу (F5).'
        : e.message;
    alert(hint);
  }
}

async function probeBatchControlApi() {
  try {
    await api('/api/batch-control');
  } catch (e) {
    if (e.status === 404) {
      showToast('Перезапустите дашборд (npm run devops:dashboard) — иначе Пауза/Стоп не работают', 'neutral');
    }
  }
  try {
    await api('/api/harvest-control');
  } catch (e) {
    if (e.status === 404) {
      showToast('Перезапустите дашборд — пауза сбора недоступна', 'neutral');
    }
  }
}

function formatHumanJobStatus(st) {
  const bc = st.batchControl || {};
  const batchAlive = Boolean(st.batchActive ?? st.batch?.running ?? bc.batchRunning);
  const msgs = [];

  if (st.harvest?.running) {
    const hp = st.harvestProgress;
    const hc = st.harvestControl || {};
    if (hc.command === 'paused') {
      msgs.push(hp?.label?.trim() || 'Сбор на паузе');
    } else {
      msgs.push(hp?.label?.trim() || 'Собираем вакансии с hh.ru…');
    }
  }

  if (batchAlive) {
    const done = Number(bc.done) || 0;
    const planned = Number(bc.planned) || 0;
    const progress = planned ? ` (${done} из ${planned})` : '';
    if (bc.command === 'paused') {
      msgs.push(`Батч на паузе${progress}`);
    } else {
      const bp = st.batchProgress;
      const fromProgress = bp?.label?.trim();
      msgs.push(fromProgress || `Идёт батч откликов${progress}`);
    }
  } else if (bc.canResume) {
    const done = Number(bc.done) || 0;
    const planned = Number(bc.planned) || 0;
    msgs.push(
      planned
        ? `Батч не закончен (${done} из ${planned}) — «Продолжить» ниже`
        : 'Есть незавершённый батч — «Продолжить» ниже'
    );
  }

  if (st.applyChat?.running && !batchAlive) {
    const ap = st.applyChatProgress;
    msgs.push(ap?.label?.trim() || 'Отклик в браузере…');
  }

  if (st.browserLock?.held && !msgs.length) {
    const ownerLabels = {
      harvest: 'сбор вакансий',
      batch: 'батч откликов',
      'hh-apply-chat': 'отклик',
      'hh-apply-batch': 'батч',
    };
    const who = ownerLabels[st.browserLock.owner] || String(st.browserLock.owner || 'задача');
    msgs.push(`Браузер занят (${who})`);
  }

  let main = msgs.length ? msgs.join(' · ') : 'Готов к работе';

  if (st.harvestLog?.lastError && !st.harvest?.running) {
    main = 'Последний сбор завершился с ошибкой';
  }

  return { main, msgs };
}

function formatJobStatusTooltip(st, { msgs = [] } = {}) {
  const lines = [];
  if (st.harvest?.running && st.harvest.pid) lines.push(`Сбор вакансий (процесс ${st.harvest.pid})`);
  if (st.batch?.running && st.batch.pid) lines.push(`Батч (процесс ${st.batch.pid})`);
  if (st.applyChat?.running && st.applyChat.pid) lines.push(`Отклик (процесс ${st.applyChat.pid})`);
  if (st.queuePath) lines.push(`Файл очереди: ${st.queuePath}`);
  if (st.browserLock?.held) lines.push(`Блокировка браузера: ${st.browserLock.owner}`);
  if (st.harvestLog?.lastError && !st.harvest?.running) {
    lines.push(`Ошибка сбора: ${st.harvestLog.lastError}`);
  }
  const tail = st.harvestLog?.tail?.trim();
  if (tail) lines.push('', tail);
  if (!lines.length && msgs.length) return '';
  return lines.join('\n');
}

function formatHarvestStatsLine(h) {
  if (!h) return '';
  if (h.message) return h.message;
  if (h.added != null) return `Сбор: +${h.added} в очередь`;
  return '';
}

function formatDashboardStatsExtra(stats) {
  if (!stats) return '';
  const q = stats.queue || {};
  const roll = stats.appliedRolling || {};
  const f = stats.funnel || {};
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
  const parts = [];
  if (q.unionRecords != null) {
    parts.push(`всего карточек: ${q.unionRecords}`);
  } else if (q.queueTotal != null) {
    parts.push(`вакансий: ${q.queueTotal}`);
  }
  if (q.knownVacancyIds != null) {
    parts.push(`известно ID: ${q.knownVacancyIds}`);
  }
  if (roll.last7d != null) parts.push(`откл. 7д: ${roll.last7d}`);
  if (roll.sinceFunnel != null && roll.sinceLabel) {
    parts.push(`${roll.sinceLabel}: ${roll.sinceFunnel}`);
  }
  parts.push(`просмотр ${viewPct}%`);
  const hLine = formatHarvestStatsLine(stats.harvestLast);
  if (hLine) parts.push(hLine);
  return parts.join(' · ');
}

function renderFunnelMini(stats) {
  const el = document.getElementById('funnel-mini');
  if (!el || !stats) return;
  const f = stats.funnel || {};
  const applied = Number(stats.applied ?? f.applied ?? 0) || 0;
  const onHh = Number(stats.appliedOnHh ?? f.appliedOnHh ?? applied) || applied;
  const sinceLabel = stats.funnelSince ? `с ${stats.funnelSince}` : 'с 1 апр';
  const viewed = Number(stats.viewed ?? f.viewed ?? 0) || 0;
  const invited = Number(stats.invited ?? f.invited ?? 0) || 0;
  const awaiting = Number(stats.awaiting ?? 0) || 0;
  const declined = Number(stats.declined ?? f.declined ?? 0) || 0;
  const max = Math.max(applied, viewed, invited, 1);
  const invitePct = f.inviteRatePct ?? stats.rates?.invitePct ?? 0;
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
  const inQueue =
    stats.byStatus != null ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—';
  const steps = [
    { label: 'Очередь', count: inQueue, w: Math.min(100, (Number(inQueue) / Math.max(applied, 1)) * 100) },
    { label: 'Откл.', count: applied, w: (applied / max) * 100 },
    { label: 'Просм.', count: viewed, w: (viewed / max) * 100 },
    { label: 'Пригл.', count: invited, w: (invited / max) * 100 },
  ];
  el.hidden = false;
  const hhExtra = onHh > applied ? ` · hh ${onHh}` : '';
  el.innerHTML = `
    <div class="funnel-mini__rates">${sinceLabel}: ${applied} откл.${hhExtra} · ${viewPct}% просм. · ${invitePct}% пригл. · ждём ${awaiting} · отказ ${declined}</div>
    <div class="funnel-mini__bars">
      ${steps
        .map(
          (s) =>
            `<div class="funnel-mini__step" title="${s.label}: ${s.count}">
              <span class="funnel-mini__bar" style="width:${Math.max(4, s.w)}%"></span>
              <span class="funnel-mini__num">${s.count}</span>
            </div>`
        )
        .join('')}
    </div>`;
}

function readFunnelFiltersFromUI() {
  const periodVal = String(document.getElementById('funnel-filter-period')?.value ?? 'since:2026-04-01');
  const scope = document.getElementById('funnel-filter-scope')?.value || 'applied';
  const minRaw = document.getElementById('funnel-filter-min-score')?.value;
  const minScore = minRaw != null && String(minRaw).trim() !== '' ? Number(minRaw) : 0;
  /** @type {{ periodDays: number, since: string, scope: string, minScore: number }} */
  const out = { periodDays: 0, since: '', scope, minScore: Number.isFinite(minScore) ? minScore : 0 };
  if (periodVal.startsWith('since:')) {
    out.since = periodVal.slice(6);
  } else {
    const n = Number(periodVal);
    out.periodDays = Number.isFinite(n) ? n : 0;
  }
  return out;
}

function funnelFilterQuery(filters) {
  const p = new URLSearchParams();
  if (filters.since) p.set('since', filters.since);
  else p.set('period', String(filters.periodDays ?? 0));
  p.set('scope', filters.scope || 'applied');
  if (filters.minScore > 0) p.set('minScore', String(filters.minScore));
  return p.toString();
}

function renderFunnelModalBody(data) {
  const body = document.getElementById('funnel-modal-body');
  if (!body) return;
  if (!data) {
    body.innerHTML = '<p class="funnel-loading">Нет данных</p>';
    return;
  }
  const {
    counts,
    steps,
    rates,
    timeline,
    hhNegotiations,
    hhRates,
    scoreBuckets,
    filters,
    byResume,
    dataSources,
  } = data;
  const sinceNote = filters?.since
    ? `Период: с ${filters.since}`
    : filters?.periodDays
      ? `Период: ${filters.periodDays} дн.`
      : 'Период: всё время';
  const stepsSafe = Array.isArray(steps) ? steps : [];
  const timelineSafe = Array.isArray(timeline) ? timeline : [];
  const buckets = scoreBuckets && typeof scoreBuckets === 'object' ? scoreBuckets : { high: 0, mid: 0, low: 0, none: 0 };
  const hh = hhNegotiations && typeof hhNegotiations === 'object' ? hhNegotiations : { total: 0, viewed: 0, invited: 0, declined: 0, awaiting: 0, syncedAt: null };
  const hhR = hhRates && typeof hhRates === 'object' ? hhRates : { viewFromAll: 0, inviteFromAll: 0, declineFromAll: 0 };
  const ratesSafe = rates && typeof rates === 'object' ? rates : {};
  const countsSafe = counts && typeof counts === 'object' ? counts : {};
  const maxStep = Math.max(...stepsSafe.map((s) => s.count), 1);

  const funnelBars = stepsSafe
    .map((s) => {
      const w = Math.round((s.count / maxStep) * 100);
      const sub =
        s.pctOfApplied != null
          ? `${s.pctOfApplied}% от откликов`
          : s.pctOfPrev != null
            ? `${s.pctOfPrev}% от пред. шага`
            : `${s.pctOfBase ?? 0}%`;
      return `<div class="funnel-chart__row funnel-chart__row--${s.color || s.id}">
        <span class="funnel-chart__label">${s.label}</span>
        <div class="funnel-chart__track"><span class="funnel-chart__bar" style="width:${Math.max(2, w)}%"></span></div>
        <span class="funnel-chart__count">${s.count}</span>
        <span class="funnel-chart__pct">${sub}</span>
      </div>`;
    })
    .join('');

  const timelineChart = bucketTimelineForDisplay(timelineSafe);
  const timelineHtml = renderFunnelTimelineHtml(timelineChart);

  const sourcesLine = (dataSources || [])
    .map((s) => `${s.file} (${s.count})`)
    .join(' · ');
  const queueNote =
    data.queueOverview != null
      ? `<p class="funnel-period-note funnel-queue-note">Охват: <strong>${
          countsSafe.unionVacancyIds ?? data.queueOverview.queueTotal
        }</strong> вакансий · <strong>${countsSafe.unionRecords ?? data.queueOverview.unionRecords ?? '—'}</strong> карточек${
          data.queueOverview.hhCacheItems
            ? ` · кэш hh: ${data.queueOverview.hhCacheItems}`
            : ''
        }${sourcesLine ? `<br><span class="funnel-sources">${sourcesLine}</span>` : ''}</p>`
      : sourcesLine
        ? `<p class="funnel-period-note funnel-queue-note"><span class="funnel-sources">${sourcesLine}</span></p>`
        : '';

  const resumeRows = (byResume || [])
    .map(
      (r) =>
        `<tr><td>${r.label}</td><td>${r.applied}</td><td>${r.viewed}</td><td>${r.invited}</td><td>${r.declined}</td><td>${r.viewPct}%</td><td>${r.invitePct}%</td></tr>`
    )
    .join('');
  const resumeTable = resumeRows
    ? `<section class="funnel-panel funnel-panel--wide">
        <h3 class="funnel-panel__title">По резюме (роль вакансии)</h3>
        <table class="funnel-resume-table">
          <thead><tr><th>Резюме</th><th>Откл.</th><th>Просм.</th><th>Пригл.</th><th>Отказ</th><th>% просм.</th><th>% пригл.</th></tr></thead>
          <tbody>${resumeRows}</tbody>
        </table>
      </section>`
    : '';

  const harvestNote = data.harvestLast
    ? `<p class="funnel-period-note funnel-harvest-note">Последний сбор: ${
        data.harvestLast.message || '—'
      }${
        data.harvestLast.serpCards != null
          ? ` · выдача ${data.harvestLast.serpCards}, дубликаты ${data.harvestLast.skippedKnown ?? 0}`
          : ''
      }${
        data.harvestLast.finishedAt
          ? ` · ${new Date(data.harvestLast.finishedAt).toLocaleString('ru-RU')}`
          : ''
      }</p>`
    : '';

  body.innerHTML = `
    ${queueNote}
    ${harvestNote}
    <p class="funnel-period-note">${sinceNote} · откликов: <strong>${countsSafe.applied ?? 0}</strong>${
      countsSafe.appliedHhCacheOnly
        ? ` (${countsSafe.appliedHhCacheOnly} только из кэша hh — синхр. «Отклики» в сервисе)`
        : ''
    }</p>
    <div class="funnel-modal-grid">
      ${resumeTable}
      <section class="funnel-panel">
        <h3 class="funnel-panel__title">Воронка</h3>
        <div class="funnel-chart">${funnelBars}</div>
        <ul class="funnel-rates-list">
          <li>Просмотр от откликов: <strong>${ratesSafe.viewFromApplied ?? 0}%</strong></li>
          <li>Приглашения от откликов: <strong>${ratesSafe.inviteFromApplied ?? 0}%</strong></li>
          <li>Приглашения от просмотров: <strong>${ratesSafe.inviteFromViewed ?? 0}%</strong></li>
          <li>Отказы: ${countsSafe.declined ?? 0} (${ratesSafe.declineFromApplied ?? 0}%)</li>
          <li>Ждём ответ: ${countsSafe.awaiting ?? 0} · без статуса: ${countsSafe.noResponseYet ?? 0}</li>
        </ul>
      </section>
      <section class="funnel-panel funnel-panel--timeline">
        <h3 class="funnel-panel__title">Динамика откликов</h3>
        ${timelineHtml}
      </section>
      <section class="funnel-panel funnel-panel--half">
        <h3 class="funnel-panel__title">По баллам</h3>
        <div class="funnel-buckets">
          <div class="funnel-bucket"><span>≥70</span><strong>${buckets.high}</strong></div>
          <div class="funnel-bucket"><span>50–69</span><strong>${buckets.mid}</strong></div>
          <div class="funnel-bucket"><span>&lt;50</span><strong>${buckets.low}</strong></div>
          <div class="funnel-bucket"><span>без</span><strong>${buckets.none}</strong></div>
        </div>
        <h3 class="funnel-panel__title">Активность</h3>
        <ul class="funnel-rates-list">
          <li>Отклики за 7 дн.: <strong>${data.appliedRolling?.last7d ?? '—'}</strong></li>
          <li>Отклики за 30 дн.: <strong>${data.appliedRolling?.last30d ?? '—'}</strong></li>
          <li>Анкеты: ${countsSafe.withQuestionnaire ?? 0}</li>
          <li>Чаты ждут ответ: ${countsSafe.chatNeedsReply ?? 0}</li>
          <li>Отклонено в очереди: ${countsSafe.rejected ?? 0}</li>
        </ul>
      </section>
      <section class="funnel-panel funnel-panel--half">
        <h3 class="funnel-panel__title">Кэш hh.ru (все переговоры)</h3>
        <p class="funnel-panel__meta">${hh.syncedAt ? `Синхр.: ${new Date(hh.syncedAt).toLocaleString('ru-RU')}` : 'Синхронизируйте отклики в «Сервис»'}</p>
        <ul class="funnel-rates-list">
          <li>Всего: <strong>${hh.total}</strong></li>
          <li>Просмотр: ${hh.viewed} (${hhR.viewFromAll}%)</li>
          <li>Приглашения: ${hh.invited} (${hhR.inviteFromAll}%)</li>
          <li>Отказы: ${hh.declined} (${hhR.declineFromAll}%)</li>
          <li>Ждём: ${hh.awaiting}</li>
        </ul>
      </section>
    </div>`;
}

async function loadFunnelAnalytics(filters) {
  const q = funnelFilterQuery(filters ?? readFunnelFiltersFromUI());
  const [funnel, dash] = await Promise.all([
    api(`/api/funnel-analytics?${q}`),
    api('/api/dashboard-stats').catch(() => null),
  ]);
  if (dash) {
    funnel.queueOverview = dash.queue;
    funnel.harvestLast = dash.harvestLast;
    funnel.appliedRolling = dash.appliedRolling;
  }
  return funnel;
}

async function refreshFunnelModal() {
  const body = document.getElementById('funnel-modal-body');
  if (body) body.innerHTML = '<p class="funnel-loading">Загрузка…</p>';
  try {
    const data = await loadFunnelAnalytics();
    renderFunnelModalBody(data);
  } catch (e) {
    if (body) body.innerHTML = `<p class="err">${e.message}</p>`;
  }
}

function openFunnelModal() {
  closeServiceDrawer();
  const modal = document.getElementById('funnel-modal');
  if (!modal) return;
  openModalEl(modal);
  void refreshFunnelModal();
}

function closeFunnelModal() {
  const modal = document.getElementById('funnel-modal');
  if (!modal) return;
  closeModalEl(modal);
}

function initFunnelUi() {
  document.getElementById('btn-open-funnel')?.addEventListener('click', openFunnelModal);
  document.getElementById('stats-panel')?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-open-funnel')) return;
    openFunnelModal();
  });
  document.querySelectorAll('[data-close-funnel]').forEach((el) => {
    el.addEventListener('click', closeFunnelModal);
  });
  document.getElementById('funnel-filter-apply')?.addEventListener('click', () => refreshFunnelModal());
  for (const id of ['funnel-filter-period', 'funnel-filter-scope', 'funnel-filter-min-score']) {
    document.getElementById(id)?.addEventListener('change', () => {
      const modal = document.getElementById('funnel-modal');
      if (modal && !modal.hidden) refreshFunnelModal();
    });
  }
}

function renderDashboardStats(stats) {
  const panel = document.getElementById('stats-panel');
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  if (!stats) {
    grid.innerHTML = '<p class="stats-placeholder">Загрузка статистики…</p>';
    const mini = document.getElementById('funnel-mini');
    if (mini) mini.hidden = true;
    return;
  }
  const f = stats.funnel || {};
  if (panel) panel.hidden = false;
  renderFunnelMini(stats);
  const compact = panel?.classList.contains('stats-panel--crm');
  const invitePct = f.inviteRatePct ?? stats.rates?.invitePct ?? 0;
  const viewPct = f.viewRatePct ?? stats.rates?.viewPct ?? 0;
  const q = stats.queue || {};
  const roll = stats.appliedRolling || {};
  const items = compact
    ? [
        { label: 'Очередь', value: stats.byStatus ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—' },
        { label: 'Всего', value: q.unionRecords ?? stats.total ?? q.queueTotal ?? '—', title: 'Все очереди + кэш hh' },
        { label: 'ID известно', value: q.knownVacancyIds ?? '—', title: 'Учитывается при сборе (дедуп)' },
        { label: 'Отклики', value: stats.applied ?? f.applied ?? 0 },
        { label: '7 дней', value: roll.last7d ?? '—' },
        { label: 'Просмотр', value: stats.viewed ?? f.viewed ?? 0 },
        { label: '% просм.', value: `${viewPct}%` },
        { label: 'Пригл.', value: stats.invited ?? f.invited ?? 0, highlight: true },
        { label: '% пригл.', value: `${invitePct}%`, highlight: true },
        { label: 'Ждём', value: stats.awaiting ?? 0 },
        { label: 'Отказы', value: stats.declined ?? f.declined ?? 0 },
        { label: 'Анкеты', value: stats.withQuestionnaire ?? 0 },
        { label: 'Чаты', value: stats.chatNeedsReply ?? 0 },
      ]
    : [
        { label: 'В очереди', value: stats.byStatus ? (stats.byStatus.pending || 0) + (stats.byStatus.approved || 0) : '—' },
        { label: 'Откликов', value: stats.applied ?? f.applied ?? 0 },
        { label: 'Просмотрели', value: stats.viewed ?? f.viewed ?? 0 },
        { label: 'Приглашения', value: stats.invited ?? f.invited ?? 0, highlight: true },
        { label: 'Отказы', value: stats.declined ?? f.declined ?? 0 },
        { label: '% приглашений', value: `${f.inviteRatePct ?? stats.rates?.invitePct ?? 0}%`, highlight: true },
        { label: 'Чаты: вопрос', value: stats.chatNeedsReply ?? 0 },
        { label: 'Анкеты', value: stats.withQuestionnaire ?? 0 },
        {
          label: 'Воронка',
          value: `${f.viewRatePct ?? 0}% просмотр → ${f.inviteRatePct ?? 0}% пригл.`,
          wide: true,
        },
      ];
  if (!compact && stats.hhNegotiations?.total) {
    items.push({
      label: 'На hh.ru (всего)',
      value: stats.hhNegotiations.total,
      wide: true,
    });
    items.push({
      label: 'hh: просмотр / отказ',
      value: `${stats.hhNegotiations.viewed} / ${stats.hhNegotiations.declined}`,
    });
  }
  grid.replaceChildren(
    ...items.map((it) => {
      const div = document.createElement('div');
      div.className = `stat-item${it.wide ? ' stat-item--wide' : ''}`;
      if (it.title) div.title = it.title;
      const val = document.createElement('span');
      val.className = `stat-value${it.highlight ? ' stat-highlight' : ''}`;
      val.textContent = String(it.value);
      const lab = document.createElement('span');
      lab.className = 'stat-label';
      lab.textContent = it.label;
      div.append(val, lab);
      return div;
    })
  );

  const extraEl = document.getElementById('stats-extra');
  if (extraEl) {
    const extra = formatDashboardStatsExtra(stats);
    if (extra) {
      extraEl.textContent = extra;
      extraEl.hidden = false;
    } else {
      extraEl.textContent = '';
      extraEl.hidden = true;
    }
  }
}

async function refreshJobStatus() {
  const el = document.getElementById('job-status');
  if (!el) return;
  try {
    const st = await api('/api/job-status');
    renderJobProgress(st);
    updateJobControlButtons(st);
    if (st.harvestTick?.sequence > lastHarvestTickSeq) {
      lastHarvestTickSeq = st.harvestTick.sequence;
      load();
    }
    const { main, msgs } = formatHumanJobStatus(st);
    if (st.applyRates) renderApplyRateMeters(st.applyRates);
    renderDashboardStats(st.dashboardStats || st.conversion);
    el.textContent = main;
    el.title = formatJobStatusTooltip(st, { msgs });
    el.classList.toggle('job-status--busy', msgs.length > 0);
    el.classList.toggle('job-status--warn', Boolean(st.harvestLog?.lastError && !st.harvest?.running));

    if (applyChatWasRunning && !st.applyChat?.running) {
      const phase = st.applyChatProgress?.phase;
      await load();
      if (phase === 'done') {
        const msg =
          currentApplyView === 'applied'
            ? 'Отклик отправлен, список обновлён'
            : 'Отклик отправлен — карточка в разделе «Отклики»';
        showToast(msg, 'good');
      } else if (phase === 'error') {
        showToast('Отклик завершился с ошибкой — см. журнал', 'neutral');
      }
    }
    applyChatWasRunning = Boolean(st.applyChat?.running);

    if (harvestWasRunning && !st.harvest?.running) {
      const hp = st.harvestProgress;
      const msg = hp?.stats?.message || hp?.label || 'Сбор завершён';
      const added = hp?.stats?.added;
      const kind = added > 0 ? 'good' : 'neutral';
      const toastText =
        typeof added === 'number' && added > 0 ? `${msg} (+${added})` : msg;
      showToast(toastText, kind);
      void load();
    }
    harvestWasRunning = Boolean(st.harvest?.running);

    if (!st.applyChat?.running && !st.batch?.running && applyLogPollTimer) {
      clearInterval(applyLogPollTimer);
      applyLogPollTimer = null;
      document.querySelectorAll('.btn-apply-auto, .btn-apply-chat').forEach((b) => {
        b.disabled = false;
      });
      const modal = document.getElementById('apply-log-modal');
      if (modal && !modal.hidden) refreshApplyLogModal();
    }
  } catch {
    el.textContent = 'Статус: —';
  }
}

function captureListScroll(anchorCardId) {
  return { y: window.scrollY, anchorCardId: anchorCardId || null };
}

function restoreListScroll(state) {
  if (!state) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.anchorCardId) {
        const el = listEl.querySelector(`[data-record-id="${CSS.escape(state.anchorCardId)}"]`);
        if (el) {
          el.scrollIntoView({ block: 'nearest', behavior: 'instant' });
          return;
        }
      }
      window.scrollTo({ top: state.y, left: 0, behavior: 'instant' });
    });
  });
}

function updateListCount(items, counts) {
  const countEl = document.getElementById('list-count');
  if (!countEl) return;
  const filters = readFiltersFromUI();
  const hasLocalFilter =
    filters.search || filters.company || filters.minScore || filters.onlySalary;
  const shown = items.length;
  const total = cachedRawItems.length;
  const bandLabel =
    currentScoreBand === 'high'
      ? `Авто ≥${scoreThreshold}`
      : currentScoreBand === 'low'
        ? `Ручной <${scoreThreshold}`
        : 'Все';
  const filterNote =
    hasLocalFilter && total !== shown ? ` · показано ${shown} из ${total}` : ` · ${shown} карточек`;

  if (!counts) {
    countEl.textContent = `Загрузка…`;
    return;
  }
  if (currentApplyView === 'applied') {
    countEl.textContent = `${bandLabel}${filterNote} · откликов всего: ${counts.applied ?? '—'}`;
  } else if (currentApplyView === 'hidden') {
    countEl.textContent = `Скрытые${filterNote} · Senior/Lead, 1С, разработчик`;
  } else if (currentApplyView === 'questionnaire') {
    countEl.textContent = `С анкетой${filterNote} · ждут заполнения на hh.ru`;
  } else if (currentApplyView === 'noQuestionnaire') {
    countEl.textContent = `${bandLabel}${filterNote} · без анкеты · ≥${scoreThreshold}: ${counts.high ?? '—'}, <${scoreThreshold}: ${counts.low ?? '—'}`;
  } else {
    countEl.textContent = `${bandLabel}${filterNote} · ≥${scoreThreshold}: ${counts.high ?? '—'}, <${scoreThreshold}: ${counts.low ?? '—'} · откликов: ${counts.applied ?? 0}`;
  }
}

function renderListFromCache(scrollState) {
  const filters = readFiltersFromUI();
  const items = applyClientFilters(cachedRawItems, filters);
  updateListCount(items, cachedCounts);
  listEl.innerHTML = '';
  if (!items.length) {
    if (currentApplyView === 'applied') {
      listEl.innerHTML =
        '<p class="empty">Пока нет откликов через дашборд. После «Авто-отклик» или батча вакансии появятся здесь.</p>';
    } else if (currentApplyView === 'hidden') {
      listEl.innerHTML =
        '<p class="empty">Нет скрытых вакансий в этой вкладке. Смените диапазон баллов или статус.</p>';
    } else if (currentApplyView === 'questionnaire') {
      listEl.innerHTML =
        '<p class="empty">Нет вакансий с анкетой. На карточке: «Отклик + анкета» или «Загрузить с hh.ru» в модалке «Вопросы».</p>';
    } else if (currentApplyView === 'noQuestionnaire') {
      listEl.innerHTML =
        '<p class="empty">Нет вакансий без анкеты в этом диапазоне. С анкетой — раздел «Анкета», отфильтрованные роли — «Скрытые».</p>';
    } else if (cachedCounts?.hiddenByRole > 0 && !filters.search) {
      listEl.innerHTML = `<p class="empty">Все скрыты фильтрами роли или локальный поиск пуст. <button type="button" class="link-btn" data-goto-hidden>Скрытые (${cachedCounts.hiddenByRole})</button></p>`;
      listEl.querySelector('[data-goto-hidden]')?.addEventListener('click', () => {
        applyViewTabsEl?.querySelector('[data-apply-view="hidden"]')?.click();
      });
    } else {
      listEl.innerHTML =
        '<p class="empty">Ничего не найдено. Соберите вакансии или сбросьте фильтры слева.</p>';
    }
    restoreListScroll(scrollState);
    return;
  }
  items.forEach((it) => listEl.appendChild(renderCard(it)));
  restoreListScroll(scrollState);
}

async function load(opts = {}) {
  const scrollState = opts.preserveScroll ? captureListScroll(opts.anchorCardId) : null;
  if (!opts.preserveScroll) {
    listEl.innerHTML = '<p class="empty">Загрузка…</p>';
  }
  try {
    if (!settingsHydrated) await loadDashboardSettings();
    try {
      const { preferences } = await api('/api/preferences');
      const w = preferences?.llmScoreWeights;
      if (w) {
        let v = Number(w.vacancy);
        let c = Number(w.cvMatch);
        if (Number.isFinite(v) && Number.isFinite(c) && v + c > 0) {
          const sum = v + c;
          scoreWeights = { vacancy: v / sum, cvMatch: c / sum };
        }
      }
    } catch {
      scoreWeights = { vacancy: 0.35, cvMatch: 0.65 };
    }

    const { items: rawItems, counts } = await api(
      `/api/vacancies?status=${encodeURIComponent(currentStatus)}&scoreBand=${encodeURIComponent(currentScoreBand)}&applyView=${encodeURIComponent(currentApplyView)}`
    );
    let items = currentApplyView === 'hidden' ? rawItems : rawItems.filter((x) => itemPassesRoleFilters(x));
    items = filterItemsForApplyView(items);
    cachedRawItems = items;
    cachedCounts = counts;
    renderListFromCache(scrollState);
  } catch (e) {
    listEl.innerHTML = `<p class="err">${e.message}</p>`;
    restoreListScroll(scrollState);
  }
}

const rerenderListDebounced = debounce(() => renderListFromCache(null), 180);

vacancyTabsEl?.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentStatus = btn.dataset.status || 'pending';
    syncVacancyTabs();
    load();
  });
});

applyViewTabsEl?.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.applyView;
    currentApplyView =
      view === 'applied' ||
      view === 'hidden' ||
      view === 'questionnaire' ||
      view === 'noQuestionnaire' ||
      view === 'queue'
        ? view
        : 'queue';
    if (currentApplyView === 'questionnaire') openQuestionnaireOnNextLoad = true;
    syncApplyViewTabs();
    load();
  });
});

syncApplyViewTabs();

document.querySelectorAll('#panel-score-band .tab-band').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentScoreBand = btn.dataset.band || 'all';
    syncScoreBandTabs();
    load();
  });
});

async function runBatch({ minScore, maxScore, label }) {
  const batchScope = batchScopeForCurrentView();
  if (!batchScope) {
    showToast('Батч недоступен в разделе «Отклики»', 'neutral');
    return;
  }
  const limit = getBatchLimitForRun();
  const section = batchScopeUiLabel(batchScope);
  let confirmMsg = `${label}\nРаздел: «${section}»\nДо ${limit} откликов · PDF резюме + письмо из пула.`;
  if (batchScope === 'hidden') {
    confirmMsg =
      `Внимание: батч по скрытым вакансиям (Senior/Lead, 1С, разработчик и т.п.).\n\n${confirmMsg}`;
  } else if (batchScope === 'questionnaire') {
    confirmMsg +=
      '\n\nБатч по анкетам: вопросы сохраняются, ответы генерируются (CV/LLM), подстановка и повторная отправка (HH_BATCH_QUESTIONNAIRE_AUTO=1 по умолчанию).';
  } else if (batchScope === 'noQuestionnaire') {
    confirmMsg +=
      '\n\nЕсли при отклике на hh.ru появится анкета работодателя, отклик не будет отправлен: вопросы сохранятся, карточка перейдёт в раздел «Анкета», батч продолжит следующую вакансию.';
  } else if (batchScope === 'queue') {
    confirmMsg += '\n\nВ «Очереди» могут быть вакансии с анкетой — они тоже попадут в батч.';
  }
  confirmMsg += '\n\nПродолжить?';
  if (!confirm(confirmMsg)) return;
  try {
    const body = { limit, batchScope };
    if (minScore != null) body.minScore = minScore;
    if (maxScore != null) body.maxScore = maxScore;
    const res = await api('/api/hh-launch-apply-batch', { method: 'POST', body: JSON.stringify(body) });
    showToast(res.message || 'Батч запущен', 'neutral');
    openApplyLogModal();
    startJobLogPoll();
    refreshJobStatus();
  } catch (e) {
    alert(e.message);
  }
}

document.getElementById('btn-batch-auto')?.addEventListener('click', () =>
  runBatch({ minScore: scoreThreshold, label: `Авто ≥${scoreThreshold}` })
);
document.getElementById('btn-batch-manual')?.addEventListener('click', () =>
  runBatch({ maxScore: scoreThreshold - 1, label: `Ручной <${scoreThreshold}` })
);

document.getElementById('btn-job-pause')?.addEventListener('click', () => sendJobControl('pause'));
document.getElementById('btn-job-stop')?.addEventListener('click', () => {
  const msg =
    activeJobControl === 'harvest'
      ? 'Остановить сбор вакансий? Текущая страница прервётся.'
      : 'Остановить батч? Прогресс сохранится — можно будет нажать «Продолжить».';
  if (confirm(msg)) sendJobControl('stop');
});
document.getElementById('btn-job-resume')?.addEventListener('click', () => sendJobControl('resume'));

document.getElementById('btn-questionnaire-reprobe-batch')?.addEventListener('click', async () => {
  if (
    !confirm(
      'Открыть hh.ru в Chromium и обновить текст вопросов для карточек с заглушками?\n\n' +
        'За один раз — до 5 вакансий (нужна сессия npm run login).'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-questionnaire-reprobe-batch');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/reprobe-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: 5 }),
    });
    showToast(res.message || `Probe: ${res.okCount}`, res.failed ? 'neutral' : 'good');
    await loadItems();
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById('btn-questionnaire-prep-batch')?.addEventListener('click', async () => {
  if (
    !confirm(
      'Сгенерировать черновики ответов для всех карточек с анкетой (pending/approved)?\n\n' +
        'Используется CV/ и при HH_QUESTIONNAIRE_LLM=1 — LLM. Уже сохранённые ответы не перезаписываются.'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-questionnaire-prep-batch');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/questionnaire/prep-batch', { method: 'POST', body: '{}' });
    showToast(res.message || `Готово: ${res.okCount}`, 'good');
    await loadItems();
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

async function launchBackgroundApi(path, toastMsg) {
  const res = await api(path, { method: 'POST', body: '{}' });
  showToast(res.message || toastMsg || 'Запущено', 'good');
  refreshJobStatus();
}

async function runServiceAction(action, triggerEl) {
  closeServiceDrawer();
  const wasDisabled = Boolean(triggerEl?.disabled);
  if (triggerEl) triggerEl.disabled = true;
  try {
    switch (action) {
      case 'sync-hh-responses':
        await launchBackgroundApi('/api/launch-sync-hh-responses', 'Синхронизация откликов hh.ru');
        break;
      case 'sync-hh-chats':
        await launchBackgroundApi('/api/launch-sync-hh-chats', 'Синхронизация чатов');
        break;
      case 'apply-negotiations-cache': {
        const res = await api('/api/apply-negotiations-cache', { method: 'POST', body: '{}' });
        showToast(res.message || `Обновлено: ${res.updated}`, 'good');
        await loadItems();
        refreshJobStatus();
        break;
      }
      case 'import-negotiations-queue': {
        const res = await api('/api/import-negotiations-queue', { method: 'POST', body: '{}' });
        showToast(res.message || `Импорт: ${res.imported}`, 'good');
        await loadItems();
        break;
      }
      case 'prune-responded':
        if (
          !confirm(
            'Убрать из очереди все вакансии (Проверка/Подходят), где отклик уже на hh.ru?\n\n' +
              'Статус станет responded — батч их не тронет.'
          )
        ) {
          return;
        }
        {
          const res = await api('/api/prune-responded-queue', { method: 'POST' });
          showToast(res.message || `Убрано: ${res.changed}`, 'good');
          await loadItems();
        }
        break;
      case 'sync-resume-from-source':
        if (
          !confirm(
            'Проверить завершённость всех резюме и дополнить опыт/«О себе» с эталона (L2/L3)?\n\nОткроется Chromium.'
          )
        ) {
          return;
        }
        await launchBackgroundApi('/api/launch-sync-resume-from-source', 'Синхронизация резюме запущена');
        break;
      case 'sync-resume-variants':
        if (
          !confirm(
            'Обновить до 5 резюме на hh.ru?\n\nНужен config/resume-variants.json и Chromium (npm run devops:list-resumes).'
          )
        ) {
          return;
        }
        await launchBackgroundApi('/api/launch-sync-resume-variants', 'Обновление резюме на hh.ru');
        break;
      case 'import-interview-notes': {
        const res = await api('/api/import-interview-notes', { method: 'POST', body: '{}' });
        showToast(res.ok ? `Импорт: ${res.count} файлов` : res.error, res.ok ? 'good' : 'bad');
        break;
      }
      case 'chat-reply-batch':
        if (!confirm('Сгенерировать черновики ответов для до 15 карточек с вопросами в чате?')) return;
        {
          const res = await api('/api/chat-reply-batch', { method: 'POST', body: '{}' });
          showToast(`Готово: ${res.processed} черновиков`, 'good');
          await loadItems();
        }
        break;
      case 'questionnaire-reprobe':
        document.getElementById('btn-questionnaire-reprobe-batch')?.click();
        break;
      case 'questionnaire-prep':
        document.getElementById('btn-questionnaire-prep-batch')?.click();
        break;
      default:
        break;
    }
  } catch (e) {
    alert(e.message);
  } finally {
    if (triggerEl) triggerEl.disabled = wasDisabled;
  }
}

function initServiceActions() {
  document.querySelectorAll('[data-service-action]').forEach((el) => {
    el.addEventListener('click', () => {
      const action = el.dataset.serviceAction;
      if (action) void runServiceAction(action, el);
    });
  });
}
async function loadDailyRoutineSteps() {
  const list = document.getElementById('routine-steps');
  if (!list) return;
  try {
    const res = await api('/api/daily-routine');
    list.replaceChildren(
      ...(res.steps || []).map((s) => {
        const li = document.createElement('li');
        li.textContent = s.optional ? `${s.label} (опц.)` : s.label;
        li.title = s.detail || '';
        return li;
      })
    );
  } catch {
    list.innerHTML = '<li>Синхр. отклики → кэш → чаты</li>';
  }
}

document.getElementById('btn-daily-routine')?.addEventListener('click', async () => {
  const withHarvest = document.getElementById('daily-routine-harvest')?.checked;
  if (
    !confirm(
      'Запустить утренний цикл?\n\n' +
        '1) Синхр. откликов hh.ru (браузер)\n' +
        '2) Обновление статусов в очереди\n' +
        '3) Синхр. чатов (браузер)' +
        (withHarvest ? '\n4) Сбор вакансий (harvest)' : '') +
        '\n\nНе закрывайте окно Chromium до завершения.'
    )
  ) {
    return;
  }
  const btn = document.getElementById('btn-daily-routine');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/daily-routine-run', {
      method: 'POST',
      body: JSON.stringify({ withHarvest: !!withHarvest }),
    });
    showToast(res.message || 'Рутина запущена', 'good');
    refreshJobStatus();
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});


document.getElementById('btn-run-harvest')?.addEventListener('click', async () => {
  const periodRaw = document.getElementById('harvest-period')?.value;
  const period = periodRaw === '0' ? 0 : Number(periodRaw) || 7;
  const periodLabel =
    period === 0
      ? 'за всё время'
      : period === 1
        ? 'за сутки'
        : period === 3
          ? 'за 3 дня'
          : period === 7
            ? 'за неделю'
            : `${period} дн.`;
  const btn = document.getElementById('btn-run-harvest');
  if (btn) btn.disabled = true;
  try {
    const res = await api('/api/run-harvest', {
      method: 'POST',
      body: JSON.stringify({ periodDays: period }),
    });
    showToast(`Сбор запущен (${periodLabel}), pid ${res.pid}`, 'good');
    renderJobProgress({
      harvest: { running: true },
      harvestProgress: {
        phase: 'starting',
        percent: 0,
        label: 'Запуск…',
        title: 'Сбор вакансий',
      },
    });
    startJobLogPoll();
    refreshJobStatus();
    window.setTimeout(async () => {
      try {
        const st = await api('/api/job-status');
        if (!st.harvest?.running && st.harvestLog?.lastError) {
          showToast(st.harvestLog.lastError.slice(0, 220), 'bad');
          renderJobProgress({
            harvest: { running: false },
            harvestProgress: {
              phase: 'error',
              percent: 0,
              label: st.harvestLog.lastError.slice(0, 120),
              title: 'Сбор вакансий',
            },
          });
        }
      } catch {
        /* ignore */
      }
    }, 4000);
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById('filter-reset')?.addEventListener('click', () => {
  if (filterSearchEl) filterSearchEl.value = '';
  if (filterCompanyEl) filterCompanyEl.value = '';
  if (filterMinScoreEl) filterMinScoreEl.value = '';
  if (filterSortEl) filterSortEl.value = 'score-desc';
  if (filterSalaryEl) filterSalaryEl.checked = false;
  renderListFromCache(null);
});

for (const el of [filterSearchEl, filterCompanyEl, filterMinScoreEl, filterSortEl, filterSalaryEl]) {
  el?.addEventListener('input', rerenderListDebounced);
  el?.addEventListener('change', rerenderListDebounced);
}

for (const el of document.querySelectorAll('[data-pref]')) {
  el.addEventListener('input', () => {
    if (el === scoreThresholdInputEl) {
      const n = Number(scoreThresholdInputEl.value);
      if (Number.isFinite(n) && n >= 0 && n <= 100) {
        scoreThreshold = n;
        updateScoreBandTabLabels();
      }
    }
    scheduleSaveSettings();
  });
  el.addEventListener('change', () => {
    if (el === scoreThresholdInputEl) {
      const n = Number(scoreThresholdInputEl.value);
      if (Number.isFinite(n) && n >= 0 && n <= 100) {
        scoreThreshold = n;
        updateScoreBandTabLabels();
      }
    }
    scheduleSaveSettings();
  });
}

await applyLocalDashboardDefaults();
initUiScaleControls();
initThemeControls();
initCardTuningControls();
window.addEventListener('hh-card-density-change', () => renderListFromCache(null));
initFloatingTooltips();
initModalLayer({
  onEscape: (modalId) => {
    if (modalId) return closeModalById(modalId);
    return closeTopModal();
  },
});

syncVacancyTabs();
syncScoreBandTabs();
syncApplyViewTabs();
async function ensureChatTemplates() {
  if (chatTemplatesCache) return chatTemplatesCache;
  try {
    const res = await api('/api/chat-templates');
    chatTemplatesCache = res.templates || [];
  } catch {
    chatTemplatesCache = [];
  }
  return chatTemplatesCache;
}

function initCrmUi() {
  const funnelEl = document.getElementById('applied-funnel-tabs');
  document.querySelectorAll('[data-applied-funnel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentAppliedFunnel = btn.dataset.appliedFunnel || 'all';
      funnelEl?.querySelectorAll('[data-applied-funnel]').forEach((b) =>
        b.classList.toggle('active', b.dataset.appliedFunnel === currentAppliedFunnel)
      );
      renderListFromCache(null);
    });
  });

  const settingsModal = document.getElementById('settings-modal');
  const settingsTabBtns = settingsModal?.querySelectorAll('[data-settings-tab]') || [];
  const settingsPanels = {
    apply: document.getElementById('settings-panel-apply'),
    list: document.getElementById('settings-panel-list'),
    ui: document.getElementById('settings-panel-ui'),
  };

  function setSettingsTab(tabId) {
    const id = tabId || 'apply';
    try {
      sessionStorage.setItem('hh-settings-tab', id);
    } catch {
      /* ignore */
    }
    for (const btn of settingsTabBtns) {
      const on = btn.dataset.settingsTab === id;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const [key, panel] of Object.entries(settingsPanels)) {
      if (!panel) continue;
      const on = key === id;
      panel.classList.toggle('active', on);
      panel.hidden = !on;
    }
  }

  settingsTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => setSettingsTab(btn.dataset.settingsTab));
  });

  const openSettings = (tabId) => {
    closeServiceDrawer();
    if (!settingsModal) return;
    let tab = tabId;
    if (!tab) {
      try {
        tab = sessionStorage.getItem('hh-settings-tab') || 'apply';
      } catch {
        tab = 'apply';
      }
    }
    setSettingsTab(tab);
    settingsModal.hidden = false;
    openModalEl(settingsModal);
  };
  const closeSettings = () => {
    if (!settingsModal) return;
    settingsModal.hidden = true;
    closeModalEl(settingsModal);
  };
  document.getElementById('btn-open-settings')?.addEventListener('click', () => openSettings());
  settingsModal?.querySelector('[data-close-settings]')?.addEventListener('click', closeSettings);
  settingsModal?.querySelector('.modal-close--settings')?.addEventListener('click', closeSettings);

  initServiceDrawer();
}

function closeServiceDrawer() {
  const drawer = document.getElementById('service-drawer');
  if (!drawer) return;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
  drawer.classList.remove('service-drawer--open');
}

function openServiceDrawer() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal && !settingsModal.hidden) return;
  const drawer = document.getElementById('service-drawer');
  const panel = drawer?.querySelector('.service-drawer__panel');
  if (!drawer || !panel) return;
  drawer.hidden = false;
  drawer.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    drawer.classList.add('service-drawer--open');
    panel.focus();
  });
}

function initServiceDrawer() {
  const open = () => openServiceDrawer();
  document.getElementById('btn-open-service')?.addEventListener('click', open);
  document.querySelectorAll('.btn-open-service-alt, [data-open-service]').forEach((el) => {
    el.addEventListener('click', open);
  });
  document.querySelectorAll('[data-close-service]').forEach((el) => {
    el.addEventListener('click', closeServiceDrawer);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeServiceDrawer();
  });
}

loadDailyRoutineSteps();
initServiceActions();
initFunnelUi();
initCrmUi();
loadDashboardSettings().then(() => load());
refreshJobStatus();
setInterval(refreshJobStatus, 2000);
probeBatchControlApi();
