/**
 * Русские подписи UI (без англицизмов tier/ingest в лице пользователя).
 */
import { recordQuestionnaireNeedsRelabel } from './questionnaire-labels.mjs';

/** Короткая метка оценки вакансии */
export const TIER_SHORT = { A: 'топ', B: 'хор.', C: 'слаб.', D: 'г' };

/** Подпись оценки для фильтров и крошек */
export const TIER_CLASS_LABEL = {
  all: 'Все оценки',
  A: 'Топ',
  B: 'Хорошие',
  C: 'Слабые',
  D: 'Очень слабые',
};

/** Бейдж инстанса дашборда для multi-profile режима */
export const INSTANCE_BADGE_LABELS = {
  emil: 'Эмиль · DevOps',
  anastasia: 'Анастасия · QA',
};

/** @param {string} instanceId @param {number | string} port */
export function formatInstanceBadge(instanceId, port) {
  const id = String(instanceId || '').trim().toLowerCase();
  const label = INSTANCE_BADGE_LABELS[id] || (id ? id : 'Профиль');
  const n = Number(port);
  return Number.isFinite(n) && n > 0 ? `${label} · :${n}` : label;
}

/** @param {string} tier */
export function tierShortLabel(tier) {
  const t = String(tier || '').toUpperCase();
  return TIER_SHORT[t] || t;
}

/** @param {string} tier */
export function tierClassLabel(tier) {
  const t = String(tier || '').toUpperCase();
  return TIER_CLASS_LABEL[t] || (t ? `Оценка ${t}` : '');
}

/** Стадии воронки откликов (корзины A–F) */
export const OUTCOME_BUCKET_LABELS = {
  A: 'Закрыли вакансию',
  B: 'Тишина',
  C: 'Шаблонный отказ',
  D: 'Диалог',
  E: 'Собеседование',
  F: 'Оффер',
};

/** Короткая подпись для плиток воронки */
export const OUTCOME_BUCKET_SHORT = {
  A: 'Закрыли',
  B: 'Тишина',
  C: 'Отказ',
  D: 'Диалог',
  E: 'Собес',
  F: 'Оффер',
};

/** @param {string} bucket */
export function outcomeBucketLabel(bucket, { short = false } = {}) {
  const b = String(bucket || '').toUpperCase();
  const map = short ? OUTCOME_BUCKET_SHORT : OUTCOME_BUCKET_LABELS;
  return map[b] || b;
}

/** Подписи источников для UI */
export const SOURCE_UI_LABELS = {
  hh: 'hh.ru',
  habr: 'Хабр',
  telegram: 'Telegram',
  ats: 'Сайт компании',
  jobboard: 'Доска вакансий',
};

/** Пресеты суфлёра */
export const PROMPT_PRESET_LABELS = {
  thesis: 'Кратко',
  star: 'СТАР',
  key5: '5 тезисов',
  full: 'Полный',
  script: 'Сценарий',
  live: 'Живой',
};

/** Источник детектора статуса hh.ru (не показывать сырой id в simple) */
export const HH_SITE_STATE_SOURCE_LABELS = {
  'already-applied-ui': 'кнопка hh.ru',
  'already-applied-banner': 'баннер hh.ru',
  'already-applied-button': 'кнопка отклика',
  'response-link-disabled': 'ссылка отклика',
  'response-button-disabled': 'кнопка отклика',
  'response-page-applied': 'страница отклика',
  'response-page-go-vacancy': 'страница вакансии',
  archived: 'архив вакансии',
  'invited-banner': 'баннер на hh.ru',
  'declined-banner': 'баннер на hh.ru',
  'no-response-button': 'нет кнопки отклика',
  ok: 'страница вакансии',
  store: 'история дашборда',
};

/** @param {string} source @param {{ expert?: boolean }} [opts] */
export function hhSiteStateSourceLabel(source, opts = {}) {
  const s = String(source || '').trim();
  if (!s) return '';
  const ru = HH_SITE_STATE_SOURCE_LABELS[s];
  if (opts.expert) return ru ? `${ru} (${s})` : s;
  return ru || '';
}

/** Причины пропуска отклика (batch / point) → русская подпись */
export const APPLY_SKIP_REASON_RU = {
  resume_visibility: 'видимость резюме на hh (нужны клиенты HH)',
  resume_visibility_preflight_error: 'не удалось проверить видимость резюме на hh',
  'hygiene:low-fit': 'гигиена очереди: низкий балл',
};

/**
 * @param {string} reason
 * @returns {string}
 */
