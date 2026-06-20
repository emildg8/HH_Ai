import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
/** Основная очередь (когда не задан HH_VACANCIES_QUEUE_FILE). */
export const DEFAULT_QUEUE_FILE = path.join(DATA_DIR, 'vacancies-queue.json');

/**
 * Активный файл очереди: `HH_VACANCIES_QUEUE_FILE` (относительно корня проекта или абсолютный), иначе основной.
 * Вызывать после loadEnv(), чтобы подхватить .env.
 */
export function getQueueFile() {
  const raw = (process.env.HH_VACANCIES_QUEUE_FILE || '').trim();
  if (raw) {
    return path.isAbsolute(raw) ? path.normalize(raw) : path.normalize(path.join(ROOT, raw));
  }
  return DEFAULT_QUEUE_FILE;
}

/** @deprecated Используйте getQueueFile(); оставлено для совместимости. */
export const QUEUE_FILE = DEFAULT_QUEUE_FILE;
/** Сигнал для UI: harvest дописал порцию записей (обновлять список). */
export const HARVEST_DASHBOARD_TICK_FILE = path.join(DATA_DIR, 'harvest-dashboard-tick.json');
export const HARVEST_PROGRESS_FILE = path.join(DATA_DIR, 'harvest-progress.json');
export const BATCH_PROGRESS_FILE = path.join(DATA_DIR, 'batch-progress.json');
export const BATCH_LAST_REPORT_FILE = path.join(DATA_DIR, 'batch-last-report.json');
export const APPLY_CHAT_PROGRESS_FILE = path.join(DATA_DIR, 'apply-chat-progress.json');
export const SKIPPED_FILE = path.join(DATA_DIR, 'skipped-vacancies.jsonl');
export const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.jsonl');
export const COVER_LETTER_USER_EDITS_FILE = path.join(DATA_DIR, 'cover-letter-user-edits.jsonl');
/** Пары вопрос–ответ после правок в дашборде — few-shot для генерации анкеты. */
export const QUESTIONNAIRE_USER_EDITS_FILE = path.join(DATA_DIR, 'questionnaire-user-edits.jsonl');
/** Лог сценария «Отклик в браузере» (Playwright), дописывается при каждом запуске. */
export const HH_APPLY_CHAT_LOG_FILE = path.join(DATA_DIR, 'hh-apply-chat.log');
export const HARVEST_RUN_LOG_FILE = path.join(DATA_DIR, 'harvest-run.log');
/** Кэш переписок и откликов с hh.ru (sync-hh-responses / sync-hh-chats). */
export const HH_NEGOTIATIONS_CACHE_FILE = path.join(DATA_DIR, 'hh-negotiations-cache.json');
/** Заметки по собеседованиям (импорт из внешней папки или ручное редактирование). */
export const INTERVIEW_NOTES_FILE = path.join(DATA_DIR, 'interview-notes.json');
/** Сгенерированные тексты «О себе» / опыт по вариантам резюме. */
export const RESUME_VARIANTS_DRAFTS_FILE = path.join(DATA_DIR, 'resume-variants-drafts.json');
export const PREFS_FILE = path.join(ROOT, 'config', 'preferences.json');
export const CV_DIR = path.join(ROOT, 'CV');

export function sessionProfilePath() {
  const SESSION_DIR = process.env.HH_SESSION_DIR
    ? path.resolve(process.cwd(), process.env.HH_SESSION_DIR)
    : path.join(ROOT, 'data', 'session');
  return path.join(SESSION_DIR, 'chromium-profile');
}

export {
  getDataRoot,
  knowledgeDbForProfile,
  KNOWLEDGE_DB_FILE,
  KNOWLEDGE_ARTIFACTS_DIR,
  KNOWLEDGE_EXPORTS_DIR,
  APPLY_INTELLIGENCE_LOG,
  KNOWLEDGE_REBUILD_LOCK,
  ensureKnowledgeDirs,
} from './data-root.mjs';
