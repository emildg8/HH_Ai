/**
 * Модалка precheck перед запуском батча.
 */

import { openModalEl, closeModalEl } from './modals.mjs';

const REASON_LABELS = {
  'work-format': 'формат работы',
  letterQuality: 'качество письма',
  'off-target': 'нецелевая',
  fixableLetterQuality: 'можно подготовить',
};

/**
 * @param {object} ctx
 * @param {object} ctx.precheck
 * @param {string} ctx.label
 * @param {number} ctx.limit
 * @param {string} ctx.section
 * @param {string|null} ctx.queueTabLabel
 * @param {(key: string) => string} [ctx.reasonLabel]
 * @returns {Promise<'start'|'prepare'|'regen'|'filter'|false>}
 */
export function openBatchPrecheckModal(ctx) {
  const modal = document.getElementById('batch-precheck-modal');
  if (!modal) return Promise.resolve(false);

  const summaryEl = modal.querySelector('#batch-precheck-summary');
  const prefsDiffEl = modal.querySelector('#batch-precheck-prefs-diff');
  const blockersEl = modal.querySelector('#batch-precheck-blockers');
  const samplesEl = modal.querySelector('#batch-precheck-samples');
  const titleEl = modal.querySelector('#batch-precheck-title');
  const btnStart = modal.querySelector('#batch-precheck-start');
  const btnPrepare = modal.querySelector('#batch-precheck-prepare');
  const btnRegen = modal.querySelector('#batch-precheck-regen');
  const btnFilter = modal.querySelector('#batch-precheck-filter');
  const reasonLabel = ctx.reasonLabel || ((k) => REASON_LABELS[k] || k);

  function render(precheck) {
    const p = precheck || {};
    const blocked = p.blocked || {};
    const ready = Number(p.ready || 0);
    const total = Number(p.totalCandidates || 0);
    const fixable = Number(p.fixableLetterQuality || 0);
    const letterPct = p.letterReadyPercent;
    const letterBlocked = Number(p.letterBlocked || p.blocked?.letterQuality || 0);
    const fp = Number(p.falsePositives || 0);
    const fpMax = Number(p.falsePositiveMax ?? 20);
    const fpGuard = Boolean(p.falsePositiveGuardrail);

    if (titleEl) {
      titleEl.textContent = ctx.label ? `Серия: ${ctx.label}` : 'Проверка перед серией';
    }
    if (summaryEl) {
      summaryEl.innerHTML = [
        `<p><strong>Раздел:</strong> ${ctx.section || '—'}${ctx.queueTabLabel ? ` · ${ctx.queueTabLabel}` : ''}</p>`,
        `<p><strong>Лимит:</strong> до ${ctx.limit} откликов</p>`,
        `<p><strong>Кандидатов:</strong> ${total} · <strong>готово:</strong> ${ready}${
          letterPct != null ? ` (${letterPct}%)` : ''
        }</p>`,
        letterPct != null && total > 0
          ? `<div class="batch-precheck-meter" title="Готовность писем в выборке"><div class="batch-precheck-meter__fill" style="width:${Math.max(0, Math.min(100, letterPct))}%"></div></div>`
          : '',
        letterBlocked > 0
          ? `<p class="batch-precheck-hint">Письма не проходят проверку: ${letterBlocked}${
              ready <= 0 ? ' — сначала «Перегенерировать» или «Подготовить»' : ''
            }</p>`
          : '',
        fixable > 0 ? `<p class="batch-precheck-warn">Автоподготовка без LLM: ${fixable}</p>` : '',
        fpGuard && fpMax > 0
          ? `<p class="batch-precheck-warn batch-precheck-warn--guard">В «Неподходит» слишком много подходящих вакансий: ${fp} (порог ${fpMax}). Сначала примените правила в сайдбаре «Письма». <button type="button" class="btn-link" data-settings-tab="letters" data-settings-focus="fp">Настроить фильтр</button></p>`
          : fp > 0 && fpMax > 0
            ? `<p class="batch-precheck-hint">Ошибочно в «Неподходит»: ${fp} из ${fpMax}. <button type="button" class="btn-link" data-settings-tab="letters" data-settings-focus="fp">Настроить</button></p>`
            : '',
        fixable <= 0 && letterBlocked > 0
          ? `<p class="batch-precheck-hint"><button type="button" class="btn-link" data-settings-tab="letters" data-settings-focus="prepare">Автоподготовка писем</button> в настройках</p>`
          : '',
      ].join('');
    }

    if (prefsDiffEl) {
      const diff = Array.isArray(p.prefsDiff) ? p.prefsDiff : [];
      if (!diff.length) {
        prefsDiffEl.hidden = true;
        prefsDiffEl.replaceChildren();
      } else {
        const when = p.lastBatchFinishedAt
          ? new Date(p.lastBatchFinishedAt).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'прошлой серии';
        prefsDiffEl.hidden = false;
        prefsDiffEl.innerHTML = [
          `<p class="batch-precheck-prefs-diff__title">Настройки изменились с ${escapeHtml(when)}:</p>`,
          '<ul class="batch-precheck-prefs-diff__list">',
          ...diff.map(
            (row) =>
              `<li><span class="batch-precheck-prefs-diff__label">${escapeHtml(row.label)}</span>` +
              `<span class="batch-precheck-prefs-diff__vals">${escapeHtml(row.before)} → <strong>${escapeHtml(row.after)}</strong></span></li>`
          ),
          '</ul>',
        ].join('');
      }
    }

    if (blockersEl) {
      const rows = Object.entries(blocked)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      if (!rows.length) {
        blockersEl.innerHTML = '<p class="modal-hint">Нет блокеров в выборке.</p>';
      } else {
        blockersEl.innerHTML = `<ul class="batch-precheck-blockers">${rows
          .map(([k, n]) => `<li><span>${reasonLabel(k)}</span><strong>${n}</strong></li>`)
          .join('')}</ul>`;
      }
    }

    if (samplesEl) {
      const samples = p.blockedSamples || {};
      const parts = [];
      for (const [key, list] of Object.entries(samples)) {
        if (!Array.isArray(list) || !list.length) continue;
        parts.push(`<p class="batch-precheck-sample-head">${reasonLabel(key)}</p>`);
        parts.push(
          '<ul class="batch-precheck-samples">' +
            list
              .map(
                (it) =>
                  `<li>${escapeHtml(it.title || it.id)}${it.reason ? ` — <span>${escapeHtml(it.reason)}</span>` : ''}</li>`
              )
              .join('') +
            '</ul>'
        );
      }
      samplesEl.innerHTML = parts.length ? parts.join('') : '';
      samplesEl.hidden = !parts.length;
    }

    if (btnStart) {
      btnStart.disabled = ready <= 0;
      btnStart.textContent = ready > 0 ? 'Запустить серию' : 'Запустить серию (нет готовых)';
      btnStart.title =
        fpGuard && ready > 0
          ? `Много подходящих вакансий в «Неподходит» (${fp} > ${fpMax}). Запуск с подтверждением.`
          : ready > 0
            ? 'Запустить серию откликов'
            : letterBlocked > 0
              ? 'Нет утверждённых писем — сначала перегенерируйте или подготовьте'
              : 'Нет готовых карточек';
      btnStart.classList.toggle('btn--guardrail', fpGuard && ready > 0);
      btnStart.classList.toggle('btn-primary', ready > 0);
    }
    if (btnPrepare) {
      btnPrepare.hidden = fixable <= 0 && !(blocked.letterQuality > 0);
      btnPrepare.textContent = fixable > 0 ? `Подготовить (${fixable})` : 'Подготовить письма';
      btnPrepare.classList.toggle('btn-primary', ready <= 0 && fixable > 0);
    }
    if (btnRegen) {
      const failN = blocked.letterQuality || 0;
      btnRegen.hidden = failN <= 0;
      btnRegen.textContent = failN > 0 ? `Перегенерировать (${failN})` : 'Перегенерировать';
      btnRegen.classList.toggle('btn-primary', ready <= 0 && failN > 0 && fixable <= 0);
    }
    if (btnFilter) {
      btnFilter.hidden = !((blocked.letterQuality || 0) + fixable > 0);
    }
  }

  render(ctx.precheck);
  openModalEl(modal);

  if (!modal.dataset.settingsLinkBound) {
    modal.dataset.settingsLinkBound = '1';
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-settings-tab]');
      if (!(btn instanceof HTMLElement)) return;
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent('hh-open-settings', {
          detail: {
            tab: btn.dataset.settingsTab || 'letters',
            focus: btn.dataset.settingsFocus || '',
          },
        })
      );
    });
  }

  return new Promise((resolve) => {
    const done = (value) => {
      closeModalEl(modal);
      resolve(value);
    };

    const onClose = () => done(false);
    modal.querySelector('.modal-close')?.addEventListener('click', onClose, { once: true });
    modal.querySelector('.modal-backdrop')?.addEventListener('click', onClose, { once: true });

    btnStart?.addEventListener(
      'click',
      () => {
        done('start');
      },
      { once: true }
    );
    btnPrepare?.addEventListener(
      'click',
      () => {
        done('prepare');
      },
      { once: true }
    );
    btnRegen?.addEventListener(
      'click',
      () => {
        done('regen');
      },
      { once: true }
    );
    btnFilter?.addEventListener(
      'click',
      () => {
        done('filter');
      },
      { once: true }
    );

    modal._batchPrecheckUpdate = (next) => render(next);
  });
}

/** @param {object} precheck */
export function updateBatchPrecheckModal(precheck) {
  const modal = document.getElementById('batch-precheck-modal');
  if (modal?._batchPrecheckUpdate) modal._batchPrecheckUpdate(precheck);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
