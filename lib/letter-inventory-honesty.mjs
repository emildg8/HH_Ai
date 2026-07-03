/**
 * ME (M0): честность письма vs инвентарь навыков — без ложных positive claims.
 */

import { filterInventorySkills } from './candidate-skills-inventory.mjs';

const HONEST_BRIDGE_RE =
  /\b(наращива|развива|pet|пилот|обучен|готов[аы]?\s+(?:нарасти|обсудить|честно)|планиру|в\s+процессе|буду\s+наращивать|без\s+коммерческого|не\s+коммерческ|ai-assisted|ии-инструмент)\b/i;

/** @type {{ claim: string, re: RegExp, keys: string[] }[]} */
const QA_RISKY_CLAIMS = [
  { claim: 'GitLab CI', re: /\bgit\s*lab(?:\s*ci)?\b/i, keys: ['gitlab', 'gitlab ci'] },
  { claim: 'Jenkins', re: /\bjenkins\b/i, keys: ['jenkins'] },
  { claim: 'Grafana', re: /\bgrafana\b/i, keys: ['grafana'] },
  { claim: 'Prometheus', re: /\bprometheus\b/i, keys: ['prometheus'] },
  { claim: 'Kubernetes', re: /\b(?:kubernetes|k8s)\b/i, keys: ['kubernetes', 'k8s'] },
  { claim: 'Docker', re: /\bdocker\b/i, keys: ['docker'] },
];

const GITLAB_SETUP_RE = /настраив\w*\s+git\s*lab/i;
const PYTHON_FRAMEWORK_RE =
  /python[- ]?фреймворк|фреймворк\w*\s+(?:на\s+)?python|(?:python|pytest)\s*\/\s*pytest\s+sdet/i;
const COMMERCIAL_SDET_RE =
  /коммерческ\w*\s+(?:python|java|c#|c\+\+|kotlin|\.net).*?(?:sdet|автоматиз|pytest|selenium|фреймворк)|(?:sdet|автоматиз\w*|фреймворк\w*).*?коммерческ/i;
const COMMERCIAL_JAVA_SDET_RE =
  /коммерческ\w*\s+(?:java|kotlin|c#|\.net).*?(?:sdet|автоматиз|фреймворк)|(?:java|kotlin|c#).*?(?:sdet|автоматиз).*?(?:прод|production|коммерческ)/i;

/**
 * @param {object | null} inventory
 * @returns {Set<string>}
 */
function buildLetterSafeTokens(inventory) {
  const tokens = new Set();
  const skills = filterInventorySkills(inventory, 'letterSafe');
  for (const s of skills) {
    for (const raw of [s.name, s.skill, ...(s.aliases || [])]) {
      const norm = String(raw || '').toLowerCase().trim();
      if (norm) tokens.add(norm);
    }
  }
  for (const proj of inventory?.projects || []) {
    if (!proj.letterSafe) continue;
    for (const raw of proj.stack || []) {
      const norm = String(raw || '').toLowerCase().trim();
      if (norm) tokens.add(norm);
    }
  }
  return tokens;
}

/**
 * @param {string[]} keys
 * @param {Set<string>} tokens
 */
function hasInventoryBacking(keys, tokens) {
  for (const key of keys) {
    if (tokens.has(key)) return true;
    for (const token of tokens) {
      if (token.includes(key) || key.includes(token)) return true;
    }
  }
  return false;
}

/**
 * @param {string} text
 * @param {number} idx
 * @param {number} [window]
 */
function hasHonestBridgeNear(text, idx, window = 90) {
  const start = Math.max(0, idx - window);
  const end = Math.min(text.length, idx + window);
  return HONEST_BRIDGE_RE.test(text.slice(start, end));
}

/**
 * @param {string} text
 * @param {string} claim
 * @param {string} reason
 * @param {Array<{ claim: string, reason: string }>} violations
 */
function pushViolation(text, claim, reason, violations) {
  if (violations.some((v) => v.claim === claim)) return;
  violations.push({ claim, reason });
}

/**
 * @param {string} letterText
 * @param {object | null} inventory
 * @param {object} [opts]
 * @param {string} [opts.lane] — 'qa' | 'any'
 * @returns {{ pass: boolean, violations: Array<{ claim: string, reason: string }> }}
 */
export function scanLetterInventoryHonesty(letterText, inventory, opts = {}) {
  const text = String(letterText || '').trim();
  if (!text) return { pass: true, violations: [] };

  const lane = opts.lane || 'qa';
  const tokens = buildLetterSafeTokens(inventory);
  /** @type {Array<{ claim: string, reason: string }>} */
  const violations = [];

  if (lane === 'qa' || lane === 'any') {
    for (const row of QA_RISKY_CLAIMS) {
      const m = row.re.exec(text);
      if (!m) continue;
      if (hasInventoryBacking(row.keys, tokens)) continue;
      if (hasHonestBridgeNear(text, m.index)) continue;
      pushViolation(
        text,
        row.claim,
        `навык «${row.claim}» не в letterSafe инвентаре`,
        violations
      );
    }

    const gitlabSetup = GITLAB_SETUP_RE.exec(text);
    if (gitlabSetup && !hasInventoryBacking(['gitlab', 'gitlab ci'], tokens)) {
      if (!hasHonestBridgeNear(text, gitlabSetup.index)) {
        pushViolation(
          text,
          'настройка GitLab',
          'настройка GitLab без подтверждения в инвентаре',
          violations
        );
      }
    }

    const pyFw = PYTHON_FRAMEWORK_RE.exec(text);
    if (pyFw && !hasInventoryBacking(['python', 'pytest'], tokens)) {
      if (!hasHonestBridgeNear(text, pyFw.index)) {
        pushViolation(
          text,
          'Python-фреймворк',
          'заявлен Python-фреймворк без letterSafe в инвентаре',
          violations
        );
      }
    }

    const commercialSdet = COMMERCIAL_SDET_RE.exec(text);
    if (commercialSdet && !hasHonestBridgeNear(text, commercialSdet.index)) {
      pushViolation(
        text,
        'коммерческий SDET',
        'коммерческий SDET/automation без честного моста',
        violations
      );
    }

    const commercialJava = COMMERCIAL_JAVA_SDET_RE.exec(text);
    if (commercialJava && !hasHonestBridgeNear(text, commercialJava.index)) {
      pushViolation(
        text,
        'коммерческий Java/C# SDET',
        'коммерческий Java/C# automation без подтверждения в инвентаре',
        violations
      );
    }
  }

  for (const pattern of inventory?.antiPatterns || []) {
    const p = String(pattern || '').trim();
    if (!p) continue;
    if (/devops\/k8s|kubernetes|k8s/i.test(p) && /\b(?:kubernetes|k8s)\b/i.test(text)) {
      if (!hasInventoryBacking(['kubernetes', 'k8s'], tokens) && !hasHonestBridgeNear(text, 0)) {
        pushViolation(
          text,
          'коммерческий K8s',
          'antiPattern: коммерческий DevOps/K8s без кейса',
          violations
        );
      }
    }
    if (/c#\/java|java\)/i.test(p) && COMMERCIAL_JAVA_SDET_RE.test(text)) {
      if (!hasHonestBridgeNear(text, 0)) {
        pushViolation(
          text,
          'legacy Java/C# framework',
          'antiPattern: legacy automation framework в проде',
          violations
        );
      }
    }
  }

  return { pass: violations.length === 0, violations };
}
