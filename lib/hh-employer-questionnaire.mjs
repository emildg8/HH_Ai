/**
 * Доп. вопросы работодателя на странице отклика hh.ru (не путать с сопроводительным).
 */

import {
  isGenericQuestionLabel,
  isLikelyAnswerTextNotQuestion,
  isInstructionPageLabel,
  isPlaceholderFieldLabel,
  isEmployerSkillCategoryLabel,
  isSkillCategoryText,
  meaningfulQuestions,
  questionsLookLikeCaptchaMisdetect,
  dedupeQuestionnaireQuestions,
  normalizeQuestionLabel,
  formatQuestionLabel,
  questionnaireTopicKey,
  EMPLOYER_SKILL_CATEGORY_TEXT_RE,
} from './questionnaire-labels.mjs';
import { detectHhCaptcha } from './hh-captcha-wait.mjs';
import { isFastMode } from './hh-human-delay.mjs';
import { answerFromCvHeuristic } from './hh-questionnaire-cv-fill.mjs';
import {
  answerChoiceFromCvHeuristic,
  isChoiceQuestion,
  matchAnswerToOption,
  normalizeChoiceOptionLabel,
} from './questionnaire-choice.mjs';
import {
  answerLlmRadioWithDisclosure,
  isLlmRelatedQuestionLabel,
} from './questionnaire-disclosure.mjs';
import {
  isBehavioralAmbiguousQuestion,
  isCodingQuestionnaireQuestion,
  isRoleInterestQuestionLabel,
  isRtsGamesQuestionLabel,
  answerRoleInterestTextarea,
} from './questionnaire-special-answers.mjs';

/** Вопросы, которые на hh.ru — textarea, но в JSON после probe могут быть radio. */
function isTextareaQuestionLabel(label) {
  const t = String(label || '');
  return (
    isRoleInterestQuestionLabel(t) ||
    isCodingQuestionnaireQuestion(t) ||
    isRtsGamesQuestionLabel(t) ||
    /мобильн\w*\s+игр|последние\s+3\s+месяц/i.test(t) ||
    /зарплат|ожидан|salary/i.test(t) ||
    isBehavioralAmbiguousQuestion(t)
  );
}

/**
 * @param {import('playwright').Locator} field
 */
async function fieldIsTextInput(field) {
  const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const type = (await field.getAttribute('type').catch(() => '')) || 'text';
    return type === 'text' || type === '';
  }
  return field
    .evaluate(
      (el) => el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox'
    )
    .catch(() => false);
}

/**
 * @param {Array<{ label: string }>} questions
 * @param {string} label
 */
function findQuestionByLabel(questions, label) {
  const norm = normalizeQuestionLabel(label);
  if (!norm) return null;
  return questions.find((q) => normalizeQuestionLabel(q.label) === norm) || null;
}

const QUESTIONNAIRE_HINT_RE =
  /вопросы\s+от\s+работодателя|дополнительные\s+вопросы|ответьте\s+на\s+вопрос|анкета\s+работодателя|несколько\s+вопросов|уточняющие\s+вопросы|ответьте\s+на\s+несколько|заполните\s+анкету|вопрос\s+\d+\s*из/i;

const COVER_LETTER_FIELD_RE =
  /сопроводительн|cover\s*letter|letter|письмо\s+к\s+вакансии|motivation/i;

/**
 * @param {import('playwright').Page} page
 */
