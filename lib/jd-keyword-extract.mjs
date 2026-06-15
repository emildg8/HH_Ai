/**
 * Извлечение ключевых навыков из описания вакансии.
 */

const SKILL_PATTERNS = [
  ['kubernetes', 'Kubernetes'],
  ['k8s', 'Kubernetes'],
  ['docker', 'Docker'],
  ['linux', 'Linux'],
  ['ansible', 'Ansible'],
  ['terraform', 'Terraform'],
  ['gitlab', 'GitLab CI'],
  ['jenkins', 'Jenkins'],
  ['grafana', 'Grafana'],
  ['prometheus', 'Prometheus'],
  ['zabbix', 'Zabbix'],
  ['helm', 'Helm'],
  ['openshift', 'OpenShift'],
  ['postgresql', 'PostgreSQL'],
  ['ci/cd', 'CI/CD'],
  ['devops', 'DevOps'],
  ['sre', 'SRE'],
  ['мониторинг', 'мониторинг'],
  ['bash', 'Bash'],
  ['python', 'Python'],
  ['kafka', 'Kafka'],
  ['redis', 'Redis'],
];

const MUST_HINTS =
  /обязательн|требуем|необходим|must have|required|опыт работы с|уверенн\w+ владение|от\s+\d+\s+лет/i;

/**
 * @param {object} vacancy
 */
export function vacancyTextBlob(vacancy) {
  return [
    vacancy?.title,
    vacancy?.company,
    vacancy?.salaryRaw,
    vacancy?.descriptionForLlm,
    vacancy?.descriptionPreview,
    vacancy?.description,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {string} blob
 */
export function extractSkillsFromBlob(blob) {
  const low = String(blob || '').toLowerCase();
  const found = [];
  for (const [key, label] of SKILL_PATTERNS) {
    if (low.includes(key) && !found.includes(label)) found.push(label);
  }
  return found;
}

/**
 * @param {object} vacancy
 */
export function extractJdKeywords(vacancy) {
  const blob = vacancyTextBlob(vacancy);
  const all = extractSkillsFromBlob(blob);
  const lines = blob.split(/\n+/);
  const mustHave = [];
  for (const line of lines) {
    if (!MUST_HINTS.test(line)) continue;
    for (const skill of extractSkillsFromBlob(line)) {
      if (!mustHave.includes(skill)) mustHave.push(skill);
    }
  }
  const must = mustHave.length ? mustHave : all.slice(0, 6);
  const niceToHave = all.filter((s) => !must.includes(s));
  return { mustHave: must, niceToHave, all };
}

export const extractMustHaveSkills = extractJdKeywords;
