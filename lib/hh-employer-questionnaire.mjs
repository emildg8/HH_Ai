/**
 * Доп. вопросы работодателя на странице отклика hh.ru (не путать с сопроводительным).
 */

import { isGenericQuestionLabel, meaningfulQuestions } from './questionnaire-labels.mjs';

const QUESTIONNAIRE_HINT_RE =
  /вопросы\s+от\s+работодателя|дополнительные\s+вопросы|ответьте\s+на\s+вопрос|анкета\s+работодателя|несколько\s+вопросов|уточняющие\s+вопросы|ответьте\s+на\s+несколько|заполните\s+анкету|вопрос\s+\d+\s*из/i;

const COVER_LETTER_FIELD_RE =
  /сопроводительн|cover\s*letter|letter|письмо\s+к\s+вакансии|motivation/i;

/**
 * @param {import('playwright').Page} page
 */
function responseScope(page) {
  if (/applicant\/vacancy_response/i.test(page.url())) {
    return page.locator('main').first().or(page.locator('body'));
  }
  return page
    .locator('[data-qa="vacancy-response-popup-form"]')
    .or(page.locator('[role="dialog"]'))
    .first();
}

/**
 * @param {string} label
 */
function looksLikeCoverLetterLabel(label) {
  return COVER_LETTER_FIELD_RE.test(String(label || ''));
}

/**
 * @param {import('playwright').Page} page
 */
export async function detectEmployerQuestionnaire(page) {
  const scope = responseScope(page);
  const reasons = [];

  const bodySnippet = await scope
    .innerText({ timeout: 3000 })
    .catch(() => '');
  if (QUESTIONNAIRE_HINT_RE.test(bodySnippet)) {
    reasons.push('текст-подсказка на странице');
  }

  const questions = await extractEmployerQuestions(page);
  if (questions.length >= 1) {
    reasons.push(`полей с вопросами: ${questions.length}`);
  }

  if (!questions.length) {
    const extra = await extractQuestionsFromVisibleInputs(page, scope);
    for (const q of extra) {
      if (!questions.some((x) => x.label.slice(0, 80) === q.label.slice(0, 80))) {
        questions.push({ ...q, index: questions.length + 1 });
      }
    }
    if (extra.length) reasons.push(`полей ввода (эвристика): ${extra.length}`);
  }

  const filtered = meaningfulQuestions(questions);
  const detected = reasons.length > 0 && filtered.length > 0;
  return {
    detected,
    questions: filtered,
    reasons,
    hint: detected
      ? 'На hh.ru есть доп. вопросы работодателя — отклик нельзя отправлять автоматически до ответов.'
      : null,
  };
}

/**
 * Считывание подписей полей через DOM (часто точнее, чем Playwright-локаторы).
 * @param {import('playwright').Page} page
 */
async function extractEmployerQuestionsViaDom(page) {
  const coverSrc = COVER_LETTER_FIELD_RE.source;
  return page.evaluate((coverPattern) => {
    const coverRe = new RegExp(coverPattern, 'i');
    const scope =
      document.querySelector('[data-qa="vacancy-response-popup-form"]') ||
      document.querySelector('[role="dialog"]') ||
      document.querySelector('main') ||
      document.body;
    const nodes = scope.querySelectorAll(
      'textarea, input[type="text"], input:not([type]), [contenteditable="true"]'
    );
    const out = [];
    const seen = new Set();

    for (const el of nodes) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;

      const qa = el.getAttribute('data-qa') || '';
      const aria = el.getAttribute('aria-label') || '';
      const name = el.getAttribute('name') || '';
      const blob = `${qa} ${name} ${aria}`;
      if (coverRe.test(blob) || /resume|резюме/i.test(blob)) continue;

      let label = '';
      const id = el.id;
      if (id) {
        const lbl = scope.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl?.innerText?.trim()) label = lbl.innerText.trim();
      }

      let parent = el.parentElement;
      for (let depth = 0; depth < 8 && parent && parent !== scope; depth++) {
        const hdr = parent.querySelector(
          ':scope > label, :scope > legend, :scope > h3, :scope > h4, :scope > [data-qa*="question"]'
        );
        if (hdr && hdr !== el) {
          const t = hdr.innerText?.trim() || '';
          if (t.length > label.length) label = t;
        }
        const prev = parent.previousElementSibling;
        if (prev) {
          const t = prev.innerText?.trim() || '';
          if (t.length > 12 && t.length < 500 && t.length > label.length) label = t;
        }
        parent = parent.parentElement;
      }

      const placeholder = (el.getAttribute('placeholder') || '').trim();
      if ((!label || label.length < 8) && placeholder.length > 6) label = placeholder;

      label = label.replace(/\s+/g, ' ').trim();
      if (!label || label.length < 6) continue;
      if (coverRe.test(label)) continue;

      const key = label.slice(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);

      let type = 'text';
      if (el.tagName === 'TEXTAREA') type = 'textarea';
      const role = el.getAttribute('role') || '';
      if (role === 'textbox' && el.getAttribute('contenteditable')) type = 'textarea';

      out.push({
        label,
        type,
        required: Boolean(el.required || el.getAttribute('aria-required') === 'true'),
      });
    }
    return out;
  }, coverSrc);
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ index: number, label: string, type: string, required: boolean }>>}
 */
