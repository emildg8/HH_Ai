/**
 * Единый клиентский слой настроек: data-setting и совместимость с data-pref*.
 */

/** @param {string} path */
function splitPath(path) {
  return String(path || '')
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {unknown} root @param {string} path */
function getAtPath(root, path) {
  const parts = splitPath(path);
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = /** @type {Record<string, unknown>} */ (cur)[p];
  }
  return cur;
}

/** @param {Record<string, unknown>} root @param {string} path @param {unknown} value */
function setAtPath(root, path, value) {
  const parts = splitPath(path);
  if (!parts.length) return;
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = /** @type {Record<string, unknown>} */ (cur[p]);
  }
  cur[parts[parts.length - 1]] = value;
}

/** @param {HTMLElement} el */
function resolveSettingPath(el) {
  const direct = el.dataset.setting?.trim();
  if (direct) return direct;
  if (el.dataset.pref) return el.dataset.pref;
  if (el.dataset.prefBool) return el.dataset.prefBool;
  if (el.dataset.prefSelect) return el.dataset.prefSelect;
  const cop = el.dataset.copilotPref?.trim();
  if (cop) return `interviewCopilot.${cop}`;
  return '';
}

/** @param {HTMLElement} el */
function readElementValue(el) {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number' || el.type === 'range') {
      const n = Number(el.value);
      return Number.isFinite(n) ? n : el.value;
    }
    return String(el.value ?? '').trim();
  }
  if (el instanceof HTMLSelectElement) return String(el.value ?? '').trim();
  if (el instanceof HTMLTextAreaElement) {
    const raw = String(el.value || '').trim();
    if (el.dataset.settingType === 'string[]') {
      return raw
        .split(/\r?\n/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
    return raw;
  }
  return undefined;
}

/** @param {HTMLElement} el @param {unknown} value */
function writeElementValue(el, value) {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox') {
      el.checked = value !== false && value !== 'off' && value !== 'false';
      return;
    }
    if (el.type === 'number' || el.type === 'range') {
      const n = Number(value);
      el.value = String(Number.isFinite(n) ? n : el.value);
      return;
    }
    el.value = value == null ? '' : String(value);
    return;
  }
  if (el instanceof HTMLSelectElement) {
    el.value = value == null ? '' : String(value);
    return;
  }
  if (el instanceof HTMLTextAreaElement) {
    if (el.dataset.settingType === 'string[]' && Array.isArray(value)) {
      el.value = value.join('\n');
      return;
    }
    el.value = value == null ? '' : String(value);
  }
}

/**
 * @param {ParentNode} [root]
 * @returns {Record<string, unknown>}
 */
export function readSettingsPatchFromHub(root = document) {
  /** @type {Record<string, unknown>} */
  const flat = {};
  const seen = new Set();
  for (const el of root.querySelectorAll(
    '[data-setting], [data-pref], [data-pref-bool], [data-pref-select], [data-copilot-pref]'
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const path = resolveSettingPath(el);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    flat[path] = readElementValue(el);
  }
  /** @type {Record<string, unknown>} */
  const nested = {};
  for (const [path, value] of Object.entries(flat)) {
    if (path.includes('.')) setAtPath(nested, path, value);
    else nested[path] = value;
  }
  return nested;
}

/**
 * @param {ParentNode} [root]
 * @param {Record<string, unknown>} preferences
 */
export function hydrateSettingsHub(root = document, preferences = {}) {
  for (const el of root.querySelectorAll(
    '[data-setting], [data-pref], [data-pref-bool], [data-pref-select], [data-copilot-pref]'
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const path = resolveSettingPath(el);
    if (!path) continue;
    const v = getAtPath(preferences, path);
    if (v !== undefined) writeElementValue(el, v);
  }
}

/**
 * @param {{
 *   root?: ParentNode,
 *   onChange?: (el: HTMLElement) => void,
 * }} [opts]
 */
export function bindSettingsHub(opts = {}) {
  const root = opts.root || document.getElementById('settings-modal') || document;
  const onChange = opts.onChange || (() => {});

  for (const el of root.querySelectorAll(
    '[data-setting], [data-pref], [data-pref-bool], [data-pref-select], [data-copilot-pref]'
  )) {
    if (!(el instanceof HTMLElement)) continue;
    const fire = () => onChange(el);
    el.addEventListener('input', fire);
    el.addEventListener('change', fire);
  }
}

/** @param {Record<string, unknown>} flat */
export function expandDotPatch(flat) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    if (path.includes('.')) setAtPath(out, path, value);
    else out[path] = value;
  }
  return out;
}

/** @param {unknown} meta */
export function setSettingsRegistryMeta(meta) {
  clientRegistryMeta = meta && typeof meta === 'object' ? meta : null;
}

let clientRegistryMeta = null;

/**
 * @param {ParentNode} [root]
 * @param {string} query
 */
