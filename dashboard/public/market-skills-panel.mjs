/**
 * Панель «Рынок навыков» в service drawer (advisory, без автозаписи на hh.ru).
 */

const TWO_R_URL = 'https://2r.ru/top-skills-and-resumes/';

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any> }} hooks
 */
export function initMarketSkillsPanel(hooks) {
  document.getElementById('btn-market-skills-refresh')?.addEventListener('click', () => {
    void refreshMarketSkillsPanel(hooks);
  });
  document.getElementById('btn-market-skills-copy')?.addEventListener('click', () => {
    void copyMissingSkills();
  });
  document.getElementById('btn-market-skills-2r')?.addEventListener('click', () => {
    window.open(TWO_R_URL, '_blank', 'noopener,noreferrer');
  });
}

/** @type {string[]} */
let lastMissing = [];

/**
 * @param {{ api: (path: string, opts?: object) => Promise<any> }} hooks
 */
export async function refreshMarketSkillsPanel(hooks) {
  const body = document.getElementById('market-skills-panel-body');
  const meta = document.getElementById('market-skills-panel-meta');
  if (!body) return;

  body.innerHTML = '<p class="service-block__desc">Загрузка…</p>';
  try {
    const data = await hooks.api('/api/market-skills');
    if (!data.enabled) {
      body.innerHTML =
        '<p class="service-block__desc">Функция выключена. Включите <code>marketSkillsEnabled: true</code> в <code>config/preferences.json</code> и обновите панель.</p>';
      if (meta) meta.textContent = '';
      lastMissing = [];
      return;
    }

    const cmp = data.cvCompare || {};
    lastMissing = cmp.missing || [];
    const skills = (data.bundle?.skills || []).slice(0, 15);
    const presentSet = new Set(cmp.present || []);

    const rows = skills
      .map((s) => {
        const ok = presentSet.has(s.name);
        const freq = s.frequency != null ? ` · ${Math.round(Number(s.frequency) * 100)}%` : '';
        return `<li class="market-skills__item${ok ? ' market-skills__item--ok' : ''}">
          <span class="market-skills__mark" aria-hidden="true">${ok ? '✓' : '·'}</span>
          <span class="market-skills__name">${escapeHtml(s.name)}</span>
          <span class="market-skills__meta">#${s.rank}${freq}</span>
        </li>`;
      })
      .join('');

    const overlap = data.vacancySample?.overlap || [];
    const overlapHint = overlap.length
      ? `<p class="service-block__desc">В выборке очереди: ${overlap.slice(0, 5).map(escapeHtml).join(', ')}</p>`
      : '';

    if (meta) {
      meta.textContent = `Роль: ${data.role || 'devops'} · покрытие CV: ${cmp.coveragePct ?? '—'}% · источник: ${data.bundle?.source || '—'}`;
    }

    body.innerHTML = `
      <ul class="market-skills__list" aria-label="Топ навыков по роли">${rows || '<li>Нет данных — скопируйте config/market-skills.example.json → market-skills.json</li>'}</ul>
      ${overlapHint}
      <p class="service-block__desc market-skills__hint">Только подсказки. Добавляйте на hh.ru навыки, которые реально есть в опыте.</p>`;
  } catch (e) {
    body.innerHTML = `<p class="service-block__desc">Ошибка: ${escapeHtml(e?.message || String(e))}</p>`;
    lastMissing = [];
  }
}

async function copyMissingSkills() {
  if (!lastMissing.length) return;
  const text = lastMissing.join(', ');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt('Скопируйте список:', text);
  }
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
