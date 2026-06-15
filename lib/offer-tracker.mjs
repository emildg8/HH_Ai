/**
 * Учёт офферов и приглашений (корзина F и слоты E).
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { loadAnalyticsUnionRecords } from './queue-aggregate.mjs';
import { classifyRecordOutcome } from './outcome-classifier.mjs';

export const OFFERS_TRACKER_FILE = path.join(DATA_DIR, 'offers-tracker.json');

function readTracker() {
  if (!fs.existsSync(OFFERS_TRACKER_FILE)) {
    return { offers: [], decisions: {}, updatedAt: null };
  }
  try {
    return JSON.parse(fs.readFileSync(OFFERS_TRACKER_FILE, 'utf8'));
  } catch {
    return { offers: [], decisions: {}, updatedAt: null };
  }
}

function writeTracker(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(OFFERS_TRACKER_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * @param {object[]} [records]
 */
export function scanOffersAndSlots(records) {
  const list = records || loadAnalyticsUnionRecords().records;
  const items = [];
  for (const rec of list) {
    const outcome = classifyRecordOutcome(rec);
    if (outcome.bucket !== 'E' && outcome.bucket !== 'F') continue;
    items.push({
      id: rec.id,
      title: rec.title,
      company: rec.company,
      bucket: outcome.bucket,
      label: outcome.label,
      url: rec.url,
      hhSiteState: rec.hhApply?.hhSiteState,
      lastAt: rec.hhApply?.lastAt,
      interviewPrep: Boolean(rec.interviewPrep),
    });
  }
  return items.sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
}

/**
 * @param {string} id
 * @param {'pending'|'accepted'|'declined'|'negotiating'} status
 * @param {string} [note]
 */
export function setOfferDecision(id, status, note = '') {
  const t = readTracker();
  if (!t.decisions) t.decisions = {};
  t.decisions[id] = { status, note, at: new Date().toISOString() };
  const scanned = scanOffersAndSlots();
  t.offers = scanned.map((o) => ({
    ...o,
    decision: t.decisions[o.id] || { status: 'pending' },
  }));
  writeTracker(t);
  return t;
}

/**
 * Полная сводка для дашборда.
 */
export function buildOffersTrackerSnapshot() {
  const t = readTracker();
  const scanned = scanOffersAndSlots();
  const offers = scanned.map((o) => ({
    ...o,
    decision: t.decisions?.[o.id] || { status: 'pending' },
  }));
  const summary = {
    slots: offers.filter((o) => o.bucket === 'E').length,
    offers: offers.filter((o) => o.bucket === 'F').length,
    pending: offers.filter((o) => o.decision?.status === 'pending').length,
    accepted: offers.filter((o) => o.decision?.status === 'accepted').length,
  };
  return { summary, offers, updatedAt: t.updatedAt };
}
