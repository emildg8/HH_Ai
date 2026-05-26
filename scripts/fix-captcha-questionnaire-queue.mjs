/**
 * Снять с очереди ложные «анкеты» (поля капчи «Текст с картинки»).
 *
 *   npm run devops:audit-captcha-questionnaires        # отчёт
 *   npm run devops:fix-captcha-questionnaires -- --apply
 *   npm run devops:fix-captcha-questionnaires -- --apply --id=<uuid>
 */

import fs from 'fs';
import path from 'path';
import { ROOT, getQueueFile } from '../lib/paths.mjs';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import {
  recordLooksLikeCaptchaQuestionnaire,
  patchClearCaptchaQuestionnaire,
  meaningfulQuestions,
} from '../lib/questionnaire-labels.mjs';

loadDevOpsEnv();

const apply = process.argv.includes('--apply');
const idArg = process.argv.find((a) => a.startsWith('--id='));
const onlyId = idArg ? idArg.slice(5).trim() : '';

function loadQueue() {
  const file = getQueueFile();
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Очередь должна быть массивом');
  return { file, data };
}

function saveQueue(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const { file, data } = loadQueue();
  const rel = path.relative(ROOT, file);
  const hits = [];

  for (const rec of data) {
    if (onlyId && rec.id !== onlyId) continue;
    if (!rec?.hhApply?.questionnaire) continue;
    if (rec.hhApply.questionnaire.clearedAsCaptcha) continue;
    if (!recordLooksLikeCaptchaQuestionnaire(rec)) continue;
    const labels = (rec.hhApply.questionnaire.questions || [])
      .map((q) => q.label)
      .filter(Boolean)
      .slice(0, 2);
    hits.push({
      id: rec.id,
      title: (rec.title || '').slice(0, 60),
      status: rec.status,
      qStatus: rec.hhApply.questionnaire.status,
      labels,
      meaningful: meaningfulQuestions(rec.hhApply.questionnaire.questions).length,
    });
  }

  console.log(`\n[audit-captcha] ${rel}: ${data.length} записей, ложных анкет (капча): ${hits.length}\n`);
  for (const h of hits.slice(0, 30)) {
    console.log(`  ${h.id.slice(0, 8)}…  ${h.title}`);
    console.log(`    статус ${h.status} · анкета ${h.qStatus} · labels: ${h.labels.join(' | ')}`);
  }
  if (hits.length > 30) console.log(`  … и ещё ${hits.length - 30}`);

  if (!apply) {
    console.log('\nСухой прогон. Чтобы сбросить: npm run devops:fix-captcha-questionnaires -- --apply\n');
    return;
  }

  let fixed = 0;
  for (const rec of data) {
    if (onlyId && rec.id !== onlyId) continue;
    if (!recordLooksLikeCaptchaQuestionnaire(rec)) continue;
    const patch = patchClearCaptchaQuestionnaire(rec);
    Object.assign(rec, patch);
    fixed++;
  }
  saveQueue(file, data);
  console.log(`\n[audit-captcha] Сброшено карточек: ${fixed} → вкладка «Анкета» без них, «Без анкет»/«Очередь» снова доступны.\n`);
}

main();
