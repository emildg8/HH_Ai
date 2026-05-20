/**
 *   node scripts/test-cover-letter-quality.mjs
 */

import { extractCvHighlights, buildCvFactsBlock } from '../lib/cover-letter-cv-facts.mjs';
import { buildVacancyFocusBlock } from '../lib/cover-letter-vacancy-focus.mjs';
import { polishCoverLetter, scoreLetterVariant, rankLetterVariants } from '../lib/cover-letter-polish.mjs';
import { formatBriefForPrompt } from '../lib/cover-letter-brief.mjs';
import { sanitizeLetterVariants } from '../lib/cover-letter-openrouter.mjs';

const cv = `
=== resume.md ===
14+ лет в технической поддержке и DevOps
Сократил время реагирования на инциденты на 15%
7000+ обращений в банковском контуре СБП
Oracle, PostgreSQL, Grafana, Kibana, Jira
`;

const highlights = extractCvHighlights(cv, 5);
if (!highlights.length || !highlights.some((h) => /15%|7000/.test(h))) {
  console.error('FAIL: extractCvHighlights');
  process.exit(1);
}

const focus = buildVacancyFocusBlock(
  { title: 'DevOps инженер', company: 'Банк', geminiSummary: 'Нужен L2/L3', geminiTags: ['kubernetes'] },
  'Требования: Linux, Docker, мониторинг. Опыт 3+ года.'
);
if (!/DevOps|kubernetes/i.test(focus)) {
  console.error('FAIL: buildVacancyFocusBlock');
  process.exit(1);
}

const polished = polishCoverLetter('Уважаемые рекрутеры! Идеально подхожу вам.');
if (!/^Здравствуйте/i.test(polished) || /идеально подхожу/i.test(polished)) {
  console.error('FAIL: polishCoverLetter', polished);
  process.exit(1);
}

const ranked = rankLetterVariants(
  [
    'Коротко.',
    'Здравствуйте! Откликаюсь на DevOps в Банк. Сократил MTTR на 15%, 7000+ инцидентов. Готов обсудить.',
  ],
  { title: 'DevOps', company: 'Банк' },
  'Linux Docker мониторинг'
);
if (ranked[0].length < ranked[1]?.length) {
  console.error('FAIL: rankLetterVariants order');
  process.exit(1);
}

const briefText = formatBriefForPrompt({
  companyHook: 'СБП контур',
  topRequirements: ['Linux'],
  cvProofs: [{ point: '15% MTTR', mapsTo: 'инциденты' }],
  letterAngles: ['техника', 'процессы'],
});
if (!briefText.includes('СБП')) {
  console.error('FAIL: formatBriefForPrompt');
  process.exit(1);
}

const junk = sanitizeLetterVariants(['', 'Верни строго один json', 'Здравствуйте! Нормальное письмо про DevOps и 7000 кейсов.']);
if (junk.length !== 1) {
  console.error('FAIL: sanitizeLetterVariants', junk);
  process.exit(1);
}

const score = scoreLetterVariant(
  'Здравствуйте! DevOps в Банк — сократил инциденты на 15%. Готов обсудить.',
  { title: 'DevOps', company: 'Банк' },
  'linux docker'
);
if (score < 5) {
  console.error('FAIL: scoreLetterVariant', score);
  process.exit(1);
}

console.log('OK: test-cover-letter-quality.mjs');