export function applySkipReasonRuLabel(reason) {
  const r = String(reason || '').trim();
  if (!r) return '';
  if (APPLY_SKIP_REASON_RU[r]) return APPLY_SKIP_REASON_RU[r];
  const lowFit = r.match(/^hygiene:low-fit(?:<(\d+))?$/i);
  if (lowFit) {
    return lowFit[1]
      ? `гигиена очереди: балл ниже ${lowFit[1]}`
      : 'гигиена очереди: низкий балл';
  }
  if (/resume_visibility/i.test(r)) return APPLY_SKIP_REASON_RU.resume_visibility;
  return r;
}

/** Подсказка при gate live/post в хабе */
export const COPILOT_LIVE_GATE_TOAST =
  'Сначала завершите живой режим — или переключитесь на «Учебную встречу» в Собеседованиях.';

/** Баннер live prep gate в хабе (трек D · GET /api/copilot/ready) */
export const COPILOT_LIVE_PREP_GATE_COPY = {
  bannerTitle: 'Суфлёр пока не готов',
  bannerLead:
    'Проверка дашборда или захвата звука не прошла — зелёную кнопку старта пока нельзя нажать.',
  bannerCta: 'npm run devops:fresh-desktop-env',
  bannerHint: 'Как починить: команда в терминале проекта, затем Ctrl+R в Desktop.',
  bannerFixSummary: 'Как починить',
  checking: 'Проверяем готовность…',
  readyShort: 'Суфлёр готов к запуску',
  blockedBtnTitle: 'Суфлёр пока недоступен',
};

/**
 * @param {Array<{ id?: number, status?: string, message?: string }> | null | undefined} checks
 * @returns {Array<{ id?: number, status?: string, message?: string }>}
 */
export function copilotLivePrepFailedChecks(checks) {
  return (checks || []).filter((c) => Number(c.id) <= 3 && c.status === 'fail');
}

/**
 * @param {Array<{ message?: string }> | null | undefined} failed
 */
export function copilotLivePrepBlockTooltip(failed) {
  if (!failed?.length) return '';
  return failed
    .map((c) => String(c.message || '').trim())
    .filter(Boolean)
    .join(' · ');
}

/** Модалка «Качество писем» */
export const LETTER_SERIES_READY_LABEL = 'Готовность серии писем';
export const LETTER_SERIES_READY_HINT =
  'Доля вакансий в очереди с утверждённым письмом — не успех последнего отклика.';

/** Источник текста суфлёра */
export const PROMPT_SOURCE_LABELS = {
  prep: 'План собеса',
  'mock-tech': 'Тех. вопросы',
  'mock-hr': 'HR-скрининг',
  manual: 'Вручную',
  loading: 'Загрузка',
  live: 'Живой режим',
  replay: 'Репетиция',
};

/** @param {string} preset */
export function promptPresetLabel(preset) {
  const p = String(preset || '').toLowerCase();
  return PROMPT_PRESET_LABELS[p] || p;
}

/** @param {string} source */
export function promptSourceLabel(source) {
  const s = String(source || '');
  return PROMPT_SOURCE_LABELS[s] || s;
}

/** Вкладки панели copilot */
export const COPILOT_TAB_LABELS = {
  prep: 'Перед стартом',
  live: 'Во время',
  replay: 'Репетиция',
  post: 'После',
};

/** Мастер готовности */
export const COPILOT_WIZARD_STEPS = {
  context: 'Контекст слота',
  audio: 'Звук с созвона',
  overlay: 'Окно поверх встречи',
  start: 'Старт',
};

/** Подписи экрана «Собеседования». */
export const INTERVIEW_HUB_UX_COPY = {
  meetingsNav: 'Встречи',
  offersNav: 'Офферы',
  emptyNav: 'Пока нет приглашений — выберите учебную встречу',
  emptyDetail: 'Выберите встречу слева',
  demoNavLabel: 'Учебная встреча',
  demoNavMeta: 'без приглашения с hh.ru',
  tabPrep: 'Подготовка',
  tabMaterials: 'Материалы',
  tabAfter: 'После',
  actionsTitle: 'Действия',
  prepareCta: 'Подготовить к встрече',
  prepareCtaTitle: 'Режим суфлёра по этапу, отметить готовность, открыть сценарий',
  desktopLive: 'Включить суфлёр поверх Zoom',
  desktopLiveTitle: 'Окно подсказок поверх встречи и захват звука — нужен HH Ai Desktop',
  openFullCopilot: 'Полная панель суфлёра',
  audioSettings: 'Настройки звука',
  slotEdit: 'Изменить дату и ссылку',
  slotDetails: 'Дата, ссылка и этап',
  criteriaDetails: 'Все пункты подготовки',
  criteriaDetailsHint: 'Отмечайте по мере готовности — не обязательно перед первым запуском.',
  outcomeDetails: 'Исход и правки',
  secondaryTitle: 'Ещё: план и вопросы',
  captureDetails: 'Проверка звука',
  expertTools: 'Дополнительно',
  progressReady: 'Готово к встрече',
  progressPartial: 'Готовность',
  prepOverlay: 'Только сценарий поверх',
  startLive: 'Включить суфлёр поверх Zoom',
  startLiveTitle: 'Запуск окна подсказок поверх Zoom',
  startLiveHint: 'Зелёная кнопка включает суфлёр здесь, в этом окне.',
  pathLead: '',
  pathSteps: [],
  nextTitle: 'Действия',
  demoDetails: 'Учебная встреча',
};

