#!/usr/bin/env node
/**
 * Аудит ложных invited/responded (класс Helix 20.07): store говорит invited,
 * но нет appliedAt / letterDelivered — риск «кнопка Откликнуться» на hh.
 *
 *   node scripts/run-with-instance.mjs --instance=emil -- node scripts/devops-audit-false-invited.mjs
 *   … -- --reset   # сбросить подозрительные в pending (как Helix)
 */
import fs from 'fs';
import path from 'path';
import { loadQueue, updateVacancyRecord } from '../lib/store.mjs';
import { getDataDir } from '../lib/paths.mjs';

const doReset = process.argv.includes('--reset');

function looksSuspiciousInvited(rec) {
  const site = String(rec.hhApply?.hhSiteState || rec.hhSiteState || '').toLowerCase();
  if (site !== 'invited' && site !== 'invitation') return false;
  const appliedAt = rec.hhApply?.appliedAt || rec.appliedAt;
  const letterDelivered = Boolean(rec.hhApply?.letterDelivered);
  const responseSubmitted = Boolean(rec.hhApply?.responseSubmitted);
  // Invited без следа отклика — класс Helix (ложный sync).
  if (!appliedAt && !letterDelivered && !responseSubmitted) return true;
  // responded + invited без appliedAt
  if (String(rec.status || '').toLowerCase() === 'responded' && !appliedAt && !letterDelivered) {
    return true;
  }
  return false;
}

function main() {
  const q = loadQueue({ force: true }) || [];
  const suspects = q.filter(looksSuspiciousInvited).map((r) => ({
    id: r.id,
    title: String(r.title || '').slice(0, 80),
    company: r.company || null,
    status: r.status,
    site: r.hhApply?.hhSiteState || null,
    url: r.url || null,
    appliedAt: r.hhApply?.appliedAt || null,
    letterDelivered: Boolean(r.hhApply?.letterDelivered),
  }));

  const outDir = path.join(getDataDir(), 'baselines', 'false-invited-audit');
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    at: new Date().toISOString(),
    count: suspects.length,
    reset: doReset,
    suspects,
  };
  const reportPath = path.join(outDir, 'latest.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ count: suspects.length, reset: doReset, reportPath }, null, 2));
  for (const s of suspects.slice(0, 30)) {
    console.log(`- ${s.company} · ${s.title} · ${s.status}/${s.site} · ${s.id.slice(0, 8)}`);
  }

  if (doReset && suspects.length) {
    let n = 0;
    for (const s of suspects) {
      const rec = q.find((x) => x.id === s.id);
      updateVacancyRecord(s.id, {
        status: 'pending',
        partnerNote: [
          String(rec?.partnerNote || '').trim(),
          `Аудит false-invited ${new Date().toISOString().slice(0, 10)}: сброс site=invited без appliedAt/letter (класс Helix).`,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 500),
        hhApply: {
          ...(rec?.hhApply || {}),
          hhSiteState: null,
          inviteKind: null,
          appliedAt: null,
          responseSubmitted: false,
        },
      });
      n++;
    }
    console.log(`reset ${n}`);
  }
}

main();
