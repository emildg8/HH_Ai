import fs from 'fs';
import path from 'path';
import { formatLogLine } from './log-line.mjs';
import { HH_APPLY_CHAT_LOG_FILE, HARVEST_RUN_LOG_FILE, ROOT } from './paths.mjs';

/** Сразу на диск (единственный канал при stdio: ignore у дочернего процесса). */
export function appendApplyChatLog(line, opts = {}) {
  const raw = String(line ?? '').trimEnd();
  if (!raw) return;
  const text = formatLogLine(raw, { withTime: opts.withTime !== false });
  const out = text.endsWith('\n') ? text : `${text}\n`;
  fs.mkdirSync(path.dirname(HH_APPLY_CHAT_LOG_FILE), { recursive: true });
  fs.appendFileSync(HH_APPLY_CHAT_LOG_FILE, out, 'utf8');
}

/** Заголовок запуска (батч / дашборд / CLI). */
export function appendApplyChatRunHeader(title, extra = '') {
  const tail = extra ? ` ${extra}` : '';
  appendApplyChatLog(`\n======== ${title} ${new Date().toISOString()}${tail} ========`, {
    withTime: false,
  });
}

function findLastRunStartIndex(lines) {
  let last = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^========/.test(lines[i])) last = i;
  }
  return last;
}

/**
 * @param {string} filePath
 * @param {number} lineCount
 * @param {{ lastRunOnly?: boolean }} opts
 */
export function readLogFileTail(filePath, lineCount, opts = {}) {
  const n = Math.min(500, Math.max(1, Number(lineCount) || 80));
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      exists: false,
      lines: [],
      text: '',
      path: filePath,
      relativePath: null,
      absolutePath: filePath,
      lastRunHeader: null,
      modifiedAt: null,
    };
  }
  const stat = fs.statSync(filePath);
  let all = fs.readFileSync(filePath, 'utf8').split('\n');
  const lastRunStart = findLastRunStartIndex(all);
  const lastRunHeader = all[lastRunStart]?.trim() || null;
  if (opts.lastRunOnly && lastRunHeader) {
    all = all.slice(lastRunStart);
  }
  const slice = all.length > n ? all.slice(-n) : all;
  const text = slice.join('\n');
  let relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('..')) relativePath = path.basename(filePath);
  return {
    exists: true,
    lines: slice,
    text,
    path: filePath,
    absolutePath: path.resolve(filePath),
    relativePath,
    lastRunHeader,
    modifiedAt: stat.mtime.toISOString(),
    sizeBytes: stat.size,
  };
}

export function readApplyChatLogTail(lineCount, opts = {}) {
  return readLogFileTail(HH_APPLY_CHAT_LOG_FILE, lineCount, opts);
}

export function readHarvestRunLogTail(lineCount, opts = {}) {
  return readLogFileTail(HARVEST_RUN_LOG_FILE, lineCount, opts);
}
