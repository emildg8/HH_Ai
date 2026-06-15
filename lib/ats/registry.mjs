/**
 * ATS registry и парсеры (по образцу OpenPostings).
 */

import { parseGreenhouseBoard } from './parsers/greenhouse.mjs';
import { parseLeverBoard } from './parsers/lever.mjs';
import { parseAshbyBoard } from './parsers/ashby.mjs';
import { parseWorkdayBoard } from './parsers/workday.mjs';
import { parseGenericHtml } from './parsers/generic-html.mjs';

/** @type {Record<string, { id: string, parse: Function }>} */
export const ATS_PARSERS = {
  greenhouse: { id: 'greenhouse', parse: parseGreenhouseBoard },
  lever: { id: 'lever', parse: parseLeverBoard },
  ashby: { id: 'ashby', parse: parseAshbyBoard },
  workday: { id: 'workday', parse: parseWorkdayBoard },
  generic: { id: 'generic', parse: parseGenericHtml },
};

/**
 * @param {string} url
 */
export function detectAtsType(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('greenhouse.io')) return 'greenhouse';
  if (u.includes('lever.co')) return 'lever';
  if (u.includes('ashbyhq.com')) return 'ashby';
  if (u.includes('myworkdayjobs.com')) return 'workday';
  return 'generic';
}

/**
 * @param {object} companyCfg
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function harvestAtsCompany(companyCfg, opts = {}) {
  const type = companyCfg.ats || detectAtsType(companyCfg.url || companyCfg.boardUrl || '');
  const parser = ATS_PARSERS[type] || ATS_PARSERS.generic;
  return parser.parse(companyCfg, opts);
}
