/** Ширина/высота сетки, объём и размер текста в карточках (независимо от масштаба UI). */

import { applyCardDensity, normalizeCardDensity } from './ui-card-density.mjs';

const STORAGE_KEY = 'hh-dashboard-card-tuning';
const LEGACY_DENSITY_KEY = 'hh-dashboard-card-density';

const DEFAULTS = {
  colW: 40,
  minH: 0,
  textAmount: 50,
  fontScale: 100,
};

let activeDefaults = { ...DEFAULTS };

export function setCardTuningDefaults(partial) {
  activeDefaults = normalizeCardTuning({ ...DEFAULTS, ...partial });
}

export function getCardTuningDefaults() {
  return { ...activeDefaults };
}

export const CARD_TUNING_LIMITS = {
  colW: { min: 18, max: 72, step: 0.5 },
  minH: { min: 0, max: 72, step: 0.5 },
  textAmount: { min: 0, max: 100, step: 1 },
  fontScale: { min: 70, max: 160, step: 1 },
};

const LIMITS = CARD_TUNING_LIMITS;

function clamp(n, min, max, step = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  let snapped = step > 0 ? Math.round(v / step) * step : v;
  if (step < 1) snapped = Math.round(snapped * 10) / 10;
  return Math.min(max, Math.max(min, snapped));
}

function formatRem(rem) {
  const n = clamp(rem, 0, 999, 0.5);
  if (n <= 0) return 'авто';
  return Number.isInteger(n) ? `${n}rem` : `${n.toFixed(1)}rem`;
}

function syncRangeLimits() {
  const map = [
    ['card-col-w-range', 'colW'],
    ['card-min-h-range', 'minH'],
    ['card-text-range', 'textAmount'],
    ['card-font-range', 'fontScale'],
  ];
  for (const [id, key] of map) {
    const el = document.getElementById(id);
    const lim = LIMITS[key];
    if (!el || !lim) continue;
    el.min = String(lim.min);
    el.max = String(lim.max);
    el.step = String(lim.step);
  }
}

export function textAmountToDensity(amount) {
  const t = clamp(amount, 0, 100, 1);
  if (t <= 33) return 'compact';
  if (t <= 66) return 'medium';
  return 'full';
}

export function densityToTextAmount(density) {
  const d = normalizeCardDensity(density);
  if (d === 'compact') return 15;
  if (d === 'full') return 85;
  return 50;
}

export function normalizeCardTuning(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    colW: clamp(o.colW ?? DEFAULTS.colW, LIMITS.colW.min, LIMITS.colW.max, LIMITS.colW.step),
    minH: clamp(o.minH ?? DEFAULTS.minH, LIMITS.minH.min, LIMITS.minH.max, LIMITS.minH.step),
    textAmount: clamp(
      o.textAmount ?? DEFAULTS.textAmount,
      LIMITS.textAmount.min,
      LIMITS.textAmount.max,
      LIMITS.textAmount.step
    ),
    fontScale: clamp(
      o.fontScale ?? DEFAULTS.fontScale,
      LIMITS.fontScale.min,
      LIMITS.fontScale.max,
      LIMITS.fontScale.step
    ),
  };
}

export function readCardTuning() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeCardTuning(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_DENSITY_KEY);
    if (legacy) {
      return normalizeCardTuning({
        ...DEFAULTS,
        textAmount: densityToTextAmount(legacy),
      });
    }
  } catch {
    /* ignore */
  }
  return { ...activeDefaults };
}

let lastDensity = null;

export function writeCardTuning(partial) {
  const next = normalizeCardTuning({ ...readCardTuning(), ...partial });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  applyCardTuning(next);
  return next;
}

export function readCardDensity() {
  return textAmountToDensity(readCardTuning().textAmount);
}


export function applyCardTuning(tuning) {
  const t = normalizeCardTuning(tuning);
  const root = document.documentElement;
  const list = document.getElementById('list');

  root.style.setProperty('--card-col-w', `${t.colW}rem`);
  if (t.minH > 0) root.style.setProperty('--card-min-h', `${t.minH}rem`);
  else root.style.removeProperty('--card-min-h');
  root.style.setProperty('--card-font-scale', String(t.fontScale / 100));

  const density = textAmountToDensity(t.textAmount);
  applyCardDensity(density);
  root.dataset.cardTextAmount = String(t.textAmount);
  if (list) list.dataset.cardTextAmount = String(t.textAmount);

  const controls = [
    { rangeId: 'card-col-w-range', labelId: 'card-col-w-value', key: 'colW', label: formatRem(t.colW) },
    {
      rangeId: 'card-min-h-range',
      labelId: 'card-min-h-value',
      key: 'minH',
      label: formatRem(t.minH),
    },
    {
      rangeId: 'card-text-range',
      labelId: 'card-text-value',
      key: 'textAmount',
      label: `${t.textAmount}%`,
    },
    {
      rangeId: 'card-font-range',
      labelId: 'card-font-value',
      key: 'fontScale',
      label: `${t.fontScale}%`,
    },
  ];
  for (const { rangeId, labelId, key, label } of controls) {
    const range = document.getElementById(rangeId);
    const labelEl = document.getElementById(labelId);
    if (range) range.value = String(t[key]);
    if (labelEl) labelEl.textContent = label;
  }

  if (lastDensity !== density) {
    lastDensity = density;
    window.dispatchEvent(new CustomEvent('hh-card-density-change', { detail: { density } }));
  }

  return t;
}

/** Применить переменные до загрузки CSS (inline в index.html). */
export function applyCardTuningFlash(tuning) {
  const t = normalizeCardTuning(tuning);
  const root = document.documentElement;
  root.style.setProperty('--card-col-w', `${t.colW}rem`);
  if (t.minH > 0) root.style.setProperty('--card-min-h', `${t.minH}rem`);
  root.style.setProperty('--card-font-scale', String(t.fontScale / 100));
  const density = textAmountToDensity(t.textAmount);
  root.dataset.cardDensity = density;
  root.dataset.cardTextAmount = String(t.textAmount);
}

export function initCardTuningControls() {
  syncRangeLimits();
  const t = readCardTuning();
  lastDensity = textAmountToDensity(t.textAmount);
  applyCardTuning(t);

  const bind = (rangeId, key) => {
    const range = document.getElementById(rangeId);
    range?.addEventListener('input', () => {
      writeCardTuning({ [key]: Number(range.value) });
    });
  };

  bind('card-col-w-range', 'colW');
  bind('card-min-h-range', 'minH');
  bind('card-text-range', 'textAmount');
  bind('card-font-range', 'fontScale');
}
