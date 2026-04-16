/**
 * Локальный мини-дашборд: http://127.0.0.1:3849
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { loadEnv } from '../lib/load-env.mjs';
loadEnv();

import { ROOT, HH_APPLY_CHAT_LOG_FILE, DATA_DIR, HARVEST_DASHBOARD_TICK_FILE } from '../lib/paths.mjs';
import { countApplyLaunchesLastHour, recordApplyLaunch } from '../lib/hh-apply-rate.mjs';
import {
  loadQueue,
  updateVacancyRecord,
  getVacancyRecord,
  removeVacancyRecord,
} from '../lib/store.mjs';
import { loadPreferences } from '../lib/preferences.mjs';
import {
  recordPassesMinSalary,
  recordHasDescription,
  recordPassesLlmList,
  recordPassesNotFirstLine,
} from '../lib/filters.mjs';
import { appendFeedback } from '../lib/feedback-context.mjs';
import { loadCvBundle } from '../lib/cv-load.mjs';
import {
  createLlmRoutingContext,
  hasScoreProviderCredentials,
  scoreVacancyWithLlm,
} from '../lib/openrouter-score.mjs';
import {
  generateCoverLetterVariants,
  normalizeVariants,
} from '../lib/cover-letter-openrouter.mjs';
import { appendCoverLetterUserEditSnippet } from '../lib/cover-letter-user-edits.mjs';
import { fetchVacancyTextFromHh } from '../lib/refresh-vacancy-from-hh.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(ROOT, 'dashboard', 'public');
const PORT = Number(process.env.DASHBOARD_PORT || 3849) || 3849;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Последние строки лога сценария отклика (для UI и отладки).
 * @param {number} lineCount
 */
function readApplyChatLogTail(lineCount) {
  const n = Math.min(500, Math.max(1, Number(lineCount) || 80));
  if (!fs.existsSync(HH_APPLY_CHAT_LOG_FILE)) {
    return { exists: false, lines: [], text: '' };
  }
  const raw = fs.readFileSync(HH_APPLY_CHAT_LOG_FILE, 'utf8');
  const all = raw.split('\n');
  const slice = all.length > n ? all.slice(-n) : all;
  const text = slice.join('\n');
  return { exists: true, lines: slice, text, path: HH_APPLY_CHAT_LOG_FILE };
}


function getMaxApplyChatPerHour() {
  try {
    const p = loadPreferences();
    const n = Number(p.hhApplyChatMaxPerHour);
    if (Number.isFinite(n) && n >= 1) return Math.min(100, Math.floor(n));
  } catch {
    /* ignore */
  }
  return 8;
}