/** Чеклист звука — экспертный блок, не главный путь. */
export const INTERVIEW_PREP_CHECKLIST_COPY = {
  title: 'Проверка звука',
  lead: 'Перед запуском суфлёра. Смысл подготовки — во вкладке «Подготовка» у выбранной встречи.',
  audioCheckCta: 'Проверка звука',
  steps: [
    {
      id: 'routing',
      label: 'Маршрут звука Zoom подтверждён',
      hint: 'Проверьте микрофон и звук с созвона перед стартом.',
    },
    {
      id: 'inject',
      label: 'Короткая репетиция: 2–3 техвопроса',
      hint: 'Прогоните короткий сценарий вопрос → ответ.',
    },
    {
      id: 'live-smoke',
      label: 'Проба: «Включить суфлёр поверх Zoom»',
      hint: 'Проверьте окно поверх встречи и статус захвата.',
    },
    {
      id: 'post',
      label: 'После: заметки и правки',
      hint: 'Исход и три правки — во вкладке «После».',
    },
  ],
  captureHealthPrefix: 'Звук',
  captureHealthFresh: 'в порядке',
  captureHealthStale: 'устарел',
  captureHealthMissing: 'нет сигнала',
  captureHealthError: 'ошибка',
  storageHintPrefix: 'Хранение прогресса',
};

/** Подготовка к встрече + форма «После» */
export const PREP_FOUNDATION_HUB_COPY = {
  title: 'Подготовка к встрече',
  empty: 'Маршрут подготовки ещё не заведён. Нужны сценарий и досье по встрече.',
  ready: 'Готово',
  notReady: 'В процессе',
  cycleClosed: 'Встреча закрыта',
  draftNote: 'Авто-черновик; ориентир — ваш сценарий и галочки ниже.',
  scenario: 'Сценарий',
  dossier: 'Досье',
  missingPrefix: 'Ещё не закрыто',
  criteriaTitle: 'Пункты',
  artifactTitle: 'Файлы',
  artifactEmpty: 'Текст сценария или досье появится здесь.',
  formTitle: 'После встречи',
  formLead: 'Исход, что спросили и три правки — чтобы закрыть цикл.',
  outcomeLabel: 'Исход',
  outcomePlaceholder: 'Выберите исход',
  fixLabel: 'Правка',
  fixPlaceholder: 'Что изменить в следующем цикле',
  askedLabel: 'Что спросили',
  askedPlaceholder: 'Кратко: вопросы и темы',
  noteLabel: 'Заметка',
  notePlaceholder: 'По желанию',
  save: 'Сохранить исход',
  errorNeedOutcome: 'Выберите исход',
  errorNeedFixes: 'Нужны три правки',
  errorSaveFailed: 'Не удалось сохранить исход',
  errorArtifactFailed: 'Не удалось открыть файл',
  dayTTitle: 'Перед созвоном',
  dayTLead: 'Выставит режим суфлёра по этапу и откроет сценарий. Потом — зелёная кнопка запуска.',
  dayTCta: 'Подготовить к встрече',
  dayTCtaTitle: 'Режим суфлёра по этапу и открытие сценария',
  dayTPolicyPrefix: 'Суфлёр',
  dayTDoneToastHr: 'Подготовлено: суфлёр выкл (HR) · сценарий открыт',
  dayTDoneToastTech: 'Подготовлено: суфлёр на тех · этап выставлен',
  dayTDoneToastManager: 'Подготовлено: сценарий важнее корпуса · этап «руководитель»',
  dayTError: 'Не удалось подготовить к встрече',
  blocks: {
    A: 'Цель',
    B: 'Контекст',
    C: 'Позиция',
    D: 'Сценарий',
    E: 'Суфлёр',
    F: 'Репетиция',
    G: 'Исход',
  },
  /** Fallback title по id, если API без foundationItems */
  criteria: {
    A1: 'Цель = оффер или следующий этап',
    A2: 'Исход + 3 правки',
    B1: 'Этап встречи известен',
    B2: 'Роль одной фразой',
    B3: 'JD и/или чат HR',
    B4: 'Уроки каталога / прошлых отказов',
    B5: 'Deep-досье заполнено (если триггеры)',
    C1: 'Pitch ~90 с',
    C2: '2 STAR под JD',
    C3: 'Честный gap + план',
    C4: 'Речь: определение → пример',
    D1: 'Карта минут с целями',
    D2: 'Ответы почему они / роль / пробел',
    D3: '4–5 вопросов + закрытие с датой',
    D4: 'Красные флаги «не говорить»',
    E1: 'Решение по суфлёру записано',
    E2: 'Политика суфлёра по этапу',
    E3: 'Два режима (если двухфазный)',
    F1: 'Репетиция вслух',
    F2: 'Шпаргалка 1 экран + ссылка',
    G1: 'Код исхода',
    G2: 'Что спросили (кратко)',
    G3: '3 правки',
    G4: 'Follow-up при необходимости',
  },
  outcomes: {
    advanced_to_tech: 'Прошли на тех',
    advanced_to_manager: 'Прошли к руководителю',
    offer: 'Оффер',
    offer_next_step: 'Следующий шаг к офферу',
    rejected: 'Отказ',
    waiting_feedback: 'Ждём обратную связь',
    deferred_positive_no_verdict: 'Позитивно, без вердикта',
    closed_other: 'Закрыто иначе',
  },
};

