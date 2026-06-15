/**
 * Не запускать harvest/sync/рутину, пока идёт батч или занят профиль Chromium.
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths.mjs';
import { getJobStatus, isProcessAlive } from './job-pids.mjs';
import { getBatchControlSummary } from './batch-control.mjs';
import { getBrowserLockInfo } from './chromium-session.mjs';

const SIDE_PID_FILES = {
  syncResponses: 'sync-responses.pid',
  syncChats: 'sync-chats.pid',
  dailyRoutine: 'daily-routine.pid',
  resumeRaise: 'resume-raise.pid',
  chatReplySend: 'chat-send-reply.pid',
};

function readSidePid(file) {
  try {
    const n = Number(fs.readFileSync(path.join(DATA_DIR, file), 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Собственный PID не считаем «занятостью» — иначе скрипт блокирует сам себя. */
function isOtherProcessAlive(pid) {
  if (!pid || pid === process.pid) return false;
  return isProcessAlive(pid);
}

export function setSideJobPid(key, pid) {
  const file = SIDE_PID_FILES[key];
  if (!file) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (pid) fs.writeFileSync(path.join(DATA_DIR, file), String(pid), 'utf8');
  else {
    try {
      fs.unlinkSync(path.join(DATA_DIR, file));
    } catch {
      /* ignore */
    }
  }
}

export function getSideJobsStatus() {
  const out = {};
  for (const [key, file] of Object.entries(SIDE_PID_FILES)) {
    const pid = readSidePid(file);
    const running = isOtherProcessAlive(pid);
    if (pid && !running) {
      try {
        fs.unlinkSync(path.join(DATA_DIR, file));
      } catch {
        /* ignore */
      }
    }
    out[key] = { pid: running ? pid : null, running };
  }
  return out;
}

/**
 * @returns {{ busy: boolean, reason?: string, message?: string }}
 */
export function getBrowserBusyState() {
  const st = getJobStatus();
  const bc = getBatchControlSummary();
  const batchAlive = Boolean(st.batch?.running || bc.batchRunning);
  const applyChildBusy = Boolean(bc.activeChildPid && isProcessAlive(bc.activeChildPid));
  const batchPausedIdle = bc.command === 'paused' && !applyChildBusy;

  if (batchAlive && !batchPausedIdle) {
    return {
      busy: true,
      reason: 'batch',
      message: applyChildBusy
        ? 'Сейчас идёт отклик в батче. Дождитесь паузы или стопа — синхронизация hh.ru использует тот же профиль Chromium.'
        : 'Сейчас идёт батч откликов. Дождитесь паузы или стопа — синхронизация hh.ru использует тот же профиль Chromium.',
    };
  }

  if (st.harvest?.running) {
    return {
      busy: true,
      reason: 'harvest',
      message: 'Сейчас идёт сбор вакансий (harvest). Дождитесь завершения или остановите сбор.',
    };
  }

  const side = getSideJobsStatus();
  if (side.syncResponses?.running) {
    return {
      busy: true,
      reason: 'sync-responses',
      message: 'Уже выполняется синхронизация откликов с hh.ru.',
    };
  }
  if (side.syncChats?.running) {
    return {
      busy: true,
      reason: 'sync-chats',
      message: 'Уже выполняется синхронизация чатов.',
    };
  }
  if (side.dailyRoutine?.running && process.env.HH_DAILY_ROUTINE_CHILD !== '1') {
    return {
      busy: true,
      reason: 'daily-routine',
      message: 'Уже выполняется утренний цикл.',
    };
  }
  if (side.resumeRaise?.running) {
    return {
      busy: true,
      reason: 'resume-raise',
      message: 'Уже выполняется подъём резюме на hh.ru.',
    };
  }
  if (side.chatReplySend?.running) {
    return {
      busy: true,
      reason: 'chat-reply-send',
      message: 'Уже выполняется отправка сообщения в чат.',
    };
  }

  const lock = getBrowserLockInfo();
  if (lock.held && lock.owner && !/batch/i.test(String(lock.owner))) {
    return {
      busy: true,
      reason: 'browser-lock',
      message: `Профиль Chromium занят (${lock.owner}). Закройте лишнее окно hh.ru или дождитесь завершения задачи.`,
    };
  }

  return { busy: false };
}

/**
 * @param {string} [label]
 */
export function assertBrowserFreeForSideJob(label = 'операция') {
  const s = getBrowserBusyState();
  if (s.busy) {
    const err = new Error(s.message || `Нельзя запустить ${label}: браузер занят`);
    err.code = 'BROWSER_BUSY';
    throw err;
  }
}
