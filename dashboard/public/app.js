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
} from './questionnaire-labels.mjs';
import {
  isChoiceQuestion,
  matchAnswerToOption,
  normalizeChoiceOptionLabel,
} from './questionnaire-choice.mjs';

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
let scoreThreshold = 50;
let batchSizeCap = 100;
/** @type {Record<string, { min: number, max: number }>} */
let prefBounds = {};
let settingsHydrated = false;
let preferencesSaveAvailable = null;
let lastHarvestTickSeq = 0;
let applyLogPollTimer = null;
let applyChatWasRunning = false;
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

function filterItemsForApplyView(items, view = currentApplyView) {
  if (view === 'noQuestionnaire') {
    return items.filter((x) => !vacancyHasHhApply(x) && !recordNeedsQuestionnaireWork(x));
  }
  if (view === 'questionnaire') {
    return items.filter((x) => !vacancyHasHhApply(x) && recordNeedsQuestionnaireWork(x));
  }
  return items;
}

function applyClientFilters(items, filters) {
  let out = filterItemsForApplyView([...items]);
  const q = filters.search.toLowerCase();
  if (q) {
    out = out.filter((it) => {
      const blob = [it.title, it.company, it.searchQuery, it.geminiSummary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
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
  return closeTopModal();
}

/** @type {{ id: string, item: object } | null} */
let questionnaireModalState = null;

function questionnaireAnswersMap(item) {
  const q = item?.hhApply?.questionnaire;
  const questions = meaningfulQuestions(q?.questions || []);
  const map = new Map();
  const suggested = q?.suggestedAnswers || [];
  const byPosition = suggested.length === questions.length;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const row =
      suggested.find((s) => Number(s.index) === question.index) ||
      (byPosition ? suggested[i] : null);
    if (row?.answer) map.set(question.index, String(row.answer));
  }

  for (const row of q?.savedAnswers || []) {
    if (Number.isFinite(row?.index) && String(row.answer || '').trim()) {
      map.set(row.index, String(row.answer));
    }
  }
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
  const questions = meaningfulQuestions(raw);
  const answers = questionnaireAnswersMap(item);

  body.innerHTML = '';
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
    await api('/api/questionnaire/save-answers', {
      method: 'POST',
      body: JSON.stringify({ id: questionnaireModalState.id, answers }),
    });
    showToast('Ответы сохранены в очереди', 'good');
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
  if (metaCompact) metaCompact.textContent = [...new Set(parts)].join(' · ');

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

  if (item.status === 'pending' && applyAutoBtn) {
    applyAutoBtn.disabled = false;
    if (currentApplyView === 'hidden') {
      applyAutoBtn.title = 'Скрыта фильтром — отклик на ваш риск';
    }
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

  if (approvedLetter) {
    applyChatBtn.disabled = false;
    applyChatBtn.removeAttribute('title');
    applyChatBtn.addEventListener('click', () =>
      launchApply(applyChatBtn, { usePoolLetter: false, tailorResume: true })
    );
  }

  const questionnaireBtn = node.querySelector('.btn-apply-questionnaire');
  if (questionnaireBtn && item.status === 'pending' && !vacancyHasHhApply(item)) {
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

    coverBtn.addEventListener('click', async () => {
      coverBtn.disabled = true;
      refreshBtn.disabled = true;
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
        refreshBtn.disabled = false;
      }
    });

    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      coverBtn.disabled = true;
      ok.disabled = true;
      bad.disabled = true;
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
        coverBtn.disabled = false;
        ok.disabled = false;
        bad.disabled = false;
      }
    });

    const send = async (action) => {
      ok.disabled = bad.disabled = true;
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
        ok.disabled = bad.disabled = false;
      }
    };
    ok.addEventListener('click', () => send('approve'));
    bad.addEventListener('click', () => send('reject'));
  } else {
    doneReason.textContent = item.feedbackReason
      ? `Комментарий: ${item.feedbackReason}`
      : '';
  }

  return node;
}