export async function extractEmployerQuestions(page) {
  const scope = responseScope(page);
  const out = [];
  const seen = new Set();

  try {
    const viaDom = await extractEmployerQuestionsViaDom(page);
    for (const row of viaDom) {
      const labelClean = String(row.label || '').replace(/\s+/g, ' ').trim();
      if (!labelClean || looksLikeCoverLetterLabel(labelClean)) continue;
      const key = labelClean.slice(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        index: out.length + 1,
        label: labelClean,
        type: row.type || 'textarea',
        required: Boolean(row.required),
      });
    }
  } catch {
    /* ignore */
  }

  const blocks = scope.locator(
    [
      '[data-qa*="employer-question" i]',
      '[data-qa*="additional-question" i]',
      '[data-qa*="vacancy-question" i]',
      '[class*="question" i][class*="employer" i]',
      'fieldset',
      '[class*="magritte-field" i]',
    ].join(', ')
  );
  const blockCount = await blocks.count().catch(() => 0);

  for (let bi = 0; bi < Math.min(blockCount, 40); bi++) {
    const block = blocks.nth(bi);
    if (!(await block.isVisible({ timeout: 200 }).catch(() => false))) continue;

    const label =
      (await block.locator('label, legend, [class*="label" i], h3, h4, p').first().innerText().catch(() => '')) ||
      (await block.getAttribute('aria-label')) ||
      '';
    const labelClean = String(label).replace(/\s+/g, ' ').trim();
    if (!labelClean || labelClean.length < 4) continue;
    if (looksLikeCoverLetterLabel(labelClean)) continue;
    if (!/\?|укажите|опишите|расскажите|сколько|есть ли|имеете|опыт|готовы/i.test(labelClean)) {
      if (!QUESTIONNAIRE_HINT_RE.test(labelClean)) continue;
    }

    const key = labelClean.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);

    let type = 'text';
    if (await block.locator('input[type="radio"]').count()) type = 'radio';
    else if (await block.locator('select').count()) type = 'select';
    else if (await block.locator('textarea').count()) type = 'textarea';
    else if (await block.locator('input[type="checkbox"]').count()) type = 'checkbox';

    const required = await block
      .locator('[required], [aria-required="true"], [class*="required" i]')
      .count()
      .then((n) => n > 0)
      .catch(() => false);

    out.push({
      index: out.length + 1,
      label: labelClean,
      type,
      required,
    });
  }

  if (out.length) return out;

  const textareas = scope.locator('textarea:visible');
  const taCount = await textareas.count().catch(() => 0);
  for (let ti = 0; ti < taCount; ti++) {
    const ta = textareas.nth(ti);
    const qa = (await ta.getAttribute('data-qa')) || '';
    const name = (await ta.getAttribute('name')) || '';
    const aria = (await ta.getAttribute('aria-label')) || '';
    const blob = `${qa} ${name} ${aria}`;
    if (COVER_LETTER_FIELD_RE.test(blob)) continue;

    const id = await ta.getAttribute('id');
    let label = aria;
    if (id) {
      const lbl = page.locator(`label[for="${id}"]`).first();
      if (await lbl.isVisible({ timeout: 150 }).catch(() => false)) {
        label = (await lbl.innerText().catch(() => '')) || label;
      }
    }
    const placeholder = String((await ta.getAttribute('placeholder')) || '').replace(/\s+/g, ' ').trim();
    let labelClean = String(label).replace(/\s+/g, ' ').trim();
    if (isGenericQuestionLabel(labelClean) && placeholder.length > 6) {
      labelClean = placeholder;
    } else if (
      placeholder.length > 8 &&
      !isGenericQuestionLabel(placeholder) &&
      labelClean &&
      !isGenericQuestionLabel(labelClean)
    ) {
      labelClean = `${labelClean} — ${placeholder}`;
    }
    if (!labelClean || isGenericQuestionLabel(labelClean)) continue;
    if (looksLikeCoverLetterLabel(labelClean)) continue;
    const key = labelClean.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ index: out.length + 1, label: labelClean, type: 'textarea', required: true });
  }

  return out;
}

