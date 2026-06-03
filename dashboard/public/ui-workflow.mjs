/**

 * Workflow-навигация v4: Найти → Разобрать → Откликнуться → Следить.

 * Переключает контекст (раздел списка, прокрутка к блоку), не запускает задачи автоматически.

 */



export const WORKFLOW_HINT_STRIP_ID = 'workflow-hint-strip';



export const WORKFLOW_STEPS = [

  {

    id: 'find',

    label: 'Найти',

    hint: 'Поиск новых вакансий на hh.ru',

    stripHint: 'Запустите «Поиск вакансий» в блоке «Действия» слева',

    scrollPanel: 'actionsPrimary',

  },

  {

    id: 'review',

    label: 'Разобрать',

    hint: 'Очередь на проверку и решение',

    stripHint: 'Отметьте карточки «Подходит» или «Не подходит» — вкладки «На проверке» / «Подходят»',

    applyView: 'queue',

  },

  {

    id: 'apply',

    label: 'Откликнуться',

    hint: 'Серия авто-откликов по вкладке «Подходят»',

    stripHint: 'Вкладка «Подходят» → «Авто-отклики» или «Серия» в «Действия»',

    applyView: 'queue',

    queueStatus: 'approved',

    scrollPanel: 'actionsPrimary',

  },

  {

    id: 'track',

    label: 'Следить',

    hint: 'Отправленные отклики и синхронизация',

    stripHint: 'Раздел «Отклики» и синхронизация справа («Утренний цикл»)',

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

export function updateWorkflowHintStrip(stepId) {

  const el = document.getElementById(WORKFLOW_HINT_STRIP_ID);

  if (!el) return;

  const step = WORKFLOW_STEPS.find((s) => s.id === stepId);

  const text = step?.stripHint || '';

  el.textContent = text;

  el.hidden = !text;

  el.dataset.workflowStep = stepId || '';

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


