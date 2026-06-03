/**
 * Промпт-правила сопроводительных по роли резюме / вакансии.
 */

import { classifyVacancyResumeRole } from './resume-routing.mjs';

/** @type {Record<string, string>} */
const STRUCTURE_BY_ROLE = {
  devops: `Структура (DevOps/SRE, 4–7 предложений, 450–1200 символов):
1) интерес к роли + 1 задача из вакансии (Linux/K8s/CI/CD/мониторинг);
2) 2–3 факта: инциденты, релизы, автоматизация, метрики;
3) что дадите в первые недели;
4) мягкое закрытие.`,
  support: `Структура (поддержка L2/L3, 4–7 предложений):
1) интерес к поддержке / SLA / highload;
2) цифры: обращения, время реакции, эскалации, связка с разработкой;
3) SQL/логи/мониторинг в контексте задач вакансии;
4) закрытие без канцелярита.`,
  data: `Структура (Data Engineer, 4–7 предложений):
1) интерес к data/ETL/DWH/пайплайнам — термины из заголовка вакансии;
2) SQL, ETL, качество данных, сопровождение пайплайнов — с цифрами;
3) опыт с аналитиками/разработчиками при необходимости;
4) закрытие. Не пиши как generic DevOps без data-терминов.`,
  tam: `Структура (TAM / сопровождение клиентов):
1) техническое сопровождение и коммуникация;
2) инциденты, изменения, прозрачность для клиента;
3) релевантный опыт из резюме;
4) закрытие.`,
  dba: `Структура (DBA / БД):
1) администрирование БД из вакансии (PostgreSQL/Oracle/MongoDB и т.д.);
2) бэкапы, производительность, инциденты;
3) цифры из резюме;
4) закрытие.`,
  platform: `Структура (Platform/K8s):
1) платформа, K8s/OpenShift, надёжность;
2) CI/CD, observability, сопровождение кластера;
3) факты из резюме;
4) закрытие.`,
};

/** @type {Record<string, string>} */
const SYSTEM_TAIL_BY_ROLE = {
  data: 'Кандидат — data engineering, не generic DevOps.',
  support: 'Кандидат — техническая поддержка L2/L3, не разработчик.',
  tam: 'Кандидат — technical account / клиентское сопровождение.',
  dba: 'Кандидат — администратор БД.',
  platform: 'Кандидат — platform/infrastructure engineer.',
};

/**
 * @param {string} [resumeRole]
 * @param {object} [record]
 */
export function getLetterStructureRules(resumeRole, record) {
  const role = String(resumeRole || (record ? classifyVacancyResumeRole(record) : '') || 'devops').toLowerCase();
  return STRUCTURE_BY_ROLE[role] || STRUCTURE_BY_ROLE.devops;
}

/**
 * @param {string} [resumeRole]
 * @param {object} [record]
 */
export function getCoverLetterSystemTail(resumeRole, record) {
  const role = String(resumeRole || (record ? classifyVacancyResumeRole(record) : '') || 'devops').toLowerCase();
  return SYSTEM_TAIL_BY_ROLE[role] || 'Кандидат — mid/senior в IT-инфраструктуре и эксплуатации.';
}