function responseScope(page) {
  if (/applicant\/vacancy_response/i.test(page.url())) {
    return page.locator('body');
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
 * Прокрутить длинную анкету, чтобы все поля были доступны для парсинга.
 * @param {import('playwright').Page} page
 */
export async function scrollQuestionnaireFields(page) {
  await page.evaluate(() => {
    const roots = [
      document.querySelector('[data-qa="vacancy-response-popup-form"]'),
      document.querySelector('[role="dialog"]'),
      document.querySelector('main'),
      document.body,
    ].filter(Boolean);
    const fields = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"][role="textbox"]'
    );
    for (const el of fields) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    for (const root of roots) {
      const max = root.scrollHeight - root.clientHeight;
      for (let y = 0; y <= max; y += Math.max(280, root.clientHeight * 0.6)) {
        root.scrollTop = y;
      }
      root.scrollTop = max;
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const areas = [...document.querySelectorAll('textarea')].sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
    );
    areas.at(-1)?.scrollIntoView({ block: 'end', behavior: 'instant' });
    areas[0]?.scrollIntoView({ block: 'start', behavior: 'instant' });
    for (const el of document.querySelectorAll('input[type="radio"]')) {
      el.closest('fieldset, label, div')?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
  await page.waitForTimeout(400);
}

/**
 * Шаг мастера: анкета работодателя, список резюме на экране не показывается.
 * @param {import('playwright').Page} page
 */
export async function isEmployerQuestionnaireWizardStep(page) {
  const q = await detectEmployerQuestionnaire(page);
  if (!q.detected || q.captchaBlocking) return false;

  const mq = meaningfulQuestions(q.questions);
  const taCount = await page.locator('textarea:visible').count().catch(() => 0);
  if (mq.length >= 2 || (mq.length >= 1 && taCount >= 1)) return true;
  if (mq.some((x) => /ответьте на вопрос|анкет/i.test(x.label || ''))) return true;

  if (!/applicant\/vacancy_response/i.test(page.url())) return true;
  const scope = responseScope(page);
  const hasResumeList =
    (await scope.locator('[data-qa="resume-select-item"]').first().isVisible({ timeout: 350 }).catch(() => false)) ||
    (await scope.getByText(/резюме для отклика|выберите резюме|каким резюме/i).first().isVisible({ timeout: 350 }).catch(() => false));
  return !hasResumeList;
}

/**
 * «Далее» на пошаговой анкете работодателя.
 * @param {import('playwright').Page} page
 * @returns {Promise<'next'|null>}
 */
export async function clickEmployerQuestionnaireNext(page) {
  const modal = /applicant\/vacancy_response/i.test(page.url())
    ? page.locator('main, body').first()
    : page.locator('[data-qa="vacancy-response-popup-form"], [role="dialog"]').first();
  const nextNames = [/^далее$/i, /продолжить/i, /сохранить и продолжить/i];
  for (const nameRe of nextNames) {
    const btn = modal.getByRole('button', { name: nameRe }).first();
    if (!(await btn.isVisible({ timeout: 400 }).catch(() => false))) continue;
    if (await btn.isDisabled().catch(() => true)) continue;
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click();
    await page.waitForTimeout(isFastMode() ? 350 : 550);
    return 'next';
  }
  return null;
}

/**
 * @param {import('playwright').Page} page
 */
export async function detectEmployerQuestionnaire(page) {
  const captcha = await detectHhCaptcha(page);
  if (captcha.active) {
    return {
      detected: false,
      questions: [],
      reasons: [`капча hh.ru (${captcha.hints.join(', ')})`],
      captchaBlocking: true,
      hint: 'Сначала пройдите проверку/капчу в браузере — это не анкета работодателя.',
    };
  }

  await scrollQuestionnaireFields(page);
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
  if (questionsLookLikeCaptchaMisdetect(questions)) {
    return {
      detected: false,
      questions: [],
      reasons: [...reasons, 'поля капчи (текст с картинки), не анкета'],
      captchaMisdetect: true,
      hint: 'На странице капча — решите вручную и повторите отклик.',
    };
  }
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
  const skillSrc = EMPLOYER_SKILL_CATEGORY_TEXT_RE.source;
  const instructionSrc =
    'отклик\\s+на\\s+вакансию|для\\s+отклика\\s+необходимо|необходимо\\s+ответить|несколько\\s+вопросов\\s+работодателя|выберите\\s+резюме|писать\\s+(?:сюда|тут|здесь)|^введите';
  return page.evaluate(
    ({ coverPattern, instrPattern, skillPattern }) => {
    const coverRe = new RegExp(coverPattern, 'i');
    const instrRe = new RegExp(instrPattern, 'i');
    const skillRe = new RegExp(skillPattern, 'i');
    const isSkill = (t) =>
      skillRe.test(t) || /ci\s*\/\s*cd/i.test(t) || (t.includes('/') && t.length >= 4 && !/\?/.test(t));
    const isBadLabel = (t) => {
      if (!t || t.length < 3) return true;
      if (isSkill(t)) return false;
      if (instrRe.test(t)) return true;
      if (/отклик\s+на\s+вакансию/i.test(t) && /необходимо\s+ответить/i.test(t)) return true;
      if (/^писать\s+(?:сюда|тут|здесь)\s*$/i.test(t)) return true;
      if (/^текстовое\s+поле\s*\d*$/i.test(t)) return true;
      return t.length < 8 && !/\?/.test(t);
    };

    const labelFromAriaIds = (idsStr) => {
      if (!idsStr) return '';
      return idsStr
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText?.trim() || '')
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const cleanFieldLabel = (raw) => {
      let t = String(raw || '').replace(/\s+/g, ' ').trim();
      t = t.replace(/\s*писать\s+(?:сюда|тут|здесь)\s*$/i, '').trim();
      return t;
    };

    const closestByClassPart = (node, part) => {
      let p = node.parentElement;
      while (p && p !== document.body) {
        if (String(p.className || '').toLowerCase().includes(part)) return p;
        p = p.parentElement;
      }
      return null;
    };

    const labelFromInputContainer = (el) => {
      let best = '';
      let bestLen = Infinity;
      let p = el.parentElement;
      for (let depth = 0; depth < 10 && p && p !== scope; depth++) {
        const t = cleanFieldLabel(p.innerText || '');
        const minLen = isSkill(t) ? 3 : 18;
        if (t.length >= minLen && t.length <= 200 && t.length < bestLen && !isBadLabel(t)) {
          best = t;
          bestLen = t.length;
        }
        if (t.length > 260) break;
        p = p.parentElement;
      }
      return best;
    };

    const pickScope = () => {
      const candidates = [
        document.querySelector('[data-qa="vacancy-response-popup-form"]'),
        document.querySelector('[role="dialog"]'),
        document.querySelector('main'),
        document.body,
      ].filter(Boolean);
      for (const el of candidates) {
        const len = (el.innerText || '').replace(/\s+/g, ' ').trim().length;
        const inputs = el.querySelectorAll('textarea, input[type="text"]').length;
        if (inputs > 0 || len > 80) return el;
      }
      return document.body;
    };
    const scope = pickScope();
    const out = [];
    const seen = new Set();

    const pushRow = (label, type, required) => {
      const clean = String(label || '').replace(/\s+/g, ' ').trim();
      if (!clean || clean.length < 6 || isBadLabel(clean)) return;
      if (coverRe.test(clean)) return;
      const key = clean.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label: clean, type: type || 'textarea', required: Boolean(required) });
    };

    scope.querySelectorAll('[data-qa*="question"]').forEach((block) => {
      const input = block.querySelector(
        'textarea, input[type="text"], input:not([type]), select, input[type="radio"]'
      );
      if (!input) return;
      const parts = [];
      block.querySelectorAll('label, legend, h3, h4, p, span, [data-qa*="label"]').forEach((n) => {
        if (n === input || input.contains(n)) return;
        const t = n.innerText?.trim();
        if (t && t.length >= 8 && t.length < 400) parts.push(t);
      });
      parts.sort((a, b) => b.length - a.length);
      const label = parts.find((t) => !isBadLabel(t)) || '';
      let type = 'text';
      if (block.querySelector('textarea')) type = 'textarea';
      else if (block.querySelector('input[type="radio"]')) type = 'radio';
      else if (block.querySelector('select')) type = 'select';
      pushRow(label, type, input.required || input.getAttribute('aria-required') === 'true');
    });

    const fieldContainers = scope.querySelectorAll('fieldset, [data-qa*="field"]');
    const magritteFields = [];
    scope.querySelectorAll('[class]').forEach((node) => {
      if (String(node.className || '').toLowerCase().includes('magritte-field')) {
        magritteFields.push(node);
      }
    });
    for (const field of [...fieldContainers, ...magritteFields]) {
      const input = field.querySelector(
        'textarea, input[type="text"], input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])'
      );
      if (!input) continue;
      const qa = `${input.getAttribute('data-qa') || ''} ${input.getAttribute('name') || ''}`;
      if (coverRe.test(qa) || /resume|резюме/i.test(qa)) continue;

      const candidates = [];
      field.querySelectorAll(':scope > label, :scope > legend, :scope > h3, :scope > h4').forEach((n) => {
        const t = n.innerText?.trim();
        if (t && (t.length >= 8 || isSkill(t))) candidates.push(t);
      });
      const labelled = labelFromAriaIds(
        input.getAttribute('aria-labelledby') || input.getAttribute('aria-describedby')
      );
      if (labelled) candidates.push(labelled);
      candidates.sort((a, b) => b.length - a.length);
      const label = candidates.find((t) => !isBadLabel(t)) || '';
      if (!label) continue;
      const type = input.tagName === 'TEXTAREA' ? 'textarea' : 'text';
      pushRow(label, type, input.required);
    }

    const nodes = scope.querySelectorAll(
      'textarea, input[type="text"], input:not([type]), [contenteditable="true"]'
    );

    for (const el of nodes) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;

      const qa = el.getAttribute('data-qa') || '';
      const aria = el.getAttribute('aria-label') || '';
      const name = el.getAttribute('name') || '';
      const blob = `${qa} ${name} ${aria}`;
      if (coverRe.test(blob) || /resume|резюме/i.test(blob)) continue;

      let label = labelFromInputContainer(el) || labelFromAriaIds(el.getAttribute('aria-labelledby'));
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
          const t = cleanFieldLabel(hdr.innerText?.trim() || '');
          if (t.length > label.length) label = t;
        }
        const prev = parent.previousElementSibling;
        if (prev) {
          const hdr =
            prev.querySelector?.('h4, h3, label, legend, [data-qa*="question"]') ||
            (prev.matches?.('h3,h4,label,legend') ? prev : null);
          const t = cleanFieldLabel((hdr ? hdr.innerText : prev.innerText)?.trim() || '');
          if (t.length >= 8 && t.length <= 280 && t.length > label.length && !isBadLabel(t)) {
            label = t;
          }
        }
        parent = parent.parentElement;
      }

      label = cleanFieldLabel(label);

      const placeholder = (el.getAttribute('placeholder') || '').trim();
      const placeholderOk =
        placeholder.length > 6 &&
        !isBadLabel(placeholder) &&
        !/^писать\s+(?:сюда|тут|здесь)\s*$/i.test(placeholder) &&
        !/^введите/i.test(placeholder);
      if ((!label || label.length < 8) && placeholderOk) {
        label = placeholder;
      }

      let type = 'text';
      if (el.tagName === 'TEXTAREA') type = 'textarea';
      const role = el.getAttribute('role') || '';
      if (role === 'textbox' && el.getAttribute('contenteditable')) type = 'textarea';

      pushRow(label, type, el.required || el.getAttribute('aria-required') === 'true');
    }

    return out.map((row, i) => ({ ...row, index: i + 1 }));
  },
    { coverPattern: coverSrc, instrPattern: instructionSrc, skillPattern: skillSrc }
  );
}

