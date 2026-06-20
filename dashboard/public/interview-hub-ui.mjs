/**

 * Хаб собеседований: слоты, офферы, мок-вопросы.

 */



import { outcomeBucketLabel } from './dashboard-copy-ru.mjs';



function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {unknown} item */
function lineText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'object') {
    for (const key of ['question', 'text', 'q', 'title', 'label', 'tip']) {
      const v = item[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  const s = String(item).trim();
  return s === '[object Object]' ? '' : s;
}



const OUTCOME_BUCKETS = ['A', 'B', 'C', 'D', 'E', 'F'];



/**

 * @param {object} hub

 */

export function renderInterviewHubHtml(hub) {

  if (!hub) return '<p class="funnel-empty">Нет данных</p>';

  const offers = hub.offers || [];

  const buckets = hub.buckets?.summary || {};

  const invited = offers.filter((o) => o.bucket === 'E');

  const offerItems = offers.filter((o) => o.bucket === 'F');



  const bucketRow = OUTCOME_BUCKETS.map((b) => {

    const label = outcomeBucketLabel(b, { short: true });

    const count = buckets[b] ?? 0;

    const full = outcomeBucketLabel(b);

    return `<div class="funnel-bucket interview-hub__funnel-bucket" title="${esc(full)}">

      <span>${esc(label)}</span>

      <strong>${esc(count)}</strong>

    </div>`;

  }).join('');



  const list = (items, empty) => {

    if (!items.length) return `<p class="muted">${empty}</p>`;

    return `<ul class="interview-hub__list">${items

      .map(

        (it) => `

      <li class="interview-hub__item" data-id="${esc(it.id)}">

        <div class="interview-hub__item-head">

          <strong>${esc(it.title || '—')}</strong>

          <span class="muted">${esc(it.company || '')}</span>

          <span class="badge">${esc(it.label || outcomeBucketLabel(it.bucket))}</span>

        </div>

        <div class="interview-hub__actions">

          <button type="button" class="btn btn-secondary btn-sm" data-hub-action="prep" data-id="${esc(it.id)}" data-title="${esc(it.title || '')}" data-company="${esc(it.company || '')}" title="Чеклист и фокус по вакансии">План собеса</button>

          <button type="button" class="btn btn-secondary btn-sm" data-hub-action="mock-tech" data-id="${esc(it.id)}" data-title="${esc(it.title || '')}" data-company="${esc(it.company || '')}" title="Технические вопросы по стеку">Тех. вопросы</button>

          <button type="button" class="btn btn-secondary btn-sm" data-hub-action="mock-hr" data-id="${esc(it.id)}" data-title="${esc(it.title || '')}" data-company="${esc(it.company || '')}" title="Вопросы HR-скрининга">HR-скрининг</button>

          <button type="button" class="btn btn-primary btn-sm" data-hub-action="copilot-go" data-id="${esc(it.id)}" data-title="${esc(it.title || '')}" data-company="${esc(it.company || '')}" title="Мастер готовности и живой суфлёр">К собесу</button>

          <button type="button" class="btn btn-secondary btn-sm" data-hub-action="prompt" data-id="${esc(it.id)}" data-title="${esc(it.title || '')}" data-company="${esc(it.company || '')}" title="Тезисы для чтения">Тезисы</button>

        </div>

        <div class="interview-hub__output" hidden></div>

      </li>`

      )

      .join('')}</ul>`;

  };



  return `

    <div class="interview-hub">

      <section class="funnel-panel">

        <h3 class="funnel-panel__title">Статусы откликов</h3>

        <p class="funnel-panel__meta">Сколько переговоров в каждой стадии воронки</p>

        <div class="funnel-buckets interview-hub__funnel-buckets">${bucketRow}</div>

      </section>

      <section class="funnel-panel">

        <h3 class="funnel-panel__title">Приглашения на собес</h3>

        ${list(invited, 'Пока нет приглашений на собеседование')}

      </section>

      <section class="funnel-panel">

        <h3 class="funnel-panel__title">Офферы</h3>

        ${list(offerItems, 'Офферов пока нет')}

      </section>

      ${

        hub.suggestions?.length

          ? `<section class="funnel-panel"><h3 class="funnel-panel__title">Подсказки</h3><ul class="interview-hub__tips">${hub.suggestions

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
  const qs = (pack.questions || pack.checklist || []).map(lineText).filter(Boolean);
  const parts = [];
  if (qs.length) {
    parts.push('<ol>' + qs.map((q) => `<li>${esc(q)}</li>`).join('') + '</ol>');
  }
  const focus = (pack.focus || []).map(lineText).filter(Boolean);
  if (focus.length) {
    parts.push(`<p class="interview-hub__focus"><strong>На что давить:</strong> ${esc(focus.join(', '))}</p>`);
  }
  if (pack.suggestedAnswers) {
    parts.push(`<pre class="interview-hub__answers">${esc(pack.suggestedAnswers)}</pre>`);
  }
  if (pack.salaryHint) parts.push(`<p class="muted">${esc(pack.salaryHint)}</p>`);
  const tips = (pack.tips || []).map(lineText).filter(Boolean);
  if (tips.length) {
    parts.push('<ul>' + tips.map((t) => `<li>${esc(t)}</li>`).join('') + '</ul>');
  }
  return parts.join('') || '<p class="muted">Нет данных</p>';
}


