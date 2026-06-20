/**
 * Пост-собес: debrief, merge spoken → notes, follow-up черновик, video capabilities.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { predictFollowUps } from './interview-copilot-followup-predict.mjs';
import { loadInterviewNotes, saveInterviewNotes } from './interview-notes.mjs';
import { DATA_DIR } from './paths.mjs';

const VOICE_PROFILE = path.join(DATA_DIR, 'candidate-voice-profile.json');

/**
 * @param {object} session
 * @param {object} [opts]
 */
export function buildDebriefSummary(session, opts = {}) {
  const turns = session?.spokenTurns || [];
  return {
    sessionId: session?.id,
    title: session?.title,
    company: session?.company,
    recordId: session?.recordId || opts.recordId,
    vacancyId: session?.vacancyId || opts.vacancyId,
    guardFlags: session?.guardFlags || [],
    spokenCount: turns.length,
    lastQuestion: session?.lastQuestion || '',
    selfRating: opts.selfRating ?? null,
    unexpectedQuestion: opts.unexpectedQuestion || '',
    followUpPredictions: predictFollowUps(session?.lastQuestion || '', session?.interviewStage === 'hr' ? 'hr' : 'technical'),
    turns: turns.slice(-10),
  };
}

/**
 * @param {object[]} items
 * @param {object} [opts]
 */
export function mergeSpokenToNotes(items, opts = {}) {
  const notes = loadInterviewNotes();
  if (!notes.topics) notes.topics = [];
  let added = 0;
  for (const item of items || []) {
    if (!item?.selected || !item?.text?.trim()) continue;
    notes.topics.unshift({
      id: `spoken-${Date.now()}-${added}`,
      title: `Собес ${opts.title || ''}`.trim(),
      excerpt: String(item.text).trim().slice(0, 1200),
      path: '',
      source: 'spoken-debrief',
      at: new Date().toISOString(),
    });
    added++;
  }
  if (added) saveInterviewNotes(notes);
  return { ok: true, added };
}

/**
 * @param {object} debrief
 */
export function mergeSpokenToVoiceProfile(debrief) {
  const facts = (debrief.turns || [])
    .map((t) => t.spokenText)
    .filter(Boolean)
    .slice(0, 8);
  if (!facts.length) return { ok: false, reason: 'empty' };
  let profile = { tone: '', phrases: [], facts: [], updatedAt: null };
  if (fs.existsSync(VOICE_PROFILE)) {
    try {
      profile = JSON.parse(fs.readFileSync(VOICE_PROFILE, 'utf8'));
    } catch {
      /* */
    }
  }
  for (const f of facts) {
    const slice = f.slice(0, 300);
    if (!profile.facts.includes(slice)) profile.facts.push(slice);
  }
  profile.facts = profile.facts.slice(0, 30);
  profile.updatedAt = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VOICE_PROFILE, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return { ok: true, profile };
}

/**
 * @param {object} debrief
 */
export function buildFollowUpDraft(debrief) {
  const company = debrief.company || 'компании';
  const title = debrief.title || 'позиции';
  return (
    `Здравствуйте!\n\n` +
    `Спасибо за собеседование на ${title} в ${company}. ` +
    `Было интересно обсудить задачи и формат работы. ` +
    `Остаюсь на связи и готов к следующему этапу.\n\n` +
    `С уважением`
  );
}

export function detectVideoCapabilities() {
  let gpuName = '';
  let rtxEligible = false;
  const r = spawnSync('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (r.status === 0) {
    gpuName = (r.stdout || '').trim().split('\n')[0] || '';
    rtxEligible = /rtx\s*20|rtx\s*30|rtx\s*40|rtx\s*50/i.test(gpuName);
  }
  const broadcastPath = path.join(
    process.env.ProgramFiles || 'C:\\Program Files',
    'NVIDIA Corporation',
    'NVIDIA Broadcast',
    'NVIDIA Broadcast.exe'
  );
  const broadcastInstalled = fs.existsSync(broadcastPath);
  return {
    os: process.platform,
    gpuName,
    rtxEligible,
    broadcastInstalled,
    broadcastPath: broadcastInstalled ? broadcastPath : null,
    virtualCamLikely: broadcastInstalled,
  };
}
