/** Плитки для режимов «Краткий» и «Средний» — клик открывает полную карточку. */



import { openVacancyDetail } from './vacancy-detail.mjs';

import { renderStatusChips, vacancyQuestionnairePending } from './card-status.mjs';

function isVacancyDeferredClient(rec, nowMs = Date.now()) {
  const until = Date.parse(String(rec?.deferUntil || ''));
  return Number.isFinite(until) && until > nowMs;
}



const tileTpl = document.getElementById('card-tile-tpl');



/**

 * @param {'tile-compact'|'tile-medium'} mode

 */

export function isTileBrowseMode(mode) {

  return mode === 'tile-compact' || mode === 'tile-medium';

}



export function currentBrowseMode() {

  const layout = document.documentElement.dataset.cardLayout || 'expanded';

  return isTileBrowseMode(layout) ? layout : null;

}



/**

 * @param {object} item

 * @param {number} scoreThreshold

 * @param {(item: object, opts?: object) => HTMLElement} renderFullCard

 * @param {(node: HTMLElement, item: object) => void} bindDismiss

 */

export function renderCardTile(item, scoreThreshold, renderFullCard, bindDismiss) {

  const mode = currentBrowseMode() || 'tile-compact';

  const node = tileTpl.content.firstElementChild.cloneNode(true);

  node.dataset.recordId = item.id;

  node.classList.add(mode === 'tile-medium' ? 'card-tile--medium' : 'card-tile--compact');



  const s = Number(item.scoreOverall ?? item.geminiScore ?? 0) || 0;

  if (s >= scoreThreshold) node.classList.add('card-tile--score-high');

  else if (s > 0) node.classList.add('card-tile--score-low');



  if (item.targeting?.eligible === false) node.classList.add('card-tile--off-target');

  if (item.hhApply?.hhSiteState === 'invited') node.classList.add('card-tile--invited');

  else if (vacancyQuestionnairePending(item)) node.classList.add('card-tile--questionnaire');



  const scoreEl = node.querySelector('.card-tile__score');

  const overall = item.scoreOverall ?? item.geminiScore;

  scoreEl.textContent = overall != null && overall !== '' ? String(overall) : '—';



  const titleEl = node.querySelector('.card-tile__title');

  titleEl.textContent = item.title || item.url || '—';



  const metaParts = [

    item.company,

    item.salaryEstimate?.ok

      ? `≈${item.salaryEstimate.minUsd}–${item.salaryEstimate.maxUsd} USD`

      : item.salaryRaw || '',

  ].filter(Boolean);

  const metaEl = node.querySelector('.card-tile__meta');

  metaEl.textContent = metaParts.join(' · ');



  renderStatusChips(node.querySelector('.card-tile__status'), item);



  const summaryEl = node.querySelector('.card-tile__summary');

  const summary = String(item.geminiSummary || '').trim();

  if (mode === 'tile-medium' && summary) {

    summaryEl.hidden = false;

    summaryEl.textContent = summary;

  } else {

    summaryEl.hidden = true;

  }



  const hhLink = node.querySelector('.card-tile__hh');

  if (item.url) {

    hhLink.href = item.url;

    hhLink.hidden = false;

  } else {

    hhLink.hidden = true;

  }



  bindDismiss(node, item);



  const openDetail = (e) => {

    if (e.target.closest('.card-dismiss, .card-tile__hh')) return;

    e.preventDefault();

    openVacancyDetail(item, renderFullCard);

  };



  node.querySelector('.card-tile__open')?.addEventListener('click', openDetail);

  node.setAttribute('tabindex', '0');

  node.addEventListener('keydown', (e) => {

    if (e.key === 'Enter' || e.key === ' ') {

      if (e.target.closest('.card-dismiss, .card-tile__hh')) return;

      e.preventDefault();

      openVacancyDetail(item, renderFullCard);

    }

  });



  return node;

}


