/**
 * Эвристика по тексту карточки вакансии (до отклика): часто в описании есть фразы про вопросы работодателя.
 */

const HINT_RULES = [
  { re: /вопросы\s+от\s+работодателя/i, label: '«вопросы от работодателя»' },
  { re: /дополнительные\s+вопросы/i, label: '«дополнительные вопросы»' },
  { re: /ответьте\s+на\s+вопрос/i, label: '«ответьте на вопрос…»' },
  { re: /анкета\s+работодателя/i, label: '«анкета работодателя»' },
  { re: /уточняющие\s+вопросы/i, label: '«уточняющие вопросы»' },
  { re: /заполните\s+анкету/i, label: '«заполните анкету»' },
  { re: /несколько\s+вопросов/i, label: '«несколько вопросов»' },
  { re: /при\s+отклике[^.\n]{0,120}(вопрос|анкет|ответить)/i, label: 'упоминание вопросов при отклике' },
  { re: /необходимо\s+ответить[^.\n]{0,80}вопрос/i, label: '«необходимо ответить… вопрос»' },
  { re: /вопрос\s+\d+\s*из\s*\d+/i, label: 'нумерация «вопрос N из M»' },
  { re: /screening\s+questions?/i, label: 'screening questions' },
  { re: /employer\s+questionnaire/i, label: 'employer questionnaire' },
];

/**
 * @param {{ title?: string, description?: string, employment?: string }} parsed
 * @returns {{ likely: boolean, reasons: string[] }}
 */
export function detectQuestionnaireHintFromVacancyText(parsed) {
  const blob = [parsed?.title, parsed?.description, parsed?.employment].filter(Boolean).join('\n');
  if (!blob.trim()) return { likely: false, reasons: [] };

  const reasons = [];
  for (const { re, label } of HINT_RULES) {
    if (re.test(blob)) reasons.push(label);
  }
  return {
    likely: reasons.length > 0,
    reasons: [...new Set(reasons)],
  };
}
