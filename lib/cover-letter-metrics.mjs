/**
 * Метрики правок сопроводительного: сравнение сгенерированного и утверждённого текста.
 */

/**
 * @param {string} a
 * @param {string} b
 */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  /** @type {number[]} */
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  /** @type {number[]} */
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** @param {string} text */
function normalizeLetter(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Доля правок 0–100 (100 = полностью другой текст).
 * @param {string} generatedText
 * @param {string} approvedText
 */
export function computeLetterEditMetrics(generatedText, approvedText) {
  const generated = normalizeLetter(generatedText);
  const approved = normalizeLetter(approvedText);
  if (!generated || !approved) return null;
  if (generated === approved) {
    return { editRatioPct: 0, generatedLen: generated.length, approvedLen: approved.length };
  }
  const dist = levenshteinDistance(generated, approved);
  const denom = Math.max(generated.length, approved.length, 1);
  const editRatioPct = Math.min(100, Math.round((dist / denom) * 100));
  return { editRatioPct, generatedLen: generated.length, approvedLen: approved.length };
}

/** @param {{ editRatioPct?: number } | null | undefined} metrics */
export function formatLetterMetricsShort(metrics) {
  if (!metrics || metrics.editRatioPct == null) return '';
  if (metrics.editRatioPct <= 5) return 'без правок';
  return `правки ~${metrics.editRatioPct}%`;
}
