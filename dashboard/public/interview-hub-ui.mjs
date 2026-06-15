/**
 * Хаб собеседований: слоты, офферы, мок-вопросы.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {object} hub
 */
export function renderInterviewHubHtml(hub) {
  if (!hub) return '<p class="funnel-empty">Нет данных</p>';
  const offers = hub.offers || [];
  const buckets = hub.buckets?.summary || {};
  const invited = offers.filter((o) => o.bucket === 'E');
  const offerItems = offers.filter((o) => o.bucket === 'F');

  const bucketRow = ['A', 'B', 'C', 'D', 'E', 'F']
    .map(
      (b) =>
        `<span class="interview-hub__bucket" title="Корзина ${b}"><strong>${b}</strong> ${buckets[b] ?? 0}</span>`
    )
    .join('');

  const list = (items, empty) => {
    if (!items.length) return `<p class="muted">${empty}</p>`;
    return `<ul class="interview-hub__list">${items
      .map(
        (it) => `
      <li class="interview-hub__item" data-id="${esc(it.id)}">
        <div class="interview-hub__item-head">
          <strong>${esc(it.title || '—')}</strong>
          <span class="muted">${esc(it.company || '')}</span>
          <span class="badge">${esc(it.label || it.bucket)}</span>
        </div>
        <div class="interview-hub__actions">
          <button type="button" class="btn btn-ghost btn-sm" data-hub-action="prep" data-id="${esc(it.id)}">Подготовка</button>
          <button type="button" class="btn btn-ghost btn-sm" data-hub-action="mock-tech" data-id="${esc(it.id)}">Тех. мок</button>
          <button type="button" class="btn btn-ghost btn-sm" data-hub-action="mock-hr" data-id="${esc(it.id)}">HR мок</button>
        </div>
        <pre class="interview-hub__output" hidden></pre>
      </li>`
      )
      .join('')}</ul>`;
  };

  return `
    <div class="interview-hub">
      <section class="funnel-panel">
        <h3 class="funnel-panel__title">Корзины воронки</h3>
        <div class="interview-hub__buckets">${bucketRow}</div>
      </section>
      <section class="funnel-panel">
        <h3 class="funnel-panel__title">Слоты собеседований (E)</h3>
        ${list(invited, 'Пока нет приглашений на собес')}
      </section>
      <section class="funnel-panel">
        <h3 class="funnel-panel__title">Офферы (F)</h3>
        ${list(offerItems, 'Офферов пока нет')}
      </section>
      ${
        hub.suggestions?.length
          ? `<section class="funnel-panel"><h3 class="funnel-panel__title">Подсказки</h3><ul>${hub.suggestions
              .map((s) => `<li>${esc(s)}</li>`)
              .join('')}</ul></section>`
          : ''
      }
    </div>`;
}

/**
 * @param {object} pack
 */
export function renderMockOutputHtml(pack) {
  if (!pack) return '';
  const qs = pack.questions || pack.checklist || [];
  const parts = [];
  if (qs.length) {
    parts.push('<ol>' + qs.map((q) => `<li>${esc(q)}</li>`).join('') + '</ol>');
  }
  if (pack.suggestedAnswers) {
    parts.push(`<pre class="interview-hub__answers">${esc(pack.suggestedAnswers)}</pre>`);
  }
  if (pack.salaryHint) parts.push(`<p class="muted">${esc(pack.salaryHint)}</p>`);
  if (pack.tips?.length) {
    parts.push('<ul>' + pack.tips.map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>');
  }
  return parts.join('') || '<p class="muted">Нет данных</p>';
}
