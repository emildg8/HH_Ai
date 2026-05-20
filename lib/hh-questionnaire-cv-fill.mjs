/**
 * Черновики ответов анкеты из текста резюме (без LLM) — для блоков «стек / инструменты».
 */

const TOOL_ALIASES = [
  ['docker'],
  ['openshift', 'open shift'],
  ['kubernetes', 'k8s'],
  ['ansible'],
  ['terraform'],
  ['gitlab', 'gitlab ci'],
  ['jenkins', 'teamcity'],
  ['grafana'],
  ['kibana', 'elasticsearch', 'opensearch'],
  ['zabbix'],
  ['prometheus', 'victoria'],
  ['postgresql', 'postgres'],
  ['oracle'],
  ['mysql'],
  ['mongodb', 'mongo'],
  ['redis'],
  ['kafka'],
  ['nginx'],
  ['linux'],
  ['bash', 'shell'],
  ['python'],
  ['java'],
  ['sql'],
  ['vmware'],
  ['proxmox'],
  ['hyper-v', 'hyperv'],
  ['veeam'],
  ['minio'],
  ['vault', 'hashicorp'],
  ['consul'],
  ['jira'],
  ['confluence'],
  ['postman'],
  ['swagger'],
  ['camunda'],
  ['keycloak'],
  ['windows server'],
];

/** @type {Array<{ re: RegExp, pick: string[] }>} */
const LABEL_RULES = [
  {
    re: /виртуализац|контейнеризац/i,
    pick: ['docker', 'openshift', 'kubernetes', 'vmware', 'proxmox', 'hyper-v', 'linux'],
  },
  {
    re: /\*?nix|unix|linux\s+систем/i,
    pick: ['linux', 'bash', 'docker', 'gitlab', 'zabbix', 'grafana'],
  },
  { re: /\biac\b|ansible|terraform|инфраструктур.*код/i, pick: ['ansible', 'terraform', 'gitlab', 'bash'] },
  {
    re: /язык.*программ|фреймворк/i,
    pick: ['python', 'java', 'bash', 'sql', 'javascript'],
  },
  {
    re: /лог|logging|сбор.*лог|opensearch|kibana|elasticsearch/i,
    pick: ['kibana', 'elasticsearch', 'opensearch', 'grafana'],
  },
  {
    re: /мониторинг|prometheus|zabbix|victoria|alert/i,
    pick: ['grafana', 'zabbix', 'prometheus', 'victoria'],
  },
  {
    re: /ci\s*\/\s*cd|gitlab\s*ci|teamcity|jenkins|непрерывн.*интегр/i,
    pick: ['gitlab', 'teamcity', 'jenkins', 'docker', 'kubernetes', 'ansible'],
  },
  { re: /\bk8s\b|kubernetes|helm/i, pick: ['kubernetes', 'docker', 'gitlab', 'ansible'] },
  { re: /discovery|consul/i, pick: ['consul', 'vault', 'nginx'] },
  { re: /баз.*данн|sql|nosql|tarantool|mysql/i, pick: ['postgresql', 'oracle', 'sql', 'mongodb', 'redis', 'mysql'] },
  {
    re: /хранен.*данн|storage/i,
    pick: ['minio', 'veeam', 'postgresql', 'oracle', 'backup'],
  },
  {
    re: /другие\s+инструмент|прочие\s+инструмент|инструмент.*владе/i,
    pick: [
      'docker',
      'openshift',
      'ansible',
      'terraform',
      'grafana',
      'kibana',
      'zabbix',
      'postgresql',
      'gitlab',
      'jira',
      'bash',
      'linux',
    ],
  },
];

/**
 * @param {string} cvText
 * @returns {Set<string>}
 */
export function extractToolsFromCv(cvText) {
  const lower = String(cvText || '').toLowerCase();
  const found = new Set();
  for (const aliases of TOOL_ALIASES) {
    if (aliases.some((a) => lower.includes(a))) {
      found.add(aliases[0]);
    }
  }
  return found;
}

/**
 * @param {string[]} pickList
 * @param {Set<string>} fromCv
 */
function pickTools(pickList, fromCv) {
  const out = [];
  for (const name of pickList) {
    if (fromCv.has(name)) out.push(capitalizeTool(name));
  }
  return out;
}

function capitalizeTool(name) {
  const special = {
    postgresql: 'PostgreSQL',
    openshift: 'OpenShift',
    kubernetes: 'Kubernetes',
    gitlab: 'GitLab',
    teamcity: 'TeamCity',
    elasticsearch: 'Elasticsearch',
    opensearch: 'OpenSearch',
    mongodb: 'MongoDB',
    nginx: 'Nginx',
    linux: 'Linux',
    bash: 'Bash',
    python: 'Python',
    java: 'Java',
    sql: 'SQL',
    vmware: 'VMware',
    proxmox: 'Proxmox',
    veeam: 'Veeam',
    minio: 'MinIO',
    jira: 'Jira',
    confluence: 'Confluence',
    postman: 'Postman',
    camunda: 'Camunda',
    keycloak: 'Keycloak',
  };
  return special[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * @param {{ label: string }} question
 * @param {string} cvText
 * @returns {string}
 */
/**
 * @param {Set<string>} fromCv
 * @param {number} [max]
 */
function allToolsFromCv(fromCv, max = 14) {
  return [...fromCv].map(capitalizeTool).slice(0, max);
}

export function answerFromCvHeuristic(question, cvText) {
  const label = String(question?.label || '');
  const fromCv = extractToolsFromCv(cvText);

  for (const rule of LABEL_RULES) {
    if (!rule.re.test(label)) continue;
    const tools = pickTools(rule.pick, fromCv);
    if (tools.length) return tools.join(', ');
    const fallback = allToolsFromCv(fromCv, 10);
    if (fallback.length) return fallback.join(', ');
  }

  if (/нейросет|llm|machine\s*learning|искусственн/i.test(label)) {
    return 'В продакшене не использую; при необходимости быстро разберусь под задачи команды.';
  }

  if (/зарплат|ожидан|доход|salary/i.test(label)) {
    return 'Готов обсудить на собеседовании; ориентиры по рынку и задачам уточню лично.';
  }

  if (/опыт|компетенц|навык|стек|технолог/i.test(label)) {
    const tools = allToolsFromCv(fromCv, 12);
    if (tools.length) return tools.join(', ');
  }

  if (/опишите|расскажите|почему|мотивац|сопровод/i.test(label)) {
    const snippet = firstRelevantCvSnippet(cvText, 320);
    if (snippet) return snippet;
  }

  const any = allToolsFromCv(fromCv, 8);
  if (any.length && /инструмент|владе|использу/i.test(label)) {
    return any.join(', ');
  }

  return '';
}

function firstRelevantCvSnippet(cvText, maxLen) {
  const m = String(cvText || '').match(
    /перехожу в devops[^.]{0,200}|опыт[^.]{20,200}|стек[^.]{10,160}|docker[^.]{0,120}/i
  );
  if (!m) return '';
  return m[0].replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
