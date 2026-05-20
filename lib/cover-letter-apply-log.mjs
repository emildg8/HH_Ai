/**
 * Логирование сопроводительного при отклике (журнал дашборда).
 */

/**
 * @param {string} text
 * @param {number} [maxLen]
 */
export function formatCoverLetterPreview(text, maxLen = 96) {
  const t = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '(пусто)';
  const n = Number.isFinite(maxLen) ? maxLen : 96;
  if (t.length <= n) return `«${t}»`;
  return `«${t.slice(0, n)}…» (${t.length} симв.)`;
}

/**
 * @param {(msg: string) => void} log
 * @param {string} letter
 */
export function logCoverLetterPrepared(log, letter) {
  const t = String(letter || '').trim();
  if (!t) {
    log('[hh-apply-chat] Сопроводительное: не задано');
    return;
  }
  log(`[hh-apply-chat] Сопроводительное (${t.length} симв.): ${formatCoverLetterPreview(t)}`);
}

/**
 * @param {(msg: string) => void} log
 * @param {{ letter?: string, letterFilledInForm?: boolean, chatSent?: boolean, channel?: string, verifiedInChat?: boolean }} r
 */
export function logCoverLetterOutcome(log, r) {
  const preview = r.letter ? formatCoverLetterPreview(r.letter, 72) : '';
  if (r.verifiedInChat) {
    log(
      `[hh-apply-chat] ✓ Письмо в переписке на hh.ru подтверждено${r.channel ? ` (${r.channel})` : ''}${preview ? `: ${preview}` : ''}`
    );
    return;
  }
  if (r.letterFilledInForm) {
    log(`[hh-apply-chat] ✓ Письмо в форме отклика${preview ? `: ${preview}` : ''}`);
    return;
  }
  if (r.chatSent) {
    log(`[hh-apply-chat] ✓ Письмо отправлено в чат${r.channel ? ` (${r.channel})` : ''}${preview ? `: ${preview}` : ''}`);
    return;
  }
  if (r.letter) {
    log(`[hh-apply-chat] ✗ Сопроводительное не доставлено автоматически${preview ? ` (черновик: ${preview})` : ''}`);
  }
}
