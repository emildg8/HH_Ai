/**
 * Соответствие зарплаты вакансии ожиданиям кандидата.
 */

/**
 * @param {string} raw
 */
export function parseSalaryRubRange(raw) {
  const t = String(raw || '').toLowerCase().replace(/\s/g, '');
  const nums = [...t.matchAll(/(\d[\d\s]*\d|\d+)/g)]
    .map((m) => Number(String(m[1]).replace(/\s/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 30000 && n <= 2000000);
  if (!nums.length) return { min: null, max: null };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/**
 * @param {object} rec
 * @param {object} [prefs]
 */
export function assessSalaryFit(rec, prefs = {}) {
  const candidateMin = Number(prefs.minMonthlyRub ?? 150000);
  const candidateTarget = Number(prefs.targetMonthlyRub ?? 180000);
  const allowUnknown = prefs.allowUnknownSalary !== false;
  const range = parseSalaryRubRange(rec?.salaryRaw || rec?.descriptionPreview || '');
  if (range.max == null && range.min == null) {
    return {
      ok: allowUnknown,
      reason: allowUnknown ? 'вилка не указана — допускаем' : 'нет вилки зарплаты',
      vacancyMin: null,
      vacancyMax: null,
      candidateTarget,
    };
  }
  const vacMax = range.max ?? range.min;
  const vacMin = range.min ?? range.max;
  if (vacMax != null && vacMax < candidateMin * 0.85) {
    return {
      ok: false,
      reason: `вилка до ${vacMax} ниже минимума ${candidateMin}`,
      vacancyMin: vacMin,
      vacancyMax: vacMax,
      candidateTarget,
    };
  }
  return {
    ok: true,
    reason: 'вилка подходит',
    vacancyMin: vacMin,
    vacancyMax: vacMax,
    candidateTarget,
  };
}
