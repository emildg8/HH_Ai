/**
 * Regen DevOps-first писем (framing router) — 5 откликов 20.07.
 *   node scripts/run-with-instance.mjs --instance=emil -- node scripts/regen-devops-framed-letters-2026-07-20.mjs
 */
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
loadDevOpsEnv();

import { getVacancyRecord, updateVacancyRecord } from '../lib/store.mjs';
import { composeDevopsFramedLetter, assessLetterFramingRisks } from '../lib/letter-framing-router.mjs';
import { assessLetterQualityForBatch } from '../lib/letter-batch-gate.mjs';

const TARGETS = [
  { id: '33cd7dec-4f9e-4961-96fa-22eee8abfbc9', label: 'Каспер IDP' },
  { id: '7e5a6f56-6e1c-41f5-b47d-c54b74895693', label: 'МАГНИТ Vault' },
  { id: 'f764c894-5682-43ba-a91f-5198987ab20f', label: 'Рестрим' },
  { id: '8d89e21d-77a0-4393-892a-f6e1166d5e63', label: 'ДОМ.РФ ЕФО' },
  { id: '3faabbab-773d-4003-a9fe-3df0815d5ff7', label: 'Сбер SberTech' },
];

const results = [];

for (const t of TARGETS) {
  const rec = getVacancyRecord(t.id);
  if (!rec) {
    results.push({ label: t.label, ok: false, note: 'нет записи' });
    continue;
  }
  const letter = composeDevopsFramedLetter(rec);
  const q = assessLetterQualityForBatch(rec, letter, 'devops', {});
  const risk = assessLetterFramingRisks(rec, letter);
  const ok = q.pass && risk.ok !== false;
  results.push({
    label: t.label,
    ok,
    len: letter.length,
    pass: q.pass,
    reason: q.reason,
    risks: risk.activeRisks,
  });
  if (!ok) {
    console.error('FAIL', t.label, q.reason, risk.risks);
    process.exitCode = 1;
    continue;
  }
  updateVacancyRecord(t.id, {
    coverLetter: {
      ...(rec.coverLetter || {}),
      approvedText: letter,
      status: 'approved',
      updatedAt: new Date().toISOString(),
      qualityFix: '2026-07-20-framing-router',
      framingRouter: {
        jdHook: risk.bundle.jdHook,
        category: risk.bundle.jdCategory,
      },
    },
  });
  console.log(`OK ${t.label} · ${letter.length} симв.\n${letter}\n`);
}

console.log(JSON.stringify(results, null, 2));
