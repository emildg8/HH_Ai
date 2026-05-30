/** Подписи и настройки интерфейса (браузер). Синхронизировать с lib/dashboard-ux.mjs */

export const UI_MODES = { simple: 'simple', expert: 'expert' };
export const SIDEBAR_LAYOUTS = { full: 'full', compact: 'compact' };

export const SIDEBAR_PANELS = {
  brand: { id: 'brand', label: 'Логотип' },
  status: { id: 'status', label: 'Статус и лимиты' },
  onboard: { id: 'onboard', label: 'Первые шаги' },
  kpi: { id: 'kpi', label: 'Воронка и график' },
  actionsPrimary: { id: 'actionsPrimary', label: 'Главные действия' },
  harvestPeriod: { id: 'harvestPeriod', label: 'Период поиска' },
  nav: { id: 'nav', label: 'Разделы вакансий' },
  quickSync: { id: 'quickSync', label: 'Быстрые действия' },
  filters: { id: 'filters', label: 'Фильтры списка' },
  serviceLink: { id: 'serviceLink', label: 'Сервис' },
  jobFooter: { id: 'jobFooter', label: 'Прогресс задачи' },
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

export const COPY = {
  batch: 'Серия откликов',
  batchShort: 'Серия',
  batchAuto: 'Авто-отклики',
  batchManual: 'Ручные отклики',
  harvest: 'Поиск вакансий',
  harvestRun: 'Запустить поиск',
  harvestPeriod: 'Период поиска',
  dailyRoutine: 'Утренний цикл',
  openLog: 'Журнал действий',
  openSettings: 'Настройки',
  openService: 'Сервис',
  funnelTitle: 'Воронка и конверсия',
  confirmStopHarvest: 'Остановить поиск вакансий?',
  confirmStopBatch: 'Остановить серию откликов?',
  navQueue: 'Очередь',
  navNoQuestionnaire: 'Без анкет',
  navQuestionnaire: 'Анкета',
  navApplied: 'Отклики',
  navHidden: 'Скрытые',
  onboardingTitle: 'Первые шаги',
  onboardingStepResume: 'Настроить hash резюме (config/resume-routing.json)',
  onboardingStepHarvest: 'Собрать вакансии — «Запустить поиск»',
  onboardingStepApply: 'Первый отклик — «Авто-отклики» или карточка',
  onboardingStepSync: 'Синхронизировать статусы — «Утренний цикл»',
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
