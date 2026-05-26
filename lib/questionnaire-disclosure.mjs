/** Текст про прозрачность автоматизации отклика (HH Ai). */

export function hhAiAutomationDisclosureShort() {
  return (
    'Прозрачно: ответы в анкете и отклик подготовлены через HH Ai (локальная автоматизация на базе резюме/CV и LLM), ' +
    'без ручного захода кандидата на сайт hh.ru.'
  );
}

/**
 * @param {string} label
 */
export function isLlmRelatedQuestionLabel(label) {
  return /\bllm\b|нейросет|chatgpt|openai|промт|prompt|инжиниринг|llm\s*агент/i.test(
    String(label || '')
  );
}

/**
 * Ответ для radio «Пользуетесь LLM?» и похожих.
 * @param {{ label: string, options?: Array<{ label: string }> }} question
 */
export function answerLlmRadioWithDisclosure(question) {
  const opts = question.options || [];
  const pick = (re) => {
    for (const o of opts) {
      if (re.test(o.label)) return o.label;
    }
    return '';
  };
  const label = String(question.label || '');
  if (/пользуетесь|используете/i.test(label)) {
    return pick(/постоянно/i) || pick(/ежедневно/i) || pick(/иногда/i) || opts[0]?.label || '';
  }
  if (/промт|инжиниринг/i.test(label)) {
    return pick(/^да/i) || opts[0]?.label || '';
  }
  if (/развернуть|агент/i.test(label)) {
    return pick(/^да/i) || pick(/научусь/i) || '';
  }
  if (/как\s+работают|знаете/i.test(label)) {
    return pick(/примерно/i) || pick(/^да/i) || '';
  }
  return pick(/постоянно/i) || pick(/^да/i) || '';
}

/**
 * Текстовое поле рядом с блоком LLM (если есть textarea на шаге).
 */
export function answerLlmDisclosureTextarea() {
  return (
    `${hhAiAutomationDisclosureShort()}\n\n` +
    'LLM использую в работе (скрипты, черновики, разбор требований). ' +
    'Готов обсудить детали процесса на собеседовании.'
  );
}
