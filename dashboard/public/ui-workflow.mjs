/**

 * Workflow-навигация v4: Найти → Разобрать → Откликнуться → Следить.

 * Переключает контекст (раздел списка, прокрутка к блоку), не запускает задачи автоматически.

 */



export const WORKFLOW_HINT_STRIP_ID = 'workflow-hint-strip';



export const WORKFLOW_STEPS = [

  {

    id: 'find',

    label: 'Найти',

    hint: 'Поиск на hh.ru, внешние источники, вставить ссылку, топ вакансии',

    stripHint: 'Панель «Источники»: поиск hh, Хабр/Telegram/сайты, ссылка, фильтр «Топ»',

    scrollPanel: 'sources',

  },

  {

    id: 'review',

    label: 'Разобрать',

    hint: 'Очередь: оценка, письма, анкеты',

    stripHint: 'Средний вид — клик открывает карточку; быстрые «Подходит / Не подходит» на плитке · вид списка в Настройки → Интерфейс',

    applyView: 'queue',

  },

  {

    id: 'apply',

    label: 'Откликнуться',

    hint: 'hh авто + ручные отклики на сайтах компаний',

    stripHint: '«Авто-отклики» для hh; ручные — сайт компании + «Открыть»',

    applyView: 'queue',

    queueStatus: 'approved',

    scrollPanel: 'actionsPrimary',

  },

  {

    id: 'track',

    label: 'Следить',

    hint: 'Отклики, сводка по источникам, чаты',

    stripHint: '«Отклики», сводка справа, «Утренний цикл»',

    applyView: 'applied',

  },

];



/** @param {string} applyView */

export function workflowStepForApplyView(applyView) {

  switch (applyView) {

    case 'applied':

    case 'deferred':

      return 'track';

    case 'queue':

    case 'noQuestionnaire':

    case 'questionnaire':

    case 'hidden':

      return 'review';

    default:

      return 'review';

  }

}



/** @param {string} stepId */

export function workflowStepHint(stepId) {

  return WORKFLOW_STEPS.find((s) => s.id === stepId)?.hint || '';

}



/** @param {string} stepId */
export function updateWorkflowHintStrip(_stepId) {
  /* полоска подсказок убрана — подсказки на кнопках workflow-nav (data-tip) */
}



function scrollToPanel(panelId) {

  const el = document.querySelector(`.sidebar-panel[data-panel="${panelId}"]`);

  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

}



function setActiveStep(nav, stepId, activeBtn) {

  nav.querySelectorAll('[data-workflow]').forEach((btn) => {

    const active = activeBtn ? btn === activeBtn : btn.getAttribute('data-workflow') === stepId;

    btn.classList.toggle('workflow-nav__step--active', active);

    btn.setAttribute('aria-current', active ? 'step' : 'false');

  });

}



/**

 * @param {{ getApplyView: () => string, onApplyView: (view: string) => void, onQueueStatus?: (status: string) => void }} hooks

 */

export function initWorkflowNav(hooks) {

  const nav = document.querySelector('.workflow-nav');

  if (!nav) return;



  nav.querySelectorAll('[data-workflow]').forEach((btn) => {

    const tip = btn.getAttribute('data-tip') || workflowStepHint(btn.getAttribute('data-workflow') || '');

    if (tip) btn.title = tip;

  });



  const syncActive = () => {

    const stepId = workflowStepForApplyView(hooks.getApplyView());

    setActiveStep(nav, stepId);

    updateWorkflowHintStrip(stepId);

  };



  nav.querySelectorAll('[data-workflow]').forEach((btn) => {

    btn.addEventListener('click', () => {

      const id = btn.getAttribute('data-workflow');

      const step = WORKFLOW_STEPS.find((s) => s.id === id);

      if (!step) return;

      if (step.applyView) hooks.onApplyView(step.applyView);

      if (step.queueStatus && hooks.onQueueStatus) hooks.onQueueStatus(step.queueStatus);

      if (step.scrollPanel) scrollToPanel(step.scrollPanel);

      setActiveStep(nav, step.id, btn);

      updateWorkflowHintStrip(step.id);

    });

  });



  window.addEventListener('hh-apply-view-change', syncActive);

  syncActive();

}


