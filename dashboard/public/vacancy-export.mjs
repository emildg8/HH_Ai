/**
 * Экспорт карточки вакансии в Markdown (буфер / файл).
 */

/**
 * @param {object} item
 * @returns {string}
 */
export function vacancyToMarkdown(item) {
  if (!item) return '';
  const lines = [];
  const title = String(item.title || 'Без названия').trim();
  const url = String(item.url || '').trim();
  const company = String(item.company || '').trim();
  const score = item.scoreOverall ?? item.geminiScore;
  const summary = String(item.geminiSummary || '').trim();
  const letter = String(item.coverLetter?.approvedText || '').trim();
  const tags = Array.isArray(item.geminiTags) ? item.geminiTags.filter(Boolean) : [];

  lines.push(`# ${title}`);
  if (url) lines.push('', `[Открыть на hh.ru](${url})`);
  lines.push('');
  if (company) lines.push(`**Компания:** ${company}`);
  if (score != null && score !== '') lines.push(`**Балл:** ${score}`);
  if (item.resumeRouting?.label) lines.push(`**Резюме:** ${item.resumeRouting.label}`);
  if (item.salaryRaw) lines.push(`**Зарплата:** ${item.salaryRaw}`);
  if (tags.length) lines.push(`**Теги:** ${tags.join(', ')}`);

  const h = item.hhApply;
  if (h?.hhSiteState) lines.push(`**Статус hh:** ${h.hhSiteState}`);
  if (h?.lastAt) lines.push(`**Отклик:** ${h.lastAt}`);

  const metrics = item.coverLetter?.metrics;
  if (metrics?.editRatioPct != null) {
    lines.push(`**Правки письма:** ~${metrics.editRatioPct}%`);
  }

  if (summary) {
    lines.push('', '## Суть', '', summary);
  }

  const desc = String(item.descriptionPreview || '').trim();
  if (desc && desc !== summary) {
    lines.push('', '## Описание', '', desc.slice(0, 4000));
  }

  if (letter) {
    lines.push('', '## Сопроводительное', '', letter);
  }

  const q = h?.questionnaire?.questions;
  if (Array.isArray(q) && q.length) {
    lines.push('', '## Анкета');
    for (const qu of q.slice(0, 20)) {
      const qt = String(qu?.text || qu?.label || '').trim();
      const ans = String(qu?.suggestedAnswer || qu?.answer || '').trim();
      if (qt) lines.push('', `### ${qt}`, ans || '_без ответа_');
    }
  }

  lines.push('', `---`, `_Экспорт HH Ai · ${new Date().toISOString().slice(0, 10)}_`);
  return lines.join('\n').trim();
}

/**
 * @param {object} item
 * @returns {Promise<boolean>}
 */
export async function copyVacancyMarkdown(item) {
  const md = vacancyToMarkdown(item);
  if (!md) return false;
  await navigator.clipboard.writeText(md);
  return true;
}

/**
 * @param {object} item
 * @param {string} [filename]
 */
export function downloadVacancyMarkdown(item, filename) {
  const md = vacancyToMarkdown(item);
  const name =
    filename ||
    `vacancy-${String(item.id || 'export').slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.md`;
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
