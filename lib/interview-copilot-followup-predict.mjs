/**
 * Эвристика: 2–3 вероятных уточнения после behavioral/tech вопроса.
 */

const FOLLOWUP_BY_KIND = {
  hr: [
    'Можете привести конкретный пример?',
    'Какой был ваш личный вклад?',
    'Что бы вы сделали иначе?',
  ],
  technical: [
    'Как вы отлаживали проблему на практике?',
    'Какие метрики/алерты использовали?',
    'Что было самым сложным в этом кейсе?',
  ],
  small_talk: ['Какой формат работы вам удобнее?', 'Когда готовы выйти?'],
};

/**
 * @param {string} question
 * @param {string} [kind]
 * @returns {string[]}
 */
export function predictFollowUps(question, kind = 'technical') {
  const k = kind || 'technical';
  const base = FOLLOWUP_BY_KIND[k] || FOLLOWUP_BY_KIND.technical;
  const q = String(question || '').toLowerCase();
  const out = [...base];
  if (/kubernetes|k8s/i.test(q)) out.unshift('Как решали проблемы с etcd или сетью?');
  if (/ci\/?cd|pipeline/i.test(q)) out.unshift('Как устроен rollback в вашем пайплайне?');
  return [...new Set(out)].slice(0, 3);
}