/** Коды исхода P7 — те же, что OUTCOME_CODES в lib/interview-prep-route.mjs */
export const PREP_OUTCOME_CODES = Object.freeze([
  'advanced_to_tech',
  'advanced_to_manager',
  'offer',
  'offer_next_step',
  'rejected',
  'waiting_feedback',
  'deferred_positive_no_verdict',
  'closed_other',
]);

/** @param {number} done @param {number} total */
export function interviewPrepChecklistProgressLabel(done, total) {
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
  return safeDone >= safeTotal && safeTotal > 0
    ? 'Готово к «Включить суфлёр поверх Zoom»'
    : `Готовность: ${safeDone}/${safeTotal}`;
}

/** @param {'fresh' | 'stale' | 'missing' | 'error'} status */
export function interviewPrepCaptureHealthLabel(status) {
  const s = String(status || '');
  const map = {
    fresh: INTERVIEW_PREP_CHECKLIST_COPY.captureHealthFresh,
    stale: INTERVIEW_PREP_CHECKLIST_COPY.captureHealthStale,
    missing: INTERVIEW_PREP_CHECKLIST_COPY.captureHealthMissing,
    error: INTERVIEW_PREP_CHECKLIST_COPY.captureHealthError,
  };
  return `${INTERVIEW_PREP_CHECKLIST_COPY.captureHealthPrefix}: ${map[s] || map.missing}`;
}

/** Статусы live */
export const COPILOT_LIVE_STATUS = {
  idle: 'Готов к собесу',
  capturing: 'Запуск захвата…',
  listening: 'Слушаю…',
  tier1: 'Быстрый ответ',
  tier2: 'Уточняю ответ…',
  error: 'Ошибка сессии',
};

/** Сообщения poll захвата (live) */
export const COPILOT_LIVE_CAPTURE_COPY = {
  ready: 'Живой: захват запущен — слушаю loopback (Zoom → CABLE Input).',
  warming: 'Живой: загрузка модели STT (~30 с) — подождите…',
  hearing: 'Живой: слышу речь, формирую ответ…',
  silence:
    'Живой: тишина в кабеле — Zoom «Проверить динамик» или речь во встрече.',
  dead: 'Живой: захват не отвечает — нажмите «Перезапустить суфлёр» в оранжевом баннере выше.',
  restarting: 'Живой: перезапуск захвата и overlay…',
  restarted: 'Живой: перезапуск завершён — ждём STT и loopback…',
};

/** Человекочитаемые флаги offer-guard */
export const COPILOT_GUARD_LABELS = {
  empty: 'Пустой ответ',
  red_flag_tone: 'Тон слишком резкий — смягчили',
  star_weak: 'Добавьте пример (СТАР)',
  spoken_years_mismatch: 'Сверьте годы опыта с тем, что уже сказали',
  spoken_cv_mismatch: 'Цифра не совпадает с резюме и вашим ответом',
};

/** @param {string} flag */
export function copilotGuardLabel(flag) {
  const s = String(flag || '');
  if (COPILOT_GUARD_LABELS[s]) return COPILOT_GUARD_LABELS[s];
  if (s.startsWith('years_mismatch:')) return `Годы опыта: сверьте с резюме (${s.split(':')[1] || '?'})`;
  return s;
}

/** Этапы собеса */
export const COPILOT_STAGE_LABELS = {
  screening: 'Скрининг',
  hr: 'HR / behavioral',
  tech: 'Технический',
  negotiation: 'Переговоры',
  final: 'Финал',
};

/** Учебный слот — единое имя компании в суфлёре */
export const DEMO_SLOT_COMPANY_LABEL = 'Demo Corp';

/** Подсказки под кнопками репетиции (simulate ≠ overlay) */
export const COPILOT_SIMULATE_BTN_HINT =
  'Сухой прогон: вопрос → ответ без overlay (обычно несколько вопросов, не таймлайн записи).';
