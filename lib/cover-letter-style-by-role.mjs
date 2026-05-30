import { loadQueue } from './store.mjs';

/** @type {Record<string, RegExp[]>} */
const ROLE_BUCKETS = {
  sre: [/sre\b/i, /site reliability/i, /надёжност/i, /observability/i],
  dba: [/\bdba\b/i, /postgresql/i, /mysql/i, /oracle/i, /баз данных/i],
  platform: [/platform/i, /kubernetes/i, /\bk8s\b/i, /openshift/i, /платформ/i],
  devops: [/devops/i, /dev\s*ops/i, /ci\s*\/\s*cd/i, /terraform/i, /ansible/i],
  support: [/\bl2\b/i, /\bl3\b/i, /support/i, /поддерж/i, /helpdesk/i, /service desk/i],
};

/**
 * @param {object} record
 * @returns {string}
 */
export function inferVacancyRoleBucket(record) {
  const blob = [
    record?.title || '',
    ...(Array.isArray(record?.geminiTags) ? record.geminiTags : []),
    record?.geminiSummary || '',
  ]
    .join(' ')
    .toLowerCase();
  for (const [bucket, patterns] of Object.entries(ROLE_BUCKETS)) {
    if (patterns.some((re) => re.test(blob))) return bucket;
  }
  return 'devops';
}

/**
 * @param {object} record
 * @param {string} bucket
 */
function recordMatchesRoleBucket(record, bucket) {
  return inferVacancyRoleBucket(record) === bucket;
}

/**
 * Утверждённые письма с той же ролью (по geminiTags / заголовку).
 * @param {object} record
 * @param {{ maxItems?: number }} [opts]
 * @returns {string[]}
 */
export function loadStyleExamplesByRole(record, opts = {}) {
  const maxItems = Math.max(1, Math.min(6, Number(opts.maxItems) || 3));
  const bucket = inferVacancyRoleBucket(record);
  const q = loadQueue();
  const matched = q.filter(
    (x) =>
      x.coverLetter?.status === 'approved' &&
      String(x.coverLetter?.approvedText || '').trim().length > 80 &&
      recordMatchesRoleBucket(x, bucket)
  );
  matched.sort((a, b) => {
    const ta = new Date(a.coverLetter?.updatedAt || a.updatedAt || 0).getTime();
    const tb = new Date(b.coverLetter?.updatedAt || b.updatedAt || 0).getTime();
    return tb - ta;
  });
  return matched.slice(0, maxItems).map((x) => {
    const title = String(x.title || '').slice(0, 55);
    return `[Эталон для роли «${bucket}»: «${title}»]\n${String(x.coverLetter.approvedText).trim()}`;
  });
}
