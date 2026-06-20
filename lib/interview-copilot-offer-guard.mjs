/**
 * Предохранитель ответов: противоречия CV, red flags, STAR для behavioral.
 */

const RED_FLAG_RE =
  /(ненавижу|идиот|козл|тупой руковод|враг|судиться|всё умею|лучший в мире|архитектор всего)/i;

const EMPLOYER_QUESTION_RE =
  /(есть вопросы к нам|ваши вопросы|что хотите спросить|остались вопросы)/i;

/**
 * @param {string} script
 * @param {object} ctx
 */
export function applyOfferGuard(script, ctx = {}) {
  const s = String(script || '').trim();
  const flags = [];

  if (!s) return { script: s, flags: ['empty'], regenerated: false };

  if (RED_FLAG_RE.test(s)) flags.push('red_flag_tone');

  const yearsInScript = s.match(/(\d+)\s*(лет|года|год)/gi) || [];
  const cv = String(ctx.cvText || '');
  for (const y of yearsInScript) {
    const num = y.match(/\d+/)?.[0];
    if (num && cv && !cv.includes(num)) flags.push(`years_mismatch:${num}`);
  }

  const spoken = String(ctx.spokenSnippet || '').toLowerCase();
  if (spoken) {
    const scriptDigitYears = [...s.matchAll(/(\d+)\s*(лет|года|год)/gi)].map((m) => m[1]);
    const spokenDigitYears = [...spoken.matchAll(/(\d+)\s*(лет|года|год)/gi)].map((m) => m[1]);
    if (scriptDigitYears.length && spokenDigitYears.length && scriptDigitYears[0] !== spokenDigitYears[0]) {
      flags.push('spoken_years_mismatch');
    }
    const wordYears = { два: '2', двух: '2', три: '3', трёх: '3', трех: '3', пять: '5', пяти: '5', четыре: '4' };
    const scriptWord = Object.keys(wordYears).find((w) => s.toLowerCase().includes(w));
    const spokenWord = Object.keys(wordYears).find((w) => spoken.includes(w));
    if (scriptWord && spokenWord && wordYears[scriptWord] !== wordYears[spokenWord]) {
      flags.push('spoken_years_mismatch');
    }
    const scriptNums = [...s.matchAll(/\b(\d{2,})\b/g)].map((m) => m[1]);
    for (const n of scriptNums) {
      if (!spoken.includes(n) && cv && !cv.includes(n)) flags.push(`spoken_cv_mismatch:${n}`);
    }
  }

  if ((ctx.kind === 'hr' || ctx.interviewStage === 'hr') && s.length > 40) {
    if (!/(был|делал|настроил|внедрил|решил|кейс|проект)/i.test(s)) {
      flags.push('star_weak');
    }
  }

  let out = s;
  let regenerated = false;

  if (flags.includes('red_flag_tone')) {
    out = 'Сформулирую нейтрально: опыт релевантный, готов привести конкретный пример по запросу.';
    regenerated = true;
  } else if (flags.includes('star_weak')) {
    out = `${s.split('.')[0]}. Конкретный пример: на прошлом месте настроил CI/CD и сократил время выкладки.`;
    regenerated = true;
  } else if (flags.some((f) => f.startsWith('years_mismatch'))) {
    out = 'По опыту: ориентируюсь на факты из резюме — готов уточнить детали по стеку и кейсам.';
    regenerated = true;
  } else if (flags.includes('spoken_years_mismatch')) {
    out = spoken
      ? `Как говорил ранее: ${ctx.spokenSnippet.slice(0, 120)}. Могу раскрыть подробнее по запросу.`
      : out;
    regenerated = out !== s;
  }

  return { script: out, flags, regenerated };
}

export function isEmployerQuestionPrompt(text) {
  return EMPLOYER_QUESTION_RE.test(String(text || ''));
}
