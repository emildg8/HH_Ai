/**
 * Проверка готовности и размеров промптов сопроводительных.
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { buildStyleContextBlock, loadCoverLetterExampleBlocks } from './cover-letter-style-context.mjs';
import { buildCvFactsBlock, extractCvHighlights } from './cover-letter-cv-facts.mjs';
import { buildVacancyFocusBlock } from './cover-letter-vacancy-focus.mjs';
import { isCoverLetterTwoPhaseEnabled } from './cover-letter-brief.mjs';
import { getCoverLetterVariantCount } from './cover-letter-openrouter.mjs';
import { hasScoreProviderCredentials, getOpenRouterApiKey, isCustomLlmRunnable } from './openrouter-score.mjs';
import { CV_DIR } from './paths.mjs';

const COVER_TEMPLATE = [
  path.join(ROOT, 'config', 'cover-letter.txt'),
  path.join(ROOT, 'config', 'cover-letter.example.txt'),
];

/**
 * @param {object} record
 * @param {{ text: string }} cvBundle
 */
export function auditCoverLetterPrompts(record, cvBundle) {
  const issues = [];
  const info = [];

  if (!hasScoreProviderCredentials()) {
    issues.push('Нет LLM: задайте OpenRouter_API_KEY или HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL');
  } else {
    if (getOpenRouterApiKey()) info.push('OpenRouter: ключ есть');
    if (isCustomLlmRunnable()) info.push('Запасной LLM: HH_CUSTOM_LLM_* настроен');
  }

  if (!fs.existsSync(CV_DIR)) issues.push('Папка CV/ не найдена');
  else if (!String(cvBundle?.text || '').trim()) issues.push('CV/ пуст — нет .pdf/.txt/.md с текстом');
  else info.push(`CV: ${(cvBundle.files || []).length} файл(ов), ${cvBundle.text.length} симв.`);

  const hasTemplate = COVER_TEMPLATE.some((p) => fs.existsSync(p));
  const examples = loadCoverLetterExampleBlocks();
  if (!hasTemplate && !examples.length) {
    issues.push('Нет эталонов: config/cover-letter.txt или cover-letter.example.txt');
  } else {
    info.push(`Эталоны стиля: ${examples.length} блок(ов) в example + очередь`);
  }

  const desc =
    String(record?.descriptionForLlm || record?.descriptionPreview || '').trim();
  if (desc.length < 80) {
    issues.push('У тестовой вакансии мало описания — письма будут слабее');
  }

  const highlights = extractCvHighlights(cvBundle?.text || '', 8);
  if (highlights.length < 2) {
    issues.push('Мало извлекаемых фактов из CV (нет цифр/стека в тексте)');
  } else {
    info.push(`Факты из CV для промпта: ${highlights.length} строк`);
  }

  const focus = buildVacancyFocusBlock(record, desc);
  const cvFacts = buildCvFactsBlock(cvBundle?.text || '');
  const style = buildStyleContextBlock({
    maxChars: Number(process.env.COVER_LETTER_STYLE_MAX_CHARS) || 8000,
    maxItemsFromQueue: Number(process.env.COVER_LETTER_STYLE_QUEUE_ITEMS) || 6,
  });

  const stats = {
    vacancyFocusChars: focus.length,
    cvFactsChars: cvFacts.length,
    styleChars: style.length,
    variantCount: getCoverLetterVariantCount(),
    twoPhase: isCoverLetterTwoPhaseEnabled(),
    temperature: Number(process.env.COVER_LETTER_TEMPERATURE) || 0.48,
  };

  if (style.length < 200) {
    issues.push('Мало эталонов стиля в промпте (<200 симв.) — утвердите 1–2 письма в дашборде');
  }
  if (stats.vacancyFocusChars < 50 && desc.length >= 80) {
    issues.push('Блок фокуса вакансии пустой');
  }

  info.push(`Двухфазная генерация: ${stats.twoPhase ? 'да (бриф + письма)' : 'нет'}`);
  info.push(`Вариантов на вакансию: ${stats.variantCount}`);

  return { ok: issues.length === 0, issues, info, stats };
}
