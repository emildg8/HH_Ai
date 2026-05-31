/**
 * Workflow-навигация v4: Найти → Разобрать → Откликнуться → Следить.
 * Переключает контекст (раздел списка, прокрутка к блоку), не запускает задачи автоматически.
 */

export const WORKFLOW_STEPS = [
  {
    id: 'find',
    label: 'Найти',
    hint: 'Поиск новых вакансий на hh.ru',
    scrollPanel: 'actionsPrimary',
  },
  {
    id: 'review',
    label: 'Разобрать',
    hint: 'Очередь на проверку и решение',
    applyView: 'queue',
  },
  {
    id: 'apply',
    label: 'Откликнуться',
    hint: 'Серия авто-откликов',
    applyView: 'queue',
    scrollPanel: 'actionsPrimary',
  },
  {
    id: 'track',
    label: 'Следить',
    hint: 'Отправленные отклики и синхронизация',
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

function scrollToPanel(panelId) {
  const el = document.querySelector(`.sidebar-panel[data-panel="${panelId}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * @param {{ getApplyView: () => string, onApplyView: (view: string) => void }} hooks
 */
export function initWorkflowNav(hooks) {
  const nav = document.querySelector('.workflow-nav');
  if (!nav) return;

  const syncActive = () => {
    const step = workflowStepForApplyView(hooks.getApplyView());
    nav.querySelectorAll('[data-workflow]').forEach((btn) => {
      const active = btn.getAttribute('data-workflow') === step;
      btn.classList.toggle('workflow-nav__step--active', active);
      btn.setAttribute('aria-current', active ? 'step' : 'false');
    });
  };

  nav.querySelectorAll('[data-workflow]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-workflow');
      const step = WORKFLOW_STEPS.find((s) => s.id === id);
      if (!step) return;
      if (step.applyView) hooks.onApplyView(step.applyView);
      if (step.scrollPanel) scrollToPanel(step.scrollPanel);
      nav.querySelectorAll('[data-workflow]').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('workflow-nav__step--active', active);
        b.setAttribute('aria-current', active ? 'step' : 'false');
      });
    });
  });

  window.addEventListener('hh-apply-view-change', syncActive);
  syncActive();
}
