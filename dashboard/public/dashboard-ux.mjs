/** Подписи и настройки интерфейса (браузер). Синхронизировать с lib/dashboard-ux.mjs */

import { SETTINGS_FORMAT_GEO_COPY } from './dashboard-copy-ru.mjs';

export const UI_MODES = { simple: 'simple', expert: 'expert' };

/** Подписи: простой vs расширенный режим (см. docs/GLOSSARY-UI.md) */
export const GLOSSARY = {
  fpRejected: { simple: 'Ложные пропуски в отказах', expert: 'FP в отказах' },
  fpOk: { simple: 'Ложных пропусков нет', expert: 'Ложных FP не найдено' },
  offTarget: { simple: 'Нецелевых откликов', expert: 'Off-target' },
  goldenRegression: {
    simple: 'Проверка эталонов не пройдена — откройте «Качество писем»',
    expert: 'Регрессия golden set',
  },
  harvest: { simple: 'Поиск вакансий', expert: 'Harvest' },
  batch: { simple: 'Серия откликов', expert: 'Batch' },
  precheck: { simple: 'Проверка перед серией', expert: 'Precheck' },
  questionnaire: { simple: 'Анкета работодателя', expert: 'Questionnaire' },
  funnel: { simple: 'Статистика откликов', expert: 'KPI / funnel' },
  syncResponses: { simple: 'Синхронизация статусов', expert: 'Sync responses' },
  syncChats: { simple: 'Обновление чатов', expert: 'Sync chats' },
  letterQuality: { simple: 'Качество письма', expert: 'Letter quality' },
  letterScore: { simple: 'Оценка письма', expert: 'Letter score' },
  targeting: { simple: 'Фильтр вакансий', expert: 'Targeting' },
  goldenLetters: { simple: 'Эталоны писем', expert: 'Golden letters' },
  goldenTargeting: { simple: 'Эталоны таргетинга', expert: 'Golden targeting' },
  autoReject: { simple: 'Авто-отклонение похожих', expert: 'Auto-reject' },
  falsePositiveGuard: { simple: 'Ложные пропуски в «Неподходит»', expert: 'FP guardrail' },
  fpSuggestTitle: {
    simple: 'Что добавить в правила (ложные пропуски)',
    expert: 'Срочные предложения для false positives',
  },
  fpSuggestTitleManual: {
    simple: 'Предложения по вашим отклонениям',
    expert: 'Авто-предложения по ручным reject',
  },
  fpFoundToast: {
    simple: 'Ложные пропуски: {n}. Откройте блок справа и примените пакет.',
    expert: 'Найдены false positives: {n}. Откройте блок справа и примените пакет.',
  },
  batchFpConfirm: {
    simple:
      'В «Неподходит» {fpN} ложных пропусков (порог {fpMax}).\n\nСначала примените правила справа или продолжите серию осознанно.',
    expert:
      'В «Неподходит» {fpN} false positives (порог {fpMax}).\n\nСначала примените правила справа или продолжите серию осознанно.',
  },
  workflowFind: { simple: 'Найти вакансии', expert: 'Workflow: find' },
  workflowReview: { simple: 'Разобрать очередь', expert: 'Workflow: review' },
  workflowApply: { simple: 'Откликнуться', expert: 'Workflow: apply' },
  workflowTrack: { simple: 'Следить за откликами', expert: 'Workflow: track' },
  serviceDrawer: { simple: 'Сервисы и пакеты', expert: 'Service drawer' },
  jobProgress: { simple: 'Текущая задача', expert: 'Job progress' },
  rateLimit: { simple: 'Лимиты откликов', expert: 'Rate limits' },
  precheckDiff: { simple: 'Изменения настроек перед серией', expert: 'Precheck prefs diff' },
  uiTrimHint: {
    simple: 'Действия слева · сервисы и настройки — вверху · журнал — справа внизу.',
    expert: 'UI trim: действия слева, sync справа, сервисы в menubar.',
  },
};

