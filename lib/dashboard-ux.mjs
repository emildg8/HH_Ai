/**
 * Пользовательские подписи и настройки интерфейса дашборда.
 */

export const UI_MODES = {
  simple: 'simple',
  expert: 'expert',
};

export const SIDEBAR_LAYOUTS = {
  full: 'full',
  compact: 'compact',
};

/** Блоки боковой панели (id → настройки) — синхронизировать с dashboard/public/dashboard-ux.mjs */
export const SIDEBAR_PANELS = {
  brand: { id: 'brand', label: 'Логотип', defaultVisible: true, expertOnly: false },
  status: { id: 'status', label: 'Статус и лимиты', defaultVisible: true, expertOnly: false },
  onboard: { id: 'onboard', label: 'С чего начать', defaultVisible: true, expertOnly: false },
  kpi: { id: 'kpi', label: 'Воронка и график', defaultVisible: true, expertOnly: false },
  falsePositives: { id: 'falsePositives', label: 'Ложные пропуски', defaultVisible: false, expertOnly: true },
  actionsPrimary: { id: 'actionsPrimary', label: 'Главные действия', defaultVisible: true, expertOnly: false },
  harvestPeriod: { id: 'harvestPeriod', label: 'Период поиска', defaultVisible: true, expertOnly: false },
  nav: { id: 'nav', label: 'Разделы вакансий', defaultVisible: true, expertOnly: false },
  filters: { id: 'filters', label: 'Фильтры списка', defaultVisible: true, expertOnly: false },
  resumeRaise: { id: 'resumeRaise', label: 'Подъём резюме', defaultVisible: true, expertOnly: false },
  syncExtended: { id: 'syncExtended', label: 'Синхронизация hh.ru', defaultVisible: true, expertOnly: false },
  serviceResume: { id: 'serviceResume', label: 'Резюме и собеседования', defaultVisible: false, expertOnly: true },
  serviceRoutine: { id: 'serviceRoutine', label: 'Рутина и пакеты', defaultVisible: false, expertOnly: true },
  jobFooter: { id: 'jobFooter', label: 'Прогресс задачи', defaultVisible: true, expertOnly: false },
};

/** Удалённые панели (UI trim 2026-06) — вычищать из сохранённых prefs */
export const DEPRECATED_SIDEBAR_PANEL_IDS = ['quickSync', 'serviceLink'];

export const SIDEBAR_PANEL_ORDER_DEFAULT = [
  'brand',
  'onboard',
  'status',
  'actionsPrimary',
  'harvestPeriod',
  'nav',
  'filters',
  'kpi',
  'falsePositives',
  'resumeRaise',
  'syncExtended',
  'serviceResume',
  'serviceRoutine',
  'jobFooter',
];

/** Пресеты конструктора */
export const LAYOUT_PRESETS = {
  simple: {
    uiMode: UI_MODES.simple,
    sidebarMode: SIDEBAR_LAYOUTS.compact,
    panels: {
      brand: false,
      onboard: true,
      status: true,
      actionsPrimary: true,
      harvestPeriod: false,
      nav: true,
      filters: false,
      falsePositives: false,
      resumeRaise: false,
      syncExtended: false,
      serviceResume: false,
      serviceRoutine: false,
      kpi: true,
      jobFooter: true,
    },
  },
  standard: {
    uiMode: UI_MODES.expert,
    sidebarMode: SIDEBAR_LAYOUTS.full,
    panels: {
      brand: false,
      onboard: true,
      status: true,
      actionsPrimary: true,
      harvestPeriod: true,
      nav: true,
      filters: true,
      falsePositives: true,
      resumeRaise: true,
      syncExtended: true,
      serviceResume: false,
      serviceRoutine: false,
      kpi: true,
      jobFooter: true,
    },
  },
  expert: {
    uiMode: UI_MODES.expert,
    sidebarMode: SIDEBAR_LAYOUTS.full,
    panels: Object.fromEntries(Object.keys(SIDEBAR_PANELS).map((k) => [k, k !== 'brand'])),
  },
};

export const SIDEBAR_PANEL_DEFAULT_SIDE = {
  brand: 'left',
  status: 'left',
  onboard: 'left',
  actionsPrimary: 'left',
  harvestPeriod: 'left',
  nav: 'left',
  filters: 'left',
  resumeRaise: 'right',
  syncExtended: 'right',
  serviceResume: 'right',
  serviceRoutine: 'right',
  kpi: 'right',
  falsePositives: 'right',
  jobFooter: 'right',
};

/** @param {unknown} raw */
export function normalizePanelSides(raw) {
  const base = { ...SIDEBAR_PANEL_DEFAULT_SIDE };
  if (!raw || typeof raw !== 'object') return base;
  for (const id of Object.keys(base)) {
    const s = raw[id];
    if (s === 'left' || s === 'right') base[id] = s;
  }
  if (raw.onboard === 'left' || raw.onboard === 'right') base.onboard = raw.onboard;
  return base;
}

