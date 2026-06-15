/**
 * MIT-inspired AI writing pattern detector (simplified vendored subset).
 * @see https://github.com/conorbronsdon/avoid-ai-writing
 */

const EN_PATTERNS = [
  { id: 'delve', re: /\bdelve\b/gi, weight: 8 },
  { id: 'tapestry', re: /\btapestry\b/gi, weight: 10 },
  { id: 'landscape', re: /\bin today's (?:fast-paced )?landscape\b/gi, weight: 12 },
  { id: 'testament', re: /\ba testament to\b/gi, weight: 10 },
  { id: 'crucial', re: /\bit is crucial\b/gi, weight: 6 },
  { id: 'furthermore', re: /\bfurthermore\b/gi, weight: 5 },
  { id: 'moreover', re: /\bmoreover\b/gi, weight: 5 },
  { id: 'underscore', re: /\bunderscores?\b/gi, weight: 7 },
  { id: 'robust', re: /\brobust solution\b/gi, weight: 6 },
  { id: 'leverage', re: /\bleverage\b/gi, weight: 5 },
  { id: 'synergy', re: /\bsynerg(?:y|ies)\b/gi, weight: 8 },
  { id: 'holistic', re: /\bholistic\b/gi, weight: 7 },
  { id: 'streamline', re: /\bstreamlin(?:e|ing)\b/gi, weight: 5 },
  { id: 'cutting_edge', re: /\bcutting[- ]edge\b/gi, weight: 6 },
  { id: 'passionate', re: /\bi am passionate about\b/gi, weight: 8 },
  { id: 'excited', re: /\bi am excited to\b/gi, weight: 7 },
  { id: 'thrilled', re: /\bi am thrilled\b/gi, weight: 8 },
  { id: 'perfect_fit', re: /\bperfect fit\b/gi, weight: 9 },
  { id: 'unique_blend', re: /\bunique blend\b/gi, weight: 10 },
  { id: 'in_conclusion', re: /\bin conclusion\b/gi, weight: 6 },
];

const RU_PATTERNS = [
  { id: 'v_svyazi', re: /в связи с вышеизложенным/gi, weight: 12 },
  { id: 'osuschestv', re: /осуществлял[аи]?\b/gi, weight: 8 },
  { id: 'yavlyaetsya', re: /является ключевым/gi, weight: 10 },
  { id: 'v_dannom', re: /в данном контексте/gi, weight: 9 },
  { id: 'komandny', re: /командный игрок/gi, weight: 10 },
  { id: 'stress', re: /стрессоустойчив/gi, weight: 8 },
  { id: 'otvetstven', re: /высокая ответственность/gi, weight: 6 },
  { id: 'dinamich', re: /динамичн(?:ая|ую) компани/gi, weight: 8 },
  { id: 'otklikayus', re: /я откликаюсь на ваканси/gi, weight: 7 },
  { id: 'rassmatriv', re: /рассматриваю возможность/gi, weight: 7 },
];

function analyzeWithPatterns(text, patterns) {
  const hits = [];
  let score = 0;
  for (const p of patterns) {
    const matches = String(text || '').match(p.re);
    if (matches?.length) {
      const add = p.weight * matches.length;
      score += add;
      hits.push({ id: p.id, count: matches.length, weight: add });
    }
  }
  return { score, hits };
}

function band(score) {
  if (score <= 15) return 'Light';
  if (score <= 35) return 'Moderate';
  if (score <= 55) return 'Strong';
  return 'Heavy';
}

export const AIDetector = {
  /**
   * @param {string} text
   * @param {{ lang?: 'en'|'ru'|'auto' }} [opts]
   */
  analyzeText(text, opts = {}) {
    const lang = opts.lang || 'auto';
    const t = String(text || '');
    const en = lang === 'ru' ? { score: 0, hits: [] } : analyzeWithPatterns(t, EN_PATTERNS);
    const ru = lang === 'en' ? { score: 0, hits: [] } : analyzeWithPatterns(t, RU_PATTERNS);
    const score = Math.min(100, en.score + ru.score);
    return {
      score,
      band: band(score),
      hits: [...en.hits, ...ru.hits],
    };
  },
};

export { EN_PATTERNS, RU_PATTERNS, band };
