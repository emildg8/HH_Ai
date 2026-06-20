/**
 * Оценка соответствия резюме описанию вакансии (по ключевым темам).
 */

const CRITERIA = [
  { key: 'integration', label: 'Интеграционное тестирование', patterns: [/интеграц/i, /сквозн/i, /микросервис/i, /kafka/i] },
  { key: 'sql', label: 'SQL и базы данных', patterns: [/postgresql/i, /sql/i, /dbeaver/i, /oracle/i] },
  { key: 'api', label: 'Проверка программных интерфейсов', patterns: [/postman/i, /swagger/i, /\bapi\b/i, /rest/i] },
  { key: 'process', label: 'Процесс и документация', patterns: [/jira/i, /confluence/i, /тест-кейс/i, /чек-лист/i, /пси/i, /пми/i] },
  { key: 'lead', label: 'Ведущая роль', patterns: [/ведущ/i, /главн/i, /lead/i, /лидир/i, /онбординг/i] },
  { key: 'bank', label: 'Банковский и регулируемый сектор', patterns: [/банк/i, /втб/i, /альфа/i, /мтс финтех/i, /atm/i, /рко/i] },
  { key: 'xml', label: 'XML и обмен данными', patterns: [/xml/i, /etl/i, /миграц/i] },
  { key: 'dotnet', label: 'Чтение кода на платформе .NET', patterns: [/\.net/i, /c#/i, /nunit/i] },
];

/**
 * @param {string} resumeText
 * @param {string} vacancyText
 */
export function scoreResumeVsVacancy(resumeText, vacancyText) {
  const resume = String(resumeText || '').toLowerCase();
  const vacancy = String(vacancyText || '').toLowerCase();
  const strengths = [];
  const gaps = [];

  for (const c of CRITERIA) {
    const inResume = c.patterns.some((p) => p.test(resume));
    const inVacancy = c.patterns.some((p) => p.test(vacancy))
      || ['integration', 'sql', 'process'].includes(c.key);

    if (!inVacancy && !['integration', 'sql', 'process', 'dotnet', 'xml'].includes(c.key)) continue;

    if (inResume) strengths.push(c.label);
    else if (inVacancy || ['dotnet', 'xml'].includes(c.key)) gaps.push(c.label);
  }

  const score = Math.round((strengths.length / CRITERIA.length) * 100);

  return { score, strengths, gaps, criteriaTotal: CRITERIA.length };
}