/** @param {keyof typeof GLOSSARY} key @param {string} [uiMode] @param {Record<string, string | number>} [vars] */
export function glossaryLabel(key, uiMode = UI_MODES.simple, vars = {}) {
  const row = GLOSSARY[key];
  if (!row) return String(key);
  let s = uiMode === UI_MODES.expert ? row.expert : row.simple;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

export const UI_TRIM_HINT_LS_KEY = 'hh-dashboard-ui-trim-hint-v1';
export const SIDEBAR_LAYOUTS = { full: 'full', compact: 'compact' };

export const SIDEBAR_PANELS = {
  brand: { id: 'brand', label: 'Логотип', side: 'left' },
  status: { id: 'status', label: 'Статус и лимиты', side: 'left' },
  onboard: { id: 'onboard', label: 'С чего начать', side: 'left' },
  actionsPrimary: { id: 'actionsPrimary', label: 'Главные действия', side: 'left' },
  sources: { id: 'sources', label: 'Источники', side: 'left' },
  harvestPeriod: { id: 'harvestPeriod', label: 'Период поиска', side: 'left' },
  nav: { id: 'nav', label: 'Разделы вакансий', side: 'left' },
  filters: { id: 'filters', label: 'Фильтры списка', side: 'left' },
  kpi: { id: 'kpi', label: 'Статистика откликов', side: 'right' },
  falsePositives: { id: 'falsePositives', label: 'Ложные пропуски', side: 'right' },
  resumeRaise: { id: 'resumeRaise', label: 'Подъём резюме', side: 'right' },
  syncExtended: { id: 'syncExtended', label: 'Синхронизация hh.ru', side: 'right' },
  serviceResume: { id: 'serviceResume', label: 'Резюме и собеседования', side: 'right' },
  serviceRoutine: { id: 'serviceRoutine', label: 'Рутина и пакеты', side: 'right' },
  jobFooter: { id: 'jobFooter', label: 'Прогресс задачи', side: 'right' },
};

export const SIDEBAR_PANEL_ORDER_DEFAULT = [
  'brand',
  'onboard',
  'status',
  'actionsPrimary',
  'sources',
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

export const LAYOUT_PRESET_KEYS = ['simple', 'standard', 'expert'];

/** Панели, которые пользователь может переставлять в конструкторе */
export const SIDEBAR_BUILDER_PANEL_IDS = SIDEBAR_PANEL_ORDER_DEFAULT.filter((id) => id !== 'brand');

const PRESET_PANEL_SIDES_STANDARD = {
  brand: 'left',
  onboard: 'left',
  status: 'left',
  actionsPrimary: 'left',
  sources: 'left',
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

export const LAYOUT_PRESETS = {
  simple: {
    id: 'simple',
    label: 'Минимум',
    hint: 'Статус, действия и разделы — без лишнего',
    uiMode: UI_MODES.simple,
    sidebarMode: SIDEBAR_LAYOUTS.compact,
    panelOrder: ['onboard', 'status', 'actionsPrimary', 'sources', 'nav', 'kpi', 'jobFooter'],
    panelSides: {
      ...PRESET_PANEL_SIDES_STANDARD,
      harvestPeriod: 'left',
      filters: 'left',
      falsePositives: 'right',
      resumeRaise: 'left',
      syncExtended: 'left',
      serviceResume: 'left',
      serviceRoutine: 'left',
    },
    panels: {
      brand: false,
      onboard: true,
      status: true,
      actionsPrimary: true,
      sources: true,
      harvestPeriod: false,
      nav: true,
      filters: true,
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
    id: 'standard',
    label: 'Стандарт',
    hint: 'Слева — работа с очередью; справа — статистика и синхронизация',
    uiMode: UI_MODES.expert,
    sidebarMode: SIDEBAR_LAYOUTS.full,
    panelOrder: [
      'onboard',
      'status',
      'actionsPrimary',
      'sources',
      'harvestPeriod',
      'nav',
      'filters',
      'kpi',
      'falsePositives',
      'resumeRaise',
      'syncExtended',
      'jobFooter',
    ],
    panelSides: { ...PRESET_PANEL_SIDES_STANDARD },
    panels: {
      brand: false,
      onboard: true,
      status: true,
      actionsPrimary: true,
      sources: true,
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
    id: 'expert',
    label: 'Всё',
    hint: 'Все блоки и расширенные действия',
    uiMode: UI_MODES.expert,
    sidebarMode: SIDEBAR_LAYOUTS.full,
    panelOrder: [...SIDEBAR_PANEL_ORDER_DEFAULT],
    panelSides: { ...defaultPanelSides() },
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
  batchManual: 'Ниже порога (разведка)',
  batchManualTip: 'Тот же Playwright и batch, что «Авто-отклики» — только вакансии с баллом ниже порога',
  harvest: 'Поиск вакансий',
  harvestRun: 'Запустить поиск',
  harvestExternal: 'Внешние источники',
  ingestUrl: 'Вставить ссылку',
  reviewTierA: 'Разобрать топ',
  reviewTierATip: 'Показать только вакансии с оценкой «Топ»',
  sourcesTopTier: 'Источники',
  sourcesTopTierList: 'Топ и хорошие',
  intelligenceDigest: 'Сводка по источникам',
  filterQuickLabel: 'Быстрый фильтр',
  filterPresetTierAFresh: 'Лучшие · свежие',
  filterPresetManual: 'Ручной отклик',
  filterPresetAllSources: 'Все вакансии',
  filterQueueToApply: 'К отклику',
  filterQueueAllPending: 'Все в статусе',
  harvestPeriod: 'Период поиска',
  dailyRoutine: 'Утренний цикл',
  openLog: 'Журнал',
  openSettings: 'Настройки',
  openService: 'Сервисы',
  allFeatures: 'Все функции',
  allFeaturesHint: 'Поиск действий и настроек — Ctrl+K',
  applyE2ePlaybook: 'Сценарий отклика',
  applyE2ePlaybookHint: 'Корзина → письмо → анкета → робот в чате',
  applyE2ePlaybookUrl: '/apply-e2e-playbook.html',
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
  tabRejectedAll: 'Все',
  tabRejectedAuto: 'Авто',
  tabRejectedManual: 'Вручную',
  autoRejectLabel: 'Авто-отклонение',
  emptyRejectedAuto: 'Нет авто-отклонённых. Сюда попадают похожие вакансии после вашего «Не подходит».',
  emptyRejectedManual: 'Нет ручных отклонений в этом диапазоне.',
  restoreFromApproved: 'Отменить одобрение',
  restoreToQueue: 'Вернуть в очередь',
  restoreToMainQueue: 'В основную очередь',
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
  sortTierFirst: 'Топ и хорошие, затем свежие',
  dailyRoutineExternal: 'Утренний цикл + Хабр, Telegram, сайты компаний',
  dailyRoutineExternalConfirm: '+ сбор с Хабра, Telegram и сайтов компаний',
  blockSpokenEnglishLabel: 'Блокировать требование устного английского',
  settingsFormatGeoTitle: SETTINGS_FORMAT_GEO_COPY.title,
  settingsFormatGeoLead: SETTINGS_FORMAT_GEO_COPY.lead,
  settingsHarvestRequireRemoteLabel: SETTINGS_FORMAT_GEO_COPY.harvestRequireRemoteLabel,
  settingsHarvestRequireRemoteHint: SETTINGS_FORMAT_GEO_COPY.harvestRequireRemoteHint,
  settingsRequireRemoteLabel: SETTINGS_FORMAT_GEO_COPY.requireRemoteLabel,
  settingsRequireRemoteHint: SETTINGS_FORMAT_GEO_COPY.requireRemoteHint,
  settingsBatchRequireRemoteLabel: SETTINGS_FORMAT_GEO_COPY.batchRequireRemoteLabel,
  settingsBatchRequireRemoteHint: SETTINGS_FORMAT_GEO_COPY.batchRequireRemoteHint,
  settingsBatchGotoApply: SETTINGS_FORMAT_GEO_COPY.batchGotoApply,
  settingsFormatGeoPolicyInfo: SETTINGS_FORMAT_GEO_COPY.policyInfo,
  questionnaireProbeToast: 'Проверка анкет: {n}',
  harvestHabr: 'Сбор с Хабра',
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

  errDashboardOffline:
    'Нет связи с дашбордом. Запустите приложение (npm run dashboard) и откройте http://127.0.0.1:3849',
  errDashboardJson404:
    'Страница открыта не через дашборд. Запустите npm run dashboard и откройте http://127.0.0.1:3849',
  errRestartDashboard: 'Перезапустите дашборд (npm run dashboard) и обновите страницу (F5)',
  errSaveUnavailable: 'Сохранение недоступно — перезапустите дашборд (npm run dashboard)',
  errServerSearch: 'Ошибка сервера при запуске поиска — обновите код и перезапустите дашборд',
  errJobControl404: 'Пауза и стоп недоступны — перезапустите дашборд и обновите страницу (F5)',
  errHarvestControl404: 'Пауза поиска недоступна — перезапустите дашборд',
  browserBusyBatch: 'Дождитесь завершения текущей серии откликов',
  emptyQuestionnaire: 'Нет вакансий с анкетой в этом разделе.',
  emptyDeferred: 'Нет отложенных вакансий. На карточке нажмите «Завтра», чтобы отложить на сутки.',
  emptyApplied: 'Пока нет откликов через дашборд. Запустите «Авто-отклики» или серию — вакансии появятся здесь.',
  probeDone: 'Проверено анкет',
  playwrightHintDefault: 'Поиск без окна; серия — свёрнуто. При капче откроется окно Chromium.',
  paletteHarvestHint: 'Сбор вакансий с hh.ru',
  batchReportEmpty: 'Отчёт серии ещё не создан',
  batchStopConfirm: 'Остановить серию? Прогресс сохранится — можно будет нажать «Продолжить».',
  batchResumePauseTitle: 'Снять паузу серии',
  batchResumeInterruptedTitle: 'Продолжить прерванную серию',
  batchResumeNoneTitle: 'Нет сохранённой серии',
  confirmBatchHidden:
    'Внимание: серия по скрытым вакансиям (Senior/Lead, 1С, разработчик и т.п.).',
  confirmBatchQuestionnaireNote:
    '\n\nЕсли при отклике на hh.ru появится анкета, отклик не отправится: вопросы сохранятся в раздел «Анкета», серия продолжит следующую вакансию.',
  confirmBatchQueueNote: '\n\nВ «Очереди» могут быть вакансии с анкетой — они тоже попадут в серию.',
};

/** @param {string} scope */
export function batchScopeLabel(scope) {
  return COPY.batchScopeLabels[scope] || scope || '';
}

/** @param {string} scope @param {string} [queueStatus] */
export function batchReportScopeLabel(scope, queueStatus) {
  const base = batchScopeLabel(scope);
  if (scope !== 'queue' || !queueStatus) return base;
  if (queueStatus === 'approved') return `${base} · Подходят`;
  if (queueStatus === 'pending') return `${base} · На проверке`;
  return base;
}

/**
 * @param {Record<string, boolean>} panels
 * @param {string} uiMode
 */
export function defaultPanelsForMode(uiMode) {
  return uiMode === UI_MODES.expert
    ? { ...LAYOUT_PRESETS.standard.panels }
    : { ...LAYOUT_PRESETS.simple.panels };
}
