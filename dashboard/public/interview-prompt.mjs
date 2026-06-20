/**
 * Модалка суфлёра интервью (browser MVP) + push в desktop overlay.
 */

import { openModalEl, closeModalEl, getModalEl } from './modal-layout.mjs';
import { normalizeInterviewLines } from './interview-text-lines.mjs';

const LS_KEY = 'hh-interview-prompt-last';
const LS_SETTINGS_KEY = 'hh-interview-prompt-settings';

/** @type {object | null} */
let currentPack = null;
/** @type {ReturnType<typeof setInterval> | null} */
let scrollTimer = null;
let scrollPaused = false;

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any>, showToast?: (msg: string) => void }} hooks
 */
export function initInterviewPrompt(hooks) {
  document.getElementById('interview-prompt-close')?.addEventListener('click', closeInterviewPromptModal);
  document.querySelectorAll('[data-close-interview-prompt]').forEach((el) => {
    el.addEventListener('click', closeInterviewPromptModal);
  });
  document.getElementById('interview-prompt-play')?.addEventListener('click', toggleScroll);
  document.getElementById('interview-prompt-hide')?.addEventListener('click', () => {
    const body = document.getElementById('interview-prompt-text');
    if (body) body.hidden = !body.hidden;
  });
  document.getElementById('interview-prompt-fullscreen')?.addEventListener('click', () => {
    getModalEl('interview-prompt-modal')?.requestFullscreen?.().catch(() => {});
  });
  document.getElementById('interview-prompt-desktop')?.addEventListener('click', () => {
    void pushToDesktopOverlay(hooks);
  });
  document.getElementById('interview-prompt-popup')?.addEventListener('click', () => {
    void openTeleprompterPopup(hooks);
  });
  document.getElementById('interview-prompt-restore')?.addEventListener('click', () => {
    restoreLastPrompt(hooks);
  });

  for (const btn of document.querySelectorAll('[data-prompt-preset]')) {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-prompt-preset');
      if (preset && currentPack) void applyPreset(hooks, preset);
    });
  }

  for (const btn of document.querySelectorAll('[data-prompt-mode]')) {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-prompt-mode');
      document.querySelectorAll('[data-prompt-mode]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-prompt-mode') === mode);
      });
      if (mode === 'live') {
        hooks.showToast?.('Живой режим — вкладка «К собесу» в хабе собеседований → «Поверх + живой»');
        document.querySelector('[data-prompt-mode="prep"]')?.click();
        return;
      }
    });
  }

  const fontEl = document.getElementById('interview-prompt-font');
  fontEl?.addEventListener('input', () => applyDisplaySettings());
  const speedEl = document.getElementById('interview-prompt-speed');
  speedEl?.addEventListener('input', () => {
    applyDisplaySettings();
    restartScroll();
  });
  const opacityEl = document.getElementById('interview-prompt-opacity');
  opacityEl?.addEventListener('input', () => applyDisplaySettings());

  document.addEventListener('keydown', (e) => {
    const modal = getModalEl('interview-prompt-modal');
    if (!modal || modal.hidden) return;
    if (e.key === ' ' && e.target?.tagName !== 'INPUT' && e.target?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      toggleScroll();
    }
    if (e.key === 'h' || e.key === 'H') {
      const body = document.getElementById('interview-prompt-text');
      if (body) body.hidden = !body.hidden;
    }
  });

  loadSettingsToUi();
}

/**
 * @param {object} pack — prompt pack from lib
 * @param {{ api: Function, showToast?: Function }} hooks
 * @param {string} [preset]
 */
export async function openInterviewPromptModal(pack, hooks, preset = 'script') {
  currentPack = pack;
  const modal = getModalEl('interview-prompt-modal');
  if (!modal) return;

  const meta = document.getElementById('interview-prompt-meta');
  if (meta) meta.textContent = `${pack.title || 'Интервью'}${pack.company ? ` · ${pack.company}` : ''}`;

  await applyPreset(hooks, preset);
  saveLastPrompt(pack, preset);
  openModalEl(modal);
  restartScroll();
}