/**
 * Сырые поля анкеты: одно поле ввода = одна строка (до фильтра meaningful).
 * @param {import('playwright').Page} page
 */
async function extractOrderedQuestionnaireFieldsRaw(page) {
  const coverSrc = COVER_LETTER_FIELD_RE.source;
  const skillSrc = EMPLOYER_SKILL_CATEGORY_TEXT_RE.source;
  return page.evaluate(({ coverPattern, skillPattern }) => {
    const coverRe = new RegExp(coverPattern, 'i');
    const stripCounter = (s) =>
      String(s || '')
        .replace(/\s+\d+\s+из\s+\d+\s*$/i, '')
        .replace(/\s*писать\s+(?:сюда|тут|здесь)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const isCover = (el) => {
      const b = `${el.getAttribute('data-qa') || ''} ${el.getAttribute('name') || ''} ${
        el.getAttribute('aria-label') || ''
      }`;
      return coverRe.test(b) || /resume|резюме/i.test(b);
    };

    const skillRe = new RegExp(skillPattern, 'i');
    const skillCategory = (t) =>
      skillRe.test(t) || /ci\s*\/\s*cd/i.test(t) || (t.includes('/') && t.length >= 4 && !/\?/.test(t));

    const looksLikeQuestion = (t) => {
      if (!t || t.length < 8) return false;
      if (/\?/.test(t)) return true;
      return (
        /^(если вы|напишите|опишите|укажите|в какие|нравится|вам дали|после внесения|изменение в|какой|какая|какие|когда|как\s)/i.test(
          t
        ) || /\bllm\b|матчмейкинг|функци.*автотест/i.test(t)
      );
    };

    const badLabel = (t) => {
      if (!t) return true;
      if (/^писать\s+(?:сюда|тут|здесь)\s*$/i.test(t)) return true;
      if (/^текстовое\s+поле\s*\d*$/i.test(t)) return true;
      if (/^введите\s*$/i.test(t)) return true;
      if (/^(def |import pytest|@pytest)/i.test(t)) return true;
      if (/готов обсудить на собеседовании|драконоборец|меня заинтересовали автотесты/i.test(t)) {
        return true;
      }
      if (skillCategory(t)) return false;
      if (!looksLikeQuestion(t) && t.length > 72) return true;
      return t.length < 8 && !/\?/.test(t);
    };

    const goodLabel = (t) => !badLabel(t);

    const labelForInput = (el) => {
      let node = el.parentElement;
      for (let depth = 0; depth < 14 && node && node !== document.body; depth++) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('textarea, input, button, select, [contenteditable]').forEach((n) => n.remove());
        const t = stripCounter(clone.innerText || '');
        if (goodLabel(t)) return t;
        const prev = node.previousElementSibling;
        if (prev) {
          const pt = stripCounter(prev.innerText || '');
          if (goodLabel(pt)) return pt;
        }
        for (const hdr of node.querySelectorAll('h3, h4, h5, label, legend, span, p')) {
          if (hdr.querySelector('textarea, input, [contenteditable]')) continue;
          const ht = stripCounter(hdr.innerText || '');
          if (skillCategory(ht) && ht.length < 160) return ht;
        }
        node = node.parentElement;
      }
      const aria = stripCounter(el.getAttribute('aria-label') || '');
      if (aria && goodLabel(aria)) return aria;
      const labelled = (el.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText?.trim() || '')
        .filter(Boolean)
        .join(' ');
      return stripCounter(labelled);
    };

    const items = [];
    const nodes = document.querySelectorAll(
      'textarea, input[type="text"], input:not([type]), [contenteditable="true"][role="textbox"], [contenteditable="true"]'
    );
    for (const el of nodes) {
      if (isCover(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      let docTop = 0;
      let docLeft = 0;
      let offsetNode = el;
      while (offsetNode) {
        docTop += offsetNode.offsetTop || 0;
        docLeft += offsetNode.offsetLeft || 0;
        offsetNode = offsetNode.offsetParent;
      }
      const dataQa = el.getAttribute('data-qa') || '';
      const stableKey = el.id
        ? `id:${el.id}`
        : el.getAttribute('name')
          ? `name:${el.getAttribute('name')}`
          : dataQa
            ? `qa:${dataQa}`
            : `pos:${docTop}:${docLeft}:${el.tagName}`;
      items.push({
        fieldKey: stableKey,
        stableKey,
        docTop,
        top: r.top,
        left: r.left,
        label: labelForInput(el),
        tag: el.tagName,
        required: Boolean(el.required || el.getAttribute('aria-required') === 'true'),
      });
    }

    items.sort((a, b) => a.top - b.top || a.left - b.left);
    return items;
  }, { coverPattern: coverSrc, skillPattern: skillSrc });
}

/**
 * @param {Array<{ label?: string, tag?: string, required?: boolean, stableKey?: string, docTop?: number }>} rows
 */
function dedupeRawRowsByStableKey(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = row.stableKey || row.fieldKey;
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev || String(row.label || '').length > String(prev.label || '').length) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.docTop ?? a.top ?? 0) - (b.docTop ?? b.top ?? 0));
}

/**
 * @param {Array<{ label?: string, tag?: string, required?: boolean }>} rows
 */
function finalizeOrderedQuestionnaireRows(rows) {
  const deduped = dedupeRawRowsByStableKey(rows);
  const preliminary = deduped
    .map((row, i) => ({
      index: i + 1,
      label: formatQuestionLabel(row.label) || '',
      type: row.tag === 'TEXTAREA' || row.tag === 'DIV' ? 'textarea' : 'text',
      required: Boolean(row.required),
    }))
    .filter((row) => row.label && !isGenericQuestionLabel(row.label) && !looksLikeCoverLetterLabel(row.label));

  const withFallback = preliminary.map((row, i) => ({
    ...row,
    label: row.label || `Категория ${i + 1}`,
  }));

  const seenNorm = new Set(withFallback.map((r) => normalizeQuestionLabel(r.label)).filter(Boolean));
  let extraIdx = 0;
  for (const row of deduped) {
    if (row.tag !== 'TEXTAREA' && row.tag !== 'DIV') continue;
    const raw = formatQuestionLabel(row.label) || '';
    const norm = normalizeQuestionLabel(raw);
    if (norm && seenNorm.has(norm)) continue;
    if (raw && !isGenericQuestionLabel(raw) && !looksLikeCoverLetterLabel(raw)) {
      if (norm) seenNorm.add(norm);
      continue;
    }
    extraIdx++;
    const label = raw && !isGenericQuestionLabel(raw) ? raw : `Вопрос ${withFallback.length + extraIdx}`;
    const normNew = normalizeQuestionLabel(label);
    if (normNew && seenNorm.has(normNew)) continue;
    if (normNew) seenNorm.add(normNew);
    withFallback.push({
      index: withFallback.length + 1,
      label,
      type: 'textarea',
      required: Boolean(row.required),
    });
  }

  return dedupeQuestionnaireQuestions(withFallback);
}

/**
 * Одно поле ввода = один вопрос, порядок сверху вниз (актуально для Magritte на hh.ru).
 * @param {import('playwright').Page} page
 */
async function extractOrderedQuestionnaireFields(page) {
  const rows = await extractOrderedQuestionnaireFieldsRaw(page);
  return finalizeOrderedQuestionnaireRows(rows);
}