/**
 * Поля ввода на экране отклика, не похожие на сопроводительное.
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 */
async function extractQuestionsFromVisibleInputs(page, scope) {
  const out = [];
  const seen = new Set();

  const inputs = scope.locator(
    'textarea:visible, input[type="text"]:visible, input:not([type]):visible'
  );
  const n = await inputs.count().catch(() => 0);
  for (let i = 0; i < Math.min(n, 12); i++) {
    const el = inputs.nth(i);
    const qa = (await el.getAttribute('data-qa')) || '';
    const name = (await el.getAttribute('name')) || '';
    const aria = (await el.getAttribute('aria-label')) || '';
    const blob = `${qa} ${name} ${aria}`;
    if (COVER_LETTER_FIELD_RE.test(blob)) continue;
    if (/resume|резюме/i.test(blob)) continue;

    const id = await el.getAttribute('id');
    let label = aria;
    if (id) {
      const lbl = page.locator(`label[for="${id}"]`).first();
      if (await lbl.isVisible({ timeout: 120 }).catch(() => false)) {
        label = (await lbl.innerText().catch(() => '')) || label;
      }
    }
    if (!label.trim()) {
      const parent = el.locator('xpath=ancestor::*[self::div or self::fieldset][1]');
      label =
        (await parent.locator('label, [class*="label" i], legend, h3, h4, p').first().innerText().catch(() => '')) ||
        '';
    }
    const labelClean = String(label).replace(/\s+/g, ' ').trim();
    if (!labelClean || labelClean.length < 6) continue;
    if (looksLikeCoverLetterLabel(labelClean)) continue;
    const key = labelClean.slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);

    let type = 'text';
    const tag = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => 'input');
    if (tag === 'textarea') type = 'textarea';

    out.push({ index: out.length + 1, label: labelClean, type, required: true });
  }

  return out;
}

/**
 * После клика «Отправить» иногда появляется второй экран с вопросами.
 * @param {import('playwright').Page} page
 * @param {number} waitMs
 */
export async function waitAndDetectQuestionnaireAfterAction(page, waitMs = 2500) {
  await page.waitForTimeout(waitMs);
  return detectEmployerQuestionnaire(page);
}

/**
 * @param {string} label
 */
