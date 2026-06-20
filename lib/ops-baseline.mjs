/**
 * Загрузка и проверка intelligence baseline.
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR, ROOT } from './paths.mjs';
import {
  INTELLIGENCE_BASELINE_FILE,
  writeIntelligenceBaseline,
} from './intelligence-loop.mjs';

export const INTELLIGENCE_BASELINE_EXAMPLE = path.join(
  DATA_DIR,
  'intelligence-baseline.example.json'
);

/** @returns {object|null} */
export function loadIntelligenceBaseline() {
  if (fs.existsSync(INTELLIGENCE_BASELINE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(INTELLIGENCE_BASELINE_FILE, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/** @returns {boolean} */
export function hasIntelligenceBaseline() {
  return fs.existsSync(INTELLIGENCE_BASELINE_FILE);
}

/**
 * @param {{ maxAgeDays?: number }} [opts]
 */
export function baselineAgeDays(opts = {}) {
  const b = loadIntelligenceBaseline();
  if (!b?.at) return null;
  const ageMs = Date.now() - Date.parse(b.at);
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}

/**
 * @param {{ maxAgeDays?: number }} [opts]
 */
export function isBaselineStale(opts = {}) {
  const max = opts.maxAgeDays ?? 90;
  const age = baselineAgeDays();
  if (age == null) return true;
  return age > max;
}

export function ensureBaselineExampleInRepo() {
  return fs.existsSync(path.join(ROOT, 'data', 'intelligence-baseline.example.json'));
}

export { writeIntelligenceBaseline };