/** Модалка сразу, пока грузятся вопросы. */
export function openInterviewPromptLoading(meta, hooks) {
  currentPack = { source: 'loading', title: meta.title, company: meta.company, questions: [] };
  const modal = getModalEl('interview-prompt-modal');
  if (!modal) return;
  const metaEl = document.getElementById('interview-prompt-meta');
  if (metaEl) {
    metaEl.textContent = `${meta.title || 'Интервью'}${meta.company ? ` · ${meta.company}` : ''}`;
  }
  const textEl = document.getElementById('interview-prompt-text');
  if (textEl) textEl.textContent = 'Загрузка вопросов…';
  openModalEl(modal);
  stopScroll();
  hooks?.showToast?.('Собираем вопросы для суфлёра…', 'neutral');
}

/** Подставить пакет после загрузки (модалка уже открыта). */
export async function loadInterviewPromptPack(pack, hooks, preset = 'script') {
  currentPack = pack;
  await applyPreset(hooks, preset);
  saveLastPrompt(pack, preset);
  restartScroll();
}

export function closeInterviewPromptModal() {
  stopScroll();
  const modal = getModalEl('interview-prompt-modal');
  if (modal?.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  closeModalEl(modal);
}

/**
 * @param {{ api: Function }} hooks
 * @param {string} preset
 */
async function applyPreset(hooks, preset) {
  if (!currentPack) return;
  const textEl = document.getElementById('interview-prompt-text');
  if (preset === 'script' && textEl) textEl.textContent = 'Собираем сценарий ответов…';
  try {
    const res = await hooks.api('/api/interview-prompt/format', {
      method: 'POST',
      body: JSON.stringify({ pack: currentPack, preset }),
    });
    if (res.pack) currentPack = res.pack;
    if (textEl) textEl.textContent = res.state?.text || '';
    document.querySelectorAll('[data-prompt-preset]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-prompt-preset') === preset);
    });
    saveLastPrompt(currentPack, preset);
    applyDisplaySettings();
    if (preset === 'live' || res.state?.autoScroll === false) stopScroll();
    else restartScroll();
  } catch (e) {
    hooks.showToast?.(e?.message || String(e));
  }
}

async function startLiveFromModal(hooks) {
  try {
    const meta = {
      title: currentPack?.title || '',
      company: currentPack?.company || '',
      vacancyId: currentPack?.vacancyId || null,
    };
    await hooks.api('/api/interview-copilot/live/start', {
      method: 'POST',
      body: JSON.stringify(meta),
    });
    const textEl = document.getElementById('interview-prompt-text');
    if (textEl) {
      textEl.textContent = 'Живой режим: слушаю вопросы…\n\nОтвет появится здесь и в окне «Поверх всего».';
    }
    stopScroll();
    hooks.showToast?.('Живой режим. В Desktop: «Поверх всего» + захват звука.', 'neutral');
  } catch (e) {
    hooks.showToast?.(e?.message || String(e));
  }
}

function applyDisplaySettings() {
  const textEl = document.getElementById('interview-prompt-text');
  const wrap = document.getElementById('interview-prompt-scroll');
  if (!textEl || !wrap) return;
  const font = Number(document.getElementById('interview-prompt-font')?.value || 22);
  const opacity = Number(document.getElementById('interview-prompt-opacity')?.value || 88) / 100;
  textEl.style.fontSize = `${font}px`;
  wrap.style.opacity = String(opacity);
  persistSettings();
}

function toggleScroll() {
  scrollPaused = !scrollPaused;
  const btn = document.getElementById('interview-prompt-play');
  if (btn) btn.textContent = scrollPaused ? '▶' : '⏸';
  if (!scrollPaused) restartScroll();
  else stopScroll();
}

function restartScroll() {
  stopScroll();
  if (scrollPaused) return;
  const wrap = document.getElementById('interview-prompt-scroll');
  if (!wrap) return;
  const speed = Number(document.getElementById('interview-prompt-speed')?.value || 28);
  scrollTimer = setInterval(() => {
    wrap.scrollTop += 1;
    if (wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 2) {
      wrap.scrollTop = 0;
    }
  }, Math.max(12, 120 - speed));
}

function stopScroll() {
  if (scrollTimer) clearInterval(scrollTimer);
  scrollTimer = null;
}

function persistSettings() {
  try {
    localStorage.setItem(
      LS_SETTINGS_KEY,
      JSON.stringify({
        font: document.getElementById('interview-prompt-font')?.value,
        speed: document.getElementById('interview-prompt-speed')?.value,
        opacity: document.getElementById('interview-prompt-opacity')?.value,
      })
    );
  } catch {
    /* ignore */
  }
}

function loadSettingsToUi() {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.font) document.getElementById('interview-prompt-font').value = s.font;
    if (s.speed) document.getElementById('interview-prompt-speed').value = s.speed;
    if (s.opacity) document.getElementById('interview-prompt-opacity').value = s.opacity;
  } catch {
    /* ignore */
  }
}

