/**
 * Черновики ответов анкеты из текста резюме (без LLM).
 */

import {
  isCodingQuestionnaireQuestion,
  isBehavioralAmbiguousQuestion,
  isRoleInterestQuestionLabel,
  answerCodingQuestionnaire,
  answerBehavioralAmbiguousTask,
  answerRoleInterestTextarea,
} from './questionnaire-special-answers.mjs';

const ML_LIB_ALIASES = [
  ['pandas'],
  ['numpy'],
  ['scikit', 'sklearn'],
  ['pytorch'],
  ['tensorflow'],
  ['keras'],
  ['matplotlib'],
  ['seaborn'],
  ['jupyter'],
  ['spark'],
  ['airflow'],
];

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
  ...ML_LIB_ALIASES,
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
 * @param {string} title
 * @param {string} [description]
 */
export function inferVacancyFocus(title, description = '') {
  const t = `${title} ${description}`.toLowerCase();
  if (/ml-инжен|machine learning|машинн.*обуч|data scientist|нейросет/i.test(t)) return 'ml';
  if (
    /\bsdet\b|test engineer|engineer in test|тестиров|quality\s*&|quality and|автотест|qa engineer/i.test(
      t
    )
  ) {
    return 'qa';
  }
  if (/devops|sre|эксплуатац|инфраструктур|observability/i.test(t)) return 'devops';
  if (/appsec|безопасн|security/i.test(t)) return 'security';
  if (/\bqa\b/i.test(t)) return 'qa';
  return 'general';
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
    pandas: 'pandas',
    numpy: 'NumPy',
    scikit: 'scikit-learn',
    pytorch: 'PyTorch',
    tensorflow: 'TensorFlow',
    keras: 'Keras',
    matplotlib: 'matplotlib',
    seaborn: 'seaborn',
    jupyter: 'Jupyter',
    spark: 'Apache Spark',
    airflow: 'Airflow',
  };
  return special[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * @param {Set<string>} fromCv
 * @param {number} [max]
 */
function allToolsFromCv(fromCv, max = 14) {
  return [...fromCv].map(capitalizeTool).slice(0, max);
}

function pickMlLibsFromCv(fromCv) {
  const order = ['pandas', 'numpy', 'scikit', 'pytorch', 'tensorflow', 'keras', 'matplotlib', 'jupyter', 'spark'];
  return pickTools(order, fromCv);
}

function firstRelevantCvSnippet(cvText, maxLen, focus = 'general') {
  const patterns =
    focus === 'ml'
      ? [
          /перехожу[^.]{0,120}/i,
          /цел[^.]{0,80}ml[^.]{0,80}/i,
          /python[^.]{0,120}/i,
          /опыт[^.]{20,200}/i,
        ]
      : [/перехожу в devops[^.]{0,200}|опыт[^.]{20,200}|стек[^.]{10,160}|docker[^.]{0,120}/i];
  for (const re of patterns) {
    const m = String(cvText || '').match(re);
    if (m) return m[0].replace(/\s+/g, ' ').trim().slice(0, maxLen);
  }
  return '';
}

function answerJobSearchReason(cvText, focus) {
  if (focus === 'qa') {
    return (
      'Ищу роль в тестировании/качестве (SDET): хочу совместить автоматизацию, проверку требований и ' +
      'наблюдаемость продукта; готов углублять Python/pytest и доменную логику под вашу команду.'
    );
  }
  if (focus === 'ml') {
    return (
      'Ищу роль ML-инженера, где смогу совместить опыт эксплуатации, данных и автоматизации ' +
      'с развитием в машинном обучении; готов быстро закрыть пробелы по ML-стеку под задачи команды.'
    );
  }
  const snippet = firstRelevantCvSnippet(cvText, 280, focus);
  if (snippet && /перехожу|ищу|цел/i.test(snippet)) {
    return snippet.endsWith('.') ? snippet : `${snippet}.`;
  }
  return (
    'Ищу роль DevOps/SRE с фокусом на стабильность, observability и автоматизацию — ' +
    'хочу применить накопленный опыт инфраструктуры в продуктовой команде.'
  );
}

function answerMlProjectsQuestion(cvText, focus) {
  const snippet = firstRelevantCvSnippet(cvText, 400, focus);
  if (focus === 'ml') {
    const base =
      'Прямых production ML-моделей в резюме нет; ближе всего опыт построения observability, CI/CD и автоматизации ' +
      '(контейнеры, мониторинг, пайплайны). В ML-проектах вижу себя на стыке MLOps/данных: надёжные пайплайны, метрики, деплой.';
    if (snippet && !/перехожу|docker, openshift/i.test(snippet)) {
      return `${base} Пример: ${snippet}`;
    }
    return base;
  }
  if (snippet) return snippet.endsWith('.') ? snippet : `${snippet}.`;
  return (
    'Ключевые проекты — эксплуатация и развитие инфраструктуры: мониторинг, CI/CD, контейнеризация, ' +
    'автоматизация рутины; детали — в резюме и сопроводительном письме.'
  );
}

function answerPythonLevelQuestion(label, cvText, focus) {
  const fromCv = extractToolsFromCv(cvText);
  const mlLibs = pickMlLibsFromCv(fromCv);
  const hasPython = fromCv.has('python');

  if (/библиотек|pandas|numpy|sklearn|машинн/i.test(label)) {
    if (mlLibs.length) {
      return `Python — рабочий уровень; из ML/аналитики в практике: ${mlLibs.join(', ')}.`;
    }
    if (hasPython) {
      if (focus === 'ml') {
        return (
          'Python — уверенный уровень для скриптов и автоматизации (Ansible, утилиты, разбор логов); ' +
          'ML-библиотеки (pandas, scikit-learn) подтягиваю под задачи — готов углубить под ваш стек.'
        );
      }
      return 'Python — для автоматизации и скриптов в инфраструктуре; SQL и bash — ежедневно.';
    }
    return 'Python базово; основной профиль — инфраструктура и эксплуатация, готов развивать ML-стек под роль.';
  }

  if (hasPython) {
    return focus === 'ml'
      ? 'Python — уверенно для скриптов и данных; ML-библиотеки осваиваю целенаправленно под вакансию.'
      : 'Python — скрипты автоматизации и интеграции; в проде чаще bash, Ansible, SQL.';
  }
  return '';
}

/**
 * @param {{ label: string }} question
 * @param {string} cvText
 * @param {{ vacancyTitle?: string, description?: string, focus?: string }} [ctx]
 * @returns {string}
 */
export function answerFromCvHeuristic(question, cvText, ctx = {}) {
  const label = String(question?.label || '');
  const fromCv = extractToolsFromCv(cvText);
  const focus =
    ctx.focus || inferVacancyFocus(ctx.vacancyTitle || '', ctx.description || '');

  if (/зарплат|ожидан|доход|salary/i.test(label)) {
    return 'Готов обсудить на собеседовании; ориентиры по рынку и задачам уточню лично.';
  }

  if (/уровень\s+английск|english\s+level|владение\s+английск/i.test(label)) {
    return 'Средний (B1–B2): читаю документацию, переписка и созвоны по работе.';
  }

  if (/гражданств|citizenship/i.test(label)) {
    return 'РФ';
  }

  if (/тестов.*задан|готов.*тестов|выполн.*тестов/i.test(label)) {
    return 'Да';
  }

  if (/город\s+прожив|место\s+прожив|локаци.*прожив|city/i.test(label) && !/удален|remote/i.test(label)) {
    return 'Москва';
  }

  if (/промт[\s-]?инжиниринг/i.test(label)) {
    return 'Да';
  }

  if (/пользуетесь\s+ли\s+вы\s+llm|используете\s+llm/i.test(label)) {
    return 'Постоянно';
  }

  if (/причин.*поиск|смен.*мест|почему.*ищ|ищете.*работ|мотивац.*смен/i.test(label)) {
    return answerJobSearchReason(cvText, focus);
  }

  if (/python|питон/i.test(label)) {
    const py = answerPythonLevelQuestion(label, cvText, focus);
    if (py) return py;
  }

  if (
    /успешн.*проект|проект.*\bml\b|машинн.*обуч|роль.*реализ|расскажите.*проект/i.test(label) ||
    (/расскажите|опишите/i.test(label) && /проект|ml|машинн/i.test(label))
  ) {
    return answerMlProjectsQuestion(cvText, focus);
  }

  if (isCodingQuestionnaireQuestion(label)) {
    return answerCodingQuestionnaire(label, focus);
  }

  if (isBehavioralAmbiguousQuestion(label)) {
    return answerBehavioralAmbiguousTask(focus);
  }

  if (isRoleInterestQuestionLabel(label)) {
    return answerRoleInterestTextarea({ vacancyTitle: ctx.vacancyTitle });
  }

  for (const rule of LABEL_RULES) {
    if (!rule.re.test(label)) continue;
    if (/язык.*программ|фреймворк/i.test(label) && isCodingQuestionnaireQuestion(label)) continue;
    const tools = pickTools(rule.pick, fromCv);
    if (tools.length) return tools.join(', ');
    const fallback = allToolsFromCv(fromCv, 10);
    if (fallback.length) return fallback.join(', ');
  }

  if (/нейросет|llm|machine\s*learning|искусственн/i.test(label)) {
    if (focus === 'ml') {
      return 'Изучаю ML-стек под роль; в проде сильнее MLOps/данные и эксплуатация — готов быстро выйти на уровень команды.';
    }
    return 'В продакшене не использую; при необходимости быстро разберусь под задачи команды.';
  }

  if (/опыт|компетенц|навык|стек|технолог/i.test(label) && !/python|питон|ml|машинн/i.test(label)) {
    const tools = allToolsFromCv(fromCv, 12);
    if (tools.length) return tools.join(', ');
  }

  if (/опишите|расскажите|почему|мотивац|сопровод/i.test(label)) {
    const snippet = firstRelevantCvSnippet(cvText, 320, focus);
    if (snippet) return snippet.endsWith('.') ? snippet : `${snippet}.`;
    if (focus === 'ml') return answerMlProjectsQuestion(cvText, focus);
  }

  const any = allToolsFromCv(fromCv, 8);
  if (any.length && /инструмент|владе|использу/i.test(label)) {
    return any.join(', ');
  }

  return '';
}
