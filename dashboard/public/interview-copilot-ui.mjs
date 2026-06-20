/**
 * UI репетиции и live copilot в хабе собеседований.
 */

import {
  COPILOT_TAB_LABELS,
  COPILOT_WIZARD_STEPS,
  COPILOT_COMPAT_ROWS,
  COPILOT_STAGE_LABELS,
  copilotGuardLabel,
} from './dashboard-copy-ru.mjs';



const LARGE_FILE_HINT_MB = 400;



function esc(s) {

  return String(s ?? '')

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

}



function formatTime(sec) {

  const s = Math.max(0, Math.floor(sec));

  const m = Math.floor(s / 60);

  const r = s % 60;

  return `${m}:${String(r).padStart(2, '0')}`;

}



export function renderCopilotPanelHtml() {
  const compatRows = COPILOT_COMPAT_ROWS.map(
    (r) =>
      `<tr><td>${esc(r.name)}</td><td>${esc(r.loopback)}</td><td>${esc(r.dock)}</td><td>${esc(r.stealth)}</td></tr>`
  ).join('');
  const stageOpts = Object.entries(COPILOT_STAGE_LABELS)
    .map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`)
    .join('');

  return `
    <section class="funnel-panel interview-copilot-panel">
      <h3 class="funnel-panel__title">Суфлёр на собеседовании</h3>
      <p class="funnel-panel__meta">Подготовка, живой созвон и follow-up в одном месте — от слота E до офера</p>

      <div class="copilot-tabs" role="tablist" aria-label="Режимы суфлёра">
        ${Object.entries(COPILOT_TAB_LABELS)
          .map(
            ([id, label], i) =>
              `<button type="button" class="copilot-tabs__btn${i === 0 ? ' active' : ''}" role="tab" aria-selected="${i === 0}" data-copilot-tab="${id}" id="copilot-tab-${id}">${esc(label)}</button>`
          )
          .join('')}
      </div>

      <div class="copilot-tab-panel active" id="copilot-panel-prep" role="tabpanel" aria-labelledby="copilot-tab-prep">
        <details class="copilot-ethics muted" open>
          <summary>О суфлёре</summary>
          <p class="muted">Инструмент подготовки и уверенности. Тезисы — не зачитывайте дословно. Данные остаются на вашем ПК.</p>
        </details>
        <ul class="interview-copilot-panel__checklist muted" id="interview-copilot-checklist"></ul>
        <ol class="copilot-wizard" id="interview-copilot-wizard">
          <li data-wizard-step="context"><span>${esc(COPILOT_WIZARD_STEPS.context)}</span><em class="copilot-wizard__state" id="wizard-state-context">—</em></li>
          <li data-wizard-step="audio"><span>${esc(COPILOT_WIZARD_STEPS.audio)}</span><em class="copilot-wizard__state" id="wizard-state-audio">—</em></li>
          <li data-wizard-step="overlay"><span>${esc(COPILOT_WIZARD_STEPS.overlay)}</span><em class="copilot-wizard__state" id="wizard-state-overlay">—</em></li>
          <li data-wizard-step="start"><span>${esc(COPILOT_WIZARD_STEPS.start)}</span><em class="copilot-wizard__state" id="wizard-state-start">—</em></li>
        </ol>
        <div class="copilot-compat-wrap">
          <p class="muted">Совместимость (шаг overlay)</p>
          <table class="copilot-compat-table muted"><thead><tr><th>Платформа</th><th>Звук</th><th>Док</th><th>Шаринг</th></tr></thead><tbody>${compatRows}</tbody></table>
        </div>
        <label class="muted copilot-stage-label">Этап собеса
          <select id="interview-copilot-stage" class="interview-copilot-panel__select">${stageOpts}</select>
        </label>
        <div class="interview-copilot-panel__modes">
          <button type="button" class="btn btn-primary btn-sm" data-copilot-action="desktop-live">Поверх + живой</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="context-preview">Что подтянется в ответы</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="prep-overlay">Сценарий поверх</button>
        </div>
        <details class="muted">
          <summary>Дополнительно (без Desktop)</summary>
          <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="live-start">Живой режим (без захвата звука)</button>
        </details>
      </div>

      <div class="copilot-tab-panel" id="copilot-panel-live" role="tabpanel" aria-labelledby="copilot-tab-live" hidden>
        <div class="copilot-live-bar" id="interview-copilot-live-bar" aria-live="polite">
          <span class="copilot-live-bar__badge" id="copilot-live-badge">—</span>
          <span class="muted" id="copilot-live-question"></span>
        </div>
        <div class="interview-copilot-panel__modes">
          <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="live-stop" hidden>Остановить</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="answered-self" hidden title="Ctrl+Shift+S">Ответил сам</button>
          <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="dock-now">Док над встречей</button>
        </div>
        <label class="muted" id="interview-copilot-spoken-label" hidden>Что вы сказали
          <input type="text" id="interview-copilot-spoken-input" class="interview-copilot-panel__select" placeholder="кратко — для следующих подсказок" />
        </label>
        <div id="interview-copilot-gaze" class="interview-copilot-panel__gaze muted"></div>
        <p class="muted copilot-hotkeys-hint">Паника: <kbd>Ctrl+Shift+H</kbd> · Ответил сам: <kbd>Ctrl+Shift+S</kbd> · Обновить ответ: <kbd>Ctrl+Enter</kbd></p>
        <pre class="copilot-capture-log muted" id="interview-copilot-capture-log" hidden></pre>
      </div>

      <div class="copilot-tab-panel" id="copilot-panel-replay" role="tabpanel" aria-labelledby="copilot-tab-replay" hidden>
        <label class="interview-copilot-panel__label">Репетиция по записи</label>
        <ol class="interview-copilot-panel__steps muted">
          <li>Для больших записей (&gt;400 МБ) — блок «С диска»</li>
          <li>Или «Выбрать видео» — whisper на этом ПК</li>
          <li>Когда «Готово» — «Репетиция → суфлёр»</li>
        </ol>
        <video id="interview-copilot-video" class="interview-copilot-panel__video" controls hidden playsinline></video>
        <audio id="interview-copilot-audio" class="interview-copilot-panel__video" controls hidden></audio>
        <div class="interview-copilot-panel__scrub" id="interview-copilot-scrub" hidden>
          <label class="muted" for="interview-copilot-scrubber">Только транскрипт</label>
          <input type="range" id="interview-copilot-scrubber" min="0" max="100" value="0" step="0.1" style="width:100%" />
          <span class="muted" id="interview-copilot-scrub-time">0:00</span>
        </div>
        <input type="file" id="interview-copilot-video-file" accept="video/*,audio/*" hidden />
        <div class="interview-copilot-panel__replay-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-copilot-action="pick-video">Выбрать видео</button>
          <button type="button" class="btn btn-secondary btn-sm" data-copilot-action="simulate-run">Прогон на записи</button>
          <button type="button" class="btn btn-primary btn-sm" data-copilot-action="replay-start" disabled>Репетиция → суфлёр</button>
        </div>
        <div id="interview-copilot-simulate-debug" class="copilot-simulate-debug muted" hidden></div>
        <details class="interview-copilot-panel__local-opt" open>
          <summary class="muted">С диска (без загрузки в браузер)</summary>
          <p class="muted interview-copilot-panel__local-hint" id="interview-copilot-local-hint"></p>
          <select id="interview-copilot-local-video" class="interview-copilot-panel__select"><option value="">— выберите запись —</option></select>
          <button type="button" class="btn btn-secondary btn-sm" data-copilot-action="prepare-local">Подготовить с диска</button>
        </details>
        <details class="interview-copilot-panel__transcript-opt">
          <summary class="muted">Готовый транскрипт</summary>
          <select id="interview-copilot-transcript" class="interview-copilot-panel__select"><option value="">— выберите транскрипт —</option></select>
          <label class="muted" style="display:flex;align-items:center;gap:0.35rem;margin-top:0.35rem">
            <input type="checkbox" id="interview-copilot-transcript-only" /> Репетиция без видео
          </label>
        </details>
        <details class="interview-copilot-panel__offset-opt">
          <summary class="muted">Сдвиг суфлёра (±сек)</summary>
          <label class="muted" style="display:flex;align-items:center;gap:0.5rem">
            <input type="range" id="interview-copilot-offset" min="-3" max="3" step="0.2" value="0" />
            <span id="interview-copilot-offset-val">0</span>
          </label>
        </details>
      </div>

      <div class="copilot-tab-panel" id="copilot-panel-post" role="tabpanel" aria-labelledby="copilot-tab-post" hidden>
        <div class="interview-copilot-panel__debrief" id="interview-copilot-debrief">
          <label class="muted" for="interview-copilot-rating">Как прошло? (1–5)</label>
          <input type="range" id="interview-copilot-rating" min="1" max="5" step="1" value="4" />
          <span class="muted" id="interview-copilot-rating-val">4</span>
          <label class="muted" for="interview-copilot-unexpected">Неожиданный вопрос</label>
          <input type="text" id="interview-copilot-unexpected" class="interview-copilot-panel__select" placeholder="если был — кратко" />
          <div id="interview-copilot-offer-reminder" class="muted"></div>
          <div id="interview-copilot-debrief-body" class="interview-copilot-panel__debrief-body"></div>
          <textarea id="interview-copilot-followup" class="interview-copilot-panel__followup" rows="5" readonly hidden></textarea>
          <div class="interview-copilot-panel__replay-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-copilot-action="debrief-reload">Обновить debrief</button>
            <button type="button" class="btn btn-primary btn-sm" data-copilot-action="merge-notes">В заметки</button>
            <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="copy-followup">Копировать follow-up</button>
            <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="save-followup-chat">В черновик чата</button>
            <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="offer-pending">Жду ответ</button>
            <button type="button" class="btn btn-ghost btn-sm" data-copilot-action="offer-negotiating">Переговоры</button>
          </div>
        </div>
      </div>

      <p class="muted interview-copilot-panel__status" id="interview-copilot-status" aria-live="polite"></p>
      <dialog id="interview-copilot-context-dialog" class="copilot-context-dialog">
        <h4>Контекст ответов</h4>
        <pre id="interview-copilot-context-body" class="copilot-context-dialog__body"></pre>
        <button type="button" class="btn btn-secondary btn-sm" data-copilot-action="context-close">Закрыть</button>
      </dialog>
    </section>`;
}



function appendTranscriptOption(selectEl, it) {

  if (!selectEl) return;

  if ([...selectEl.options].some((o) => o.value === it.base)) return;

  const opt = document.createElement('option');

  opt.value = it.base;

  opt.textContent = it.name;

  selectEl.appendChild(opt);

}



function applyPrepareResult(r, hooks, els) {

  const { selectEl, videoEl, audioEl, replayBtn, statusEl, scrubEl, scrubber, scrubTime } = els;

  const preparedTranscriptBase = r.transcriptBase;

  appendTranscriptOption(selectEl, { base: r.transcriptBase, name: `${r.transcriptBase}.json` });

  if (selectEl) selectEl.value = r.transcriptBase;

  const isAudio = /\.(m4a|wav)$/i.test(r.videoUrl || r.localName || '');

  if (videoEl && r.videoUrl) {

    if (isAudio) {

      videoEl.hidden = true;

      if (audioEl) {

        audioEl.hidden = false;

        audioEl.src = r.videoUrl;

      }

    } else {

      videoEl.hidden = false;

      videoEl.src = r.videoUrl;

      if (audioEl) audioEl.hidden = true;

    }

  }

  replayBtn.disabled = false;

  const cached = r.cached ? ' (из кэша)' : '';

  const src = r.source === 'local' ? `С диска: ${r.localName || ''}` : 'Загрузка';

  const planInfo = r.promptCount

    ? ` · ${r.promptCount} точек ответа · готово ${r.pregenDone ?? 0}`

    : '';

  const warn =

    r.validation?.warnings?.length && statusEl

      ? ` ⚠ ${r.validation.warnings[0]}`

      : '';

  if (statusEl) {

    statusEl.textContent = `Готово (${src}): ${r.segmentCount} фрагментов речи${cached}${planInfo}. Нажмите «Репетиция → суфлёр».${warn}`;

  }

  if (scrubEl && scrubber && r.transcriptEndSec) {

    scrubber.max = String(r.transcriptEndSec);

  }

  return {

    transcriptBase: preparedTranscriptBase,

    prepContext: r.prepContext || '',

    title: r.title || '',

    sourceId: r.sourceId || '',

    transcriptEndSec: r.transcriptEndSec || 0,

    timingConfidence: r.timingConfidence || 'medium',

    promptCount: r.promptCount || 0,

  };

}



/**

 * @param {{ api: Function, showToast?: Function }} hooks

 * @param {HTMLElement} root

 */

export function initCopilotPanel(hooks, root) {

  if (!root) return;

  const panel = root.querySelector('.interview-copilot-panel');

  if (!panel) return;

  let activeTab = 'prep';
  let liveDashTimer = null;
  let lastSimulatePairs = [];

  function setCopilotTab(tabId) {
    activeTab = tabId;
    panel.querySelectorAll('[data-copilot-tab]').forEach((btn) => {
      const on = btn.getAttribute('data-copilot-tab') === tabId;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    for (const id of ['prep', 'live', 'replay', 'post']) {
      const el = panel.querySelector(`#copilot-panel-${id}`);
      if (el) el.hidden = id !== tabId;
    }
  }

  panel.querySelectorAll('[data-copilot-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-copilot-tab');
      if (tab) setCopilotTab(tab);
    });
  });

  function updateWizard() {
    const ctxOk = Boolean(meta.title || meta.vacancyId || meta.recordId);
    const audioOk =
      copilotPrefs.listenMic === false || Boolean(String(copilotPrefs.micDevice || '').trim());
    const overlayOk = Boolean(getInvoke());
    const set = (id, ok, hint) => {
      const el = panel.querySelector(`#wizard-state-${id}`);
      if (el) {
        el.textContent = ok ? '✓' : hint || '—';
        el.classList.toggle('copilot-wizard__state--ok', ok);
        el.classList.toggle('copilot-wizard__state--warn', !ok);
      }
    };
    set('context', ctxOk, 'выберите слот E');
    set('audio', audioOk, 'укажите микрофон в настройках');
    set('overlay', overlayOk, 'нужен HH Ai Desktop');
    set('start', ctxOk && (audioOk || copilotPrefs.listenMic === false), 'готово к старту');
  }

  function stopLiveDashPoll() {
    if (liveDashTimer) clearInterval(liveDashTimer);
    liveDashTimer = null;
  }

  function startLiveDashPoll() {
    stopLiveDashPoll();
    const badge = panel.querySelector('#copilot-live-badge');
    const qEl = panel.querySelector('#copilot-live-question');
    const logEl = panel.querySelector('#interview-copilot-capture-log');
    liveDashTimer = setInterval(async () => {
      if (!liveSessionId) return;
      try {
        const [sessR, snapR] = await Promise.all([
          hooks.api(`/api/interview-copilot/session?id=${encodeURIComponent(liveSessionId)}`),
          hooks.api(`/api/interview-copilot/spoken/snapshot?sessionId=${encodeURIComponent(liveSessionId)}`),
        ]);
        const s = sessR.session;
        if (badge && s) {
          const tier = s.lastAnswerTier || (s.lastPromptPushAt ? 'tier1' : 'listening');
          badge.textContent =
            tier === 2 || tier === 'tier2' ? 'Уточняю…' : tier === 1 || tier === 'tier1' ? 'Ответ' : 'Слушаю…';
          badge.classList.toggle('copilot-live-bar__badge--active', Boolean(s.running));
        }
        if (qEl && s?.lastQuestion) qEl.textContent = s.lastQuestion.slice(0, 120);
        if (logEl && snapR?.turns?.length) {
          logEl.hidden = false;
          logEl.textContent = snapR.turns
            .slice(-3)
            .map((t) => `Q: ${(t.questionText || '').slice(0, 60)}\nA: ${(t.spokenText || '').slice(0, 80)}`)
            .join('\n---\n');
        }
      } catch {
        /* ignore poll errors */
      }
    }, 2000);
  }



  const statusEl = panel.querySelector('#interview-copilot-status');

  const selectEl = panel.querySelector('#interview-copilot-transcript');

  const localSelectEl = panel.querySelector('#interview-copilot-local-video');

  const localHintEl = panel.querySelector('#interview-copilot-local-hint');

  const videoEl = panel.querySelector('#interview-copilot-video');

  const audioEl = panel.querySelector('#interview-copilot-audio');

  const scrubEl = panel.querySelector('#interview-copilot-scrub');

  const scrubber = panel.querySelector('#interview-copilot-scrubber');

  const scrubTime = panel.querySelector('#interview-copilot-scrub-time');

  const transcriptOnlyCb = panel.querySelector('#interview-copilot-transcript-only');

  const offsetEl = panel.querySelector('#interview-copilot-offset');

  const offsetVal = panel.querySelector('#interview-copilot-offset-val');

  const fileInput = panel.querySelector('#interview-copilot-video-file');

  const replayBtn = panel.querySelector('[data-copilot-action="replay-start"]');

  const pickBtn = panel.querySelector('[data-copilot-action="pick-video"]');

  const liveStopBtn = panel.querySelector('[data-copilot-action="live-stop"]');



  const els = { selectEl, videoEl, audioEl, replayBtn, statusEl, scrubEl, scrubber, scrubTime };



  let replaySessionId = null;

  let liveSessionId = null;

  let tickInFlight = false;

  let preparedTranscriptBase = null;

  let preparedSourceId = '';

  let preparedPrepContext = '';

  let preparedReplayTitle = '';

  let preparedTranscriptEndSec = 0;

  let preparing = false;

  let meta = { title: '', company: '', vacancyId: null };

  let copilotPrefs = {
    dockPreset: 'above-meeting',
    listenMic: true,
    learnFromSpoken: true,
    liveFontSize: 26,
  };

  let dockTimer = null;

  let captureLogTimer = null;

  let lastDebriefSessionId = null;

  let lastDebrief = null;

  let cachedInterviewPrep = null;



  function renderChecklist() {

    const el = panel.querySelector('#interview-copilot-checklist');

    if (!el) return;

    const items = [

      meta.title

        ? `Слот: ${meta.title}${meta.company ? ` · ${meta.company}` : ''}`

        : 'Выберите слот E в списке собеседований',

      'Проверьте контекст (кнопка ниже) перед live',

      'Desktop: «Поверх + живой» — loopback + overlay',

      'Полоска над Zoom; Ctrl+Shift+H — скрыть суфлёр',

      copilotPrefs.listenMic !== false ? 'Микрофон: учимся на ваших ответах' : 'Микрофон выкл — кнопка «Ответил сам»',

    ];

    el.innerHTML = items.map((i) => `<li>${esc(i)}</li>`).join('');
    updateWizard();
  }



  function getInvoke() {

    return (

      window.__TAURI__?.core?.invoke ||

      window.__TAURI_INTERNALS__?.invoke ||

      window.__TAURI__?.invoke

    );

  }



  async function loadCopilotPrefs() {

    try {

      const r = await hooks.api('/api/preferences');

      copilotPrefs = { ...copilotPrefs, ...(r.preferences?.interviewCopilot || {}) };
      const stageEl = panel.querySelector('#interview-copilot-stage');
      if (stageEl) stageEl.value = copilotPrefs.interviewStage || 'tech';

    } catch {

      /* defaults */

    }

  }



  async function loadGazeCapabilities() {

    const gazeEl = panel.querySelector('#interview-copilot-gaze');

    if (!gazeEl) return;

    try {

      const r = await hooks.api('/api/copilot/video-capabilities');

      const c = r.capabilities || {};

      const parts = [];

      if (c.gpuName) parts.push(`GPU: ${c.gpuName}`);

      if (c.broadcastInstalled) {

        parts.push('NVIDIA Broadcast установлен — включите Eye Contact в Broadcast перед созвоном');

      } else if (c.rtxEligible) {

        parts.push('RTX: установите NVIDIA Broadcast для eye contact на созвоне');

      } else {

        parts.push('Eye contact: держите взгляд в камеру; для RTX — NVIDIA Broadcast');

      }

      gazeEl.textContent = parts.join(' · ');

    } catch {

      gazeEl.textContent = 'Камера: проверьте NVIDIA Broadcast (eye contact) перед созвоном.';

    }

  }



  function stopDockPoll() {

    if (dockTimer) clearInterval(dockTimer);

    dockTimer = null;

  }



  function startDockPoll() {

    stopDockPoll();

    const invoke = getInvoke();

    if (!invoke || copilotPrefs.dockPreset !== 'above-meeting') return;

    const tick = () => {

      invoke('dock_teleprompter').catch(() => {});

    };

    tick();

    dockTimer = setInterval(tick, 5000);

  }



  function stopCaptureLogPoll() {

    if (captureLogTimer) clearInterval(captureLogTimer);

    captureLogTimer = null;

  }



  function startCaptureLogPoll() {

    stopCaptureLogPoll();

    captureLogTimer = setInterval(async () => {

      if (!liveSessionId) return;

      try {

        const r = await hooks.api('/api/copilot/capture-log?lines=5');

        const tail = r.tail || '';

        if (!tail || !statusEl) return;

        if (/fatal|error|\[mic\]/i.test(tail)) {

          statusEl.textContent = `Живой: ${tail.replace(/^\[[^\]]+\]\s*/, '').slice(0, 100)}`;

        }

      } catch {

        /* */

      }

    }, 6000);

  }



  async function pushPrepScenario() {

    let text =

      preparedPrepContext ||

      `Собес: ${meta.title || 'позиция'}${meta.company ? ` · ${meta.company}` : ''}\n\n` +

        'Ключевые тезисы из подготовки появятся здесь после репетиции или mock-собеса.';

    const employerQs =

      cachedInterviewPrep?.llm?.questionsToEmployer ||

      cachedInterviewPrep?.questionsToEmployer ||

      [];

    if (employerQs.length) {

      text += `\n\nМои вопросы работодателю:\n${employerQs.map((q) => `• ${q}`).join('\n')}`;

    }

    await hooks.api('/api/interview-prompt/prep-push', {

      method: 'POST',

      body: JSON.stringify({

        text,

        title: meta.title || 'Сценарий',

        preset: 'prep',

        mode: 'prep',

        autoScroll: true,

        fontSize: copilotPrefs.liveFontSize || 20,

        opacity: 0.82,

      }),

    });

  }



  async function loadDebrief(sessionId) {

    if (!sessionId) return;

    const debriefEl = panel.querySelector('#interview-copilot-debrief');

    const bodyEl = panel.querySelector('#interview-copilot-debrief-body');

    const followEl = panel.querySelector('#interview-copilot-followup');

    const ratingEl = panel.querySelector('#interview-copilot-rating');

    const unexpectedEl = panel.querySelector('#interview-copilot-unexpected');

    const offerEl = panel.querySelector('#interview-copilot-offer-reminder');

    if (!debriefEl || !bodyEl) return;

    const r = await hooks.api('/api/interview-copilot/post/debrief', {

      method: 'POST',

      body: JSON.stringify({

        sessionId,

        recordId: meta.vacancyId || meta.recordId,

        selfRating: Number(ratingEl?.value) || null,

        unexpectedQuestion: unexpectedEl?.value?.trim() || '',

      }),

    });

    lastDebriefSessionId = sessionId;

    lastDebrief = r.debrief;

    setCopilotTab('post');

    const turns = r.debrief?.turns || [];

    if (!turns.length) {

      bodyEl.innerHTML = '<p class="muted">Живых ответов не зафиксировано — debrief по guard flags и последнему вопросу.</p>';

    } else {

      bodyEl.innerHTML = turns

        .map(

          (t, i) => `

        <label class="interview-copilot-panel__debrief-turn" style="display:block;margin:0.35rem 0">

          <input type="checkbox" data-debrief-idx="${i}" checked />

          <span class="muted">${esc((t.questionText || 'вопрос').slice(0, 80))}</span>

          <div style="margin-left:1.2rem;font-size:0.9em">${esc((t.spokenText || '').slice(0, 400))}</div>

        </label>`

        )

        .join('');

    }

    const flags = r.debrief?.guardFlags || [];

    if (flags.length) {

      bodyEl.insertAdjacentHTML(

        'beforeend',

        `<p class="muted">Подсказки: ${flags.map((f) => esc(copilotGuardLabel(typeof f === 'string' ? f : f.kind || f))).join(' · ')}</p>`

      );

    }

    const preds = r.debrief?.followUpPredictions || [];

    if (preds.length) {

      bodyEl.insertAdjacentHTML(

        'beforeend',

        `<p class="muted"><strong>Возможные уточнения:</strong></p><ul>${preds.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`

      );

    }

    if (followEl && r.followUpDraft) {

      followEl.hidden = false;

      followEl.value = r.followUpDraft;

    }

    if (offerEl && r.offerTracker) {

      offerEl.textContent = `${r.offerTracker.reminder} (${r.offerTracker.bucket}, статус: ${r.offerTracker.decision})`;

    } else if (offerEl) {

      offerEl.textContent = 'Привяжите слот E — напоминание трекера оферов появится здесь.';

    }

  }



  function mediaEl() {

    if (transcriptOnlyCb?.checked) return null;

    if (audioEl && !audioEl.hidden && audioEl.src) return audioEl;

    if (videoEl?.src) return videoEl;

    return null;

  }



  function currentTimeSec() {

    const m = mediaEl();

    if (m) return m.currentTime;

    if (transcriptOnlyCb?.checked && scrubber) return Number(scrubber.value) || 0;

    return 0;

  }



  async function sendTick() {

    if (!replaySessionId || tickInFlight) return;

    tickInFlight = true;

    try {

      const r = await hooks.api('/api/interview-copilot/replay/tick', {

        method: 'POST',

        body: JSON.stringify({

          sessionId: replaySessionId,

          currentTimeSec: currentTimeSec(),

        }),

      });

      const sess = r.session;

      const total = sess?.promptTotal;

      const ap = r.activePrompt;

      if (statusEl && total) {

        const t = formatTime(currentTimeSec());

        const pos =

          ap && ap.index >= 0

            ? ` · ответ ${ap.index + 1}/${ap.total ?? total}`

            : '';

        statusEl.textContent = `Репетиция: ${t}${pos} · готово ${sess.pregenDone ?? '?'}/${total}`;

      }

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    } finally {

      tickInFlight = false;

    }

  }



  function bindMediaTick(el) {

    if (!el) return;

    el.addEventListener('timeupdate', () => {

      void sendTick();

    });

    el.addEventListener('seeked', () => {

      void sendTick();

    });

  }

  bindMediaTick(videoEl);

  bindMediaTick(audioEl);



  scrubber?.addEventListener('input', () => {

    if (scrubTime) scrubTime.textContent = formatTime(Number(scrubber.value));

    void sendTick();

  });



  offsetEl?.addEventListener('input', async () => {

    const v = Number(offsetEl.value);

    if (offsetVal) offsetVal.textContent = v.toFixed(1);

    if (preparedSourceId) {

      await hooks.api('/api/interview-copilot/replay/offset', {

        method: 'POST',

        body: JSON.stringify({ sourceId: preparedSourceId, offsetSec: v }),

      }).catch(() => {});

    }

  });



  transcriptOnlyCb?.addEventListener('change', () => {

    const on = transcriptOnlyCb.checked;

    if (scrubEl) scrubEl.hidden = !on;

    if (on && preparedTranscriptEndSec) {

      scrubber.max = String(preparedTranscriptEndSec);

      replayBtn.disabled = !preparedTranscriptBase;

    }

  });



  void hooks.api('/api/interview-copilot/replay/transcripts').then((r) => {

    for (const it of r.items || []) appendTranscriptOption(selectEl, it);

  }).catch(() => {});



  void hooks.api('/api/interview-copilot/replay/local-videos').then((r) => {

    if (localHintEl) {

      localHintEl.textContent = r.missing

        ? `Папка не найдена: ${r.dir}`

        : `Папка: ${r.dir}`;

    }

    for (const it of r.items || []) {

      const opt = document.createElement('option');

      opt.value = it.id;

      opt.textContent = `${it.name} (${it.sizeMb} МБ)`;

      localSelectEl?.appendChild(opt);

    }

  }).catch(() => {});



  selectEl?.addEventListener('change', async () => {

    if (selectEl.value) {

      preparedTranscriptBase = selectEl.value;

      if (!preparing) replayBtn.disabled = false;

      try {

        const planR = await hooks.api(

          `/api/interview-copilot/replay/plan?transcriptBase=${encodeURIComponent(selectEl.value)}`

        );

        preparedSourceId = planR.plan?.sourceId || '';

        preparedTranscriptEndSec = planR.plan?.transcriptEndSec || 0;

        if (scrubber && preparedTranscriptEndSec) scrubber.max = String(preparedTranscriptEndSec);

        if (statusEl) {

          statusEl.textContent = `Транскрипт: ${selectEl.value} · ${planR.plan?.prompts?.length || 0} точек`;

        }

      } catch {

        if (statusEl) statusEl.textContent = `Выбран транскрипт: ${selectEl.value}`;

      }

    }

  });



  pickBtn?.addEventListener('click', () => {

    fileInput?.click();

  });



  async function prepareVideo(file) {

    const sizeMb = Math.round(file.size / 1024 / 1024);

    if (sizeMb > LARGE_FILE_HINT_MB) {

      hooks.showToast?.(

        `Файл ~${sizeMb} МБ — быстрее через «С диска»: положите в папку интервью и нажмите «Подготовить с диска»`

      );

    }



    preparing = true;

    replayBtn.disabled = true;

    pickBtn.disabled = true;

    preparedTranscriptBase = null;

    if (statusEl) statusEl.textContent = `Загрузка «${file.name}» (${sizeMb} МБ)…`;



    try {

      if (statusEl) statusEl.textContent = `Загрузка и транскрибация «${file.name}» — подождите…`;



      const r = await hooks.api('/api/interview-copilot/replay/prepare-video', {

        method: 'POST',

        headers: {

          'Content-Type': 'application/octet-stream',

          'X-File-Name': encodeURIComponent(file.name),

        },

        body: file,

      });



      const prep = applyPrepareResult(r, hooks, els);

      preparedTranscriptBase = prep.transcriptBase;

      preparedSourceId = prep.sourceId;

      preparedPrepContext = prep.prepContext;

      preparedReplayTitle = prep.title;

      preparedTranscriptEndSec = prep.transcriptEndSec;

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

      if (statusEl) {

        statusEl.textContent = `Ошибка: ${e.message || e}. Для больших файлов — «С диска» ниже.`;

      }

      replayBtn.disabled = Boolean(selectEl?.value);

    } finally {

      preparing = false;

      pickBtn.disabled = false;

    }

  }



  fileInput?.addEventListener('change', () => {

    const file = fileInput.files?.[0];

    if (!file) return;

    void prepareVideo(file);

  });



  panel.querySelector('[data-copilot-action="prepare-local"]')?.addEventListener('click', async () => {

    const videoId = localSelectEl?.value;

    if (!videoId) {

      hooks.showToast?.('Выберите запись из списка');

      return;

    }

    preparing = true;

    replayBtn.disabled = true;

    preparedTranscriptBase = null;

    if (statusEl) statusEl.textContent = 'Подготовка с диска — транскрипт и план ответов…';

    try {

      const r = await hooks.api('/api/interview-copilot/replay/prepare-local', {

        method: 'POST',

        body: JSON.stringify({ videoId }),

      });

      const prep = applyPrepareResult(r, hooks, els);

      preparedTranscriptBase = prep.transcriptBase;

      preparedSourceId = prep.sourceId;

      preparedPrepContext = prep.prepContext;

      preparedReplayTitle = prep.title;

      preparedTranscriptEndSec = prep.transcriptEndSec;

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

      if (statusEl) statusEl.textContent = `Ошибка: ${e.message || e}`;

    } finally {

      preparing = false;

    }

  });



  void loadCopilotPrefs().then(() => {

    loadGazeCapabilities();

    renderChecklist();

    updateWizard();

  });



  const ratingEl = panel.querySelector('#interview-copilot-rating');

  const ratingVal = panel.querySelector('#interview-copilot-rating-val');

  ratingEl?.addEventListener('input', () => {

    if (ratingVal) ratingVal.textContent = ratingEl.value;

  });



  const answeredSelfBtn = panel.querySelector('[data-copilot-action="answered-self"]');



  async function startLive(pushOverlay = false) {

    await loadCopilotPrefs();

    const stage =
      meta.interviewStage ||
      copilotPrefs.interviewStage ||
      panel.querySelector('#interview-copilot-stage')?.value ||
      'tech';

    if (pushOverlay && copilotPrefs.listenMic !== false && !String(copilotPrefs.micDevice || '').trim()) {

      hooks.showToast?.('Укажите микрофон в Настройки → Суфлёр или отключите listenMic');

      updateWizard();

      return;

    }

    if (!pushOverlay) {

      hooks.showToast?.('Для захвата звука нужен HH Ai Desktop или npm run devops:copilot-capture');

    }

    try {

      const invoke = getInvoke();

      if (pushOverlay && invoke) {

        await invoke('start_copilot', {

          title: meta.title || 'Собеседование',

          company: meta.company || '',

          vacancyId: meta.vacancyId ? String(meta.vacancyId) : '',

          recordId: meta.recordId ? String(meta.recordId) : '',

          interviewStage: stage,

          prepContext: preparedPrepContext || meta.prepContext || '',

          scriptOnly: copilotPrefs.scriptOnlyOverlay !== false,

          listen_mic: copilotPrefs.listenMic !== false,

          wasapi_device: copilotPrefs.wasapiDevice || 'default',

          mic_device: copilotPrefs.micDevice || '',

        });

        for (let i = 0; i < 40; i++) {

          const r = await hooks.api('/api/interview-copilot/session?mode=live');

          if (r.session?.running) {

            liveSessionId = r.session.id;

            break;

          }

          await new Promise((res) => setTimeout(res, 250));

        }

        await invoke('show_teleprompter');

        startDockPoll();

        startCaptureLogPoll();

      } else {

        const r = await hooks.api('/api/interview-copilot/live/start', {

          method: 'POST',

          body: JSON.stringify({

            ...meta,

            prepContext: preparedPrepContext || meta.prepContext || '',

            scriptOnlyOverlay: pushOverlay,

          }),

        });

        liveSessionId = r.session?.id;

      }

      if (statusEl) {

        statusEl.textContent = pushOverlay

          ? 'Живой суфлёр: только текст ответа поверх экрана.'

          : 'Живой режим: запустите Desktop или скрипт захвата звука.';

      }

      liveStopBtn.hidden = false;

      answeredSelfBtn && (answeredSelfBtn.hidden = false);

      const spokenLabel = panel.querySelector('#interview-copilot-spoken-label');

      if (spokenLabel) spokenLabel.hidden = false;

      if (pushOverlay) startCaptureLogPoll();

      setCopilotTab('live');

      startLiveDashPoll();

      hooks.showToast?.(pushOverlay ? 'Живой суфлёр запущен' : 'Сессия без захвата — нужен Desktop');

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  }



  panel.querySelector('[data-copilot-action="live-start"]')?.addEventListener('click', () => {

    void startLive(false);

  });



  panel.querySelector('[data-copilot-action="desktop-live"]')?.addEventListener('click', () => {

    void startLive(true);

  });



  liveStopBtn?.addEventListener('click', async () => {

    const stoppedSessionId = liveSessionId;

    stopDockPoll();

    stopCaptureLogPoll();

    stopLiveDashPoll();

    if (stoppedSessionId) {

      try {

        await loadDebrief(stoppedSessionId);

      } catch (e) {

        hooks.showToast?.(e.message || 'Debrief недоступен');

      }

    }

    await hooks.api('/api/interview-copilot/live/stop', {

      method: 'POST',

      body: JSON.stringify({ sessionId: liveSessionId }),

    }).catch(() => {});

    const invoke = getInvoke();

    if (invoke) {

      await invoke('stop_copilot').catch(() => {});

      await invoke('hide_teleprompter').catch(() => {});

      await invoke('hide_teleprompter_prep').catch(() => {});

    }

    liveSessionId = null;

    liveStopBtn.hidden = true;

    if (answeredSelfBtn) answeredSelfBtn.hidden = true;

    const spokenLabel = panel.querySelector('#interview-copilot-spoken-label');

    if (spokenLabel) spokenLabel.hidden = true;

    if (statusEl) statusEl.textContent = 'Живой режим остановлен.';

    hooks.showToast?.('Оцените собес во вкладке «После»');

  });



  panel.querySelector('[data-copilot-action="prep-overlay"]')?.addEventListener('click', async () => {

    try {

      await pushPrepScenario();

      const invoke = getInvoke();

      if (invoke) {

        await invoke('show_teleprompter_prep');

        hooks.showToast?.('Сценарий поверх экрана');

      } else {

        window.open(`${location.origin}/teleprompter-prep.html?overlay=1`, 'hh-teleprompter-prep', 'width=520,height=360');

      }

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  });



  panel.querySelector('[data-copilot-action="dock-now"]')?.addEventListener('click', async () => {

    const invoke = getInvoke();

    if (!invoke) {

      hooks.showToast?.('Док над встречей — только в HH Ai Desktop');

      return;

    }

    try {

      await invoke('dock_teleprompter');

      hooks.showToast?.('Суфлёр над окном встречи');

    } catch (e) {

      hooks.showToast?.(e.message || 'Окно Zoom/Телемост не найдено');

    }

  });



  panel.querySelector('[data-copilot-action="debrief-reload"]')?.addEventListener('click', () => {

    if (lastDebriefSessionId) void loadDebrief(lastDebriefSessionId).catch((e) => hooks.showToast?.(e.message));

    else hooks.showToast?.('Сначала завершите живой режим');

  });



  panel.querySelector('[data-copilot-action="merge-notes"]')?.addEventListener('click', async () => {

    const bodyEl = panel.querySelector('#interview-copilot-debrief-body');

    if (!bodyEl || !lastDebrief) {

      hooks.showToast?.('Нет debrief');

      return;

    }

    const turns = lastDebrief.turns || [];

    const items = [...bodyEl.querySelectorAll('[data-debrief-idx]')].map((cb) => {

      const idx = Number(cb.getAttribute('data-debrief-idx'));

      const t = turns[idx];

      return {

        selected: cb.checked,

        text: t?.spokenText || '',

        questionText: t?.questionText || '',

      };

    });

    try {

      const r = await hooks.api('/api/interview-copilot/spoken/merge-notes', {

        method: 'POST',

        body: JSON.stringify({

          items,

          title: meta.title,

          learnProfile: copilotPrefs.learnFromSpoken !== false,

          debrief: lastDebrief,

        }),

      });

      hooks.showToast?.(`В заметки: ${r.added || 0} фрагментов`);

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  });



  panel.querySelector('[data-copilot-action="copy-followup"]')?.addEventListener('click', async () => {

    const followEl = panel.querySelector('#interview-copilot-followup');

    const text = followEl?.value?.trim();

    if (!text) {

      hooks.showToast?.('Нет черновика follow-up');

      return;

    }

    try {

      await navigator.clipboard.writeText(text);

      hooks.showToast?.('Follow-up скопирован');

    } catch {

      hooks.showToast?.('Не удалось скопировать');

    }

  });



  panel.querySelector('[data-copilot-action="save-followup-chat"]')?.addEventListener('click', async () => {

    const followEl = panel.querySelector('#interview-copilot-followup');

    const text = followEl?.value?.trim();

    const recordId = meta.vacancyId || meta.recordId;

    if (!text || !recordId) {

      hooks.showToast?.('Нет черновика или слота вакансии');

      return;

    }

    try {

      await hooks.api('/api/interview-copilot/post/save-followup', {

        method: 'POST',

        body: JSON.stringify({ recordId, text }),

      });

      hooks.showToast?.('Follow-up сохранён в черновик чата');

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  });



  answeredSelfBtn?.addEventListener('click', async () => {

    if (!liveSessionId) {

      hooks.showToast?.('Сначала запустите живой режим');

      return;

    }

    const inputEl = panel.querySelector('#interview-copilot-spoken-input');

    const text = inputEl?.value?.trim() || '';

    try {

      await hooks.api('/api/interview-copilot/spoken/mark', {

        method: 'POST',

        body: JSON.stringify({

          sessionId: liveSessionId,

          text,

          questionText: (await hooks.api(`/api/interview-copilot/session?id=${encodeURIComponent(liveSessionId)}`))

            .session?.lastQuestion || '',

        }),

      });

      if (inputEl) inputEl.value = '';

      hooks.showToast?.('Ваш ответ записан для следующих подсказок');

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  });



  panel.querySelector('[data-copilot-action="simulate-run"]')?.addEventListener('click', async () => {

    const transcriptBase = preparedTranscriptBase || selectEl?.value || 'interview-transcript-mini';

    if (statusEl) statusEl.textContent = 'Прогон на записи…';

    try {

      const r = await hooks.api('/api/interview-copilot/simulate/run', {

        method: 'POST',

        body: JSON.stringify({

          transcriptBase,

          recordId: meta.vacancyId || meta.recordId,

          vacancyId: meta.vacancyId,

          title: meta.title,

          company: meta.company,

          prepContext: preparedPrepContext,

          speed: 80,

        }),

      });

      const ready = r.readyForLive ? ' · готов к live' : '';

      lastSimulatePairs = r.questions || [];

      const dbg = panel.querySelector('#interview-copilot-simulate-debug');

      if (dbg && lastSimulatePairs.length) {

        dbg.hidden = false;

        dbg.innerHTML = `<strong>Последний прогон (${lastSimulatePairs.length} вопр.)</strong><ul>${lastSimulatePairs

          .slice(0, 8)

          .map((q) => `<li>${esc(String(q).slice(0, 100))}</li>`)

          .join('')}</ul>`;

      }

      if (statusEl) {

        statusEl.textContent = `Прогон: ${r.questions?.length || 0} вопр., guard=${r.guardCount || 0}${ready}`;

      }

      hooks.showToast?.(r.readyForLive ? 'Прогон OK — можно на live' : 'Прогон завершён');

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

      if (statusEl) statusEl.textContent = `Ошибка прогона: ${e.message || e}`;

    }

  });



  panel.querySelector('[data-copilot-action="context-preview"]')?.addEventListener('click', async () => {

    try {

      const r = await hooks.api('/api/interview-copilot/context/preview', {

        method: 'POST',

        body: JSON.stringify({

          title: meta.title,

          company: meta.company,

          vacancyId: meta.vacancyId,

          recordId: meta.recordId || meta.vacancyId,

          prepContext: preparedPrepContext,

          interviewStage: meta.interviewStage || copilotPrefs.interviewStage,

        }),

      });

      const dlg = panel.querySelector('#interview-copilot-context-dialog');

      const body = panel.querySelector('#interview-copilot-context-body');

      const lines = [

        `CV: ${r.cvLen} симв.`,

        `Чанков RAG: ${r.chunkCount}`,

        `Фокус: ${(r.focus || []).join(', ') || '—'}`,

        `Этап: ${r.interviewStage || meta.interviewStage || 'tech'}`,

        r.prepSummary ? `\nPrep:\n${r.prepSummary}` : '',

        r.employerQuestions?.length ? `\nВопросы работодателю:\n${r.employerQuestions.join('\n')}` : '',

      ].filter(Boolean);

      if (body) body.textContent = lines.join('\n');

      if (dlg?.showModal) dlg.showModal();

      else hooks.showToast?.(`Контекст: CV ${r.cvLen} симв., чанков ${r.chunkCount}`);

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  });



  panel.querySelector('[data-copilot-action="context-close"]')?.addEventListener('click', () => {

    panel.querySelector('#interview-copilot-context-dialog')?.close?.();

  });

  panel.querySelector('#interview-copilot-stage')?.addEventListener('change', (e) => {

    const v = e.target?.value;

    if (v) {

      meta.interviewStage = v;

      copilotPrefs.interviewStage = v;

      void hooks.api('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ patch: { 'interviewCopilot.interviewStage': v } }),
      }).catch(() => {});

    }

  });

  async function setOfferDecision(decision) {

    const recordId = meta.vacancyId || meta.recordId;

    if (!recordId) {

      hooks.showToast?.('Выберите слот E');

      return;

    }

    try {

      await hooks.api('/api/offer-decision', {

        method: 'POST',

        body: JSON.stringify({ id: recordId, status: decision }),

      });

      hooks.showToast?.(`Статус офера: ${decision}`);

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  }

  panel.querySelector('[data-copilot-action="offer-pending"]')?.addEventListener('click', () => {

    void setOfferDecision('pending');

  });

  panel.querySelector('[data-copilot-action="offer-negotiating"]')?.addEventListener('click', () => {

    void setOfferDecision('negotiating');

  });



  document.addEventListener('keydown', (e) => {

    if (e.ctrlKey && e.key === 'Enter' && liveSessionId) {

      e.preventDefault();

      void hooks

        .api('/api/interview-copilot/live/inject-question', {

          method: 'POST',

          body: JSON.stringify({

            sessionId: liveSessionId,

            question: meta.lastQuestion || 'Повторите последний вопрос',

          }),

        })

        .then(() => hooks.showToast?.('Ответ обновлён (Ctrl+Enter)'))

        .catch((err) => hooks.showToast?.(err.message || String(err)));

      return;

    }

    if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's') && liveSessionId) {

      e.preventDefault();

      answeredSelfBtn?.click();

    }

  });



  replayBtn?.addEventListener('click', async () => {

    const transcriptBase = preparedTranscriptBase || selectEl?.value || undefined;

    if (!transcriptBase) {

      hooks.showToast?.('Сначала подготовьте видео или выберите транскрипт');

      return;

    }

    const transcriptOnly = transcriptOnlyCb?.checked;

    const m = mediaEl();

    if (!transcriptOnly && !m?.src) {

      hooks.showToast?.('Нужно видео/аудио или включите «Репетиция без видео»');

      return;

    }

    try {

      const body = {

        title: preparedReplayTitle || meta.title,

        company: meta.company,

        vacancyId: meta.vacancyId,

        transcriptBase,

        sourceId: preparedSourceId || undefined,

        prepContext: preparedPrepContext,

      };

      const r = await hooks.api('/api/interview-copilot/replay/start', {

        method: 'POST',

        body: JSON.stringify(body),

      });

      replaySessionId = r.session?.id;

      const total = r.session?.promptTotal ?? 0;

      if (!total) {

        hooks.showToast?.('План пуст — пересоберите подготовку с диска');

      }

      if (m && !transcriptOnly) await m.play();

      if (transcriptOnly && scrubEl) scrubEl.hidden = false;

      void sendTick();

      const invoke = getInvoke();

      if (invoke) {

        await invoke('show_teleprompter').catch(() => {});

      } else {

        const url = `${location.origin}/teleprompter.html?overlay=1`;

        hooks.showToast?.('Браузерный суфлёр виден при шаринге — для созвона используйте Desktop');

        window.open(url, 'hh-teleprompter', 'width=480,height=240,menubar=no,toolbar=no');

      }

      if (statusEl) {

        statusEl.textContent = `Репетиция: ${total} точек ответа. Суфлёр — только текст для речи.`;

      }

    } catch (e) {

      hooks.showToast?.(e.message || String(e));

    }

  });



  return {

    setMeta(m) {

      meta = { ...meta, ...m, recordId: m.recordId || m.vacancyId || meta.recordId };

      if (m.interviewStage) copilotPrefs.interviewStage = m.interviewStage;

      if (m.interviewPrep) cachedInterviewPrep = m.interviewPrep;

      renderChecklist();

      const stageEl = panel.querySelector('#interview-copilot-stage');

      if (stageEl && (m.interviewStage || copilotPrefs.interviewStage)) {

        stageEl.value = m.interviewStage || copilotPrefs.interviewStage;

      }

      const slotId = m.vacancyId || m.recordId;

      if (slotId && !m.interviewPrep) {

        void hooks

          .api(`/api/interview-prep/cached?id=${encodeURIComponent(slotId)}`)

          .then((r) => {

            if (r.interviewPrep) cachedInterviewPrep = r.interviewPrep;

            updateWizard();

          })

          .catch(() => {});

      } else {

        updateWizard();

      }

    },

    setCopilotTab,

    focusPrepTab() {

      setCopilotTab('prep');

      panel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });

    },

  };

}


