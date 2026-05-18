/**
 * Разбор строки зарплаты hh.ru → оценка вилки в USD/мес.
 * rubPerUsd — сколько рублей за 1 USD (например 98).
 */

function normalizeSpaces(s) {
  return String(s).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @returns {{ ok: boolean, minUsd?: number, maxUsd?: number, note?: string }}
 */
export function estimateMonthlyUsd(salaryRaw, rubPerUsd) {
  if (!salaryRaw || !String(salaryRaw).trim()) {
    return { ok: false, note: 'Зарплата не указана' };
  }

  let s = normalizeSpaces(salaryRaw).toLowerCase();
  s = s.replace(/(\d)\s+(?=\d)/g, '$1');

  const nums = (s.match(/\d+/g) || []).map((x) => parseInt(x, 10)).filter((n) => n > 0);
  if (!nums.length) {
    return { ok: false, note: 'Не удалось распознать сумму' };
  }

  const isUsd = /\$|usd|долл/.test(s);
  const isEur = /€|eur|евро/.test(s);

  let minN = Math.min(...nums);
  let maxN = Math.max(...nums);
  if (nums.length === 1) {
    minN = maxN = nums[0];
  }

  const hasOt = /\bот\b/.test(s);
  const hasDo = /\bдо\b/.test(s);
  if (nums.length >= 2 && hasOt && hasDo) {
    minN = Math.min(nums[0], nums[1]);
    maxN = Math.max(nums[0], nums[1]);
  } else if (hasOt && !hasDo) {
    minN = maxN = nums[0];
  } else if (hasDo && !hasOt) {
    maxN = nums[0];
    minN = Math.round(maxN * 0.55);
  }

  const rub = rubPerUsd || 98;
  let minUsd;
  let maxUsd;

  if (isUsd) {
    minUsd = minN;
    maxUsd = maxN;
  } else if (isEur) {
    const k = 1.08;
    minUsd = minN * k;
    maxUsd = maxN * k;
  } else {
    minUsd = minN / rub;
    maxUsd = maxN / rub;
  }

  if (!Number.isFinite(minUsd) || minUsd <= 0) {
    return { ok: false, note: 'Некорректный разбор' };
  }

  return {
    ok: true,
    minUsd: Math.round(minUsd),
    maxUsd: Math.round(maxUsd),
    note: salaryRaw,
  };
}