function syncVacancyTabs() {
  vacancyTabsEl.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.status === currentStatus);
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
  const hideStatus = currentApplyView === 'applied' || currentApplyView === 'questionnaire';
  if (vacancyTabsEl) vacancyTabsEl.hidden = hideStatus;
  document.getElementById('panel-vacancy-status')?.toggleAttribute('hidden', hideStatus);
  document.getElementById('panel-score-band')?.toggleAttribute('hidden', hideStatus);
  updateBatchButtonsForView();
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
  if (s.urlsFound != null) parts.push(`найдено URL: ${s.urlsFound}`);
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

function updateBatchControlButtons(st) {
  const row = document.getElementById('batch-control-row');
  const pauseBtn = document.getElementById('btn-batch-pause');
  const stopBtn = document.getElementById('btn-batch-stop');
  const resumeBtn = document.getElementById('btn-batch-resume');
  const bc = st.batchControl || {};
  const running = Boolean(st.batchActive ?? st.batch?.running ?? st.batchControl?.batchRunning);
  const paused = running && bc.command === 'paused';
  const show = running || bc.canResume;
  if (row) row.hidden = !show;
  if (pauseBtn) pauseBtn.disabled = !running || paused;
  if (stopBtn) stopBtn.disabled = !running;
  if (resumeBtn) {
    resumeBtn.disabled = paused ? false : !bc.canResume;
    resumeBtn.title = paused
      ? 'Снять паузу'
      : bc.canResume
        ? 'Продолжить прерванный батч'
        : 'Нет сохранённого батча';
  }
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

async function sendBatchControl(action) {
  try {
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
    refreshJobStatus();
  } catch (e) {
    const hint =
      e.status === 404
        ? 'Кнопки Пауза/Стоп требуют перезапуска дашборда: в терминале Ctrl+C, затем npm run devops:dashboard и обновите страницу (F5).'
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
}

function formatHumanJobStatus(st) {
  const bc = st.batchControl || {};
  const batchAlive = Boolean(st.batchActive ?? st.batch?.running ?? bc.batchRunning);
  const msgs = [];

  if (st.harvest?.running) {
    const hp = st.harvestProgress;
    msgs.push(hp?.label?.trim() || 'Собираем вакансии с hh.ru…');
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

async function refreshJobStatus() {
  const el = document.getElementById('job-status');
  if (!el) return;
  try {
    const st = await api('/api/job-status');
    renderJobProgress(st);
    updateBatchControlButtons(st);
    if (st.harvestTick?.sequence > lastHarvestTickSeq) {
      lastHarvestTickSeq = st.harvestTick.sequence;
      load();
    }
    const { main, msgs } = formatHumanJobStatus(st);
    if (st.applyRates) renderApplyRateMeters(st.applyRates);
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

vacancyTabsEl.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    vacancyTabsEl.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatus = btn.dataset.status;
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

document.querySelectorAll('.score-band-tabs .tab-band').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.score-band-tabs .tab-band').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentScoreBand = btn.dataset.band || 'all';
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
    confirmMsg += '\n\nВакансии с анкетой работодателя — возможна пауза на ручное заполнение (или HH_QUESTIONNAIRE_AUTO).';
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

document.getElementById('btn-batch-pause')?.addEventListener('click', () => sendBatchControl('pause'));
document.getElementById('btn-batch-stop')?.addEventListener('click', () => {
  if (confirm('Остановить батч? Прогресс сохранится — можно будет нажать «Продолжить».')) {
    sendBatchControl('stop');
  }
});
document.getElementById('btn-batch-resume')?.addEventListener('click', () => sendBatchControl('resume'));

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
syncApplyViewTabs();
loadDashboardSettings().then(() => load());
refreshJobStatus();
setInterval(refreshJobStatus, 2000);
probeBatchControlApi();
