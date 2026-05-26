/**
 * Локальная оценка вакансии без LLM (ключевые слова DevOps + совпадение с CV).
 */

const DEVOPS_VACANCY_POS = [
  'devops',
  'sre',
  'site reliability',
  'platform engineer',
  'инженер devops',
  'devops-инженер',
  'платформ',
  'kubernetes',
  'k8s',
  'ci/cd',
  'cicd',
  'terraform',
  'ansible',
  'helm',
  'gitops',
  'инженер по эксплуатации',
  'инженер инфраструктуры',
  'технической поддержк',
  'technical support',
  'l2',
  '2 линия',
  'системный инженер',
  'service desk',
  'technical account',
  'tam',
];

const DEVOPS_VACANCY_NEG = [
  'senior only',
  'только senior',
  'architect',
  'team lead',
  'руководитель',
  '10+ лет',
  'golang разработчик',
  'java developer',
  'frontend',
  '1 линия',
  '1-я линия',
  'l1 support',
  'helpdesk',
];

const CV_SKILLS = [
  ['linux', 'Linux'],
  ['docker', 'Docker'],
  ['kubernetes', 'Kubernetes'],
  ['k8s', 'Kubernetes'],
  ['openshift', 'OpenShift'],
  ['grafana', 'Grafana'],
  ['kibana', 'Kibana'],
  ['zabbix', 'Zabbix'],
  ['postgresql', 'PostgreSQL'],
  ['oracle', 'Oracle'],
  ['sql', 'SQL'],
  ['git', 'Git'],
  ['ci/cd', 'CI/CD'],
  ['jenkins', 'CI/CD'],
  ['gitlab', 'GitLab CI'],
  ['terraform', 'Terraform'],
  ['ansible', 'Ansible'],
  ['bash', 'Bash'],
  ['prometheus', 'Prometheus'],
  ['jira', 'Jira'],
  ['confluence', 'Confluence'],
  ['postman', 'Postman'],
  ['vmware', 'VMware'],
  ['hyper-v', 'Hyper-V'],
  ['proxmox', 'Proxmox'],
  ['windows server', 'Windows Server'],
  ['active directory', 'AD'],
  ['мониторинг', 'мониторинг'],
  ['инцидент', 'инциденты'],
  ['релиз', 'релизы'],
  ['сбп', 'СБП'],
  ['банк', 'банковский опыт'],
];

function norm(s) {
  return String(s || '').toLowerCase();
}

function countHits(text, patterns) {
  let n = 0;
  for (const p of patterns) {
    if (text.includes(p)) n++;
  }
  return n;
}

function matchSkills(text) {
  const found = [];
  for (const [key, label] of CV_SKILLS) {
    if (text.includes(key)) found.push(label);
  }
  return [...new Set(found)];
}

/**
 * @returns {{ score: number, scoreVacancy: number, scoreCvMatch: number, scoreOverall: number, summary: string, risks: string, matchCv: string, tags: string[], providerModel: string, llmSource: string }}
 */
export function scoreVacancyLocally(vacancy, cvBundle) {
  const blob = norm(
    [vacancy.title, vacancy.company, vacancy.salaryRaw, vacancy.description].filter(Boolean).join('\n')
  );
  const cv = norm(cvBundle?.text || '');

  const posHits = countHits(blob, DEVOPS_VACANCY_POS);
  const negHits = countHits(blob, DEVOPS_VACANCY_NEG);
  const reqSkills = matchSkills(blob);
  const cvSkills = matchSkills(cv);

  let scoreVacancy = 35 + posHits * 9 - negHits * 12;
  if (posHits === 0) scoreVacancy = 25;
  scoreVacancy = Math.max(0, Math.min(100, scoreVacancy));

  const overlap = reqSkills.filter((s) => cvSkills.includes(s));
  const overlapRatio = reqSkills.length ? overlap.length / reqSkills.length : 0.5;
  let scoreCvMatch = Math.round(40 + overlapRatio * 45 + Math.min(15, cvSkills.length));
  if (!cv.trim()) scoreCvMatch = 0;
  scoreCvMatch = Math.max(0, Math.min(100, scoreCvMatch));

  const scoreOverall = Math.round(0.45 * scoreVacancy + 0.55 * scoreCvMatch);

  const summary =
    `Локальная оценка: DevOps-сигнал ${posHits}, риски ${negHits}. ` +
    `Совпадение стека: ${overlap.length}/${reqSkills.length || '?'}. ` +
    `Итог ${scoreOverall}/100.`;

  const risks =
    negHits > 0
      ? `В тексте есть маркеры несоответствия уровню/роли (${negHits}). Проверь требования вручную.`
      : reqSkills.length && overlap.length < reqSkills.length / 2
        ? `Часть стека вакансии (${reqSkills.slice(0, 5).join(', ')}) слабо отражена в резюме.`
        : 'Явных красных флагов по ключевым словам нет — сверь уровень junior+/middle.';

  return {
    score: scoreOverall,
    scoreVacancy,
    scoreCvMatch,
    scoreOverall,
    summary,
    risks,
    matchCv: scoreCvMatch >= 55 ? 'primary' : 'both',
    tags: [...reqSkills.slice(0, 6), 'local-score'],
    providerModel: 'local-heuristic',
    llmSource: 'local',
  };
}

export function resolveScoreMode() {
  const m = String(process.env.HH_SCORE_MODE || 'local-first').trim().toLowerCase();
  if (['local', 'local-only', 'heuristic'].includes(m)) return 'local';
  if (['llm', 'openrouter'].includes(m)) return 'llm';
  return 'local-first';
}
