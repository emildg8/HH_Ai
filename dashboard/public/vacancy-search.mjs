/**
 * Текст для поиска по карточке вакансии (дашборд).
 */

const RESUME_ROLE_LABELS = {
  devops: 'DevOps SRE инженер',
  data: 'Data Engineer дата',
  support: 'Поддержка L2 L3 helpdesk',
  support_lead: 'Руководитель поддержки',
  tam: 'TAM Technical Account Manager',
};

/**
 * @param {unknown} v
 */
function pushPart(parts, v) {
  if (v == null || v === '') return;
  parts.push(String(v));
}

/**
 * @param {object} item
 * @returns {string} lowercase blob for .includes()
 */
export function buildVacancySearchText(item) {
  const parts = [];
  pushPart(parts, item?.title);
  pushPart(parts, item?.company);
  pushPart(parts, item?.searchQuery);
  pushPart(parts, item?.geminiSummary);
  pushPart(parts, item?.descriptionPreview);
  pushPart(parts, item?.descriptionForLlm);
  pushPart(parts, item?.url);

  if (Array.isArray(item?.geminiTags)) {
    pushPart(parts, item.geminiTags.join(' '));
  }

  const h = item?.hhApply || {};
  pushPart(parts, h.profileResume);
  pushPart(parts, h.resumeTitleSelected);
  pushPart(parts, h.resumeRole);
  pushPart(parts, h.resumeTarget?.label);
  pushPart(parts, h.resumeTarget?.title);
  pushPart(parts, h.resumeTarget?.role);
  pushPart(parts, h.negotiationStatusRaw);
  pushPart(parts, h.letterPreview);
  pushPart(parts, h.chatReplyDraft?.reply);

  const role = h.resumeRole || item?.resumeRole;
  if (role && RESUME_ROLE_LABELS[role]) pushPart(parts, RESUME_ROLE_LABELS[role]);

  const cl = item?.coverLetter;
  pushPart(parts, cl?.approvedText);
  if (Array.isArray(cl?.variants)) {
    for (const v of cl.variants) {
      if (typeof v === 'string') pushPart(parts, v);
      else pushPart(parts, v?.text);
    }
  }

  const msgs = h.chatMessages;
  if (Array.isArray(msgs)) {
    for (const m of msgs) {
      pushPart(parts, m?.text);
      pushPart(parts, m?.body);
    }
  }

  return parts.join('\n').toLowerCase();
}

/**
 * @param {object} item
 * @param {string} query trimmed lowercase query
 */
export function vacancyMatchesSearch(item, query) {
  if (!query) return true;
  return buildVacancySearchText(item).includes(query.toLowerCase());
}
