/**
 * Извлечение сильных фактов из текста CV без LLM (для промпта сопроводительных).
 */

const TECH_RE =
  /\b(devops|sre|kubernetes|k8s|docker|ansible|terraform|linux|postgres|postgresql|oracle|sql|grafana|kibana|prometheus|jira|confluence|gitlab|ci\/cd|jenkins|nginx|bash|python|мониторинг|инцидент|sla|sbp|сбп)\b/i;

const METRIC_RE =
  /\d+\s*%|\d+\+|более\s+\d+|\d+\s*(лет|года|год|чел|человек|обращен|инцидент|кейс)|сократил|увеличил|снизил|ускорил/i;

/**
 * @param {string} cvText
 * @param {number} max
 * @returns {string[]}
 */
export function extractCvHighlights(cvText, max = 14) {
  const raw = String(cvText || '');
  const chunks = raw
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+/))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 22 && s.length <= 220);

  const seen = new Set();
  const scored = [];
  for (const line of chunks) {
    const key = line.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    let score = 0;
    if (METRIC_RE.test(line)) score += 4;
    if (TECH_RE.test(line)) score += 2;
    if (/\b(l2|l3|руковод|эксперт|банк|поддержк|сопровожден)\b/i.test(line)) score += 2;
    if (/^(мой|я\s|имею|опыт|владею)/i.test(line)) score -= 1;
    if (score > 0) scored.push({ line, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((x) => x.line);
}

/**
 * @param {string} cvText
 * @returns {string}
 */
export function buildCvFactsBlock(cvText) {
  const highlights = extractCvHighlights(cvText, 12);
  if (!highlights.length) return '';
  return `КЛЮЧЕВЫЕ ФАКТЫ ИЗ РЕЗЮМЕ (используй 2–4 в каждом письме, своими словами):\n${highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;
}