export const COPILOT_REPLAY_BTN_HINT =
  'Таймлайн по записи: суфлёр с точками ответа на таймкодах (десятки точек по транскрипту).';

/** @param {object} [meta] */
export function isDemoCopilotSlot(meta) {
  const id = meta?.vacancyId || meta?.recordId || meta?.id || '';
  return Boolean(meta?.isDemoInstrument) || id === 'demo-interview-instrument';
}

/** @param {string} [company] @param {boolean} [isDemo] */
export function copilotSlotCompanyLabel(company, isDemo) {
  if (isDemo) return DEMO_SLOT_COMPANY_LABEL;
  return String(company || '').trim();
}

/**
 * Статус после simulate — явно не overlay.
 * @param {{ questionCount?: number, guardCount?: number }} p
 */
export function copilotSimulateStatusLine(p) {
  const n = p.questionCount ?? 0;
  const g = p.guardCount ?? 0;
  return `Прогон завершён: ${n} вопросов (сухой Q→A, без overlay) · guard ${g}. Это не суфлёр — для overlay нажмите «Репетиция → суфлёр».`;
}

/**
 * Статус тика репетиции с «точками ответа».
 * @param {{ time?: string, answerIndex?: number, promptTotal?: number, pregenDone?: number }} p
 */
export function copilotReplayTickStatus(p) {
  const total = p.promptTotal ?? 0;
  const done = p.pregenDone ?? '?';
  const time = p.time || '0:00';
  const idx = p.answerIndex;
  const pos =
    idx != null && idx >= 0 && total
      ? ` · ответ ${idx + 1} из ${total} точек`
      : total
        ? ` · ${total} точек ответа`
        : '';
  return `Репетиция: ${time}${pos} · готово ${done}/${total} точек ответа`;
}

/** @param {number} promptTotal */
export function copilotReplayStartStatus(promptTotal) {
  const n = promptTotal ?? 0;
  return `Репетиция: ${n} точек ответа по записи. Суфлёр — только текст для речи.`;
}

/**
 * Убрать шум digest (Ghost, tier-C) при учебном прогоне.
 * @param {string[]} suggestions
 * @param {{ demoMode?: boolean }} [opts]
 */
export function filterInterviewHubSuggestions(suggestions, opts = {}) {
  const list = Array.isArray(suggestions) ? suggestions : [];
  if (!opts.demoMode) return list;
  return list.filter((s) => {
    const t = String(s || '');
    if (/^Ghost:/i.test(t)) return false;
    if (/tier[- ]?C/i.test(t)) return false;
    return true;
  });
}

/** Совместимость платформ */
export const COPILOT_COMPAT_ROWS = [
  { id: 'zoom', name: 'Zoom (desktop)', loopback: 'да', dock: 'да', stealth: 'проверьте шаринг' },
  { id: 'telemost', name: 'Телемост (web)', loopback: 'частично', dock: 'да', stealth: 'проверьте шаринг' },
  { id: 'teams', name: 'Teams', loopback: 'частично', dock: 'частично', stealth: 'проверьте шаринг' },
];

/** H-SKILL.1: chip advisory score с pet-практикой (только expert) */
export function inventoryPracticeChipLabel(advisoryScore) {
  const n = Number(advisoryScore);
  return Number.isFinite(n) ? `практика ${n}%` : 'практика';
}

/** @param {object} item */
export function inventoryPracticeTooltip(item) {
  const ms = item?.matchScore || {};
  const line = scoreTooltipPracticeLine(ms);
  const parts = [];
  if (line?.text) parts.push(line.text);
  if (line?.skills) parts.push(`${SCORE_TOOLTIP_COPY.practiceSkills}: ${line.skills}`);
  parts.push(SCORE_TOOLTIP_COPY.autoApplyNote);
  return parts.join(' ');
}

