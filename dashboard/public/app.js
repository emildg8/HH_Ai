const listEl = document.getElementById('list');
const tpl = document.getElementById('card-tpl');

const vacancyTabsEl = document.querySelector('.vacancy-tabs');

let currentStatus = 'pending';

/** Нормализованные веса для подсказки к скору (как в lib/openrouter-score.mjs) */
let scoreWeights = { vacancy: 0.35, cvMatch: 0.65 };

/** @type {{ id: string, variants: string[], selectedIndex: number } | null} */
let draftModalState = null;

document.addEventListener('click', () => {
  document.querySelectorAll('.model-info-panel').forEach((p) => {
    p.hidden = true;
  });
});

function showToast(message, variant = 'neutral') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${variant}`;
  t.setAttribute('role', 'status');
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--visible'));
  const hide = () => {
    t.classList.remove('toast--visible');
    setTimeout(() => t.remove(), 280);
  };
  setTimeout(hide, 2600);
}

async function api(path, opts = {}) {
  const url =
    typeof path === 'string' && path.startsWith('/')
      ? new URL(path, window.location.origin).toString()
      : path;
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const looksHtml = /^\s*</.test(text);
    const hint =
      r.status === 404 && (text.trim() === 'Not found' || looksHtml)
        ? 'Ответ не JSON (часто 404 у статики). Запустите дашборд: npm run dashboard и откройте http://127.0.0.1:3849'
        : text.slice(0, 400) || r.statusText;
    const err = new Error(hint);
    err.status = r.status;
    throw err;
  }
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function requestCoverLetterGenerate(id, force = false) {
  return api('/api/cover-letter/generate', {
    method: 'POST',
    body: JSON.stringify({ id, force }),
  });
}

function closeDraftModal() {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;
  modal.hidden = true;
  draftModalState = null;
  document.removeEventListener('keydown', onDraftModalEscape);
}

function onDraftModalEscape(e) {
  if (e.key === 'Escape') closeDraftModal();
}

function closeApprovedLetterModal() {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  modal.hidden = true;
  document.removeEventListener('keydown', onApprovedModalEscape);
}

function closeApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  modal.hidden = true;
  document.removeEventListener('keydown', onApplyLogModalEscape);
}

function onApplyLogModalEscape(e) {
  if (e.key === 'Escape') closeApplyLogModal();
}

async function refreshApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  const pre = modal.querySelector('.apply-log-pre');
  const pathEl = modal.querySelector('.apply-log-path');
  pathEl.textContent = 'data/hh-apply-chat.log';
  pre.textContent = 'Загрузка…';
  try {
    const data = await api('/api/hh-apply-chat-log?lines=120');
    const rel = data.relativePath || data.path || 'data/hh-apply-chat.log';
    pathEl.textContent = rel && rel !== '.' ? rel : 'data/hh-apply-chat.log';
    if (!data.exists) {
      pre.textContent =
        'Файла лога ещё нет. Нажмите «Отклик в браузере» на карточке с утверждённым письмом — тогда появится Chromium и запись в лог.';
      return;
    }
    pre.textContent = data.text || '(пусто)';
  } catch (e) {
    pre.textContent = `Ошибка: ${e.message}`;
  }
}

function openApplyLogModal() {
  const modal = document.getElementById('apply-log-modal');
  if (!modal) return;
  modal.hidden = false;
  document.addEventListener('keydown', onApplyLogModalEscape);
  refreshApplyLogModal();
}

function onApprovedModalEscape(e) {
  if (e.key === 'Escape') closeApprovedLetterModal();
}

function openApprovedLetterModal(item) {
  const modal = document.getElementById('approved-letter-modal');
  if (!modal) return;
  const text = String(item.coverLetter?.approvedText || '').trim();
  modal.querySelector('.modal-vacancy-approved').textContent = item.title || item.url || '';
  modal.querySelector('.modal-approved-text').textContent = text;
  modal.hidden = false;
  document.addEventListener('keydown', onApprovedModalEscape);
}

function openDraftModal(item) {
  const modal = document.getElementById('draft-modal');
  if (!modal) return;
  const body = modal.querySelector('.modal-draft-body');
  const vacEl = modal.querySelector('.modal-vacancy');
  vacEl.textContent = item.title || item.url || '';
  body.innerHTML = '';

  const raw = item.coverLetter?.variants || [];
  const variants = raw.length ? raw.map((s) => String(s)) : [];
  if (!variants.length) {
    const p = document.createElement('p');
    p.className = 'modal-empty';
    p.textContent = 'Нет вариантов.';
    body.appendChild(p);
    modal.hidden = false;
    document.addEventListener('keydown', onDraftModalEscape);
    draftModalState = null;
    return;
  }

  const name = `draft-v-${item.id}`;
  let selectedIndex = 0;

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'modal-draft-fieldset';
  const legend = document.createElement('legend');
  legend.textContent = 'Вариант';
  fieldset.appendChild(legend);

  variants.forEach((_, i) => {
    const row = document.createElement('div');
    row.className = 'modal-draft-variant-row';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.id = `${name}-${i}`;
    input.value = String(i);
    if (i === 0) input.checked = true;
    const label = document.createElement('label');
    label.htmlFor = `${name}-${i}`;
    label.textContent = `Вариант ${i + 1}`;
    row.appendChild(input);
    row.appendChild(label);
    fieldset.appendChild(row);
  });

  const lbl = document.createElement('label');
  lbl.className = 'modal-letter-label';
  lbl.htmlFor = `${name}-edit`;
  lbl.textContent = 'Текст (правки сохраняются и учитываются при следующей генерации)';

  const ta = document.createElement('textarea');
  ta.className = 'modal-letter-edit';
  ta.id = `${name}-edit`;
  ta.rows = 12;
  ta.value = variants[0] || '';

  const actions = document.createElement('div');
  actions.className = 'modal-draft-actions';

  const btnSave = document.createElement('button');
  btnSave.type = 'button';
  btnSave.className = 'btn';
  btnSave.textContent = 'Сохранить правки';

  const btnApprove = document.createElement('button');
  btnApprove.type = 'button';
  btnApprove.className = 'btn ok';
  btnApprove.textContent = 'Утвердить';

  const btnDecline = document.createElement('button');
  btnDecline.type = 'button';
  btnDecline.className = 'btn bad';
  btnDecline.textContent = 'Отклонить';

  actions.appendChild(btnSave);
  actions.appendChild(btnApprove);
  actions.appendChild(btnDecline);

  body.appendChild(fieldset);
  body.appendChild(lbl);
  body.appendChild(ta);
  body.appendChild(actions);

  draftModalState = { id: item.id, variants, selectedIndex: 0 };

  function syncTextareaToVariant() {
    if (!draftModalState) return;
    draftModalState.variants[draftModalState.selectedIndex] = ta.value;
  }

  fieldset.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name !== name || t.type !== 'radio') return;
    syncTextareaToVariant();
    const idx = Number(t.value);
    const max = draftModalState.variants.length - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx > max) return;
    draftModalState.selectedIndex = idx;
    ta.value = draftModalState.variants[idx] ?? '';
  });

  btnSave.addEventListener('click', async () => {
    syncTextareaToVariant();
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/save-draft', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, variants: draftModalState.variants }),
      });
      showToast('Правки сохранены', 'good');
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnApprove.addEventListener('click', async () => {
    syncTextareaToVariant();
    const text = ta.value.trim();
    if (!text) {
      alert('Введите или выберите текст письма.');
      return;
    }
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/action', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, action: 'approve', text }),
      });
      showToast('Письмо утверждено', 'good');
      closeDraftModal();
      await load();
    } catch (e) {
      alert(e.message);
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  btnDecline.addEventListener('click', async () => {
    if (!confirm('Отклонить черновик?')) return;
    btnSave.disabled = btnApprove.disabled = btnDecline.disabled = true;
    try {
      await api('/api/cover-letter/action', {
        method: 'POST',
        body: JSON.stringify({ id: item.id, action: 'decline' }),
      });
      showToast('Черновик отклонён', 'neutral');
      closeDraftModal();
      await load();
    } catch (e) {
      alert(e.message);
      btnSave.disabled = btnApprove.disabled = btnDecline.disabled = false;
    }
  });

  modal.hidden = false;
  document.addEventListener('keydown', onDraftModalEscape);
}

const draftModalEl = document.getElementById('draft-modal');
draftModalEl?.querySelector('[data-close-modal]')?.addEventListener('click', closeDraftModal);
draftModalEl?.querySelector('.modal-close')?.addEventListener('click', closeDraftModal);

const approvedModalEl = document.getElementById('approved-letter-modal');
approvedModalEl?.querySelector('[data-close-approved-modal]')?.addEventListener('click', closeApprovedLetterModal);
approvedModalEl?.querySelector('.modal-close--approved')?.addEventListener('click', closeApprovedLetterModal);
document.querySelector('.btn-log-apply')?.addEventListener('click', () => openApplyLogModal());
const applyLogModalEl = document.getElementById('apply-log-modal');
applyLogModalEl?.querySelector('[data-close-apply-log]')?.addEventListener('click', closeApplyLogModal);
applyLogModalEl?.querySelector('.modal-close--apply-log')?.addEventListener('click', closeApplyLogModal);
applyLogModalEl?.querySelector('.btn-refresh-apply-log')?.addEventListener('click', () => refreshApplyLogModal());

approvedModalEl?.querySelector('.btn-copy-approved')?.addEventListener('click', async () => {
  const pre = approvedModalEl.querySelector('.modal-approved-text');
  const t = pre?.textContent || '';
  try {
    await navigator.clipboard.writeText(t);
    showToast('Скопировано в буфер', 'good');
  } catch {
    showToast('Не удалось скопировать', 'bad');
  }
});

function bindDismiss(node, item) {
  const dismissBtn = node.querySelector('.card-dismiss');
  if (!dismissBtn) return;
  dismissBtn.addEventListener('click', async () => {
    if (!confirm('Удалить эту запись из очереди? (без «подходит / не подходит»)')) return;
    dismissBtn.disabled = true;
    try {
      await api('/api/dismiss', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      });
      showToast('Запись удалена из очереди', 'neutral');
      await load();
    } catch (e) {
      alert(e.message);
      dismissBtn.disabled = false;
    }
  });
}

function renderCard(item) {
  const node = tpl.content.firstElementChild.cloneNode(true);

  bindDismiss(node, item);

  const scoreEl = node.querySelector('.score');
  const overall = item.scoreOverall ?? item.geminiScore;
  const displayOverall = overall != null && overall !== '' ? String(overall) : '—';
  scoreEl.textContent = displayOverall;
  scoreEl.setAttribute(
    'aria-label',
    displayOverall === '—'
      ? 'Нет скора'
      : `Итоговый балл ${displayOverall}, наведи для расшифровки`
  );

  const tooltip = node.querySelector('.score-tooltip');
  const wv = scoreWeights.vacancy;
  const wc = scoreWeights.cvMatch;
  const sv = item.scoreVacancy;
  const scm = item.scoreCvMatch;
  const so = item.scoreOverall ?? item.geminiScore;
  if (Number.isFinite(Number(sv)) && Number.isFinite(Number(scm))) {
    tooltip.innerHTML = [
      '<strong>Вакансия</strong> (оценка модели): ',
      String(sv),
      '<br><strong>Сходство с твоими CV</strong>: ',
      String(scm),
      '<br><strong>Итог на карточке</strong>: ',
      so != null && so !== '' ? String(so) : '—',
      '<br><br>Если модель не вернула свой <code>scoreOverall</code>, итог считается как ',
      `<code>${wv.toFixed(2)}×</code>вакансия + <code>${wc.toFixed(2)}×</code>CV (веса из preferences.json).`,
    ].join('');
  } else {
    tooltip.textContent =
      'Нет разбивки по компонентам. Добавь записи через npm run harvest с включённым LLM (без --skip-llm).';
  }

  const modelBtn = node.querySelector('.model-info-btn');
  const modelPanel = node.querySelector('.model-info-panel');
  const modelName = item.openRouterModel ? String(item.openRouterModel).trim() : '';
  if (modelName) {
    modelBtn.hidden = false;
    modelPanel.textContent = `Модель OpenRouter: ${modelName}`;
    modelPanel.addEventListener('click', (e) => e.stopPropagation());
    modelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = modelPanel.hidden;
      document.querySelectorAll('.model-info-panel').forEach((p) => {
        p.hidden = true;
      });
      if (open) modelPanel.hidden = false;
    });
  }

  const a = node.querySelector('.title-link');
  a.href = item.url;
  a.textContent = item.title || item.url;

  const meta = node.querySelector('.meta');
  const parts = [
    item.company,
    item.salaryRaw,
    item.salaryEstimate?.ok ? `≈${item.salaryEstimate.minUsd}–${item.salaryEstimate.maxUsd} USD/мес` : '',
    item.searchQuery ? `запрос: ${item.searchQuery}` : '',
  ].filter(Boolean);
  meta.textContent = parts.join(' · ');

  node.querySelector('.summary').textContent = item.geminiSummary || '';
  const risks = node.querySelector('.risks');
  risks.textContent = item.geminiRisks ? `Нюансы: ${item.geminiRisks}` : '';
  risks.hidden = !item.geminiRisks;

  const tags = node.querySelector('.tags');
  (item.geminiTags || []).forEach((t) => {
    const s = document.createElement('span');
    s.className = 'tag';
    s.textContent = t;
    tags.appendChild(s);
  });

  const cl = item.coverLetter;
  const draftBtn = node.querySelector('.cover-draft-btn');
  const regenBtn = node.querySelector('.btn-regenerate-letter');
  const viewLetterBtn = node.querySelector('.btn-view-approved');

  if (cl?.status === 'pending' && (cl?.variants || []).length) {
    draftBtn.hidden = false;
    draftBtn.addEventListener('click', () => openDraftModal(item));
  }

  if (cl?.status === 'declined') {
    regenBtn.hidden = false;
    regenBtn.addEventListener('click', async () => {
      regenBtn.disabled = true;
      try {
        await requestCoverLetterGenerate(item.id, false);
        showToast('Новые варианты готовы', 'good');
        await load();
      } catch (e) {
        if (e.status === 409) {
          const ok = confirm(
            'Уже есть утверждённое письмо. Пересоздать и заменить черновиком?'
          );
          if (ok) {
            try {
              await requestCoverLetterGenerate(item.id, true);
              showToast('Новые варианты готовы', 'good');
              await load();
            } catch (e2) {
              alert(e2.message);
            }
          }
        } else {
          alert(e.message);
        }
      } finally {
        regenBtn.disabled = false;
      }
    });
  }

  if (cl?.status === 'approved' && String(cl?.approvedText || '').trim()) {
    viewLetterBtn.hidden = false;
    viewLetterBtn.addEventListener('click', () => openApprovedLetterModal(item));
  }

  const applyChatBtn = node.querySelector('.btn-apply-chat');
  const approvedLetter =
    cl?.status === 'approved' && String(cl?.approvedText || '').trim();
  if (approvedLetter) {
    applyChatBtn.disabled = false;
    applyChatBtn.removeAttribute('title');
    applyChatBtn.addEventListener('click', async () => {
      applyChatBtn.disabled = true;
      try {
        const res = await api('/api/hh-launch-apply-chat', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        const pid = res.pid != null ? ` PID ${res.pid}.` : '';
        const logHint = res.logFile ? ` Лог: ${res.logFile}` : '';
        showToast(
          `Запущен Chromium (отдельный процесс).${pid}${logHint} Лог отклика открыт — обновляется каждые 2.5 с.`,
          'neutral'
        );
        openApplyLogModal();
      } catch (e) {
        alert(e.message);
      } finally {
        applyChatBtn.disabled = false;
      }
    });
  }

  const actions = node.querySelector('.actions');
  const doneReason = node.querySelector('.done-reason');

  if (item.status === 'pending') {
    actions.hidden = false;
    const ta = actions.querySelector('.reason');
    const ok = actions.querySelector('.ok');
    const bad = actions.querySelector('.bad');
    const coverBtn = actions.querySelector('.btn-cover');
    const refreshBtn = actions.querySelector('.btn-refresh-vacancy');

    coverBtn.addEventListener('click', async () => {
      coverBtn.disabled = true;
      refreshBtn.disabled = true;
      try {
        await requestCoverLetterGenerate(item.id, false);
        showToast('Сгенерированы варианты сопроводительного', 'good');
        await load();
      } catch (e) {
        if (e.status === 409) {
          const confirmed = confirm(
            'Письмо уже утверждено. Пересоздать черновик? (утверждённый текст будет сброшен до нового согласования)'
          );
          if (confirmed) {
            try {
              await requestCoverLetterGenerate(item.id, true);
              showToast('Новые варианты готовы', 'good');
              await load();
            } catch (e2) {
              alert(e2.message);
            }
          }
        } else {
          alert(e.message);
        }
      } finally {
        coverBtn.disabled = false;
        refreshBtn.disabled = false;
      }
    });

    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      coverBtn.disabled = true;
      ok.disabled = true;
      bad.disabled = true;
      try {
        const refreshRes = await api('/api/vacancy/refresh-body', {
          method: 'POST',
          body: JSON.stringify({ id: item.id }),
        });
        if (refreshRes.scoreUpdated) {
          showToast('Текст с hh.ru и оценка (OpenRouter) обновлены', 'good');
        } else if (refreshRes.scoreError) {
          showToast(`Текст обновлён с hh.ru. Оценка: ${refreshRes.scoreError}`, 'neutral');
        } else {
          showToast('Текст вакансии обновлён с hh.ru', 'good');
        }
        await load();
      } catch (e) {
        alert(e.message);
        refreshBtn.disabled = false;
        coverBtn.disabled = false;
        ok.disabled = false;
        bad.disabled = false;
      }
    });

    const send = async (action) => {
      ok.disabled = bad.disabled = true;
      try {
        await api('/api/action', {
          method: 'POST',
          body: JSON.stringify({
            id: item.id,
            action,
            reason: ta.value.trim(),
          }),
        });
        if (action === 'approve') {
          showToast('Сохранено: подходит', 'good');
        } else {
          showToast('Сохранено: не подходит', 'bad');
        }
        await load();
      } catch (e) {
        alert(e.message);
        ok.disabled = bad.disabled = false;
      }
    };
    ok.addEventListener('click', () => send('approve'));
    bad.addEventListener('click', () => send('reject'));
  } else {
    doneReason.textContent = item.feedbackReason
      ? `Комментарий: ${item.feedbackReason}`
      : '';
  }

  return node;
}

function syncVacancyTabs() {
  vacancyTabsEl.querySelectorAll('.tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.status === currentStatus);
  });
}

async function load() {
  listEl.innerHTML = '';
  try {
    try {
      const { preferences } = await api('/api/preferences');
      const w = preferences?.llmScoreWeights;
      if (w) {
        let v = Number(w.vacancy);
        let c = Number(w.cvMatch);
        if (Number.isFinite(v) && Number.isFinite(c) && v + c > 0) {
          const sum = v + c;
          scoreWeights = { vacancy: v / sum, cvMatch: c / sum };
        }
      }
    } catch {
      scoreWeights = { vacancy: 0.35, cvMatch: 0.65 };
    }

    const { items } = await api(`/api/vacancies?status=${encodeURIComponent(currentStatus)}`);
    if (!items.length) {
      listEl.innerHTML = '<p class="empty">Пусто.</p>';
      return;
    }
    items.forEach((it) => listEl.appendChild(renderCard(it)));
  } catch (e) {
    listEl.innerHTML = `<p class="err">${e.message}</p>`;
  }
}

vacancyTabsEl.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    vacancyTabsEl.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatus = btn.dataset.status;
    load();
  });
});

syncVacancyTabs();
load();
