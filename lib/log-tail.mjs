import fs from 'fs';

/**
 * @param {string} filePath
 * @param {number} lineCount
 */
export function readLogTail(filePath, lineCount = 25) {
  const n = Math.min(200, Math.max(1, Number(lineCount) || 25));
  if (!filePath || !fs.existsSync(filePath)) {
    return { exists: false, lines: [], text: '', lastError: null };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const all = raw.split('\n');
  const lines = all.length > n ? all.slice(-n) : all;
  const text = lines.join('\n');
  const errLine =
    [...lines]
      .reverse()
      .find((l) =>
        /Error:|browser has been closed|browserType\.launch|SingletonLock|Профиль браузера|не найден|Сессия не активна/i.test(
          l
        )
      ) || null;
  return { exists: true, lines, text, lastError: errLine };
}
