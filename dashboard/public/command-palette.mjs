/**
 * Command palette — быстрые действия (Ctrl+K / /).
 */

/** @typedef {{ id: string, label: string, hint?: string, keywords?: string, group?: string, run: () => void | Promise<void> }} PaletteAction */

let paletteEl = null;
let inputEl = null;
let listEl = null;
/** @type {PaletteAction[]} */
let actions = [];
/** @type {() => void} */
let onClose = () => {};
let activeIndex = 0;

function ensureDom() {
  if (paletteEl) return;
  paletteEl = document.getElementById('command-palette');
  inputEl = document.getElementById('command-palette-input');
  listEl = document.getElementById('command-palette-list');
  if (!paletteEl || !inputEl || !listEl) return;

  paletteEl.querySelector('.command-palette__backdrop')?.addEventListener('click', closeCommandPalette);
  inputEl.addEventListener('input', () => {
    activeIndex = 0;
    const q = inputEl.value.trim();
    renderList(filterActions(inputEl.value), !q);
  });
  inputEl.addEventListener('keydown', (e) => {
    const items = listEl.querySelectorAll('.command-palette__item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      highlightItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[activeIndex]?.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  });
}

/** @param {NodeListOf<Element>} items */
function highlightItem(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  items[activeIndex]?.scrollIntoView({ block: 'nearest' });
}

/** @param {string} q */
function filterActions(q) {
  const s = String(q || '')
    .trim()
    .toLowerCase();
  if (!s) return actions;
  return actions.filter((a) => {
    const blob = `${a.label} ${a.hint || ''} ${a.keywords || ''}`.toLowerCase();
    return blob.includes(s);
  });
}

const GROUP_ORDER = ['Найти', 'Разобрать', 'Откликнуться', 'Следить', 'Панели', 'Настройки', 'Справка'];

/** @param {PaletteAction[]} filtered @param {boolean} [grouped] */
function renderList(filtered, grouped = false) {
  if (!listEl) return;
  if (!filtered.length) {
    listEl.innerHTML = '<li class="command-palette__empty">Ничего не найдено</li>';
    return;
  }

  const fragments = [];
  let globalIdx = 0;

  const appendAction = (a) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    const i = globalIdx;
    btn.className = `command-palette__item${i === activeIndex ? ' active' : ''}`;
    btn.innerHTML = `<span class="command-palette__item-label">${escapeHtml(a.label)}</span>${
      a.hint ? `<span class="command-palette__item-hint">${escapeHtml(a.hint)}</span>` : ''
    }`;
    btn.addEventListener('click', async () => {
      closeCommandPalette();
      await a.run();
    });
    li.appendChild(btn);
    fragments.push(li);
    globalIdx += 1;
  };

  if (grouped && filtered.some((a) => a.group)) {
    for (const group of GROUP_ORDER) {
      const items = filtered.filter((a) => a.group === group);
      if (!items.length) continue;
      const head = document.createElement('li');
      head.className = 'command-palette__group';
      head.textContent = group;
      fragments.push(head);
      for (const a of items) appendAction(a);
    }
    const other = filtered.filter((a) => !a.group || !GROUP_ORDER.includes(a.group));
    if (other.length) {
      const head = document.createElement('li');
      head.className = 'command-palette__group';
      head.textContent = 'Другое';
      fragments.push(head);
      for (const a of other) appendAction(a);
    }
  } else {
    for (const a of filtered) appendAction(a);
  }

  listEl.replaceChildren(...fragments);
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * @param {PaletteAction[]} actionList
 * @param {{ onClose?: () => void }} [opts]
 */
export function registerCommandPaletteActions(actionList, opts = {}) {
  actions = actionList;
  onClose = opts.onClose || (() => {});
  ensureDom();
}

export function openCommandPalette(prefill = '') {
  ensureDom();
  if (!paletteEl || !inputEl) return;
  activeIndex = 0;
  inputEl.value = prefill;
  const q = prefill.trim();
  renderList(filterActions(prefill), !q);
  paletteEl.hidden = false;
  requestAnimationFrame(() => inputEl.focus());
}

export function closeCommandPalette() {
  if (!paletteEl) return;
  paletteEl.hidden = true;
  onClose();
}

export function isCommandPaletteOpen() {
  return paletteEl && !paletteEl.hidden;
}
