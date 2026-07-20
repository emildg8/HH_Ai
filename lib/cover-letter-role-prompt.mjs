/**
 * Промпт-правила сопроводительных по роли резюме / вакансии / маршруту охоты (HT.3).
 */

import { classifyVacancyResumeRole } from './resume-routing.mjs';
import { classifyVacancyHuntTrack } from './hunt-tracks.mjs';
import { getCandidateGenderPromptLine } from './letter-candidate-gender.mjs';
import { getLetterStretchPromptBlock } from './letter-stretch-canon.mjs';
import { getDomainFramingPromptBlock } from './letter-domain-framing.mjs';
import { buildLetterFramingPromptBlock } from './letter-framing-router.mjs';

/** @type {Set<string>} */
const HUNT_TRACK_IDS = new Set([
  'devops',
  'infra',
  'l2l3',
  'tam',
  'qa-lead',
  'senior-qa',
  'aqa-ai-assist',
  'manual-qa',
]);

/** @type {Record<string, string>} */
const STRUCTURE_BY_ROLE = {
  devops: `Структура (DevOps/SRE, 4–7 предложений, 450–1200 символов):
1) интерес к роли + 1 задача из вакансии (Linux/K8s/CI/CD/мониторинг);
2) 2–3 факта: инциденты, релизы, автоматизация, метрики;
3) одна опора под JD (стек/задача) без обещаний «в первые недели»;
4) короткое закрытие.`,
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

/** @type {Record<string, string>} */
const STRUCTURE_BY_HUNT_TRACK = {
  devops: `Структура (маршрут DevOps/SRE, 4–7 предложений, 450–1200 символов):
1) «Здравствуйте!» + интерес к роли + ТОЧНОЕ название из заголовка + 1 задача из JD своими словами (без «Вижу, что вам нужен человек…» и без «это мой хлеб»);
2) 2–3 факта под стек: Docker, Grafana/Kibana, пайплайны, релизы, инциденты — **одна** метрика из РАЗРЕШЁННЫХ, не копируй одну фразу на все вакансии;
3) одна опора под JD **или** (редко) мягкий stretch — см. блок STRETCH; **без** обещаний «в первые недели закрою / унифицирую / наведу порядок»;
4) короткое закрытие: готов обсудить стек / формат — без пафоса и без «live troubleshooting».
Позиционирование: **mid DevOps/SRE**, инженер на практике, не architect/lead/head.
Канон IT_One: только **до июня 2026**, прошедшее время.
СТРОГО в **первых 2 предложениях** запрещено: «14+ лет», «N+ лет опыта», «7000+», «руководил», «команда 20+», lead/head/platform owner.
В тексте не используй англ. «hands-on», «highload», «observability», «live troubleshooting» — по-русски.
7000+ — только с привязкой «в IT_One (СБП)», не в opening.
Не копируй один абзац между вакансиями.
РАЗРЕШЁННЫЕ метрики (выбери **одну**, чередуй; −15% не чаще 1 из 3 писем волны):
- время реакции / MTTR примерно −15%;
- 7000+ обращений на IT_One / СБП (не в opening; **запрещено** на SRE / Site Reliability);
- масштаб: контуры СБП, релизы, дежурства, SLA;
- срок/роль: «до июня 2026», «вторая линия».
SRE / надёжность: ядро — восстановление, алерты, окна изменений, MTTR/SLA; не 7000+ и не тикетный объём.
ЗАПРЕЩЕНО: оправдания «Kubernetes не заявляю» — молчи о дыре.
ЗАПРЕЩЕНА мишура ИИ (см. также anti-framing ниже).`,
  l2l3: `Структура (маршрут L2/L3 поддержка, 4–7 предложений):
1) интерес к поддержке / SLA + ТОЧНОЕ название из заголовка вакансии;
2) hands-on L2: диагностика, эскалации, Jira/Confluence, SQL/логи/мониторинг, Postman при API в JD — 1 метрика из опыта (не копируй «15%» в каждое письмо);
3) стек из ожидания JD, пересекающийся с inventory (Jira, Grafana, Postman, SQL…) — 1–2 инструмента явно; домен работодателя (фитнес/CRM клубов и т.п.) не выдумывать;
4) закрытие без канцелярита.
Позиционируй как линейного L2/L3 инженера, не как DevOps/SRE и не как руководителя.
СТРОГО: не упоминай руководство/lead/head/«20+ человек» вообще (даже одной строкой) — это даёт overqualified-скрининг.
СТРОГО: не выдумывай цифры. Метрики только из резюме (MTTR/SLA/7000+ IT_One); чередуй формулировки между письмами.
Канон занятости: проект IT_One / СБП завершён **до июня 2026** — только прошедшее время («до июня 2026», «на проекте СБП в IT_One»), не «сейчас работаю в IT_One».`,
  infra: `Структура (маршрут смежная инфра, 4–7 предложений):
1) интерес к эксплуатации Linux/инфраструктуры из вакансии;
2) коммерческий STAR: мониторинг (Zabbix/Grafana), Proxmox, сеть, сопровождение серверов;
3) цифры из резюме, без акцента на CI/CD как основной профиль;
4) закрытие.`,
  tam: `Структура (маршрут TAM / сопровождение клиентов):
1) техническое сопровождение и коммуникация с заказчиком;
2) эскалации, изменения, прозрачность процессов для клиента;
3) релевантный опыт из резюме (SLA, инциденты, координация);
4) закрытие.`,
  'senior-qa': `Структура (маршрут Senior QA, 4–7 предложений):
1) интерес к роли + термины из заголовка (тестировщик-аналитик, quality engineer, gamedev/Middle если есть);
2) регрессия, тест-дизайн, API/SQL, Jira — под задачи JD;
3) коммерческий бэкграунд: банк/финтех (NDA) — одна короткая фраза, НЕ opening на non-fintech JD (gamedev/retail и т.п.);
4) если в JD есть Kotlin/Java как навык QA (не SDET-framework) — одна фраза «работала с Kotlin на последнем месте», без Selenium-framework в проде;
5) закрытие. Не позиционируй как DevOps или разработчик.
Для Middle/IC: hands-on, без «ведущий специалист» / «координирую команду».`,
  'aqa-ai-assist': `Структура (маршрут AQA + ИИ-инструменты, 4–7 предложений):
1) интерес к автоматизации тестирования + задачи из вакансии;
2) manual/API база; Kotlin с последнего места если JD про Java/Kotlin (без англ. mid);
3) Cursor/LLM — только если в JD есть ИИ/AI-assist/Cursor/LLM; иначе план входа в automation без Cursor;
4) без выдуманного Selenium framework в проде; opening без «8+ лет»; без «ведущий специалист» на IC;
5) закрытие.`,
  'qa-lead': `Структура (маршрут QA Lead / ведущий, 4–7 предложений, 450–1200 символов):
1) интерес к роли + 1 задача из вакансии (тест-дизайн, регресс, API, релизный контур);
2) 2–3 факта: банк/финтех (NDA «крупный банк»), контроль релизов и раннее выявление дефектов (без «90%»), Kafka/PostgreSQL/Kibana;
3) координация релиза, Jira, приоритизация рисков; если в JD Kotlin — коротко «работала с Kotlin», без SDET-framework;
4) мягкое закрытие.
Акцент: QA Lead, регрессия, API, интеграции — не DevOps/SRE/K8s/CI/CD.`,
  'manual-qa': `Структура (маршрут Manual QA / API, 4–7 предложений):
1) функциональное и API-тестирование из вакансии;
2) Postman, SQL, регрессия, мобильное при необходимости;
3) опыт из резюме: банк/финтех (NDA) — коротко и не как стена на чужом домене;
4) если в JD Kotlin — одна фраза «работала с Kotlin на последнем месте»;
5) закрытие.`,
};

/** @type {Record<string, string>} */
const SYSTEM_TAIL_BY_HUNT_TRACK = {
  devops: 'Кандидат — DevOps/SRE mid+, hands-on: CI/CD, контейнеры, observability; не lead/head и не «14+ лет в opening».',
  l2l3: 'Кандидат — hands-on L2/L3 поддержка (банк/Softline): SLA, диагностика, эскалации; не позиционируй как DevOps и не как lead/head.',
  infra: 'Кандидат — инженер смежной инфраструктуры (Linux, мониторинг, коммерческая эксплуатация).',
  tam: 'Кандидат — technical account / клиентское сопровождение, эскалации и процессы.',
  'qa-lead':
    'Кандидат — QA Lead / ведущий тестировщик: тест-дизайн, регресс, API, релизный контур; не DevOps/SRE.',
  'senior-qa': 'Кандидат — Senior QA / тестировщик-аналитик; не DevOps и не backend-разработчик.',
  'aqa-ai-assist':
    'Кандидат — AQA с ИИ-инструментами; Kotlin с последнего места; практика Playwright — собственные проекты (не pet, без года; без англ. mid в письме).',
  'manual-qa': 'Кандидат — manual/API QA; без позиционирования как DevOps.',
};

/** @type {Record<string, string>} */
const ANTI_FRAMING_BY_HUNT_TRACK = {
  devops: `ЗАПРЕЩЕНО для маршрута DevOps (overqualified-скрининг hh.ru):
- в **первых 2 предложениях**: «14+ лет», «N+ лет в IT», «7000+», «руководил/руководство», «команда 20+», lead/head/architect owner;
- начинать с L2/SL2/helpdesk или «7000+ обращений» без контекста DevOps-задач;
- приписывать 7000+ Softline (только IT_One, проект СБП, и не в opening);
- позиционировать себя как «техподдержку» или «руководителя направления»;
- один и тот же шаблонный абзац для разных компаний — каждое письмо уникально под JD;
- копировать одну фразу «примерно на 15%» / «MTTR −15%» во все письма волны;
- оправдания: «Kubernetes не заявляю/не приписываю», «не веду как основной профиль» (Cisco и т.п.);
- больше 1 фразы про собственные проекты 2026;
- Playwright / Node.js / «автоматизация на Node» в письме, если JD не про ботов/тесты/скрипты;
- на SRE-вакансии: 7000+ / тикетный объём как главный аргумент (звучит как L2, не как надёжность);
- англ. pet / hands-on / highload / observability / live troubleshooting в письме.
МИШУРА ИИ — запрещено дословно и по смыслу:
- «это мой хлеб», «закрою гэпы», «наведу порядок», «унифицирую пайплайны/мониторинг/Grafana»;
- «за первые недели / первым делом разберусь / закрою / унифицирую»;
- ярлык «Опора:» перед списком стека;
- «Вижу, что вам нужен человек, который…»;
- «прозрачный статус до восстановления» как рекламный штамп;
- пафосные обещания вместо факта из опыта.
РАЗРЕШЕНО: mid/senior DevOps на практике, Docker/CI/CD/Grafana, IT_One/SBP в прошедшем времени; мягкий stretch (0–1 фраза, не в каждом письме); K8s — только практика/смежный OpenShift; метрики — чередовать.`,
  l2l3: `ЗАПРЕЩЕНО для маршрута L2/L3:
- в первых 2 предложениях: «14+ лет», «7000+», «руководил/команда 20+», lead/head;
- противоречие «руководил…» + «хочу вернуться к практике»;
- DevOps/SRE/K8s/CI/CD как основной профиль;
- «platform engineer», «автоматизация инфраструктуры» без контекста поддержки.`,
  infra: `ЗАПРЕЩЕНО для маршрута Infra:
- чисто DevOps-позиционирование (K8s/MLOps как ядро);
- pet-проекты как главный аргумент — опирайся на коммерческий STAR; стартап-практику — максимум 1 фраза.`,
  tam: `ЗАПРЕЩЕНО для маршрута TAM:
- чисто L2/helpdesk без клиентского контекста;
- узкий DevOps-стек без процессов и коммуникации с заказчиком.`,
  'qa-lead': `ЗАПРЕЩЕНО для маршрута QA Lead:
- DevOps/SRE/K8s/CI/CD/Terraform как основной профиль;
- 7000+ обращений Softline, L2/SL2, helpdesk;
- названия ВТБ/Иннотех/Т1 — только NDA «крупный банк»;
- «90%», «более чем на 90%», «снизила дефекты на …%» — метрика только в CV/STAR, не в письме;
- «8+ лет» в первых 2 предложениях;
- слово pet и год собственных проектов в письме;
- шаблон «выстроила регрессионный контур» — вместо него: релизы, API, smoke/sanity, тест-дизайн.`,
  'senior-qa': `ЗАПРЕЩЕНО для маршрута Senior QA:
- DevOps/SRE/platform engineer;
- backend/java/python developer;
- «90%» и «регрессионный контур» — только в CV/STAR; в письме — эталон Индид (lib/qa-letter-phrasing.mjs);
- «8+ лет» в первых 2 предложениях; слово pet и год собственных проектов;
- на gamedev/non-fintech: opening «банковский и финтех-контур» + SoapUI/юрлиц как ядро; lead-тон («ведущий специалист», «координирую команду») на Middle IC.`,
  'aqa-ai-assist': `ЗАПРЕЩЕНО для маршрута AQA+AI:
- выдуманный Selenium framework в проде;
- слово pet и год собственных проектов в письме;
- «8+ лет» / «более 8 лет» в первых 2 предложениях;
- голое «Java/Kotlin не заявляю», если есть Kotlin с работы — опирайся на него;
- англ. mid / «уровень около mid» в письме;
- DevOps-инфра как ядро профиля;
- «90%» и «регрессионный контур» как шаблон из CV — не копировать в письмо.`,
  'manual-qa': `ЗАПРЕЩЕНО для маршрута Manual QA:
- SDET/C# framework без опоры на практику/Kotlin;
- слово pet и год собственных проектов;
- «8+ лет» в opening;
- DevOps/SRE позиционирование;
- «90%» и «выстроила регрессионный контур» — только в CV/STAR;
- банковская стена в opening на gamedev/retail JD.`,
};

/**
 * @param {object} [record]
 * @param {string} [huntTrack]
 * @returns {'devops'|'infra'|'l2l3'|'tam'|null}
 */
export function resolveHuntTrackForLetter(record, huntTrack) {
  const explicit = String(huntTrack || '').trim().toLowerCase();
  if (HUNT_TRACK_IDS.has(explicit)) return /** @type {'devops'|'infra'|'l2l3'|'tam'} */ (explicit);
  const classified = record ? classifyVacancyHuntTrack(record) : null;
  if (classified && HUNT_TRACK_IDS.has(classified)) return classified;
  return null;
}

/**
 * @param {string} [huntTrack]
 */
export function getHuntTrackAntiFramingBlock(huntTrack) {
  const track = String(huntTrack || '').trim().toLowerCase();
  return ANTI_FRAMING_BY_HUNT_TRACK[track] || '';
}

/**
 * @param {string} [resumeRole]
 * @param {object} [record]
 * @param {string} [huntTrack]
 */
export function getLetterStructureRules(resumeRole, record, huntTrack) {
  const track = resolveHuntTrackForLetter(record, huntTrack);
  const titleBlob = String(record?.title || '');
  const sreExtra =
    /\bsre\b|site reliability|надёжност/i.test(titleBlob)
      ? `\nSRE-вакансия: акцент на восстановление сервиса, алерты Grafana/Kibana, окна изменений, SLA/MTTR. Запрещено: 7000+, тикетный объём, helpdesk framing.`
      : '';
  const stretch = getLetterStretchPromptBlock(record, track || huntTrack);
  const stretchExtra = stretch ? `\n${stretch}` : '';
  const domainExtra = (() => {
    const block = getDomainFramingPromptBlock(record);
    return block ? `\n${block}` : '';
  })();
  if (track && STRUCTURE_BY_HUNT_TRACK[track]) {
    const anti = getHuntTrackAntiFramingBlock(track);
    const base = anti
      ? `${STRUCTURE_BY_HUNT_TRACK[track]}\n${anti}`
      : STRUCTURE_BY_HUNT_TRACK[track];
    const framingExtra = buildLetterFramingPromptBlock(record, track);
    const framingBlock = framingExtra ? `\n${framingExtra}` : '';
    return `${base}${sreExtra}${stretchExtra}${domainExtra}${framingBlock}`;
  }
  const role = String(resumeRole || (record ? classifyVacancyResumeRole(record) : '') || 'devops').toLowerCase();
  return `${STRUCTURE_BY_ROLE[role] || STRUCTURE_BY_ROLE.devops}${sreExtra}${stretchExtra}${domainExtra}`;
}

/**
 * @param {string} [resumeRole]
 * @param {object} [record]
 * @param {string} [huntTrack]
 */
export function getCoverLetterSystemTail(resumeRole, record, huntTrack) {
  const genderLine = getCandidateGenderPromptLine();
  const track = resolveHuntTrackForLetter(record, huntTrack);
  if (track && SYSTEM_TAIL_BY_HUNT_TRACK[track]) {
    const tail = SYSTEM_TAIL_BY_HUNT_TRACK[track];
    return genderLine ? `${tail} ${genderLine}` : tail;
  }
  const role = String(resumeRole || (record ? classifyVacancyResumeRole(record) : '') || 'devops').toLowerCase();
  const tail = SYSTEM_TAIL_BY_ROLE[role] || 'Кандидат — mid/senior в IT-инфраструктуре и эксплуатации.';
  return genderLine ? `${tail} ${genderLine}` : tail;
}