/** Без завершающего слэша, кроме корня `/` — иначе `/api/foo/` не совпадёт с маршрутом. */
function requestPathname(url) {
  let p = url.pathname || '/';
  if (p !== '/') p = p.replace(/\/+$/, '');
  return p || '/';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 2_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || '127.0.0.1';
  const url = new URL(req.url || '/', `http://${host}`);
  const pathname = requestPathname(url);

  if (req.method === 'GET' && pathname === '/api/harvest-tick') {
    if (!fs.existsSync(HARVEST_DASHBOARD_TICK_FILE)) {
      return sendJson(res, 200, { sequence: 0, addedThisRun: null, at: null });
    }
    try {
      const raw = fs.readFileSync(HARVEST_DASHBOARD_TICK_FILE, 'utf8').trim();
      const data = JSON.parse(raw);
      return sendJson(res, 200, data);
    } catch {
      return sendJson(res, 200, { sequence: 0, addedThisRun: null, at: null });
    }
  }

  if (req.method === 'GET' && pathname === '/api/vacancies') {
    const status = url.searchParams.get('status') || 'pending';
    let prefs = {};
    try {
      prefs = loadPreferences();
    } catch {
      /* ignore */
    }
    const q = loadQueue()
      .filter((x) => x.status === status)
      .filter((x) => recordHasDescription(x))
      .filter((x) => recordPassesNotFirstLine(x))
      .filter((x) => recordPassesLlmList(x))
      .filter((x) => recordPassesMinSalary(x, prefs));
    q.sort(
      (a, b) =>
        (b.scoreOverall ?? b.geminiScore ?? 0) - (a.scoreOverall ?? a.geminiScore ?? 0)
    );
    return sendJson(res, 200, { items: q });
  }

  if (req.method === 'GET' && pathname === '/api/cover-letters') {
    const letterStatus = url.searchParams.get('status') || 'pending';
    if (!['pending', 'approved', 'declined'].includes(letterStatus)) {
      return sendJson(res, 400, { error: 'status: pending | approved | declined' });
    }
    const q = loadQueue()
      .filter((x) => x.coverLetter?.status === letterStatus)
      .filter((x) => recordHasDescription(x))
      .filter((x) => recordPassesNotFirstLine(x))
      .filter((x) => recordPassesLlmList(x));
    q.sort(
      (a, b) =>
        (b.scoreOverall ?? b.geminiScore ?? 0) - (a.scoreOverall ?? a.geminiScore ?? 0)
    );
    return sendJson(res, 200, { items: q });
  }

  if (req.method === 'GET' && pathname === '/api/hh-apply-chat-log') {
    const lines = url.searchParams.get('lines');
    const tail = readApplyChatLogTail(lines);
    const rel = path.relative(ROOT, HH_APPLY_CHAT_LOG_FILE).replace(/\\/g, '/');
    const relativePath =
      rel && rel !== '.' && !rel.startsWith('..') ? rel : 'data/hh-apply-chat.log';
    return sendJson(res, 200, {
      ...tail,
      relativePath,
    });
  }

  if (req.method === 'GET' && pathname === '/api/preferences') {
    try {
      const p = loadPreferences();
      return sendJson(res, 200, { preferences: p });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/action') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, action, reason } = body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return sendJson(res, 400, { error: 'Нужны id и action: approve | reject' });
    }

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (rec.status !== 'pending') {
      return sendJson(res, 409, { error: 'Уже обработана' });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    updateVacancyRecord(id, {
      status: nextStatus,
      feedbackReason: String(reason || '').trim(),
    });

    appendFeedback({
      at: new Date().toISOString(),
      action,
      reason: String(reason || '').trim(),
      vacancyId: rec.vacancyId,
      title: rec.title,
      recordId: id,
      url: rec.url,
    });

    return sendJson(res, 200, { ok: true, status: nextStatus });
  }

  if (req.method === 'POST' && pathname === '/api/vacancy/refresh-body') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (!rec.url) return sendJson(res, 400, { error: 'У записи нет url' });

    let parsed;
    try {
      parsed = await fetchVacancyTextFromHh(rec.url);
    } catch (e) {
      return sendJson(res, 502, { error: e.message || 'Не удалось загрузить страницу вакансии' });
    }

    const desc = String(parsed.description || '');
    const now = new Date().toISOString();
    const title = parsed.title || rec.title;
    const company = parsed.company || rec.company;
    const salaryRaw = parsed.salaryRaw || rec.salaryRaw;

    const patch = {
      title,
      company,
      salaryRaw,
      descriptionPreview: desc.slice(0, 600),
      descriptionForLlm: desc.slice(0, 6000),
      vacancyBodyRefreshedAt: now,
    };

    let scoreUpdated = false;
    let scoreError = null;

    if (hasScoreProviderCredentials()) {
      try {
        const cvBundle = await loadCvBundle();
        if (!cvBundle.text.trim()) {
          scoreError = 'Нет текста CV в CV/ — оценка пропущена';
        } else {
          const prefs = loadPreferences();
          const llm = await scoreVacancyWithLlm(
            {
              title,
              company,
              salaryRaw,
              description: desc,
              url: rec.url,
            },
            cvBundle,
            prefs,
            createLlmRoutingContext()
          );
          Object.assign(patch, {
            llmProvider: llm.llmSource === 'custom' ? 'openai-compatible' : 'openrouter',
            openRouterModel: llm.providerModel || null,
            scoreVacancy: llm.scoreVacancy,
            scoreCvMatch: llm.scoreCvMatch,
            scoreOverall: llm.scoreOverall,
            geminiScore: llm.scoreOverall ?? llm.score,
            geminiSummary: llm.summary,
            geminiRisks: llm.risks,
            geminiMatchCv: llm.matchCv,
            geminiTags: llm.tags,
          });
          scoreUpdated = true;
        }
      } catch (e) {
        scoreError = e.message || String(e);
      }
    } else {
      scoreError = 'Нет OpenRouter и не настроен HH_CUSTOM_LLM_* — обновлён только текст с hh.ru';
    }

    updateVacancyRecord(id, patch);

    const next = getVacancyRecord(id);
    return sendJson(res, 200, {
      ok: true,
      vacancyBodyRefreshedAt: now,
      scoreUpdated,
      scoreError,
      item: next,
    });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/generate') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, force } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const prev = rec.coverLetter;
    if (prev?.status === 'approved' && !force) {
      return sendJson(res, 409, {
        error: 'Письмо уже утверждено. Отправьте force: true для перегенерации.',
      });
    }

    if (!hasScoreProviderCredentials()) {
      return sendJson(res, 503, {
        error: 'Нужен OpenRouter_API_KEY или HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL',
      });
    }

    let cvBundle;
    try {
      cvBundle = await loadCvBundle();
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'Не удалось загрузить CV' });
    }
    if (!cvBundle.text.trim()) {
      return sendJson(res, 400, { error: 'Нет текста CV — положите файлы в папку CV/' });
    }

    let result;
    try {
      result = await generateCoverLetterVariants(rec, cvBundle);
    } catch (e) {
      const raw = String(e?.message || e || 'Ошибка LLM');
      let error = raw;
      if (/\b429\b|rate\s*limit|Rate limit exceeded|лимит/i.test(raw)) {
        error =
          'Лимит запросов OpenRouter (часто дневной лимит бесплатных моделей). ' +
          'Запустите Ollama и задайте HH_CUSTOM_LLM_BASE_URL + HH_CUSTOM_LLM_MODEL в .env как запасной канал, ' +
          'или подождите / пополните баланс на openrouter.ai.';
      } else if (raw.length > 600) {
        error = `${raw.slice(0, 600)}…`;
      }
      return sendJson(res, 502, { error });
    }

    const now = new Date().toISOString();
    const coverLetter = {
      status: 'pending',
      variants: result.variants,
      approvedText: '',
      openRouterModel: result.providerModel || null,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });

    return sendJson(res, 200, { ok: true, coverLetter });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/save-draft') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, variants: rawVariants } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    if (rec.coverLetter?.status !== 'pending') {
      return sendJson(res, 409, { error: 'Черновик можно править только в статусе «на согласовании»' });
    }

    const normalized = normalizeVariants(rawVariants, { forSaveDraft: true });
    const now = new Date().toISOString();
    const prev = rec.coverLetter || {};
    const coverLetter = {
      ...prev,
      status: 'pending',
      variants: normalized,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });

    const snippet = normalized.filter(Boolean).join('\n---\n').trim();
    if (snippet) appendCoverLetterUserEditSnippet(snippet);

    return sendJson(res, 200, { ok: true, coverLetter });
  }

  if (req.method === 'POST' && pathname === '/api/cover-letter/action') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id, action, text } = body;
    if (!id || !['approve', 'decline'].includes(action)) {
      return sendJson(res, 400, { error: 'Нужны id и action: approve | decline' });
    }

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });

    const now = new Date().toISOString();
    const model = rec.coverLetter?.openRouterModel ?? null;

    if (action === 'approve') {
      const t = String(text || '').trim();
      if (!t) return sendJson(res, 400, { error: 'Для approve нужен непустой text' });
      const coverLetter = {
        status: 'approved',
        variants: [],
        approvedText: t,
        openRouterModel: model,
        updatedAt: now,
      };
      updateVacancyRecord(id, { coverLetter });
      return sendJson(res, 200, { ok: true, coverLetter });
    }

    const coverLetter = {
      status: 'declined',
      variants: [],
      approvedText: '',
      openRouterModel: model,
      updatedAt: now,
    };
    updateVacancyRecord(id, { coverLetter });
    return sendJson(res, 200, { ok: true, coverLetter });
  }

  if (req.method === 'POST' && pathname === '/api/hh-launch-apply-chat') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });

    const rec = getVacancyRecord(id);
    if (!rec) return sendJson(res, 404, { error: 'Запись не найдена' });
    const letter = String(rec.coverLetter?.approvedText || '').trim();
    if (!letter) {
      return sendJson(res, 400, {
        error: 'Нет утверждённого письма — сначала утвердите текст в «Черновик письма»',
      });
    }

    const scriptPath = path.join(ROOT, 'scripts', 'hh-apply-chat-letter.mjs');
    if (!fs.existsSync(scriptPath)) {
      return sendJson(res, 500, { error: 'Скрипт hh-apply-chat-letter.mjs не найден' });
    }

    const maxApply = getMaxApplyChatPerHour();
    if (countApplyLaunchesLastHour() >= maxApply) {
      return sendJson(res, 429, {
        error: `Слишком частые отклики: максимум ${maxApply} запусков в час (hhApplyChatMaxPerHour в preferences.json).`,
      });
    }
    recordApplyLaunch();

    fs.mkdirSync(DATA_DIR, { recursive: true });
    const header = `\n======== ${new Date().toISOString()} recordId=${id} launch dashboard pid=${process.pid} ========\n`;
    fs.appendFileSync(HH_APPLY_CHAT_LOG_FILE, header, 'utf8');

    /**
     * detached + pipe ломает дочерний процесс (буфер stdout заполняется).
     * Пишем stdout/stderr в файл через унаследованный fd.
     */
    const logFd = fs.openSync(HH_APPLY_CHAT_LOG_FILE, 'a');
    let child;
    try {
      child = spawn(process.execPath, [scriptPath, `--id=${id}`], {
        cwd: ROOT,
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: process.env,
      });
    } finally {
      fs.closeSync(logFd);
    }

    child.on('exit', (code, signal) => {
      const line = `\n--- child exit code=${code} signal=${signal || ''} at ${new Date().toISOString()} ---\n`;
      try {
        fs.appendFileSync(HH_APPLY_CHAT_LOG_FILE, line, 'utf8');
      } catch {
        /* ignore */
      }
    });

    child.unref();

    return sendJson(res, 200, {
      ok: true,
      pid: child.pid,
      logFile: path.relative(ROOT, HH_APPLY_CHAT_LOG_FILE),
      logFileAbsolute: HH_APPLY_CHAT_LOG_FILE,
    });
  }

  if (req.method === 'POST' && pathname === '/api/dismiss') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'Нужен id' });
    if (!removeVacancyRecord(id)) {
      return sendJson(res, 404, { error: 'Запись не найдена' });
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api')) {
    return sendJson(res, 404, { error: 'Неизвестный путь API', path: pathname });
  }

  const staticRel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(STATIC_DIR, staticRel);
  const staticRoot = path.resolve(STATIC_DIR);
  filePath = path.resolve(filePath);
  if (!filePath.startsWith(staticRoot + path.sep) && filePath !== staticRoot) {
    res.writeHead(403);
    return res.end();
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Дашборд: http://127.0.0.1:${PORT}`);
});
