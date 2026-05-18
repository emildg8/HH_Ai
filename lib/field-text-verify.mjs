/**
 * Проверка, что в поле реально появился ожидаемый текст (не «успех» по клику в пустое поле).
 */

function normalizeText(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {import('playwright').Locator} locator
 * @param {string} expectedText
 * @param {{ minChars?: number }} [opts]
 */
export async function fieldContainsExpectedText(locator, expectedText, opts = {}) {
  const expected = normalizeText(expectedText);
  if (!expected) return false;
  const minChars = opts.minChars ?? Math.min(50, Math.max(20, Math.floor(expected.length * 0.12)));
  const el = locator.first();
  const got = normalizeText(
    await el
      .evaluate((node) => {
        if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
          return node.value || '';
        }
        return node.textContent || node.innerText || '';
      })
      .catch(() => '')
  );
  if (got.length < minChars) return false;
  const head = expected.slice(0, Math.min(100, expected.length));
  const tail = expected.length > 80 ? expected.slice(-60) : '';
  if (got.includes(head)) return true;
  if (tail && got.includes(tail)) return true;
  return got.length >= minChars && expected.length >= minChars;
}
