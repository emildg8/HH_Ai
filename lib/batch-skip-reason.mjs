/**
 * Причины пропуска вакансии в батче — строка в журнале для парсинга родителем.
 */

import { appendApplyChatLog } from './apply-chat-log.mjs';

export const BATCH_SKIP_TAG = '[hh-apply-batch-skip]';

/**
 * @param {string} reason — короткая причина без префикса (рус.)
 */
export function logBatchSkipReason(reason) {
  const text = String(reason || '').trim();
  if (!text) return;
  const line = `${BATCH_SKIP_TAG} ${text}`;
  console.log(line);
  appendApplyChatLog(line, { withTime: true });
}

/**
 * @param {string} line
 */
export function parseBatchSkipReasonFromLine(line) {
  const m = String(line || '').match(/\[hh-apply-batch-skip\]\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * @param {string[]} lines — последние строки stdout/stderr дочернего процесса
 * @returns {string | null}
 */
export function findBatchSkipReasonInLines(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const r = parseBatchSkipReasonFromLine(lines[i]);
    if (r) return r;
  }
  return null;
}

/**
 * Краткая причина по тексту ошибки / коду выхода (fallback, если нет BATCH_SKIP_TAG).
 * @param {string} raw
 * @param {number} [exitCode]
 */
export function formatApplySkipReasonFromText(raw, exitCode) {
  const m = String(raw || '');
  const fromTag = parseBatchSkipReasonFromLine(m);
  if (fromTag) return fromTag;

  const resumeM = m.match(/не выбрано резюме\s*«([^»]+)»/i);
  if (resumeM) return `не выбрано резюме «${resumeM[1]}»`;

  const wrongResumeM = m.match(/в форме резюме\s*«[^»]+»,\s*нужно\s*«([^»]+)»/i);
  if (wrongResumeM) return `не выбрано резюме «${wrongResumeM[1]}»`;

  if (/резюме не переключилось/i.test(m)) {
    const title = (process.env.HH_PROFILE_RESUME_TITLE || 'DevOps').trim();
    return `не выбрано резюме «${title}»`;
  }

  if (/анкета работодателя|BATCH:\s*анкета|questionnaire/i.test(m)) {
    const qm = m.match(/(\d+)\s+вопр/i);
    if (qm) return `анкета: ${qm[1]} вопр.`;
    return 'анкета работодателя';
  }

  if (/мастер не дошёл|кнопки «отправить»/i.test(m)) {
    if (/резюме/i.test(m)) {
      const title = (process.env.HH_PROFILE_RESUME_TITLE || 'DevOps').trim();
      return `не выбрано резюме «${title}»`;
    }
    return 'форма отклика не завершена';
  }

  if (/отклик недоступен|в архиве|снята с публикации/i.test(m)) {
    return 'вакансия недоступна для отклика';
  }

  if (/не удалось открыть форму отклика|кнопка «откликнуться»|не найдена кнопка/i.test(m)) {
    return 'не открылась форма отклика';
  }

  if (/редирект на логин|npm run login/i.test(m)) {
    return 'нужен вход на hh.ru (npm run login)';
  }

  if (/капч|hh-captcha/i.test(m)) {
    return 'капча / проверка на hh.ru';
  }

  if (exitCode === 5) return 'анкета работодателя';

  if (/hh-apply-chat exit (\d+)/i.test(m)) {
    const code = m.match(/exit (\d+)/i)?.[1];
    return code === '5' ? 'анкета работодателя' : `ошибка отклика (код ${code})`;
  }

  const short = m.replace(/^Error:\s*/i, '').trim();
  if (short.length > 0 && short.length <= 120) return short;
  if (short.length > 120) return `${short.slice(0, 117)}…`;

  if (exitCode && exitCode !== 0) return `ошибка отклика (код ${exitCode})`;
  return null;
}
