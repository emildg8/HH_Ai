/** Плавающие подсказки для [data-tip] — не обрезаются overflow сайдбара. */

let tipEl = null;
let currentAnchor = null;

function ensureTipEl() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'float-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  return tipEl;
}

function positionTip(anchor) {
  const tip = ensureTipEl();
  tip.hidden = false;
  tip.style.visibility = 'hidden';
  tip.style.left = '0';
  tip.style.top = '0';
  const tr = tip.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tr.width / 2;
  let top = rect.top - tr.height - 10;
  if (top < 8) top = rect.bottom + 10;
  left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
  tip.style.visibility = 'visible';
}

function showTip(anchor) {
  if (!anchor?.getAttribute) return;
  const text = anchor.getAttribute('data-tip')?.trim();
  if (!text) return;
  currentAnchor = anchor;
  const tip = ensureTipEl();
  tip.textContent = text;
  positionTip(anchor);
}

function hideTip() {
  currentAnchor = null;
  if (tipEl) tipEl.hidden = true;
}

export function initFloatingTooltips() {
  document.addEventListener(
    'mouseover',
    (e) => {
      const el = e.target.closest?.('[data-tip]');
      if (el) showTip(el);
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (e) => {
      const el = e.target.closest?.('[data-tip]');
      if (!el) return;
      const related = e.relatedTarget;
      if (related && el.contains(related)) return;
      if (currentAnchor === el) hideTip();
    },
    true
  );

  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el) showTip(el);
  });

  document.addEventListener('focusout', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el && currentAnchor === el) hideTip();
  });

  window.addEventListener(
    'scroll',
    () => {
      if (currentAnchor && !tipEl?.hidden) positionTip(currentAnchor);
    },
    true
  );
  window.addEventListener('resize', () => {
    if (currentAnchor && !tipEl?.hidden) positionTip(currentAnchor);
  });
}
