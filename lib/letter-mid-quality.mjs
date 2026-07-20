/**
 * Mid DevOps letter quality (SESSION-2026-07-20-letter-quality-fix L0).
 * Junior-stretch / informal brand greeting / min length floor.
 */

const JUNIOR_STRETCH_RE =
  /учебн\w*\s+стенд|на\s+учебн|знаком\s+на\s+учеб|уже\s+практикуюсь|практикуюсь\s+в\s+проектах|pet-проект|(?:^|[^\p{L}])pet(?:-|\s)/iu;

const INFORMAL_OPEN_RE = /^привет[!.,\s]/i;

/** Крупные бренды / банк — не «Привет!» */
const BRAND_TITLE_RE =
  /каспер|сбер|яндекс|тиньк|т-банк|втб|альфа|мтс|билайн|магнит|дом\.?рф|флант|wildberries|ozon|авито|хх|hh\.ru|лаборатори/i;

/**
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string }}
 */
export function detectJuniorStretchLetter(text) {
  if (String(process.env.HH_LETTER_ALLOW_JUNIOR_STRETCH || '').trim() === '1') {
    return { ok: true };
  }
  const t = String(text || '');
  if (JUNIOR_STRETCH_RE.test(t)) {
    return {
      ok: false,
      reason:
        'junior-stretch в письме (учебн*/практикуюсь/pet) — для mid DevOps пишите коммерческий контур',
    };
  }
  return { ok: true };
}

/**
 * @param {object} rec
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string }}
 */
export function detectInformalBrandGreeting(rec, text) {
  const t = String(text || '').trim();
  if (!INFORMAL_OPEN_RE.test(t)) return { ok: true };
  const blob = `${rec?.company || ''} ${rec?.employer || ''} ${rec?.title || ''}`;
  if (BRAND_TITLE_RE.test(blob)) {
    return {
      ok: false,
      reason: 'для бренда/банка не «Привет!» — начните с «Здравствуйте»',
    };
  }
  return { ok: true };
}

/**
 * Мин. длина для devops/infra mid (откат HH_LETTER_MIN_CHARS=0).
 * @param {object} prefs
 * @param {string} [huntTrack]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveLetterMinLength(prefs = {}, huntTrack = '', env = process.env) {
  const base = Number(prefs.batchLetterMinLength || 90);
  const raw = String(env.HH_LETTER_MIN_CHARS ?? '').trim();
  if (raw === '0') return base;
  if (raw && Number.isFinite(Number(raw))) return Math.max(base, Number(raw));
  const track = String(huntTrack || '').toLowerCase();
  if (track === 'devops' || track === 'infra' || track === 'l2l3') {
    return Math.max(base, 320);
  }
  return base;
}

/**
 * L1.6: только «2+/3+ сервиса» без коммерческого факта — не mid-метрика.
 * Откат: HH_LETTER_ALLOW_WEAK_VOLUME=1.
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string, weakVolumeOnly?: boolean }}
 */
export function detectWeakVolumeOnlyMetric(text) {
  if (String(process.env.HH_LETTER_ALLOW_WEAK_VOLUME || '').trim() === '1') {
    return { ok: true };
  }
  const t = String(text || '');
  if (
    /MTTR|SLA\s*>?\s*\d|7000\+|Softline|IT_One|−\s*\d+\s*%|-\s*\d+\s*%|примерно\s+на\s+\d+\s*%|~\s*78\s*%|~\s*93\s*%/i.test(
      t
    )
  ) {
    return { ok: true };
  }
  const hasWeakVolume = /\d+\s*\+\s*(?:сервис|инстанс|контур)/i.test(t);
  if (!hasWeakVolume) return { ok: true };

  const digits = t.match(/\d+/g) || [];
  const meaningful = digits.filter((d) => {
    if (/^20\d{2}$/.test(d)) return false; // «2026» — дата, не метрика
    if (/^[2-5]$/.test(d)) return false; // N из «N+ сервисов»
    return true;
  });
  if (meaningful.length === 0) {
    return {
      ok: false,
      weakVolumeOnly: true,
      reason:
        'слабая метрика «N+ сервисов/инстансов» без коммерческого факта (IT_One / Softline / SLA / %) — добавьте факт из опыта',
    };
  }
  return { ok: true };
}

/**
 * DevOps title + MSSQL/реплики в первом абзаце = L2 framing.
 * @param {object} rec
 * @param {string} text
 */
export function detectDevopsDbFirstFraming(rec, text) {
  const title = String(rec?.title || '');
  if (!/devops|sre|platform|vault|idp/i.test(title)) return { ok: true };
  if (/dba|баз\s+данн|mssql|postgres\s+dba/i.test(title)) return { ok: true };
  // Без приветствия: иначе «Здравствуйте!» съедает слот opening.
  const body = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:здравствуйте|добрый\s+день|привет)[!,.]?\s*/i, '');
  const first = body.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  // «Откликаюсь на DevOps» не спасает MSSQL-first — нужен CI/Vault/автоматизация в opening.
  if (
    /MSSQL|MySQL|реплик\w*|бэкап\w*\s+баз/i.test(first) &&
    !/ci\/?cd|kubernetes|\bk8s\b|vault|gitlab|автоматизац|пайплайн|pipeline|секрет/i.test(first)
  ) {
    return {
      ok: false,
      reason: 'DevOps-вакансия: не открывайте письмо MSSQL/репликами (L2) — сначала Linux/CI/мониторинг',
    };
  }
  return { ok: true };
}
