/**
 * Базовая проверка качества сопроводительного перед авто-откликом.
 */

const PLACEHOLDER_RE =
  /\b(?:todo|заполнит[еь]|вставьт[еь]|текст\s+письма|your\s+name|company\s+name|название\s+компании)\b|[{[]\s*(?:company|name|vacancy|role)\s*[}\]]|\{\{\s*ROLE\s*\}\}/i;

/** @type {Record<string, RegExp>} */
export const ROLE_KEYWORDS = {
  devops: /\bdevops\b|\bsre\b|kubernetes|k8s|docker|linux|terraform|ansible|grafana|ci\/cd|инфраструктур/i,
  support: /поддержк|helpdesk|service\s*desk|sla|инцидент|\bl2\b|\bl3\b|эксплуатац/i,
  data: /data\s*engineer|etl|dwh|big\s*data|airflow|clickhouse|пайплайн|аналитическ/i,
  tam: /technical\s+account|tam|клиент|сопровождени/i,
  dba: /\bdba\b|mongodb|postgres|oracle|баз\s+данн|администратор\s+бд/i,
  platform: /platform|openshift|kubernetes|\bk8s\b/i,
};

const GENERIC_ONLY_RE =
  /^(?:здравствуйте|добрый\s+день)[!.]?\s*(?:откликаюсь|готов\s+обсудить|интересует\s+ваканси)/i;

/**
 * @param {string} role
 * @returns {RegExp|undefined}
 */
export function getRoleKeywordPattern(role) {
  return ROLE_KEYWORDS[String(role || '').toLowerCase()];
}

/**
 * @param {object} rec
 * @param {string} letter
 * @param {string} resumeRole
 * @param {object} [prefs]
 */
export function assessLetterQuality(rec, letter, resumeRole, prefs = {}) {
  const text = String(letter || '').replace(/\s+/g, ' ').trim();
  const minLen = Number(prefs.batchLetterMinLength || 90);
  const maxLen = Number(prefs.batchLetterMaxLength || 2600);
  const requireRoleKeywords = prefs.batchLetterRequireRoleKeywords !== false;
  const requireMetric = prefs.batchLetterRequireMetric === true;

  if (!text) return { pass: false, reason: 'письмо пустое', score: 0 };
  if (text.length < minLen) {
    return { pass: false, reason: `письмо слишком короткое (${text.length} < ${minLen})`, score: 0 };
  }
  if (text.length > maxLen) {
    return { pass: false, reason: `письмо слишком длинное (${text.length} > ${maxLen})`, score: 0 };
  }
  if (PLACEHOLDER_RE.test(text)) {
    return { pass: false, reason: 'письмо содержит плейсхолдер/черновик', score: 0 };
  }

  let score = 0;
  if (/\d/.test(text)) score += 2;
  if (text.length >= 280) score += 1;
  if (/\b(отклик|позици|ваканси|готов|интересн)\b/i.test(text)) score += 1;

  if (requireMetric && !/\d/.test(text)) {
    return { pass: false, reason: 'нет цифр/метрик из опыта', score };
  }

  if (requireRoleKeywords) {
    const roleRe = getRoleKeywordPattern(resumeRole);
    if (roleRe && !roleRe.test(text)) {
      const titleBlob = [
        rec?.title,
        rec?.geminiSummary,
        ...(Array.isArray(rec?.geminiTags) ? rec.geminiTags : []),
      ]
        .filter(Boolean)
        .join(' ');
      if (roleRe.test(titleBlob)) {
        return { pass: false, reason: 'письмо не отражает профиль роли вакансии', score };
      }
    }
  }

  if (
    GENERIC_ONLY_RE.test(text) &&
    text.length < 200 &&
    !/\b(linux|docker|kubernetes|devops|sql|инцидент|etl|поддержк|\d)\b/i.test(text)
  ) {
    return { pass: false, reason: 'слишком общее письмо без фактов', score };
  }

  return { pass: true, reason: 'ok', score };
}
