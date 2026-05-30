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

  if (/нецелевая|нет IT-профиля/i.test(m)) {
    return m.match(/нецелевая[^:]*:?(.+)/i)?.[1]?.trim() || 'нецелевая вакансия';
  }

  if (/мастер hh\.ru|кем вы хотите работать|мастер профиля/i.test(m)) {
    return 'мастер профиля hh.ru';
  }

  if (/таймаут открытия формы отклика/i.test(m)) {
    return 'форма отклика не открылась (55 с)';
  }

  if (/таймаут мастера отклика/i.test(m)) {
    return 'мастер отклика (120 с)';
  }

  if (/мастер не дошёл до кнопки/i.test(m) && /не выбрано резюме/i.test(m)) {
    return 'форма не закрылась после «Откликнуться» (резюме могло быть выбрано)';
  }

  if (/мастер не дошёл|кнопки «отправить»/i.test(m)) {
    if (/резюме/i.test(m)) {
      const title = (process.env.HH_PROFILE_RESUME_TITLE || 'DevOps').trim();
      return `не выбрано резюме «${title}»`;
    }
    return 'форма отклика не завершена';
  }

  if (/приглашение на hh\.ru/i.test(m)) return 'приглашение на hh.ru';
  if (/отказ на hh\.ru/i.test(m)) return 'отказ на hh.ru';
  if (/уже отклик на hh\.ru/i.test(m)) return 'уже отклик на hh.ru';

  if (/уже отклик|приглашение на hh|already-submitted/i.test(m)) {
    return 'уже отклик или приглашение на hh.ru';
  }

  if (/нет в списке hh\.ru|недоступно для этой вакансии|notInEmployerList/i.test(m)) {
    return 'нужное резюме не в списке работодателя на hh.ru';
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
