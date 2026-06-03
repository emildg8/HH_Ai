/**
 * Подстановка названия компании вместо обобщённых «ваша команда».
 */

/** @type {Array<{ re: RegExp, replace: (company: string) => string }>} */
const GENERIC_PATTERNS = [
  { re: /в\s+вашей\s+команде/gi, replace: (c) => `в команде ${c}` },
  { re: /в\s+вашей\s+компании/gi, replace: (c) => `в ${c}` },
  { re: /для\s+вашей\s+компании/gi, replace: (c) => `для ${c}` },
  { re: /вашей\s+команде/gi, replace: (c) => `команде ${c}` },
];

/**
 * @param {string} text
 * @param {object} rec
 */
export function injectCompanyNameIfNeeded(text, rec) {
  const company = String(rec?.company || '').trim();
  if (!company || company.length < 2) return text;
  const blob = text.toLowerCase();
  const needle = company.toLowerCase().slice(0, Math.min(12, company.length));
  if (needle.length >= 4 && blob.includes(needle)) return text;
  let out = text;
  let changed = false;
  for (const { re, replace } of GENERIC_PATTERNS) {
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, () => {
      changed = true;
      return replace(company);
    });
  }
  return changed ? out : text;
}
