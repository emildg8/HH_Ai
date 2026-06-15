/**
 * Смягчение шаблонных фраз в письме (без LLM).
 */

const REPLACEMENTS = [
  [/\bЯ хотел бы\b/gi, 'Хотел бы'],
  [/\bЯ бы хотел\b/gi, 'Хотел бы'],
  [/\bв связи с тем, что\b/gi, 'так как'],
  [/\bв настоящее время\b/gi, 'сейчас'],
  [/\bосуществлял\b/gi, 'делал'],
  [/\bосуществляю\b/gi, 'делаю'],
  [/\bданная вакансия\b/gi, 'эта позиция'],
  [/\bв вашей компании\b/gi, 'у вас'],
  [/\bс уважением,\s*$/gi, ''],
  [/\bзаранее благодарю\b/gi, 'буду рад ответу'],
];

const ROBOT_OPENERS = [
  'Здравствуйте! ',
  'Добрый день! ',
  'Привет! ',
];

/**
 * @param {string} text
 */
export function humanizeLetterText(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;

  for (const [re, rep] of REPLACEMENTS) {
    t = t.replace(re, rep);
  }

  if (/^здравствуйте!?\s+здравствуйте/i.test(t)) {
    t = t.replace(/^здравствуйте!?\s+/i, 'Здравствуйте! ');
  }

  const hasOpener = ROBOT_OPENERS.some((o) => t.toLowerCase().startsWith(o.toLowerCase().trim()));
  if (!hasOpener && t.length > 40) {
    t = `Здравствуйте! ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
  }

  return t.replace(/\s{2,}/g, ' ').trim();
}
