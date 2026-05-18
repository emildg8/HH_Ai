/** Паттерны исключения для публичного экспорта / бэкапа «только код». */

export const PUBLIC_EXPORT_IGNORE = [
  'node_modules',
  '.git',
  '.playwright-browsers',
  'playwright-report',
  'test-results',
  '.env',
  'config/secrets.local.env',
  'config/devops.env',
  'config/cover-letter.txt',
  'config/cover-letter-style-examples.txt',
  'data/session',
  'CV',
  'backups',
  'releases',
  'dist',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
  '*.pdf',
  'data/hh-apply-chat-error-',
  'data/hh-apply-launches.json',
];

/**
 * @param {string} rel — путь относительно корня, с /
 */
export function shouldIgnoreExport(rel) {
  const n = rel.replace(/\\/g, '/');
  for (const pat of PUBLIC_EXPORT_IGNORE) {
    if (pat.includes('*')) {
      const re = new RegExp(`^${pat.replace(/\*/g, '.*')}$`);
      if (re.test(n) || n.includes(pat.replace(/\*/g, ''))) return true;
    } else if (n === pat || n.startsWith(`${pat}/`) || n.endsWith(`/${pat}`)) {
      return true;
    }
  }
  if (/config\/profiles\/[^/]+\.env$/.test(n) && !n.endsWith('.example.env')) return true;
  if (n === 'data/vacancies-devops.json') return true;
  if (n === 'data/vacancies-queue.json') return true;
  if (/^data\/.*\.jsonl$/.test(n)) return true;
  if (/^data\/.*\.json$/.test(n) && !n.endsWith('.example.json')) return true;
  return false;
}
