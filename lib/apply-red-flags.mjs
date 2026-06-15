/**
 * Стоп-сигналы перед откликом: зарплата, ключевые слова, дубли, чёрный список.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { assessSalaryFit } from './salary-fit.mjs';
import { assessKeywordGap } from './resume-keyword-gap.mjs';
import { loadCvBundle } from './cv-load.mjs';

const BLACKLIST_FILE = path.join(DATA_DIR, 'employer-blacklist.json');
const DUPLICATE_DAYS = 30;

function loadBlacklist() {
  try {
    if (!fs.existsSync(BLACKLIST_FILE)) return { companies: [], until: {} };
    return JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
  } catch {
    return { companies: [], until: {} };
  }
}

function companyKey(rec) {
  return String(rec?.company || rec?.employerName || '')
    .trim()
    .toLowerCase();
}

function daysSince(iso) {
  const t = Date.parse(String(iso || ''));
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

/**
 * @param {object} rec
 * @param {{ allRecords?: object[], prefs?: object, cvText?: string }} [opts]
 */
export async function assessApplyRedFlags(rec, opts = {}) {
  const flags = [];
  const prefs = opts.prefs || {};
  const bl = loadBlacklist();
  const company = companyKey(rec);

  if (company && bl.companies?.includes(company)) {
    const until = bl.until?.[company];
    if (!until || Date.parse(until) > Date.now()) {
      flags.push({ code: 'blacklist', message: `компания в чёрном списке: ${rec.company}` });
    }
  }

  const salary = assessSalaryFit(rec, prefs);
  if (!salary.ok) flags.push({ code: 'salary', message: salary.reason });

  let cvText = opts.cvText;
  if (!cvText) {
    try {
      const bundle = await loadCvBundle();
      cvText = bundle?.text || '';
    } catch {
      cvText = '';
    }
  }
  const gap = assessKeywordGap(rec, cvText);
  const minGap = Number(prefs.minKeywordGapScore ?? 40);
  if (gap.gapScore < minGap) {
    flags.push({
      code: 'keyword_gap',
      message: `пробел по ключам ${gap.gapScore}%: нет ${gap.missing.slice(0, 5).join(', ')}`,
      gap,
    });
  }

  const all = opts.allRecords || [];
  if (company) {
    for (const other of all) {
      if (other.id === rec.id) continue;
      if (companyKey(other) !== company) continue;
      const applied =
        other.hhApply?.responseSubmitted ||
        other.status === 'responded' ||
        other.hhApply?.hhSiteState === 'already_applied' ||
        (other.status === 'pending' && companyKey(other) === company);
      if (!applied) continue;
      const d = daysSince(other.hhApply?.lastAt || other.createdAt);
      if (d != null && d < DUPLICATE_DAYS) {
        flags.push({
          code: 'duplicate_company',
          message: `уже откликались в «${rec.company}» ${Math.round(d)} дн. назад`,
        });
        break;
      }
    }
  }

  const critical = flags.some((f) =>
    ['blacklist', 'salary', 'keyword_gap', 'duplicate_company'].includes(f.code)
  );

  return {
    blocked: critical,
    flags,
    salary,
    keywordGap: gap,
  };
}

export function saveEmployerBlacklist(company, days = 60) {
  const bl = loadBlacklist();
  const key = String(company || '').trim().toLowerCase();
  if (!key) return bl;
  if (!bl.companies.includes(key)) bl.companies.push(key);
  bl.until = bl.until || {};
  bl.until[key] = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BLACKLIST_FILE, `${JSON.stringify(bl, null, 2)}\n`, 'utf8');
  return bl;
}