export const DEFAULT_UI_PREFS = {
  uiMode: UI_MODES.simple,
  sidebarMode: SIDEBAR_LAYOUTS.compact,
  panelOrder: [...SIDEBAR_PANEL_ORDER_DEFAULT],
  panels: { ...LAYOUT_PRESETS.simple.panels },
};

export const COPY = {
  appTitle: 'HH Ai',
  appSubtitle: 'Поиск вакансий · отклики · воронка',

  batch: 'Серия откликов',
  batchAuto: 'Авто-отклики',
  batchManual: 'Ручные отклики',
  batchShort: 'Серия',
  harvest: 'Поиск вакансий',
  harvestRun: 'Запустить поиск',
  harvestPeriod: 'Период поиска',

  dailyRoutine: 'Утренний цикл',
  syncResponses: 'Синхронизировать отклики',
  syncChats: 'Обновить чаты',
  importNegotiations: 'Импорт откликов',
  syncResume: 'Синхронизировать резюме',
  moreService: 'Дополнительно',
  openService: 'Сервис',
  openSettings: 'Настройки',
  openLog: 'Журнал действий',

  navQueue: 'Очередь',
  navNoQuestionnaire: 'Без анкет',
  navQuestionnaire: 'Анкета',
  navApplied: 'Отправлено',
  navHidden: 'Скрытые',

  tabPending: 'На проверке',
  tabApproved: 'Подходят',
  tabRejected: 'Отклонённые',
  tabRejectedAll: 'Все',
  tabRejectedAuto: 'Авто',
  tabRejectedManual: 'Вручную',
  autoRejectLabel: 'Авто-отклонение',
  emptyRejectedAuto: 'Нет авто-отклонённых. Сюда попадают похожие вакансии после вашего «Не подходит».',
  emptyRejectedManual: 'Нет ручных отклонений в этом диапазоне.',
  restoreFromApproved: 'Отменить одобрение',
  restoreToQueue: 'Вернуть в очередь',
  restoreToMainQueue: 'В основную очередь',

  onboardingTitle: 'Первые шаги',
  onboardingStepResume: 'Настроить hash резюме (config/resume-routing.json)',
  onboardingStepHarvest: 'Собрать вакансии — «Запустить поиск»',
  onboardingStepApply: 'Первый отклик — «Авто-отклики» или карточка',
  onboardingStepSync: 'Синхронизировать статусы — «Утренний цикл»',

  tabAuto: 'Авто',
  tabBelowThreshold: 'Ниже порога',
  tabAll: 'Все',

  statusReady: 'Готов',
  statusRunning: 'Выполняется',
  statusAttention: 'Нужно внимание',
  statusPaused: 'Пауза',

  jobProgressTitle: 'Текущая задача',
  jobProgressDefault: 'Выполнение',
  jobControlHarvest: 'Сбор',
  jobControlBatch: 'Серия откликов',
  pause: 'Пауза',
  stop: 'Стоп',
  resume: 'Продолжить',

  funnelTitle: 'Воронка и конверсия',
  settingsTitle: 'Настройки',
  settingsLead: 'Лимиты, фильтры и вид карточек',
  limitsTab: 'Лимиты',
  layoutTab: 'Интерфейс',
  appearanceTab: 'Карточки',
  resumeRaise: 'Поднять резюме',

  confirmStopHarvest: 'Остановить поиск вакансий?',
  confirmStopBatch: 'Остановить серию откликов?',

  applyViewLabels: {
    queue: 'Очередь',
    noQuestionnaire: 'Без анкет',
    questionnaire: 'Анкета',
    applied: 'Отправлено',
    hidden: 'Скрытые',
  },

  batchScopeLabels: {
    queue: 'Очередь',
    noQuestionnaire: 'Без анкет',
    questionnaire: 'Анкета',
    hidden: 'Скрытые',
  },

  /** Замены для старых терминов в UI (функция) */
  replaceTerms(text) {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/\b[Bb]atch\b/g, COPY.batch)
      .replace(/\b[Hh]arvest\b/g, COPY.harvest)
      .replace(/\b[Bb]ATCH\b/g, COPY.batch)
      .replace(/resume-raise/gi, 'поднять резюме')
      .replace(/routing-health/gi, 'проверка резюме')
      .replace(/apply-chat-log/gi, COPY.openLog)
      .replace(/batch-control/gi, 'управление серией')
      .replace(/harvest-control/gi, 'управление поиском');
  },

  /** @param {string} key */
  t(key, vars = {}) {
    let s = COPY[key] || key;
    if (typeof s === 'function') s = s(vars);
    return s;
  },

  isSimpleMode(mode) {
    return mode === UI_MODES.simple;
  },

  isExpertMode(mode) {
    return mode === UI_MODES.expert;
  },
};
