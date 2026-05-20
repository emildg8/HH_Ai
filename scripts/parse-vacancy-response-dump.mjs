import fs from 'fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/parse-vacancy-response-dump.mjs <dump.md>');
  process.exit(1);
}
const t = fs.readFileSync(path, 'utf8');

const needles = [
  '*nix',
  'Виртуализация',
  'Контейнеризация',
  'IaC',
  'Ansible',
  'Языки программирования',
  'Системы сбора',
  'Базы данных',
  'Системы хранения',
  'другие инструменты',
  'зарплат',
  'Ответьте на вопросы',
];
for (const p of needles) {
  let idx = 0;
  let n = 0;
  while ((idx = t.indexOf(p, idx)) >= 0 && n < 5) {
    console.log(`[${p}]`, t.slice(idx, idx + 140).replace(/\s+/g, ' '));
    idx += p.length;
    n++;
  }
}
console.log('textarea tags:', (t.match(/<textarea/gi) || []).length);
console.log('magritte-field:', (t.match(/magritte-field/gi) || []).length);
