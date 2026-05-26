/**
 * Классификация заголовка вакансии: целевые роли vs жёсткий отсев.
 */

/** DevOps / SRE / платформа (не «главный»). */
export function titleLooksDevOpsRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (isClearlyOverqualifiedTitle(title)) return false;
  return (
    /\bdevops\b|\bdev\s*ops\b|\bsre\b|site reliability|platform engineer|платформенн|инженер инфраструктуры|инженер по эксплуатации|mlops|devsecops|инженер open.?shift|контейнерн.*платформ/i.test(
      t
    )
  );
}

/** Техподдержка L2/L3, системный инженер поддержки, TAM. */
export function titleLooksSupportRole(title) {
  const t = String(title || '').toLowerCase();
  if (!t.trim()) return false;
  if (/продавец|кассир|мерчендайз|оператор call-?center|колл-?центр.*оператор/i.test(t)) {
    return false;
  }
  return (
    /технич\w*\s+поддерж|technical support|service\s*desk|help\s*desk|helpdesk|l2|l3|2\s*линия|3\s*линия|2\s*лини[яи]|3\s*лини[яи]|линия\s*l2|линия\s*l3|инженер\s+поддерж|специалист\s+поддерж|руководитель.*поддерж|координатор.*поддерж|консультант.*поддерж|сервис[\s-]*менеджер|системный\s+инженер|прикладн\w*\s+администратор|account\s+manager|technical\s+account|\btam\b/i.test(
      t
    )
  );
}

export function titleLooksTamRole(title) {
  const t = String(title || '').toLowerCase();
  return /technical\s+account|\btam\b|технический\s+аккаунт|менеджер\s+по\s+работе\s+с\s+клиент/i.test(t);
}

/** Целевой профиль пользователя (DevOps junior+/middle или поддержка L2+). */
export function titleLooksTargetRole(title) {
  return titleLooksDevOpsRole(title) || titleLooksSupportRole(title) || titleLooksTamRole(title);
}

/** Главный / Chief / Principal / Head — выше уровня пользователя. */
export function isClearlyOverqualifiedTitle(title) {
  const t = String(title || '');
  if (!t.trim()) return false;
  if (/\b(главный|chief|principal|head\s+of|директор|cto|cio)\b/i.test(t)) return true;
  if (/\b(ведущий|старший)\s+(devops|sre)\b/i.test(t.toLowerCase())) return true;
  if (/\b(lead|tech\s*lead|team\s*lead)\s+(devops|sre|platform)\b/i.test(t.toLowerCase())) return true;
  if (/\b(devops|sre)\s+(lead|architect)\b/i.test(t.toLowerCase())) return true;
  return false;
}

/** Senior в названии DevOps/SRE (не поддержка L2). */
export function titleLooksSeniorDevOpsTitle(title) {
  if (titleLooksSupportRole(title) && !titleLooksDevOpsRole(title)) {
    if (/l2|l3|2\s*линия|3\s*линия|руководитель.*поддерж|ведущий.*поддерж/i.test(String(title || '').toLowerCase())) {
      return false;
    }
  }
  const t = String(title || '').toLowerCase();
  return (
    /\bsenior\b|\bсеньор\b|\bсеньёр\b|middle\s*\/\s*senior|senior\s*\/\s*middle/i.test(t) &&
    (/\bdevops\b|\bsre\b|platform/i.test(t) || titleLooksDevOpsRole(title))
  );
}

/**
 * Только 1-я линия / L1 (L2/L3 в названии — не считаем).
 * @param {string} text
 */
export function textMentionsFirstSupportLineOnly(text) {
  const t = String(text || '');
  const low = t.toLowerCase();
  if (/l2|l3|2\s*линия|3\s*линия|2\s*лини[яи]|3\s*лини[яи]|вторая\s+линия|третья\s+линия/i.test(low)) {
    return false;
  }
  if (/(?<![0-9])1\s*[-–]?\s*линия/i.test(t)) return true;
  if (/1\s*[-–]я\s+линия/i.test(t)) return true;
  if (/первая\s+линия/i.test(low)) return true;
  if (/(?<![0-9])1\s*[-–]?\s*линии/i.test(t)) return true;
  if (/линия\s*l1/i.test(low) || /поддержки\s+l1/i.test(low) || /l1\s*[-/]\s*лини/i.test(low)) {
    return true;
  }
  if (
    /(^|[^a-z0-9])l1([^a-z0-9]|$)/i.test(t) &&
    /поддержк|технич\.\s*поддерж|help\s*desk|service\s*desk/i.test(low)
  ) {
    return true;
  }
  return false;
}

/** Продавец, кассир и т.п. — не IT. */
export function titleLooksNonItRole(title) {
  const t = String(title || '').toLowerCase();
  return /продавец|кассир|мерчендайз|охранник|водитель|курьер|официант|бариста|уборщик/i.test(t);
}