function saveLastPrompt(pack, preset) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ pack, preset, at: new Date().toISOString() }));
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ api: Function, showToast?: Function }} hooks
 */
/**
 * @param {{ api: Function, showToast?: Function }} hooks
 */
export function openLastInterviewPrompt(hooks) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      hooks.showToast?.('Нет сохранённого суфлёра — сначала откройте «Хаб собеседований»');
      return;
    }
    const { pack, preset } = JSON.parse(raw);
    if (!pack) return;
    void openInterviewPromptModal(pack, hooks, preset || 'thesis');
  } catch {
    hooks.showToast?.('Не удалось восстановить суфлёр');
  }
}

function restoreLastPrompt(hooks) {
  openLastInterviewPrompt(hooks);
}

/**
 * @param {{ api: Function, showToast?: Function }} hooks
 */
async function buildAndPushState(hooks) {
  const preset =
    document.querySelector('[data-prompt-preset].active')?.getAttribute('data-prompt-preset') || 'thesis';
  const res = await hooks.api('/api/interview-prompt/format', {
    method: 'POST',
    body: JSON.stringify({ pack: currentPack, preset }),
  });
  const state = {
    ...res.state,
    fontSize: Number(document.getElementById('interview-prompt-font')?.value || 22),
    scrollSpeed: Number(document.getElementById('interview-prompt-speed')?.value || 28),
    opacity: Number(document.getElementById('interview-prompt-opacity')?.value || 88) / 100,
    paused: scrollPaused,
  };
  await hooks.api('/api/interview-prompt/push', {
    method: 'POST',
    body: JSON.stringify(state),
  });
  return state;
}

async function pushToDesktopOverlay(hooks) {
  if (!currentPack) return;
  try {
    await buildAndPushState(hooks);
    const invoke =
      window.__TAURI__?.core?.invoke ||
      window.__TAURI_INTERNALS__?.invoke ||
      window.__TAURI__?.invoke;
    if (invoke) {
      await invoke('show_teleprompter');
      hooks.showToast?.('Окно суфлёра поверх других приложений');
      return;
    }
    hooks.showToast?.('Состояние отправлено. Откройте HH Ai Desktop → кнопка Desktop или teleprompter.html');
  } catch (e) {
    hooks.showToast?.(e?.message || String(e));
  }
}

async function openTeleprompterPopup(hooks) {
  if (!currentPack) return;
  try {
    await buildAndPushState(hooks);
    const url = `${location.origin}/teleprompter.html?overlay=1`;
    window.open(url, 'hh-teleprompter', 'width=480,height=200,menubar=no,toolbar=no');
  } catch (e) {
    hooks.showToast?.(e?.message || String(e));
  }
}

/**
 * @param {object} rawPack — prep/mock/hr raw
 * @param {'prep'|'mock-tech'|'mock-hr'} source
 * @param {object} meta
 */
export function normalizeToPromptPack(rawPack, source, meta = {}) {
  if (source === 'prep') {
    return {
      source: 'prep',
      title: rawPack.vacancyTitle || meta.title,
      company: rawPack.company || meta.company,
      checklist: normalizeInterviewLines(rawPack.checklist),
      llm: rawPack.llm,
      pitch: rawPack.llm?.pitch,
      questions: normalizeInterviewLines([
        ...(rawPack.llm?.techQuestions || []),
        ...(rawPack.llm?.behavioralQuestions || []),
      ]),
      tips: normalizeInterviewLines(rawPack.insights?.prepTips),
      vacancyId: meta.id,
    };
  }
  if (source === 'mock-tech') {
    return {
      source: 'mock-tech',
      title: meta.title,
      company: meta.company,
      questions: normalizeInterviewLines(rawPack.questions),
      focus: normalizeInterviewLines(rawPack.focus),
      tips: normalizeInterviewLines(rawPack.tips),
      vacancyId: meta.id,
    };
  }
  return {
    source: 'mock-hr',
    title: meta.title || rawPack.title,
    company: meta.company || rawPack.company,
    questions: normalizeInterviewLines(rawPack.questions),
    checklist: normalizeInterviewLines(rawPack.checklist),
    suggestedAnswers: rawPack.suggestedAnswers || '',
    salaryHint: rawPack.salaryHint || '',
    vacancyId: meta.id,
  };
}