/**
 * Длинная анкета (Gear Games и др.): объединить поля со всех позиций прокрутки.
 * @param {import('playwright').Page} page
 */
async function extractOrderedQuestionnaireFieldsUnion(page) {
  await scrollQuestionnaireFields(page);
  const batch = await extractOrderedQuestionnaireFieldsRaw(page);
  return finalizeOrderedQuestionnaireRows(batch);
}

/**
 * @param {Array<{ index: number, label: string, type: string, required: boolean }>} ordered
 * @param {Array<{ index: number, label: string, type: string, required: boolean }>} other
 */
/**
 * Объединить текстовые и choice-вопросы в порядке на странице.
 * @param {Array<{ label: string, docTop?: number }>} choiceList
 * @param {Array<{ label: string, docTop?: number }>} textList
 */
export function combineQuestionListsByPosition(choiceList, textList) {
  const tagged = [
    ...(choiceList || []).map((q, i) => ({ ...q, _pos: Number(q.docTop) || i })),
    ...(textList || []).map((q, i) => ({ ...q, _pos: Number(q.docTop) || 10_000 + i })),
  ];
  tagged.sort((a, b) => a._pos - b._pos);
  const stripped = tagged.map(({ _pos, docTop, ...q }) => q);
  return dedupeQuestionnaireQuestions(stripped);
}

/**
 * Radio/checkbox-группы («Ответьте на вопросы», шкала 1–5).
 * @param {import('playwright').Page} page
 */
export async function extractChoiceQuestionGroups(page) {
  const coverSrc = COVER_LETTER_FIELD_RE.source;
  const rows = await page.evaluate(({ coverPattern }) => {
    const coverRe = new RegExp(coverPattern, 'i');
    const scope =
      document.querySelector('[data-qa="vacancy-response-popup-form"]') ||
      document.querySelector('[role="dialog"]') ||
      document.querySelector('main') ||
      document.body;

    const isResumeRadio = (el) => {
      const b = `${el.getAttribute('data-qa') || ''} ${el.getAttribute('name') || ''} ${el.id || ''}`;
      return coverRe.test(b) || /resume|резюме|letter|письмо/i.test(b);
    };

    const labelForRadio = (input) => {
      const id = input.id;
      if (id) {
        const lbl = scope.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl) return (lbl.innerText || '').replace(/\s+/g, ' ').trim();
      }
      const parent = input.closest('label');
      if (parent) return (parent.innerText || '').replace(/\s+/g, ' ').trim();
      let node = input.parentElement;
      for (let d = 0; d < 6 && node; d++) {
        const next = node.nextElementSibling;
        if (next?.tagName === 'LABEL') return (next.innerText || '').replace(/\s+/g, ' ').trim();
        node = node.parentElement;
      }
      return (input.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    };

    const looksLikeQuestionText = (t) => {
      if (!t || t.length < 8 || t.length > 520) return false;
      if (/\?/.test(t)) return true;
      return (
        /^(какой|какая|какие|есть\s+ли|сможешь|из\s+какого|укажите|вы\s+рассматрива|весь\s+твой|подтвержд|готовы|пользуетесь|можете|знаете|ваши\s+первые|расскажите)/i.test(
          t
        ) ||
        /\bllm\b|промт|инжиниринг|матчмейкинг|агент/i.test(t)
      );
    };

    const questionLabelForGroup = (firstInput) => {
      const fieldset = firstInput.closest('fieldset');
      if (fieldset) {
        const leg = fieldset.querySelector('legend');
        const lt = (leg?.innerText || '').replace(/\s+/g, ' ').trim();
        if (looksLikeQuestionText(lt)) return lt;
      }

      let node = firstInput.parentElement;
      for (let depth = 0; depth < 18 && node && node !== scope; depth++) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('input, textarea, button, select, label').forEach((n) => {
          if (n.tagName === 'LABEL' && n.querySelector('input[type="radio"]')) n.remove();
          else if (n.tagName !== 'LABEL') n.remove();
        });
        const t = (clone.innerText || '').replace(/\s+/g, ' ').trim();
        if (looksLikeQuestionText(t)) return t;

        const prev = node.previousElementSibling;
        if (prev) {
          const pt = (prev.innerText || '').replace(/\s+/g, ' ').trim();
          if (looksLikeQuestionText(pt)) return pt;
        }
        for (const hdr of node.querySelectorAll('h3, h4, h5, legend, p, [class*="label" i]')) {
          const ht = (hdr.innerText || '').replace(/\s+/g, ' ').trim();
          if (looksLikeQuestionText(ht)) return ht;
        }
        node = node.parentElement;
      }
      return '';
    };

    const docOffset = (el) => {
      let top = 0;
      let left = 0;
      let n = el;
      while (n) {
        top += n.offsetTop || 0;
        left += n.offsetLeft || 0;
        n = n.offsetParent;
      }
      return { top, left };
    };

    const byName = new Map();
    for (const input of scope.querySelectorAll('input[type="radio"]')) {
      if (isResumeRadio(input)) continue;
      const name = input.name;
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(input);
    }

    const out = [];
    for (const [name, inputs] of byName) {
      if (inputs.length < 2) continue;
      const sorted = inputs.slice().sort((a, b) => {
        const pa = docOffset(a);
        const pb = docOffset(b);
        return pa.top - pb.top || pa.left - pb.left;
      });
      const options = sorted.map((input) => ({
        value: input.value || '',
        label: labelForRadio(input) || input.value || '',
      }));
      const numbered = options.filter((o) => /^\d+\s*[\(.]/.test(o.label)).length;
      const shortWordOptions =
        options.length >= 2 &&
        options.length <= 12 &&
        options.every((o) => o.label.length >= 1 && o.label.length <= 56);
      let questionLabel = questionLabelForGroup(sorted[0]);
      if (!questionLabel && shortWordOptions) {
        const fs = sorted[0].closest('[class*="magritte" i], [class*="question" i], section, div');
        if (fs) {
          const hdr = fs.querySelector('h3, h4, h5, p, span, [class*="title" i]');
          const ht = (hdr?.innerText || '').replace(/\s+/g, ' ').trim();
          if (looksLikeQuestionText(ht)) questionLabel = ht;
        }
      }
      if (!questionLabel && numbered < 2 && !shortWordOptions) continue;
      if (!questionLabel) continue;
      if (/выберите\s+резюме|сопроводительн/i.test(questionLabel)) continue;

      const pos = docOffset(sorted[0]);
      out.push({
        label: questionLabel,
        type: 'radio',
        choiceName: name,
        options,
        docTop: pos.top,
        required: sorted.some((i) => i.required || i.getAttribute('aria-required') === 'true'),
      });
    }

    out.sort((a, b) => a.docTop - b.docTop);
    return out;
  }, { coverPattern: coverSrc });

  return rows
    .map((row, i) => ({
      index: i + 1,
      label: formatQuestionLabel(row.label),
      type: row.type || 'radio',
      choiceName: row.choiceName,
      options: (row.options || []).map((o) => ({
        value: o.value || '',
        label: formatQuestionLabel(o.label),
      })),
      docTop: row.docTop,
      required: Boolean(row.required),
    }))
    .filter((row) => row.label && !isGenericQuestionLabel(row.label) && !looksLikeCoverLetterLabel(row.label));
}