/** S2.1: подписи блока расшифровки балла (simple, без жаргона) */
export const SCORE_TOOLTIP_COPY = {
  sectionScore: 'Оценка вакансии',
  harvest: 'Сбор (модель)',
  fitCv: 'Соответствие резюме на hh',
  fitPracticeBoost: 'Со стартап-практикой',
  fitPracticeNone: 'Со стартап-практикой: без прироста',
  projected: 'После подгонки резюме',
  sectionDetails: 'Детали',
  gap: 'Ключи в описании',
  stack: 'Стек',
  sectionNote: 'Важно',
  interviewChanceTitle: 'Шанс собеса (HR-звонок)',
  interviewNow: 'Сейчас — резюме на hh',
  interviewAfter: 'После доработок программы',
  interviewFocus: 'Порог фокуса',
  interviewFactor: 'Фактор',
  interviewPenalty: 'Штраф',
  interviewBoost: 'Доп. после пакета',
  interviewOfferNote: 'Оффер — отдельный этап; суфлёр — на собеседовании.',
  interviewHarvestNote: 'Совпадение с JD (сбор) — вспомогательно, не равно шансу собеса.',
  autoApplyNote: 'Авто-отклик смотрит на резюме hh, не на стартап-проекты.',
  levelPen: 'Нюанс уровня или роли учтён — оценка сбора не раздувается до 100.',
  practiceSkills: 'Навыки из стартап-проектов',
  llmVacancy: 'Оценка вакансии (модель)',
  llmCv: 'Сходство с вашими CV',
  llmOverall: 'Итог на карточке',
  llmWeightsNote(wv, wc) {
    return `Если модель не вернула свой итог, считается ${wv.toFixed(2)}× вакансия + ${wc.toFixed(2)}× CV (веса из настроек).`;
  },
};

/**
 * @param {object | null | undefined} ms matchScore
 * @returns {{ text: string, skills?: string } | null}
 */
export function scoreTooltipPracticeLine(ms) {
  if (!ms || ms.scoreFitAdvisory == null) return null;
  const advisory = Number(ms.scoreFitAdvisory);
  const fit = Number(ms.scoreFit);
  const boost = Number(ms.inventoryBoost) || 0;
  if (!Number.isFinite(advisory)) return null;
  if (boost > 0 && Number.isFinite(fit)) {
    return {
      text: `${SCORE_TOOLTIP_COPY.fitPracticeBoost}: ${advisory} (+${boost})`,
      skills: formatPracticeSkills(ms.inventoryMatched),
    };
  }
  return {
    text: `${SCORE_TOOLTIP_COPY.fitPracticeNone}${Number.isFinite(advisory) ? ` (${advisory})` : ''}`,
    skills: formatPracticeSkills(ms.inventoryMatched),
  };
}

/** @param {unknown} matched */
function formatPracticeSkills(matched) {
  if (!Array.isArray(matched) || !matched.length) return '';
  return matched.slice(0, 8).join(', ');
}

/** Маршруты охоты (H-TRACKS) — подписи для UI */
export const HUNT_TRACK_LABELS = {
  devops: { short: 'DevOps', title: 'DevOps / SRE' },
  infra: { short: 'Инфра', title: 'Смежная инфра' },
  l2l3: { short: 'Поддержка', title: 'L2 / L3 поддержка' },
  tam: { short: 'TAM', title: 'TAM' },
};

/** @param {string} id */
export function huntTrackChipLabel(id) {
  const track = String(id || '').trim();
  return HUNT_TRACK_LABELS[track]?.short || track;
}

/** @param {{ id?: string, labelRu?: string } | string | null | undefined} track */
export function huntTrackChipTitle(track) {
  const id = typeof track === 'string' ? track : String(track?.id || '').trim();
  const custom = typeof track === 'object' && track ? String(track.labelRu || '').trim() : '';
  const meta = HUNT_TRACK_LABELS[id];
  if (custom) return custom;
  if (meta?.title) return meta.title;
  return id ? `Маршрут ${id}` : '';
}

/** inviteKind — см. docs/HH-NEGOTIATION-STATUS.md */
export const INVITE_KIND_LABELS = {
  real_hr_invite: 'Приглашение от HR',
  silent_invite: 'Статус hh: приглашение (без чата)',
  questionnaire_completed: 'Анкета отправлена',
  hh_tab_stage: 'Воронка hh: Собеседование',
};

const INVITE_KIND_CHIP_SHORT = {
  real_hr_invite: 'приглашение от HR',
  silent_invite: 'hh: приглашение',
  questionnaire_completed: 'анкета отправлена',
  hh_tab_stage: 'воронка: собес',
};

/** @param {string} kind */
export function inviteKindChipLabel(kind) {
  const k = String(kind || '').trim();
  return INVITE_KIND_CHIP_SHORT[k] || '';
}

/** @param {{ tier?: string, labelRu?: string, reason?: string } | null | undefined} roleTier */
export function roleTierChipLabel(roleTier) {
  const tier = String(roleTier?.tier || '').trim();
  const label = String(roleTier?.labelRu || tier || '').trim();
  if (!label) return '';
  if (tier === 'R0') return label;
  if (tier === 'R1') return label;
  if (tier === 'R2') return `${label} · мост`;
  if (tier === 'R3') return `${label}`;
  if (tier === 'R4') return `${label}`;
  return label;
}

