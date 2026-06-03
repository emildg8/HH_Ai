/**
 * Логика док-панелей без браузера: сетка колонок и sanitize.
 */
import {
  buildStageColumns,
  defaultState,
  sanitizeDockState,
} from '../dashboard/public/workspace-docks.mjs';

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const prevInnerWidth = globalThis.window?.innerWidth;
globalThis.window = { innerWidth: 1400 };

try {
  const base = defaultState();
  const colsVisible = buildStageColumns(base);
  assert(colsVisible.includes('240px'), 'левая ширина по умолчанию');
  assert(colsVisible.includes('272px'), 'правая ширина по умолчанию');
  assert((colsVisible.match(/12px/g) || []).length === 2, 'два сплиттера всегда');

  const leftHidden = defaultState();
  leftHidden.left.hidden = true;
  const colsLeftHidden = buildStageColumns(leftHidden);
  assert(!colsLeftHidden.includes('240px'), 'при скрытой левой нет колонки дока');
  assert(colsLeftHidden.startsWith('12px'), 'при скрытой левой сплиттер первый');

  const bothHidden = defaultState();
  bothHidden.left.hidden = true;
  bothHidden.right.hidden = true;
  const colsBoth = buildStageColumns(bothHidden);
  assert(colsBoth === '12px minmax(0, 1fr) 12px', `обе скрыты: ${colsBoth}`);

  const wide = defaultState();
  wide.left.width = 900;
  wide.right.width = 900;
  sanitizeDockState(wide);
  assert(wide.left.width < 900, 'sanitize ужимает слишком широкую левую');
  assert(wide.right.width < 900, 'sanitize ужимает слишком широкую правую');

  const mini = defaultState();
  mini.left.collapsed = true;
  const colsMini = buildStageColumns(mini);
  assert(colsMini.includes('52px'), 'свёрнутая левая — mini-колонка');
} finally {
  if (prevInnerWidth === undefined) delete globalThis.window;
  else globalThis.window = { innerWidth: prevInnerWidth };
}

if (errors.length) {
  console.error('FAIL test-workspace-docks-logic:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('test-workspace-docks-logic: OK');
