/** Подписи и настройки интерфейса (браузер). Синхронизировать с lib/dashboard-ux.mjs */

export const UI_MODES = { simple: 'simple', expert: 'expert' };
export const SIDEBAR_LAYOUTS = { full: 'full', compact: 'compact' };

export const SIDEBAR_PANELS = {
  brand: { id: 'brand', label: 'Логотип', side: 'left' },
  status: { id: 'status', label: 'Статус и лимиты', side: 'left' },
  onboard: { id: 'onboard', label: 'С чего начать', side: 'left' },
  actionsPrimary: { id: 'actionsPrimary', label: 'Главные действия', side: 'left' },
  harvestPeriod: { id: 'harvestPeriod', label: 'Период поиска', side: 'left' },
  nav: { id: 'nav', label: 'Разделы вакансий', side: 'left' },
  quickSync: { id: 'quickSync', label: 'Синхронизация', side: 'left' },
  filters: { id: 'filters', label: 'Фильтры списка', side: 'left' },
  serviceLink: { id: 'serviceLink', label: 'Дополнительно', side: 'left' },
  kpi: { id: 'kpi', label: 'Статистика откликов', side: 'right' },
  jobFooter: { id: 'jobFooter', label: 'Прогресс задачи', side: 'right' },
};

export const SIDEBAR_PANEL_ORDER_DEFAULT = [
  'brand',
  'onboard',
  'status',
  'actionsPrimary',
  'harvestPeriod',
  'nav',
  'quickSync',
  'filters',
  'serviceLink',
  'kpi',
  'jobFooter',
];

export const LAYOUT_PRESET_KEYS = ['simple', 'standard', 'expert'];

/** Панели, которые пользователь может переставлять в конструкторе */
export const SIDEBAR_BUILDER_PANEL_IDS = SIDEBAR_PANEL_ORDER_DEFAULT.filter((id) => id !== 'brand');

export const LAYOUT_PRESETS = {
  simple: {
    id: 'simple',
    label: 'Минимум',
    hint: 'Статус, действия и разделы — без лишнего',
    uiMode: UI_MODES.simple,
    sidebarMode: SIDEBAR_LAYOUTS.compact,
    panelOrder: ['onboard', 'status', 'actionsPrimary', 'nav', 'jobFooter'],
    panels: {
      brand: false,
      onboard: true,
      status: true,
      actionsPrimary: true,
      harvestPeriod: false,
      nav: true,
      quickSync: false,
      filters: false,
      serviceLink: false,
      kpi: false,
      jobFooter: true,
    },
  },
  standard: {
    id: 'standard',
    label: 'Стандарт',
    hint: 'Поиск, фильтры и статистика',
    uiMode: UI_MODES.expert,
    sidebarMode: SIDEBAR_LAYOUTS.full,
    panelOrder: [
      'onboard',
      'status',
      'actionsPrimary',
      'harvestPeriod',
      'nav',
      'filters',
      'quickSync',
      'kpi',
      'jobFooter',
    ],
    panels: {
      brand: false,
      onboard: true,
      status: true,
      actionsPrimary: true,
      harvestPeriod: true,
      nav: true,
      quickSync: true,
      filters: true,
      serviceLink: true,
      kpi: true,
      jobFooter: true,
    },
  },
  expert: {
    id: 'expert',
    label: 'Всё',
    hint: 'Все блоки и расширенные действия',
    uiMode: UI_MODES.expert,
    sidebarMode: SIDEBAR_LAYOUTS.full,
    panelOrder: [...SIDEBAR_PANEL_ORDER_DEFAULT],
    panels: Object.fromEntries(Object.keys(SIDEBAR_PANELS).map((k) => [k, k !== 'brand'])),
  },
};

/**
 * @param {{ panels: Record<string, boolean>, panelOrder: string[] }} ui
 * @returns {string|null}
 */
export function detectLayoutPreset(ui) {
  for (const key of LAYOUT_PRESET_KEYS) {
    const p = LAYOUT_PRESETS[key];
    if (!p) continue;
    const orderMatch =
      JSON.stringify(normalizePanelOrder(ui.panelOrder)) === JSON.stringify(normalizePanelOrder(p.panelOrder));
    const panelsMatch = SIDEBAR_BUILDER_PANEL_IDS.every((id) => Boolean(ui.panels[id]) === Boolean(p.panels[id]));
    if (orderMatch && panelsMatch && ui.uiMode === p.uiMode && ui.sidebarMode === p.sidebarMode) return key;
  }
  return null;
}

/** @param {string[]} order */
export function normalizePanelOrder(order) {
  const base = Array.isArray(order) ? order.filter((id) => SIDEBAR_PANELS[id] && id !== 'brand') : [];
  const seen = new Set(base);
  for (const id of SIDEBAR_PANEL_ORDER_DEFAULT) {
    if (id !== 'brand' && !seen.has(id)) base.push(id);
  }
  return base;
}