/** @param {{ tier?: string, labelRu?: string, reason?: string } | null | undefined} roleTier */
export function roleTierChipTitle(roleTier) {
  const label = roleTierChipLabel(roleTier);
  const reason = String(roleTier?.reason || '').trim();
  const tier = String(roleTier?.tier || '').trim();
  const parts = [label];
  if (tier) parts.push(tier);
  if (reason && !parts.join(' · ').includes(reason)) parts.push(reason);
  if (tier === 'R2') parts.push('В авто-серии — только с одобрением или настройкой R2');
  if (tier === 'R3' || tier === 'R4') parts.push('Вне авто-серии по умолчанию');
  return parts.filter(Boolean).join(' · ');
}

/** @param {{ id?: string, labelRu?: string } | null | undefined} chip */
export function packageChipLabel(chip) {
  return String(chip?.labelRu || chip?.id || '').trim();
}

/** @param {{ packageScore?: number, chips?: { id?: string, labelRu?: string }[] } | null | undefined} packageMeta */
export function packageMetaSummary(packageMeta) {
  const score = Number(packageMeta?.packageScore);
  const chips = (packageMeta?.chips || []).map(packageChipLabel).filter(Boolean);
  const scorePart = Number.isFinite(score) && score > 0 ? `пакет ${score}` : '';
  return [scorePart, ...chips.slice(0, 3)].filter(Boolean).join(' · ');
}

/** @param {{ tier?: string } | null | undefined} roleTier */
export function roleTierAssessmentHeading(roleTier) {
  const label = roleTierChipLabel(roleTier);
  return label ? `Роль: ${label}` : 'Роль на лестнице';
}

const LETTER_FALLBACK_TEMPLATE_RE = /fallback-template/i;
const LETTER_TIER_A_FALLBACK_RE = /tierAFallback|template:cascade/i;

/** @param {string | null | undefined} model */
export function letterProviderModelRaw(model) {
  return String(model || '').trim();
}

/** @param {object | null | undefined} coverLetter */
export function letterProviderModelFromCover(coverLetter) {
  const cl = coverLetter && typeof coverLetter === 'object' ? coverLetter : {};
  return letterProviderModelRaw(cl.providerModel || cl.openRouterModel);
}

/**
 * @param {string | null | undefined} model
 * @returns {'template' | 'fallback' | null}
 */
export function letterFallbackChipKind(model) {
  const m = letterProviderModelRaw(model);
  if (!m) return null;
  if (LETTER_FALLBACK_TEMPLATE_RE.test(m)) return 'template';
  if (LETTER_TIER_A_FALLBACK_RE.test(m) || /tierAFallback/i.test(m)) return 'fallback';
  return null;
}

/** @param {'template' | 'fallback'} kind */
export function letterFallbackChipLabel(kind) {
  return kind === 'template' ? 'шаблон' : 'fallback';
}

/** @param {string | null | undefined} model @param {'template' | 'fallback'} kind */
export function letterFallbackChipTitle(model, kind) {
  const m = letterProviderModelRaw(model);
  const label = letterFallbackChipLabel(kind);
  if (kind === 'template') {
    return `${label} · письмо из шаблона (не LLM) · ${m || 'модель не указана'}`;
  }
  return `${label} · tier A без LLM · ${m || 'модель не указана'}`;
}

export const APPLY_COOLDOWN_CHIP_LABEL = 'кулдаун';

/** @param {string} [reason] */
export function applyCooldownChipTitle(reason) {
  const r = String(reason || '').trim();
  return r
    ? `${APPLY_COOLDOWN_CHIP_LABEL} · ${r}`
    : `${APPLY_COOLDOWN_CHIP_LABEL} · повторный отклик в компанию или стоп-сигнал`;
}

const COOLDOWN_FLAG_CODES = new Set(['duplicate_company', 'cooldown', 'blacklist']);

/**
 * @param {object} item
 * @returns {{ reason: string } | null}
 */
export function detectApplyCooldownMeta(item) {
  if (!item || typeof item !== 'object') return null;

  const intel = item.employerIntel;
  if (intel?.cooldown || intel?.cooldownActive) {
    return {
      reason: String(intel.cooldownReason || intel.cooldownMessage || 'компания в кулдауне'),
    };
  }
  const until = Date.parse(String(intel?.cooldownUntil || item.applyCooldown?.until || ''));
  if (Number.isFinite(until) && until > Date.now()) {
    return {
      reason: String(
        intel?.cooldownReason ||
          item.applyCooldown?.reason ||
          'повторный отклик в эту компанию'
      ),
    };
  }
  if (item.applyCooldown?.active || item.applyCooldown === true) {
    return {
      reason: String(item.applyCooldown?.reason || item.applyCooldown?.message || 'кулдаун отклика'),
    };
  }

  const flagLists = [
    item.redFlags,
    item.applyGate?.redFlags,
    item.applyRedFlags?.flags,
    item.gatePreview?.redFlags,
  ];
  for (const list of flagLists) {
    if (!Array.isArray(list)) continue;
    for (const f of list) {
      if (!f || typeof f !== 'object') continue;
      const code = String(f.code || '').trim();
      const message = String(f.message || f.reason || '').trim();
      if (COOLDOWN_FLAG_CODES.has(code)) return { reason: message || code };
      if (/уже откликал/i.test(message) || /кулдаун/i.test(message)) return { reason: message };
    }
  }

  const reasonLists = [item.applyGate?.reasons, item.gatePreview?.reasons, item.reasons];
  for (const list of reasonLists) {
    if (!Array.isArray(list)) continue;
    for (const line of list) {
      const message = String(line || '').trim();
      if (/уже откликал/i.test(message) || /кулдаун/i.test(message)) return { reason: message };
    }
  }

  const blockers = item.readiness?.blockers;
  if (Array.isArray(blockers)) {
    for (const b of blockers) {
      const code = String(b?.code || '').trim();
      const message = String(b?.message || '').trim();
      if (code === 'duplicate_company' || code === 'cooldown' || /уже откликал/i.test(message)) {
        return { reason: message || code };
      }
    }
  }

  return null;
}

