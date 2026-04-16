import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const QUEUE_FILE = path.join(DATA_DIR, 'vacancies-queue.json');
/** Сигнал для UI: harvest дописал порцию записей (обновлять список). */
export const HARVEST_DASHBOARD_TICK_FILE = path.join(DATA_DIR, 'harvest-dashboard-tick.json');
export const SKIPPED_FILE = path.join(DATA_DIR, 'skipped-vacancies.jsonl');
export const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.jsonl');
export const COVER_LETTER_USER_EDITS_FILE = path.join(DATA_DIR, 'cover-letter-user-edits.jsonl');
/** Лог сценария «Отклик в браузере» (Playwright), дописывается при каждом запуске. */
export const HH_APPLY_CHAT_LOG_FILE = path.join(DATA_DIR, 'hh-apply-chat.log');
export const PREFS_FILE = path.join(ROOT, 'config', 'preferences.json');
export const CV_DIR = path.join(ROOT, 'CV');

export function sessionProfilePath() {
  const SESSION_DIR = process.env.HH_SESSION_DIR
    ? path.resolve(process.cwd(), process.env.HH_SESSION_DIR)
    : path.join(ROOT, 'data', 'session');
  return path.join(SESSION_DIR, 'chromium-profile');
}
