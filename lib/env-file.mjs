import fs from 'node:fs';

/**
 * Добавить или обновить KEY=value в .env (без удаления остальных строк).
 * @param {string} filePath
 * @param {string} key
 * @param {string} value
 * @param {string} [commentLine] строка-комментарий перед ключом, если ключ новый
 */
export function upsertEnvVar(filePath, key, value, commentLine = '') {
  const line = `${key}=${value}`;
  if (!fs.existsSync(filePath)) {
    const body = commentLine ? `${commentLine}\n${line}\n` : `${line}\n`;
    fs.writeFileSync(filePath, body, 'utf8');
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`^${escapeRegExp(key)}=.*$`, 'm');
  if (re.test(raw)) {
    fs.writeFileSync(filePath, raw.replace(re, line), 'utf8');
    return;
  }
  const suffix = raw.endsWith('\n') ? '' : '\n';
  const insert = commentLine ? `${suffix}${commentLine}\n${line}\n` : `${suffix}${line}\n`;
  fs.writeFileSync(filePath, raw + insert, 'utf8');
}

/** @param {string} key @param {string} filePath */
export function removeEnvVar(filePath, key) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const re = new RegExp(`^${escapeRegExp(key)}=.*\\n?`, 'm');
  fs.writeFileSync(filePath, raw.replace(re, ''), 'utf8');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