export const QUESTIONNAIRE_CHIP_LABEL = 'анкета';
export const QUESTIONNAIRE_PROBE_CHIP_LABEL = 'probe?';
export const QUESTIONNAIRE_EXTERNAL_TEST_CHIP_LABEL = 'внешний тест';

/** @param {object} item @returns {boolean} */
export function questionnaireProbeChipVisible(item) {
  const q = item?.hhApply?.questionnaire;
  if (!q) return false;
  return recordQuestionnaireNeedsRelabel(item) || q.needsProbe === true;
}

/** @param {object} item @returns {boolean} */
export function questionnaireExternalTestChipVisible(item) {
  const qs = item?.hhApply?.questionnaire?.questions;
  if (!Array.isArray(qs) || !qs.length) return false;
  return qs.some((q) => /https?:\/\//i.test(String(q?.label || '')));
}

/** @param {object} item @returns {{ label: string, title: string, warn: true } | null} */
export function questionnaireProbeChipMeta(item) {
  if (!questionnaireProbeChipVisible(item)) return null;
  return {
    label: QUESTIONNAIRE_PROBE_CHIP_LABEL,
    title: 'Нужен probe на hh.ru — подписи вопросов неполные или анкета ещё не снята',
    warn: true,
  };
}

/** @param {object} item @returns {{ label: string, title: string, warn: true } | null} */
export function questionnaireExternalTestChipMeta(item) {
  if (!questionnaireExternalTestChipVisible(item)) return null;
  return {
    label: QUESTIONNAIRE_EXTERNAL_TEST_CHIP_LABEL,
    title: 'В анкете ссылка на внешний тест — нужен URL результата',
    warn: true,
  };
}

/** Настройки → «Кого берём» → «Формат и гео» */
export const SETTINGS_FORMAT_GEO_COPY = {
  title: 'Формат и гео',
  lead:
    'Поиск (harvest) широкий, отклик и серия строже: формат и зона доезда проверяются при отборе в очередь и перед откликом.',
  harvestRequireRemoteLabel: 'Harvest: требовать удалёнку в шапке',
  harvestRequireRemoteHint:
    'Выключено — в поиск попадают гибрид и офис (если разрешены ниже). Включено — harvest режет так же строго, как apply.',
  requireRemoteLabel: 'Только удалёнка — глобально',
  requireRemoteHint: 'Без явной remote/hybrid в описании — «Неподходит» при оценке вакансии',
  batchRequireRemoteLabel: 'Удалёнка в серии откликов',
  batchRequireRemoteHint:
    'Переключатель на вкладке «Серия откликов». Серия может быть строже очереди — без явной удалёнки вакансия пропускается.',
  batchRequireRemoteOn: 'Включена — только вакансии с явной удалёнкой или hybrid',
  batchRequireRemoteOff: 'Выключена — серия берёт из очереди по глобальным правилам',
  batchGotoApply: '→ Серия откликов',
  policyInfo:
    'Зона доезда (гибрид/офис): config/commute-zone.json · приоритет удалёнки и часовой пояс: config/work-format-policy.json. Подробнее — docs/TARGETING-ROADMAP.md (work-format).',
  harvestWideApplyStrict:
    'Harvest широкий, apply строгий: в поиске могут быть гибрид и офис, серия и gate отсекают по формату.',
  harvestStrictWarn:
    'Harvest с strict remote — в поиск попадут только вакансии с явной удалёнкой в шапке hh.ru.',
};

/** @param {boolean} batchRequireRemote */
export function formatGeoBatchStatusText(batchRequireRemote) {
  return batchRequireRemote
    ? SETTINGS_FORMAT_GEO_COPY.batchRequireRemoteOn
    : SETTINGS_FORMAT_GEO_COPY.batchRequireRemoteOff;
}
