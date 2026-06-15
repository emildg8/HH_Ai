/**
 * Jobboards registry (волна 2).
 */

import { parseDiceSearchHtml } from './parsers/dice.mjs';
import { parseJungleSearchHtml } from './parsers/welcometothejungle.mjs';

export const JOBBOARD_PARSERS = {
  dice: { id: 'dice', parse: parseDiceSearchHtml },
  welcometothejungle: { id: 'welcometothejungle', parse: parseJungleSearchHtml },
};

/**
 * @param {string} boardId
 * @param {object} cfg
 * @param {object} [opts]
 */
export async function harvestJobboard(boardId, cfg, opts = {}) {
  const parser = JOBBOARD_PARSERS[boardId];
  if (!parser) throw new Error(`Unknown jobboard: ${boardId}`);
  return parser.parse(cfg, opts);
}