function labelKey(label) {
  return String(label || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 * @param {string} label
 */
async function blockForQuestion(page, scope, label) {
  const short = labelKey(label).slice(0, 48);
  if (!short) return null;
  const candidates = [
    scope.locator('fieldset').filter({ hasText: short }),
    scope.locator('[class*="magritte-field" i]').filter({ hasText: short }),
    scope.locator('[data-qa*="question" i]').filter({ hasText: short }),
    scope.locator('[class*="field" i]').filter({ hasText: short }),
  ];
  for (const loc of candidates) {
    const el = loc.first();
    if (await el.isVisible({ timeout: 250 }).catch(() => false)) return el;
  }
  const anchor = scope.getByText(short, { exact: false }).first();
  if (await anchor.isVisible({ timeout: 200 }).catch(() => false)) {
    return anchor.locator('xpath=ancestor::fieldset[1] | ancestor::div[contains(@class,"field")][1]').first();
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 * @param {string} label
 * @param {string} answer
 */
async function fillTextInBlock(block, answer) {
  const input = block.locator('textarea:visible, input[type="text"]:visible, input:not([type]):visible').first();
  if (!(await input.isVisible({ timeout: 400 }).catch(() => false))) return false;
  await input.click({ timeout: 2000 }).catch(() => {});
  await input.fill(answer, { timeout: 8000 });
  return true;
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 * @param {string} label
 * @param {string} answer
 * @param {'radio'|'checkbox'} kind
 */
async function fillChoiceInBlock(block, answer, kind) {
  const re = new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 60), 'i');
  const role = kind === 'checkbox' ? 'checkbox' : 'radio';
  const byRole = block.getByRole(role, { name: re }).first();
  if (await byRole.isVisible({ timeout: 400 }).catch(() => false)) {
    await byRole.click({ timeout: 3000 });
    return true;
  }
  const byLabel = block.locator('label').filter({ hasText: re }).first();
  if (await byLabel.isVisible({ timeout: 400 }).catch(() => false)) {
    await byLabel.click({ timeout: 3000 });
    return true;
  }
  if (/^(да|yes)$/i.test(answer.trim())) {
    const yes = block.getByText(/^да$/i).first();
    if (await yes.isVisible({ timeout: 300 }).catch(() => false)) {
      await yes.click();
      return true;
    }
  }
  if (/^(нет|no)$/i.test(answer.trim())) {
    const no = block.getByText(/^нет$/i).first();
    if (await no.isVisible({ timeout: 300 }).catch(() => false)) {
      await no.click();
      return true;
    }
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {Array<{ index: number, label: string, type: string }>} questions
 * @param {Array<{ index: number, answer: string }>} answers
 * @param {{ log?: (msg: string) => void }} [opts]
 */
export async function fillEmployerQuestionnaire(page, questions, answers, opts = {}) {
  const log = opts.log || (() => {});
  const scope = responseScope(page);
  const byIndex = new Map(answers.map((a) => [Number(a.index), String(a.answer || '').trim()]));
  let filledCount = 0;
  const textQueue = scope.locator(
    'textarea:visible, input[type="text"]:visible, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):visible'
  );
  let textFieldCursor = 0;

  for (const q of questions) {
    const answer = byIndex.get(q.index);
    if (!answer) continue;

    let block = await blockForQuestion(page, scope, q.label);
    if (block && !(await block.isVisible({ timeout: 200 }).catch(() => false))) {
      block = null;
    }

    let ok = false;
    if (q.type === 'radio' || q.type === 'checkbox') {
      if (block) ok = await fillChoiceInBlock(block, answer, q.type);
    } else if (q.type === 'select' && block) {
      const sel = block.locator('select').first();
      if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
        await sel.selectOption({ label: answer }).catch(async () => {
          await sel.selectOption({ value: answer }).catch(() => {});
        });
        ok = true;
      }
    } else if (block) {
      ok = await fillTextInBlock(block, answer);
    }

    if (!ok && (q.type === 'text' || q.type === 'textarea')) {
      const field = textQueue.nth(textFieldCursor);
      textFieldCursor++;
      const qa = (await field.getAttribute('data-qa')) || '';
      if (!COVER_LETTER_FIELD_RE.test(qa) && (await field.isVisible({ timeout: 200 }).catch(() => false))) {
        await field.fill(answer).catch(() => {});
        ok = true;
      }
    }

    if (ok) {
      filledCount++;
      log(`[hh-questionnaire] Поле ${q.index} заполнено`);
    } else {
      log(`[hh-questionnaire] Поле ${q.index} не найдено в DOM: ${q.label.slice(0, 60)}`);
    }
  }

  return { filledCount, total: questions.length, ok: filledCount > 0 };
}