export function mergeQuestionListsPreferOrder(ordered, other) {
  const otherByNorm = new Map();
  for (const q of other) {
    const n = normalizeQuestionLabel(q.label);
    if (n) otherByNorm.set(n, q);
  }

  const combined = [];
  for (const q of ordered) {
    const n = normalizeQuestionLabel(q.label);
    const merged =
      n && otherByNorm.has(n) ? { ...q, ...otherByNorm.get(n), label: q.label || otherByNorm.get(n).label } : q;
    combined.push(merged);
  }
  for (const q of other) {
    const n = normalizeQuestionLabel(q.label);
    if (n && combined.some((x) => normalizeQuestionLabel(x.label) === n)) continue;
    combined.push(q);
  }
  return dedupeQuestionnaireQuestions(combined);
}

/**
 * Подпись вопроса над textarea (когда в поле только placeholder «Писать тут»).
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} field
 */
async function resolveQuestionLabelAboveField(page, field) {
  return field.evaluate((el) => {
    const isQ = (t) => {
      const s = String(t || '').replace(/\s+/g, ' ').trim();
      if (!s || s.length < 12 || s.length > 480) return false;
      if (/^писать\s+тут$/i.test(s)) return false;
      return /\?/.test(s) || /ваши\s+первые\s+действ|неясн\w*\s+задач|матчмейкинг/i.test(s);
    };
    let node = el;
    for (let d = 0; d < 14 && node; d++) {
      const prev = node.previousElementSibling;
      if (prev) {
        const lines = (prev.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          if (isQ(lines[i])) return lines[i];
        }
      }
      for (const hdr of node.querySelectorAll('h3, h4, h5, legend, p, [class*="title" i]')) {
        const t = (hdr.innerText || '').replace(/\s+/g, ' ').trim();
        if (isQ(t)) return t;
      }
      node = node.parentElement;
    }
    const top = el.getBoundingClientRect().top;
    const hits = [];
    for (const hdr of document.querySelectorAll('h3, h4, h5, legend, p, label, span')) {
      const r = hdr.getBoundingClientRect();
      if (r.bottom > top + 8 || r.top < top - 280) continue;
      const t = (hdr.innerText || '').replace(/\s+/g, ' ').trim();
      if (isQ(t)) hits.push({ t, dist: top - r.bottom });
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits[0]?.t || '';
  });
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ index: number, label: string, type: string, required: boolean }>>}
 */
