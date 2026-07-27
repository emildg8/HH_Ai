import fs from 'fs';
import path from 'path';
import { CV_DIR, DATA_DIR } from './paths.mjs';
import { writePdfFromMarkdown } from './md-export.mjs';

const SKILL_MAP = [
  ['docker', 'Docker, контейнеризация'],
  ['kubernetes', 'Kubernetes'],
  ['k8s', 'Kubernetes'],
  ['openshift', 'OpenShift'],
  ['linux', 'Linux'],
  ['ci/cd', 'CI/CD, пайплайны'],
  ['gitlab', 'GitLab CI'],
  ['jenkins', 'Jenkins'],
  ['terraform', 'Terraform'],
  ['ansible', 'Ansible'],
  ['helm', 'Helm'],
  ['grafana', 'Grafana'],
  ['prometheus', 'Prometheus'],
  ['kibana', 'Kibana'],
  ['zabbix', 'Zabbix'],
  ['postgresql', 'PostgreSQL'],
  ['oracle', 'Oracle'],
  ['bash', 'Bash-скрипты'],
  ['git', 'Git'],
  ['мониторинг', 'мониторинг и алерты'],
  ['инцидент', 'инцидент-менеджмент'],
  ['релиз', 'релизы и регламентные работы'],
  ['сбп', 'сопровождение СБП (банк)'],
];

export function resolveBaseResumeMdPath(
  cvDir = CV_DIR,
  configuredFile = process.env.HH_TAILOR_RESUME_BASE_FILE
) {
  const files = fs.existsSync(cvDir)
    ? fs.readdirSync(cvDir).filter((n) => n.endsWith('.md') && !n.startsWith('.')).sort()
    : [];
  if (!files.length) throw new Error('Нет CV/*.md — положите резюме в папку CV/');

  const requested = String(configuredFile || '').trim();
  if (requested) {
    if (path.basename(requested) !== requested || !files.includes(requested)) {
      throw new Error(`HH_TAILOR_RESUME_BASE_FILE=${requested} не найден в CV/`);
    }
    return path.join(cvDir, requested);
  }

  if (files.length > 1) {
    throw new Error(
      `В CV/ несколько .md-файлов (${files.join(', ')}). ` +
        'Укажите HH_TAILOR_RESUME_BASE_FILE в профиле.'
    );
  }
  return path.join(cvDir, files[0]);
}

function readBaseResumeMd() {
  return fs.readFileSync(resolveBaseResumeMdPath(), 'utf8');
}

function vacancyBlob(vacancy) {
  return [vacancy.title, vacancy.company, vacancy.description].filter(Boolean).join('\n').toLowerCase();
}

function matchedSkills(blob) {
  const out = [];
  for (const [key, label] of SKILL_MAP) {
    if (blob.includes(key) && !out.includes(label)) out.push(label);
  }
  return out;
}

/**
 * Текст резюме с блоком под конкретную вакансию (без LLM).
 */
export function buildTailoredResumeMarkdown(vacancy) {
  const base = readBaseResumeMd();
  const blob = vacancyBlob(vacancy);
  const skills = matchedSkills(blob);
  const title = String(vacancy.title || 'DevOps').trim();
  const company = String(vacancy.company || '').trim();

  const header = [
    `# Резюме под вакансию`,
    ``,
    `**Позиция:** ${title}`,
    company ? `**Компания:** ${company}` : '',
    ``,
    `## Почему я подхожу`,
    ``,
    skills.length
      ? `В вакансии упоминаются: ${skills.join(', ')}. У меня практический опыт по этим направлениям (банковский прод, L2/инфраструктура, мониторинг, релизы, Docker/OpenShift).`
      : `Опыт 14+ лет в эксплуатации и поддержке продакшена, переход в DevOps junior+/middle: Linux, Docker, CI/CD-культура, observability, SQL, инциденты.`,
    `Готов к удалённой работе. Уровень: junior+ / middle.`,
    ``,
    `---`,
    ``,
  ]
    .filter(Boolean)
    .join('\n');

  return `${header}${base}`;
}

export function tailoredResumeDir(recordId) {
  return path.join(DATA_DIR, 'tailored-resumes', recordId);
}

export function writeTailoredResumeFiles(recordId, vacancy) {
  const dir = tailoredResumeDir(recordId);
  fs.mkdirSync(dir, { recursive: true });
  const md = buildTailoredResumeMarkdown(vacancy);
  const mdPath = path.join(dir, 'resume-tailored.md');
  fs.writeFileSync(mdPath, md, 'utf8');
  return { mdPath, dir, md };
}

/** MD + PDF в data/tailored-resumes/{id}/ */
export async function ensureTailoredResumePdf(recordId, vacancy) {
  const { mdPath, dir, md } = writeTailoredResumeFiles(recordId, vacancy);
  const pdfPath = path.join(dir, 'resume-tailored.pdf');
  await writePdfFromMarkdown(md, pdfPath);
  return { mdPath, pdfPath, dir };
}
