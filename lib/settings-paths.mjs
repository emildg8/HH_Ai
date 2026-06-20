/**
 * Утилиты dot-path для единого модуля настроек.
 */

/** @param {string} path */
export function splitSettingPath(path) {
  return String(path || '')
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** @param {unknown} root @param {string} path */
export function getAtPath(root, path) {
  const parts = splitSettingPath(path);
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = /** @type {Record<string, unknown>} */ (cur)[p];
  }
  return cur;
}

/** @param {Record<string, unknown>} root @param {string} path @param {unknown} value */
export function setAtPath(root, path, value) {
  const parts = splitSettingPath(path);
  if (!parts.length) return;
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object' || Array.isArray(cur[p])) {
      cur[p] = {};
    }
    cur = /** @type {Record<string, unknown>} */ (cur[p]);
  }
  cur[parts[parts.length - 1]] = value;
}

/**
 * @param {unknown} obj
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function flattenObjectPaths(obj, prefix = '') {
  if (obj == null) return prefix ? [prefix] : [];
  if (Array.isArray(obj)) return prefix ? [prefix] : [];
  if (typeof obj !== 'object') return prefix ? [prefix] : [];
  /** @type {string[]} */
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenObjectPaths(v, p));
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} flat
 */
export function expandDotPatch(flat) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [path, value] of Object.entries(flat)) {
    if (path.includes('.')) setAtPath(out, path, value);
    else out[path] = value;
  }
  return out;
}