export async function extractEmployerQuestions(page) {
  const scope = responseScope(page);
  const out = [];
  const seen = new Set();

  let ordered = [];
  try {
    ordered = await extractOrderedQuestionnaireFieldsUnion(page);
  } catch (err) {
    console.error('[hh-questionnaire] extractOrderedQuestionnaireFieldsUnion:', err?.message || err);
    try {
      ordered = await extractOrderedQuestionnaireFields(page);
    } catch (err2) {
      console.error('[hh-questionnaire] extractOrderedQuestionnaireFields:', err2?.message || err2);
    }
  }

  try {
    const viaDom = await extractEmployerQuestionsViaDom(page);
    for (const row of viaDom || []) {
      const labelClean = String(row.label || '').replace(/\s+/g, ' ').trim();
      if (
        !labelClean ||
        looksLikeCoverLetterLabel(labelClean) ||
        isInstructionPageLabel(labelClean) ||
        isGenericQuestionLabel(labelClean)
      ) {
        continue;
      }
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
  } catch (err) {
    console.error('[hh-questionnaire] extractEmployerQuestionsViaDom:', err?.message || err);
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
      if (!QUESTIONNAIRE_HINT_RE.test(labelClean) && !isEmployerSkillCategoryLabel(labelClean)) {
        continue;
      }
    }

    const key = labelClean.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);

    let type = 'text';
    if (await block.locator('input[type="radio"]').count()) type = 'radio';
    else if (await block.locator('select').count()) type = 'select';
    else if (await block.locator('textarea').count()) type = 'textarea';
    else if (await block.locator('input[type="checkbox"]').count()) type = 'checkbox';

    if (type === 'radio' || type === 'checkbox') continue;

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

  let choices = [];
  try {
    choices = await extractChoiceQuestionGroups(page);
  } catch (err) {
    console.error('[hh-questionnaire] extractChoiceQuestionGroups:', err?.message || err);
  }

  let textQs = [];
  if (ordered.length >= 3) {
    textQs = ordered;
  } else if (ordered.length) {
    textQs = mergeQuestionListsPreferOrder(ordered, out);
  } else if (out.length) {
    textQs = out;
  }

  if (textQs.length === 0) {
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
    if (isGenericQuestionLabel(labelClean) || isPlaceholderFieldLabel(labelClean)) {
      const above = await resolveQuestionLabelAboveField(page, ta);
      if (above) labelClean = above;
    }
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
    textQs = out;
  }

  if (choices.length && textQs.length) {
    return combineQuestionListsByPosition(choices, textQs);
  }
  if (choices.length) return dedupeQuestionnaireQuestions(choices);
  return dedupeQuestionnaireQuestions(textQs);
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
  for (let i = 0; i < Math.min(n, 24); i++) {
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
/**
 * Узкий блок вокруг одного поля (не вся форма).
 * @param {import('playwright').Locator} field
 */
async function blockForField(field) {
  const block = field.locator(
    'xpath=ancestor::fieldset[1] | ancestor::*[contains(@class,"magritte-field")][1] | ancestor::*[contains(@class,"field")][1]'
  ).first();
  if (await block.isVisible({ timeout: 150 }).catch(() => false)) return block;
  return null;
}

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
/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 * @param {{ label: string, type?: string, choiceName?: string, options?: Array<{ value?: string, label: string }> }} question
 * @param {string} answer
 */
/**
 * @param {import('playwright').Locator} scope
 * @param {string} [choiceName]
 */
async function isRadioGroupAnswered(scope, choiceName) {
  if (!choiceName) return false;
  const checked = scope.locator(`input[type="radio"][name="${choiceName}"]:checked`);
  if ((await checked.count().catch(() => 0)) > 0) return true;
  const aria = scope.locator(`input[type="radio"][name="${choiceName}"][aria-checked="true"]`);
  return (await aria.count().catch(() => 0)) > 0;
}

/**
 * Видимые radio-группы анкеты (по DOM, не по JSON probe).
 * @param {import('playwright').Locator} scope
 */
async function listVisibleRadioGroupsFromDom(scope) {
  const coverSrc = COVER_LETTER_FIELD_RE.source;
  return scope.evaluate(({ coverPattern }) => {
    const coverRe = new RegExp(coverPattern, 'i');
    const isResume = (input) => {
      const b = `${input.getAttribute('data-qa') || ''} ${input.getAttribute('name') || ''} ${
        input.getAttribute('aria-label') || ''
      }`;
      return coverRe.test(b) || /resume|резюме|letter|письм/i.test(b);
    };
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const st = window.getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden';
    };
    const isAnswered = (inputs) =>
      inputs.some((i) => i.checked || i.getAttribute('aria-checked') === 'true');

    const labelForGroup = (firstInput) => {
      const fs = firstInput.closest('fieldset');
      const leg = fs?.querySelector('legend');
      const lt = (leg?.innerText || '').replace(/\s+/g, ' ').trim();
      if (lt && /\?/.test(lt)) return lt;
      let node = firstInput.parentElement;
      for (let d = 0; d < 12 && node; d++) {
        const prev = node.previousElementSibling;
        if (prev) {
          const pt = (prev.innerText || '').replace(/\s+/g, ' ').trim();
          if (pt && /\?/.test(pt) && pt.length < 480) return pt;
        }
        node = node.parentElement;
      }
      return '';
    };

    const byName = new Map();
    for (const input of document.querySelectorAll('input[type="radio"]')) {
      if (!input.name || isResume(input) || !isVisible(input)) continue;
      if (!byName.has(input.name)) byName.set(input.name, []);
      byName.get(input.name).push(input);
    }

    const out = [];
    for (const [name, inputs] of byName) {
      const visible = inputs.filter(isVisible);
      if (visible.length < 2) continue;
      const options = visible.map((i) => ({
        value: i.value || '',
        label: (i.closest('label')?.innerText || i.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
      }));
      out.push({
        choiceName: name,
        label: labelForGroup(visible[0]),
        options,
        answered: isAnswered(visible),
      });
    }
    return out;
  }, { coverPattern: coverSrc });
}

/**
 * Есть ли на форме radio-группы анкеты без выбранного варианта.
 * @param {import('playwright').Page} page
 */
export async function hasUnfilledEmployerQuestionnaireRadios(page) {
  const scope = responseScope(page);
  const groups = await listVisibleRadioGroupsFromDom(scope).catch(() => []);
  return groups.some((g) => !g.answered);
}

/**
 * Добивает radio по DOM (в т.ч. LLM), если probe не попал в liveQuestions.
 */
async function fillUnfilledRadioGroupsFromDom(page, scope, lookup, dashboardQuestions, ctx) {
  const log = ctx.log || (() => {});
  const cvText = String(ctx.cvText || '').trim();
  let filled = 0;
  const groups = await listVisibleRadioGroupsFromDom(scope);

  for (const g of groups) {
    if (g.answered) continue;
    const label = formatQuestionLabel(g.label);
    if (!label || isTextareaQuestionLabel(label)) continue;

    let q =
      findQuestionByLabel(dashboardQuestions, label) ||
      findQuestionByLabel(ctx.liveQuestions || [], label) || {
        label,
        type: 'radio',
        choiceName: g.choiceName,
        options: g.options,
      };

    let answer = resolveAnswerForLiveLabel(label, lookup, dashboardQuestions);
    if (!answer && isLlmRelatedQuestionLabel(label)) {
      answer = answerLlmRadioWithDisclosure(q);
    }
    if (!answer && cvText) {
      answer = answerChoiceFromCvHeuristic(q, cvText);
    }
    if (!answer) {
      log(`[hh-questionnaire] Нет ответа (radio DOM): ${label.slice(0, 70)}`);
      continue;
    }

    const ok = await fillStoredChoiceQuestion(page, scope, q, answer);
    if (ok) {
      filled++;
    } else {
      log(`[hh-questionnaire] Не удалось выбрать (radio DOM): ${label.slice(0, 70)}`);
    }
  }
  return filled;
}

async function fillStoredChoiceQuestion(page, scope, question, answer) {
  const opt = matchAnswerToOption(answer, question.options || []);
  const targetLabel = normalizeChoiceOptionLabel(opt?.label || answer);
  if (!targetLabel) return false;

  const kind = question.type === 'checkbox' ? 'checkbox' : 'radio';
  const name = question.choiceName;
  if (name && opt?.value) {
    const byValue = scope.locator(`input[type="radio"][name="${name}"][value="${opt.value}"]`).first();
    if (await byValue.isVisible({ timeout: 400 }).catch(() => false)) {
      await byValue.click({ timeout: 3000 });
      if (!name || (await isRadioGroupAnswered(scope, name))) return true;
    }
  }

  const block = await blockForQuestion(page, scope, question.label);
  if (block && (await block.isVisible({ timeout: 250 }).catch(() => false))) {
    if (await fillChoiceInBlock(block, targetLabel, kind)) {
      if (!name || (await isRadioGroupAnswered(scope, name))) return true;
    }
  }

  const escaped = targetLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
  const anywhere = scope.locator('label').filter({ hasText: new RegExp(escaped, 'i') }).first();
  if (await anywhere.isVisible({ timeout: 400 }).catch(() => false)) {
    await anywhere.click({ timeout: 3000 });
    if (!name || (await isRadioGroupAnswered(scope, name))) return true;
  }
  return false;
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 * @param {Array<{ label: string, type?: string, choiceName?: string, options?: Array<{ value?: string, label: string }> }>} liveQuestions
 * @param {ReturnType<typeof buildAnswerLookup>} lookup
 * @param {Array<{ index: number, label: string }>} dashboardQuestions
 * @param {{ cvText?: string, log?: (msg: string) => void }} ctx
 */
async function fillLiveChoiceQuestions(page, scope, liveQuestions, lookup, dashboardQuestions, ctx) {
  const log = ctx.log || (() => {});
  const cvText = String(ctx.cvText || '').trim();
  let filled = 0;

  for (const q of liveQuestions) {
    if (!isChoiceQuestion(q)) continue;
    if (isTextareaQuestionLabel(q.label)) continue;
    if (q.choiceName && (await isRadioGroupAnswered(scope, q.choiceName))) continue;

    let answer = resolveAnswerForLiveLabel(q.label, lookup, dashboardQuestions);
    if (!answer && isLlmRelatedQuestionLabel(q.label)) {
      answer = answerLlmRadioWithDisclosure(q);
    }
    if (!answer && cvText) {
      answer = answerChoiceFromCvHeuristic(q, cvText);
    }
    if (!answer) {
      log(`[hh-questionnaire] Нет ответа (варианты на hh.ru): ${q.label.slice(0, 70)}`);
      continue;
    }

    const ok = await fillStoredChoiceQuestion(page, scope, q, answer);
    if (ok) {
      filled++;
    } else {
      log(`[hh-questionnaire] Не удалось выбрать (hh.ru): ${q.label.slice(0, 70)}`);
    }
  }
  return filled;
}

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
 * Lookup по вопросам из дашборда (не по live-detect): индексы ответов = index в JSON.
 * @param {Array<{ index: number, label: string }>} dashboardQuestions
 * @param {Array<{ index: number, answer: string }>} answers
 */
export function buildAnswerLookup(dashboardQuestions, answers) {
  const byIndex = new Map(
    answers
      .map((a) => [Number(a.index), String(a.answer || '').trim()])
      .filter(([, v]) => v)
  );
  const byNorm = new Map();
  const byTopic = new Map();
  const topicCount = new Map();
  for (const q of dashboardQuestions) {
    const ans = byIndex.get(q.index);
    if (!ans) continue;
    const norm = normalizeQuestionLabel(q.label);
    if (norm) byNorm.set(norm, ans);
    const topic = questionnaireTopicKey(q.label);
    if (topic) {
      byTopic.set(topic, ans);
      topicCount.set(topic, (topicCount.get(topic) || 0) + 1);
    }
  }
  const uniqueTopic = (topic) => (topicCount.get(topic) || 0) === 1;
  return { byIndex, byNorm, byTopic, uniqueTopic };
}

/**
 * Ответ для подписи поля на hh.ru (сопоставление с вопросами дашборда).
 * @param {string} liveLabel
 * @param {ReturnType<typeof buildAnswerLookup>} lookup
 * @param {Array<{ index: number, label: string }>} dashboardQuestions
 */
export function resolveAnswerForLiveLabel(liveLabel, lookup, dashboardQuestions) {
  const norm = normalizeQuestionLabel(liveLabel);
  if (norm && lookup.byNorm.has(norm)) return lookup.byNorm.get(norm);

  const liveTopic = questionnaireTopicKey(liveLabel);
  const storedWithTopic = dashboardQuestions.filter(
    (q) => questionnaireTopicKey(q.label) === liveTopic
  );
  if (storedWithTopic.length === 1) {
    return lookup.byIndex.get(storedWithTopic[0].index) || '';
  }

  if (norm) {
    for (const q of dashboardQuestions) {
      const sn = normalizeQuestionLabel(q.label);
      if (!sn) continue;
      if (sn === norm || sn.includes(norm.slice(0, 28)) || norm.includes(sn.slice(0, 28))) {
        const ans = lookup.byIndex.get(q.index);
        if (ans) return ans;
      }
    }
  }

  if (lookup.uniqueTopic(liveTopic) && lookup.byTopic.has(liveTopic)) {
    return lookup.byTopic.get(liveTopic);
  }

  return '';
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').Locator} scope
 */
async function listVisibleQuestionnaireInputs(scope) {
  const loc = scope.locator(
    [
      'textarea:visible',
      'input[type="text"]:visible',
      'input:not([type]):visible',
      '[contenteditable="true"]:visible',
      '[role="textbox"]:visible',
    ].join(', ')
  );
  const n = await loc.count().catch(() => 0);
  const fields = [];
  for (let i = 0; i < n; i++) {
    const field = loc.nth(i);
    const qa = `${(await field.getAttribute('data-qa')) || ''} ${(await field.getAttribute('name')) || ''}`;
    if (COVER_LETTER_FIELD_RE.test(qa) || /resume|резюме/i.test(qa)) continue;
    if (!(await field.isVisible({ timeout: 150 }).catch(() => false))) continue;
    const box = await field.boundingBox().catch(() => null);
    fields.push({ field, top: box?.y ?? i * 1000, domOrder: i });
  }
  fields.sort((a, b) => a.top - b.top || a.domOrder - b.domOrder);
  return fields;
}

/**
 * Подпись вопроса рядом с конкретным полем ввода (для подстановки по видимым полям).
 * @param {import('playwright').Locator} field
 */
async function extractLabelForField(field) {
  const skillSrc = EMPLOYER_SKILL_CATEGORY_TEXT_RE.source;
  return field.evaluate(
    (el, { skillPattern }) => {
    const stripCounter = (s) =>
      String(s || '')
        .replace(/\s+\d+\s+из\s+\d+\s*$/i, '')
        .replace(/\s*писать\s+(?:сюда|тут|здесь)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const skillRe = new RegExp(skillPattern, 'i');
    const skillCategory = (t) =>
      skillRe.test(t) || /ci\s*\/\s*cd/i.test(t) || (t.includes('/') && t.length >= 4 && !/\?/.test(t));
    const good = (t) =>
      t &&
      !/^писать\s+(?:сюда|тут|здесь)\s*$/i.test(t) &&
      !/^текстовое\s+поле/i.test(t) &&
      (/\?/.test(t) ||
        /укажите|опишите|есть ли|от какой|рассматриваете|формат работы|неинтересн/i.test(t) ||
        skillCategory(t) ||
        (t.length >= 8 && skillRe.test(t)));

    let node = el.parentElement;
    for (let depth = 0; depth < 14 && node && node !== document.body; depth++) {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('textarea, input, [contenteditable], button').forEach((n) => n.remove());
      const t = stripCounter(clone.innerText || '');
      if (good(t)) return t;
      const prev = node.previousElementSibling;
      if (prev) {
        const pt = stripCounter(prev.innerText || '');
        if (good(pt)) return pt;
      }
      node = node.parentElement;
    }
    return '';
  },
    { skillPattern: skillSrc }
  );
}

/**
 * @param {import('playwright').Locator} field
 * @param {string} answer
 */
async function tryFillField(field, answer) {
  if (!answer) return false;
  await field.scrollIntoViewIfNeeded().catch(() => {});
  await field.click({ timeout: 3000 }).catch(() => {});

  const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'textarea');
  const isEditable = await field
    .evaluate((el) => el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')
    .catch(() => false);

  if (isEditable && tag !== 'textarea' && tag !== 'input') {
    await field.evaluate((el, text) => {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, answer);
  } else {
    await field.fill('', { timeout: 3000 }).catch(() => {});
    await field.fill(answer, { timeout: 8000 }).catch(() => {});
  }

  const check = await field
    .evaluate((el) => {
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        return el.value || '';
      }
      return el.textContent || '';
    })
    .catch(() => '');
  const snippet = answer.replace(/\s+/g, ' ').trim().slice(0, 24);
  return snippet.length >= 4 && check.replace(/\s+/g, ' ').includes(snippet.slice(0, 12));
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
  const dashboardQuestions = meaningfulQuestions(
    opts.dashboardQuestions?.length ? opts.dashboardQuestions : questions
  );
  const lookup = buildAnswerLookup(dashboardQuestions, answers);

  await scrollQuestionnaireFields(page);
  const orderedOnPage = await extractOrderedQuestionnaireFields(page);
  const live = await detectEmployerQuestionnaire(page);
  const liveQuestions = meaningfulQuestions(live.questions?.length ? live.questions : []);

  if (liveQuestions.length > dashboardQuestions.length) {
    log(
      `[hh-questionnaire] На hh.ru ${liveQuestions.length} вопр., в дашборде ${dashboardQuestions.length} — обновите «Загрузить с hh.ru»`
    );
  } else if (liveQuestions.length && liveQuestions.length < dashboardQuestions.length) {
    log(
      `[hh-questionnaire] На странице ${liveQuestions.length} полей, в дашборде ${dashboardQuestions.length} — сопоставление по тексту вопроса`
    );
  }

  const visibleInputs = await listVisibleQuestionnaireInputs(scope);
  let filledCount = 0;
  const totalVisible = visibleInputs.length;
  const cvText = String(opts.cvText || '').trim();

  if (totalVisible > dashboardQuestions.length && dashboardQuestions.length) {
    log(
      `[hh-questionnaire] На странице ${totalVisible} полей, в дашборде ${dashboardQuestions.length} — обновите «Загрузить с hh.ru»; пустые поля заполню из резюме`
    );
  }

  for (const q of dashboardQuestions) {
    if (!isChoiceQuestion(q)) continue;
    if (isTextareaQuestionLabel(q.label)) continue;
    let answer = lookup.byIndex.get(q.index) || '';
    if (!answer && cvText) {
      answer = answerChoiceFromCvHeuristic(q, cvText);
    }
    if (!answer) {
      log(`[hh-questionnaire] Нет ответа (варианты): ${q.label.slice(0, 70)}`);
      continue;
    }
    const ok = await fillStoredChoiceQuestion(page, scope, q, answer);
    if (ok) {
      filledCount++;
    } else {
      log(`[hh-questionnaire] Не удалось выбрать вариант: ${q.label.slice(0, 70)}`);
    }
  }

  filledCount += await fillLiveChoiceQuestions(page, scope, liveQuestions, lookup, dashboardQuestions, {
    cvText,
    log,
  });
  filledCount += await fillUnfilledRadioGroupsFromDom(page, scope, lookup, dashboardQuestions, {
    cvText,
    log,
    liveQuestions,
  });

  const textareaQueue = dashboardQuestions
    .filter((q) => isTextareaQuestionLabel(q.label) || q.type === 'textarea')
    .sort((a, b) => a.index - b.index);
  let textareaQueueIdx = 0;
  const filledTextIndices = new Set();

  for (let i = 0; i < visibleInputs.length; i++) {
    const { field } = visibleInputs[i];
    const orderedQ = orderedOnPage[i];
    const isTextField = await fieldIsTextInput(field);
    let label = orderedQ?.label || '';
    if (!label || isPlaceholderFieldLabel(label)) {
      label = formatQuestionLabel(await extractLabelForField(field));
    }
    if (!label || isPlaceholderFieldLabel(label)) {
      label = formatQuestionLabel(await resolveQuestionLabelAboveField(page, field));
    }
    if (!label) {
      log(`[hh-questionnaire] Поле ${i + 1}: не удалось прочитать вопрос`);
      continue;
    }

    let storedQ = findQuestionByLabel(dashboardQuestions, label);
    const liveQ = findQuestionByLabel(liveQuestions, label);
    const forceText = isTextField || isTextareaQuestionLabel(label);

    if (
      forceText &&
      (!storedQ || isLikelyAnswerTextNotQuestion(label) || isPlaceholderFieldLabel(label))
    ) {
      while (textareaQueueIdx < textareaQueue.length) {
        const candidate = textareaQueue[textareaQueueIdx++];
        if (filledTextIndices.has(candidate.index)) continue;
        storedQ = candidate;
        label = candidate.label;
        break;
      }
    }

    if (
      !forceText &&
      ((storedQ && isChoiceQuestion(storedQ)) || (liveQ && isChoiceQuestion(liveQ)))
    ) {
      const choiceQ = liveQ && isChoiceQuestion(liveQ) ? liveQ : storedQ;
      let choiceText = lookup.byIndex.get(storedQ?.index ?? choiceQ.index) || '';
      if (!choiceText || /^тестирование\s+(черн|бел)/i.test(choiceText)) {
        choiceText =
          resolveAnswerForLiveLabel(label, lookup, dashboardQuestions) ||
          (isLlmRelatedQuestionLabel(label) ? answerLlmRadioWithDisclosure(choiceQ) : '') ||
          (cvText
            ? answerChoiceFromCvHeuristic(choiceQ, cvText) ||
              answerFromCvHeuristic({ label }, cvText, { vacancyTitle: opts.vacancyTitle })
            : '');
      }
      if (choiceText && choiceQ.options?.length && !matchAnswerToOption(choiceText, choiceQ.options)) {
        const fromCv = cvText
          ? answerChoiceFromCvHeuristic(choiceQ, cvText) ||
            (isRoleInterestQuestionLabel(label)
              ? answerFromCvHeuristic({ label }, cvText, { vacancyTitle: opts.vacancyTitle })
              : '')
          : '';
        if (fromCv && matchAnswerToOption(fromCv, choiceQ.options)) choiceText = fromCv;
      }
      if (isRoleInterestQuestionLabel(label) && cvText) {
        const roleText = answerFromCvHeuristic({ label }, cvText, { vacancyTitle: opts.vacancyTitle });
        if (roleText && (!choiceText || !matchAnswerToOption(choiceText, choiceQ.options || []))) {
          choiceText = roleText;
        }
      }
      if (choiceText) {
        const okChoice = await fillStoredChoiceQuestion(page, scope, choiceQ, choiceText);
        if (okChoice) filledCount++;
        else log(`[hh-questionnaire] Не удалось выбрать вариант: ${label.slice(0, 70)}`);
      }
      continue;
    }

    let answer = '';
    if (isTextareaQuestionLabel(label) && cvText) {
      answer = answerFromCvHeuristic({ label }, cvText, { vacancyTitle: opts.vacancyTitle });
    }
    if (!answer) {
      answer = resolveAnswerForLiveLabel(label, lookup, dashboardQuestions);
    }
    if (!answer && cvText) {
      answer = answerFromCvHeuristic({ label }, cvText, { vacancyTitle: opts.vacancyTitle });
    }
    if (!answer) {
      log(`[hh-questionnaire] Нет ответа в дашборде: ${label.slice(0, 70)}`);
      continue;
    }

    let ok = await tryFillField(field, answer);
    if (!ok) {
      const block =
        (await blockForField(field)) ||
        (await blockForQuestion(page, scope, label));
      if (block && (await block.isVisible({ timeout: 200 }).catch(() => false))) {
        const qType = orderedQ?.type || liveQ?.type || 'textarea';
        if (qType === 'radio' || qType === 'checkbox') {
          ok = await fillChoiceInBlock(block, answer, qType);
        } else if (qType === 'select') {
          const sel = block.locator('select').first();
          if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
            await sel.selectOption({ label: answer }).catch(async () => {
              await sel.selectOption({ value: answer }).catch(() => {});
            });
            ok = true;
          }
        } else {
          ok = await fillTextInBlock(block, answer);
        }
      }
    }

    if (ok) {
      filledCount++;
      if (storedQ?.index) filledTextIndices.add(storedQ.index);
    } else {
      log(`[hh-questionnaire] Не удалось заполнить: ${label.slice(0, 70)}`);
    }
  }

  for (const { field } of await listVisibleQuestionnaireInputs(scope)) {
    let label = formatQuestionLabel(await extractLabelForField(field));
    if (!label) label = formatQuestionLabel(await resolveQuestionLabelAboveField(page, field));
    if (!isRoleInterestQuestionLabel(label)) continue;
    const roleText = answerRoleInterestTextarea({ vacancyTitle: opts.vacancyTitle });
    if (roleText && (await tryFillField(field, roleText))) {
      filledCount++;
      log(`[hh-questionnaire] Роль/интерес (textarea): ${label.slice(0, 50)}`);
    }
  }

  await scrollQuestionnaireFields(page);
  filledCount += await fillUnfilledRadioGroupsFromDom(page, scope, lookup, dashboardQuestions, {
    cvText,
    log,
    liveQuestions,
  });

  for (const { field } of await listVisibleQuestionnaireInputs(scope)) {
    const isText = await fieldIsTextInput(field);
    if (!isText) continue;
    const val = await field
      .evaluate((el) => {
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value || '';
        return el.textContent || '';
      })
      .catch(() => '');
    if (String(val || '').trim()) continue;
    let label = formatQuestionLabel(await extractLabelForField(field));
    if (!label) label = formatQuestionLabel(await resolveQuestionLabelAboveField(page, field));
    if (!label || isPlaceholderFieldLabel(label)) continue;
    const qa = `${(await field.getAttribute('data-qa')) || ''} ${(await field.getAttribute('name')) || ''}`;
    if (/resume|резюме|letter|письм|cover/i.test(qa)) continue;
    let answer =
      resolveAnswerForLiveLabel(label, lookup, dashboardQuestions) ||
      (cvText ? answerFromCvHeuristic({ label }, cvText, { vacancyTitle: opts.vacancyTitle }) : '');
    if (!answer) continue;
    if (await tryFillField(field, answer)) filledCount++;
  }

  const choiceTotal = liveQuestions.filter(isChoiceQuestion).length;
  const unfilledRadios = await hasUnfilledEmployerQuestionnaireRadios(page);
  if (unfilledRadios) {
    const scope2 = responseScope(page);
    const pending = (await listVisibleRadioGroupsFromDom(scope2)).filter((g) => !g.answered);
    for (const g of pending.slice(0, 4)) {
      const hint = formatQuestionLabel(g.label) || g.choiceName || 'radio';
      log(`[hh-questionnaire] Пустая radio-группа: ${hint.slice(0, 72)}`);
    }
  }

  if (filledCount > 0) {
    log(
      `[hh-questionnaire] Заполнено полей: ${filledCount}` +
        (totalVisible ? ` (текстовых на экране: ${totalVisible})` : '') +
        (choiceTotal ? `, radio-групп в JSON: ${choiceTotal}` : '') +
        (unfilledRadios ? ' — остались пустые варианты' : '')
    );
  }

  const total = Math.max(totalVisible, liveQuestions.length, dashboardQuestions.length);
  return { filledCount, total, ok: filledCount > 0 && !unfilledRadios, unfilledRadios };
}