/** Сторона дока по умолчанию (id → left | right). */
export function defaultPanelSides() {
  return Object.fromEntries(
    Object.entries(SIDEBAR_PANELS).map(([id, meta]) => [id, meta.side === 'right' ? 'right' : 'left'])
  );
}

/** @param {unknown} raw */
export function normalizePanelSides(raw) {
  const base = defaultPanelSides();
  if (!raw || typeof raw !== 'object') return base;
  for (const id of Object.keys(SIDEBAR_PANELS)) {
    const s = raw[id];
    if (s === 'left' || s === 'right') base[id] = s;
  }
  return base;
}

/** @param {{ panelSides?: Record<string, string> }} ui @param {string} id */
export function panelSideFor(ui, id) {
  const s = ui?.panelSides?.[id];
  if (s === 'left' || s === 'right') return s;
  return SIDEBAR_PANELS[id]?.side === 'right' ? 'right' : 'left';
}

export const WORKFLOW_COPY = {
  find: 'Найти',
  review: 'Разобрать',
  apply: 'Откликнуться',
  track: 'Следить',
};

export const COPY = {
  appSubtitle: 'Поиск · отклики · воронка',
  batch: 'Серия откликов',
  batchShort: 'Серия',
  batchAuto: 'Авто-отклики',
  batchManual: 'Ручные отклики',
  harvest: 'Поиск вакансий',
  harvestRun: 'Запустить поиск',
  harvestPeriod: 'Период поиска',
  dailyRoutine: 'Утренний цикл',
  openLog: 'Журнал',
  openSettings: 'Настройки',
  openService: 'Дополнительно',
  funnelTitle: 'Статистика откликов',
  confirmStopHarvest: 'Остановить поиск вакансий?',
  confirmStopBatch: 'Остановить серию откликов?',
  navQueue: 'Очередь',
  navNoQuestionnaire: 'Без анкет',
  navQuestionnaire: 'С анкетой',
  navApplied: 'Отклики',
  navHidden: 'Скрытые',
  navDeferred: 'Отложенные',
  tabRecommended: 'Рекомендуемые',
  tabBelowThreshold: 'Ниже порога',
  tabAllScores: 'Все',
  tabPending: 'На проверке',
  tabApproved: 'Подходят',
  tabRejected: 'Отклонённые',
  sidebarSyncResponses: 'Статусы',
  sidebarSyncChats: 'Чаты',
  sidebarSyncImport: 'Импорт',
  sidebarSyncResume: 'Резюме',
  questionnaireProbe: 'Проверить анкеты',
  questionnairePrep: 'Подготовить ответы',
  questionnaireReprobe: 'Обновить вопросы',
  exportMarkdown: 'Экспорт',
  resumePdf: 'Резюме PDF',
  batchReportBtn: 'Отчёт серии',
  logHarvest: 'Поиск',
  logApply: 'Отклики',
  onboardingTitle: 'С чего начать',
  onboardingStepResume: 'Укажите резюме в настройках (если ещё не настроено)',
  onboardingStepHarvest: 'Нажмите «Запустить поиск» — соберём вакансии с hh.ru',
  onboardingStepApply: 'Откройте карточку или «Авто-отклики» для первого отклика',
  onboardingStepSync: '«Утренний цикл» подтянет статусы с hh.ru',
  onboardingCtaSettings: 'Настроить',
  onboardingCtaHarvest: 'Поиск',
  onboardingCtaQueue: 'К очереди',
  onboardingCtaRoutine: 'Синхронизация',
  settingsTabApply: 'Отклики и лимиты',
  settingsTabAppearance: 'Список и вид',
  draftTitle: 'Черновик письма',
  draftVariantLabel: 'Вариант',
  draftVariantHint: '1–3 или ← → — переключить вариант (вне поля текста)',
  draftLetterLabel: 'Текст (правки сохраняются и учитываются при следующей генерации)',
  draftSave: 'Сохранить правки',
  draftApprove: 'Утвердить',
  draftDecline: 'Отклонить',
  draftButton: 'Черновик',
  batchScopeLabels: {
    queue: 'Очередь',
    noQuestionnaire: 'Без анкет',
    questionnaire: 'Анкета',
    hidden: 'Скрытые',
  },
};

/** @param {string} scope */
export function batchScopeLabel(scope) {
  return COPY.batchScopeLabels[scope] || scope || '';
}

/**
 * @param {Record<string, boolean>} panels
 * @param {string} uiMode
 */
export function defaultPanelsForMode(uiMode) {
  const simple = uiMode === UI_MODES.simple;
  return {
    brand: true,
    onboard: true,
    status: true,
    actionsPrimary: true,
    harvestPeriod: true,
    nav: true,
    quickSync: true,
    filters: true,
    serviceLink: true,
    kpi: !simple,
    jobFooter: true,
  };
}
