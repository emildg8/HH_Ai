/**
 *   npm run devops:regenerate-letters
 *   npm run devops:regenerate-letters -- --limit=30 --resume
 */
import { loadProfile } from '../lib/load-profile.mjs';

loadProfile();

/** Массовый прогон: один запрос на вакансию (бриф — отдельно, в дашборде можно TWO_PHASE=1). */
if (process.env.COVER_LETTER_TWO_PHASE === undefined) {
  process.env.COVER_LETTER_TWO_PHASE = '0';
}
/** Только OpenRouter — локальный Ollama часто отдаёт пустой ответ на большой JSON. */
if (process.env.COVER_LETTER_OPENROUTER_ONLY === undefined) {
  process.env.COVER_LETTER_OPENROUTER_ONLY = '1';
}
if (process.env.COVER_LETTER_STYLE_MAX_CHARS === undefined) {
  process.env.COVER_LETTER_STYLE_MAX_CHARS = '3500';
}
if (process.env.COVER_LETTER_VARIANT_COUNT === undefined) {
  process.env.COVER_LETTER_VARIANT_COUNT = '3';
}
if (process.env.COVER_LETTER_STYLE_QUEUE_ITEMS === undefined) {
  process.env.COVER_LETTER_STYLE_QUEUE_ITEMS = '3';
}

await import('./regenerate-cover-letters.mjs');