export function filterSettingsSearch(root = document, query = '') {
  const modal =
    root instanceof Document ? root.getElementById('settings-modal') : /** @type {HTMLElement} */ (root);
  if (!modal) return;
  const q = String(query || '').trim().toLowerCase();
  /** @type {Map<string, string[]>} */
  const keywordMap = new Map();
  if (clientRegistryMeta?.zones) {
    for (const entries of Object.values(clientRegistryMeta.zones)) {
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if (e?.path) keywordMap.set(e.path, e.keywords || []);
      }
    }
  }
  for (const group of modal.querySelectorAll('.settings-group, .settings-expert-fold')) {
    if (!(group instanceof HTMLElement)) continue;
    if (!q) {
      group.classList.remove('settings-group--search-hidden');
      continue;
    }
    const text = group.textContent?.toLowerCase() || '';
    const path = group.querySelector('[data-setting]')?.dataset?.setting || '';
    const kws = keywordMap.get(path) || [];
    const hit = text.includes(q) || path.toLowerCase().includes(q) || kws.some((k) => k.includes(q));
    group.classList.toggle('settings-group--search-hidden', !hit);
  }
  let visibleNav = 0;
  for (const btn of modal.querySelectorAll('.settings-nav__btn[data-settings-tab]')) {
    if (!(btn instanceof HTMLElement)) continue;
    if (!q) {
      btn.classList.remove('settings-nav__btn--search-hidden');
      visibleNav++;
      continue;
    }
    const tab = btn.dataset.settingsTab || '';
    const panel = document.getElementById(`settings-panel-${tab}`);
    const navText = btn.textContent?.toLowerCase() || '';
    const panelText = panel?.textContent?.toLowerCase() || '';
    const zoneKeywords = (clientRegistryMeta?.zones?.[tab] || [])
      .flatMap((e) => [e.label, ...(e.keywords || [])])
      .join(' ')
      .toLowerCase();
    const hit =
      navText.includes(q) || panelText.includes(q) || tab.includes(q) || zoneKeywords.includes(q);
    btn.classList.toggle('settings-nav__btn--search-hidden', !hit);
    if (hit) visibleNav++;
  }
  const emptyEl = document.getElementById('settings-search-empty');
  if (emptyEl instanceof HTMLElement) {
    emptyEl.hidden = !q || visibleNav > 0;
  }
}

/** @param {HTMLSelectElement} sel @param {string} value @param {string} label */
function ensureSelectOption(sel, value, label) {
  if (!value) return;
  if ([...sel.options].some((o) => o.value === value)) return;
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label || value;
  sel.append(opt);
}

/** @param {{ ffmpeg?: boolean, wasapi?: Array<{id:string,label:string}>, mic?: Array<{id:string,label:string}> }} devices */
function syncMicDeviceFallback(devices) {
  const micSel = document.getElementById('settings-mic-select');
  const micManual = document.getElementById('settings-mic-manual');
  const micWrap = document.getElementById('settings-mic-fallback');
  const useManual = devices.ffmpeg === false || !(devices.mic?.length);
  if (!(micSel instanceof HTMLSelectElement) || !(micManual instanceof HTMLInputElement) || !micWrap) return;

  if (useManual) {
    micWrap.hidden = false;
    const cur = micSel.value || micManual.value;
    micSel.removeAttribute('data-setting');
    micManual.setAttribute('data-setting', 'interviewCopilot.micDevice');
    if (cur) {
      micManual.value = cur;
      ensureSelectOption(micSel, cur, cur);
      micSel.value = cur;
    }
  } else {
    micWrap.hidden = true;
    micManual.removeAttribute('data-setting');
    micSel.setAttribute('data-setting', 'interviewCopilot.micDevice');
    if (micManual.value) {
      ensureSelectOption(micSel, micManual.value, micManual.value);
      micSel.value = micManual.value;
      micManual.value = '';
    }
  }
}

/**
 * @param {{ ffmpeg?: boolean, wasapi?: Array<{id:string,label:string}>, mic?: Array<{id:string,label:string}> }} devices
 */
export function fillCopilotDeviceSelects(devices = {}) {
  const wasapiSel = document.getElementById('settings-wasapi-select');
  const micSel = document.getElementById('settings-mic-select');
  if (wasapiSel instanceof HTMLSelectElement) {
    const cur = wasapiSel.value;
    wasapiSel.replaceChildren();
    for (const d of devices.wasapi || [{ id: 'default', label: 'По умолчанию (системный звук)' }]) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label || d.id;
      wasapiSel.append(opt);
    }
    if (cur) {
      ensureSelectOption(wasapiSel, cur, cur);
      wasapiSel.value = cur;
    }
  }
  if (micSel instanceof HTMLSelectElement) {
    const cur =
      micSel.value ||
      (document.getElementById('settings-mic-manual') instanceof HTMLInputElement
        ? document.getElementById('settings-mic-manual').value
        : '');
    micSel.replaceChildren();
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = 'Выберите устройство…';
    micSel.append(blank);
    for (const d of devices.mic || []) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label || d.id;
      micSel.append(opt);
    }
    if (cur) {
      ensureSelectOption(micSel, cur, cur);
      micSel.value = cur;
    }
  }
  syncMicDeviceFallback(devices);
}
