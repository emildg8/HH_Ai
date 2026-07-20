/**
 * Фильтр списка «к отклику» (pain-wave1): не весь pending, а разбор к ship.
 */

/**
 * Карточка в режиме toApply: активный статус + письмо approved (путь к ship).
 * @param {object} item
 */
export function itemPassesToApplyFilter(item) {
  if (!item) return false;
  const status = String(item.status || '');
  if (status === 'skipped' || status === 'rejected' || status === 'responded') return false;
  if (status !== 'pending' && status !== 'approved') return false;
  if (item.hhApply?.responseSubmitted) return false;
  const site = String(item.hhApply?.hhSiteState || '').toLowerCase();
  if (site === 'already_applied' || site === 'applied_on_hh' || site === 'declined') return false;
  const letterOk =
    String(item.coverLetter?.status || '') === 'approved' ||
    Boolean(String(item.coverLetter?.approvedText || '').trim());
  return letterOk;
}
