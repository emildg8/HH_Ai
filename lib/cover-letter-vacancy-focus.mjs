/**
 * Фокус вакансии для промпта сопроводительных (требования, угол отклика).
 */

const STOP = new Set(
  'и в на с по для от до из к о об при что это как или не без также вашей нашей компании команде'.split(
    /\s+/
  )
);

/**
 * @param {string} desc
 * @param {number} max
 */
function extractRequirementLines(desc, max = 8) {
  const lines = String(desc || '')
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–—*]+/, '').trim())
    .filter((l) => l.length >= 12 && l.length <= 200);

  const bullets = lines.filter(
    (l) =>
      /требован|обязанност|ожидаем|нужно|знание|опыт|умеете|будет плюс|стек|навык/i.test(l) ||
      /^[•\-–—]/.test(l)
  );
  const pool = bullets.length ? bullets : lines;
  return pool.slice(0, max);
}

/**
 * @param {string} desc
 */
function topKeywords(desc, max = 12) {
  const words = String(desc || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9+/.\-]+/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

/**
 * @param {object} record
 * @param {string} desc
 * @returns {string}
 */
export function buildVacancyFocusBlock(record, desc) {
  const title = String(record?.title || '').trim();
  const company = String(record?.company || '').trim();
  const summary = String(record?.geminiSummary || '').trim();
  const risks = String(record?.geminiRisks || '').trim();
  const tags = Array.isArray(record?.geminiTags) ? record.geminiTags.filter(Boolean) : [];
  const reqs = extractRequirementLines(desc, 8);
  const kw = topKeywords(desc, 10);

  const parts = [];
  if (title || company) {
    parts.push(`ПОЗИЦИЯ: ${title || '—'}${company ? ` · ${company}` : ''}`);
  }
  if (summary) parts.push(`Суть вакансии (оценка): ${summary}`);
  if (tags.length) parts.push(`Теги: ${tags.join(', ')}`);
  if (reqs.length) {
    parts.push('Требования/задачи из описания (отрази 2–3 в письме):');
    reqs.forEach((r, i) => parts.push(`  ${i + 1}. ${r}`));
  }
  if (kw.length) parts.push(`Ключевые слова вакансии: ${kw.join(', ')}`);
  if (risks) parts.push(`На что обратить внимание: ${risks}`);

  return parts.join('\n');
}
