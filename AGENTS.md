# HH Ai — правила для агента

Гибрид app+bot в `apps/hh-ai`. Глобальные линзы — в `D:\Dev\.cursor\rules\15-expertise-lenses.mdc`.

**Новый чат:** hook `sessionStart` (`.cursor/hooks.json`) автоматически пересобирает и вливает `.cursor/agent-context.md`; правило `session-bootstrap.mdc` — дочитывать docs по задаче.

## Быстрые якоря

- **Сквозной отклик (корзина → анкета → робот):** [`docs/APPLY-END-TO-END-PLAYBOOK.md`](docs/APPLY-END-TO-END-PLAYBOOK.md) · правило `.cursor/rules/apply-e2e-playbook.mdc` · дашборд `/apply-e2e-playbook.html` · `GET /api/apply-e2e-playbook`.
- **Live ship Эмиль (день охоты):** только [`docs/HUNT-DAY-ORCHESTRATOR.md`](docs/HUNT-DAY-ORCHESTRATOR.md) · `npm run devops:hunt-day:emil -- ship --mode=point|basket --go …`. **Не** вызывать напрямую live `devops:apply-point-ready` / `devops:emil-pack-ship` / `hh-apply-chat` в обход (dry-run и отладка движка — ок; явный bypass по просьбе партнёра — ок).
- **Live ship Анастасия:** `npm run devops:hunt-day:anastasia -- ship --mode=basket --go …`. **Не** прямой live `anastasia-pack-ship` без просьбы. Point live на QA — только после ручного plan.
- **Ingest / harvest / очередь:** skill `hh-ru-apply-workflow`, `lib/vacancy-ingest.mjs`, `docs/SOURCE-EXPERTISE.md`. **Фоновый harvest:** `npm run devops:harvest:watchdog` · `:silent` · `docs/SESSION-2026-07-05-gaming-harvest-handoff.md`.
- **Дашборд:** `design-tokens.css`, `dashboard-unify.css`, `docs/DASHBOARD-DESIGN-TOKENS.md`.
- **Multi-profile:** `docs/MULTI-PROFILE-GUIDE.md`, `docs/MULTI-PROFILE-INVARIANTS.md`, `docs/MULTI-CANDIDATE-ROADMAP.md`, `docs/MULTI-PROFILE-STATUS.md`, `docs/ANASTASIA-HUNT-ROUTE-STATUS.md`, `npm run dashboard:emil`, `npm run dashboard:anastasia`. **Gate MC:** `npm run test:mc-all-isolation`. **QA apply:** `.cursor/rules/anastasia-apply-qa.mdc` · **анкета/probe:** `.cursor/rules/qa-hh-questionnaire-probe.mdc` · runbook `docs/ANASTASIA-HT63-APPLY-RUNBOOK.md` · Kandinsky GigaRecruiter `docs/SESSION-2026-07-03-kandinsky-gigarecruiter.md` · IBS `docs/SESSION-2026-07-03-ibs-apply-lessons.md`. **Handoff MC 02.07:** `docs/SESSION-2026-07-02-mc-isolation-close.md`.
- **Профиль кандидата:** **инфра-лента** — DevOps junior+/middle + смежная эксплуатация L2+ / TAM, удалёнка; одна лента охоты (не «узкий/расширенный» режим).
- **Позиционирование / HR / ЗП 2026:** [`docs/CANDIDATE-POSITIONING-2026.md`](docs/CANDIDATE-POSITIONING-2026.md) — роли, маршруты, вилка, HR-скан vs pet.
- **Истина домена для агента:** [`docs/AGENT-DOMAIN-TRUTH.md`](docs/AGENT-DOMAIN-TRUTH.md) · правило `.cursor/rules/agent-domain-truth.mdc`.
- **R-tier / пакет / M0-матрица:** `config/role-ladder.json`, `lib/role-ladder.mjs`, `docs/ROLE-LADDER-M0-MATRIX.md` · **framing router (DevOps vs L2):** `lib/letter-framing-router.mjs`, `docs/LETTER-FRAMING-ROUTER.md`, `npm run test:letter-framing-router`.
- **Handoff / релиз:** `docs/PUBLIC-RELEASE.md`, `npm run test:handoff`, `npm run release:public`.
- **Документация (партнёр):** `docs/GUIDE-PARTNER.md` — порядок перечитывания; оглавление — `docs/README.md`.
- **Дорожная карта (где мы / L3 / срезы):** `docs/MASTER-ROADMAP.md` — **читать первым** в начале сессии, обновлять в конце. HANDOFF и MEGA — детали, не фаза.
- **LLM (провайдеры, бюджет, STT):** `docs/LLM-ROADMAP.md` — трек LLM-L0.
- **Мультимодальность (inventory, evidence):** `docs/MULTIMODAL-ROADMAP.md` — трек M0; реестр фич — `docs/FEATURE-MAP.md`.
- **Таргетинг / minus-слова (H-TARGET):** `docs/TARGETING-ROADMAP.md`, `config/targeting-policy.json`, `npm run devops:targeting-market-audit`.
- **Поток охоты (дашборд → отклик):** `docs/HUNT-ARCHITECTURE.md` · **темп откликов:** `docs/HUNT-APPLY-PACE.md`
- **Маршруты охоты (H-TRACKS):** `docs/HUNT-TRACKS-ROADMAP.md`, `config/hunt-tracks-qa.json` (Anastasia), `npm run test:hunt-tracks`
- **Статусы hh (inviteKind):** `docs/HH-NEGOTIATION-STATUS.md`, `npm run test:hh-negotiations-sync` · «Собеседование» на hh ≠ слот E.
- **HH API harvest (H-INGEST):** `docs/HH-INGEST-ROADMAP.md` — трек HI.0–HI.5; prod default `playwright` до go-live.
- **HI.0 probe:** `npm run devops:probe-hh-api` · `npm run test:hh-api` · отчёт `data/logs/hh-api-probe-latest.json`.
- **Ситуации «если сломалось»:** `docs/SCENARIOS-PLAYBOOK.md` — №12–**82**, P0–P3.
- **S1 precheck / точечный автоотклик:** сначала `npm run devops:s1-preflight`, live ship — **`devops:hunt-day:emil -- ship --go`** (не прямой `apply-point-ready` / `emil-pack-ship`) · `npm run devops:prep-wednesday` · `npm run devops:batch-precheck` · `docs/S1-HUNT-CHECKLIST.md` · **темп:** [`docs/HUNT-APPLY-PACE.md`](docs/HUNT-APPLY-PACE.md) · архив mass apply: [`docs/archive/2026-06-mass-apply-era/ARCHIVE-INDEX.md`](docs/archive/2026-06-mass-apply-era/ARCHIVE-INDEX.md).
- **Хронология июня:** `docs/SESSION-INDEX-2026-06.md` — при потере контекста между чатами.
- **Уроки агента:** `docs/LEARNING-LOG.md`.
- **Стандарты / гигиена:** `docs/PRODUCT-STANDARDS.md`, `npm run test:hygiene`, `npm run hygiene:audit`.
- **OPS / baseline:** `docs/OPS-RHYTHM.md`, `npm run test:ops-readiness`, `npm run devops:ops-readiness`, `npm run devops:intelligence-baseline`.
- **Суфлёр / I-track (отдельная вкладка):** **`docs/COPILOT-LIVE-GO-LIVE-RITUAL.md`** (3 фазы) · **`docs/COPILOT-MIC-SMOKE-HANDOFF.md`** · **`docs/COPILOT-I-TRACK-ROADMAP.md`** · **`docs/COPILOT-LIVE-LIFECYCLE.md`** · **`docs/SESSION-2026-07-05-lb-go-live-handoff.md`** · `npm run devops:copilot-partner-prep` · **`npm run devops:mic-smoke-prep`** · **`npm run devops:copilot-go-live`** · `npm run devops:copilot-bandicam-postmortem` · `npm run test:copilot`.
- **Инвентарь навыков (трек M0 / H):** `data/candidate-skills-inventory.json`, `my/cursor-evidence-index.md`, `lib/candidate-knowledge-pack.mjs`, `docs/MULTIMODAL-ROADMAP.md` §M0.2 baseline, `npm run test:candidate-knowledge-pack`. **CV на hh:** HT.5 devops ✅ · полный кабинет 4 маршрута — [`H-PROFILE-ROADMAP.md`](docs/H-PROFILE-ROADMAP.md) HT.6.
- **Prep к собесу (P0–P7 + опора A–G):** skill `hh-interview-prep` · `reference-foundation.md` · `npm run devops:interview-prep-run` · `npm run test:interview-prep-route` · цель — оффер / следующий этап.
- **ME (@me):** consult / review / day open-close · skill `hh-me-guardian` · `.cursor/agents/me.md`

## Доменные линзы (дополнительно к универсальным)

| Домен | Фокус |
|-------|-------|
| HR / рекрутинг | Воронка кандидата, тон писем, tier A/B, лимиты, не спамить |
| Рынок труда (RU IT) | Зарплаты, удалёнка, hh/Habr/ATS, свежесть вакансий |
| Дизайн-система | `--hh-*` / `--ds-*`, `--font-ui`, модалки вне shell |

## UI
- Копирайт через `dashboard-ux.mjs` / `dashboard-copy-ru.mjs`, не хардкод в HTML.
- Токены из `design-tokens.css`, не разовые hex/шрифты.

## Проверки
- `npm run check:*`, `test:*` в `scripts/` после нетривиальных правок UI/API.

## Apply Truth (B1D)

Правило `.cursor/rules/apply-truth-video.mdc` — две модели отклика, видео+лог как источник истины.

**Live ship (агент, Эмиль):** только `devops:hunt-day:emil … --go`. Прямой live `apply-point-ready` / `emil-pack-ship` / `hh-apply-chat` — обход lane/outcome; запрещён без явной просьбы партнёра. Движки под капотом те же; вход — оркестратор.

**Live ship (агент, Анастасия):** только `devops:hunt-day:anastasia … --mode=basket --go`. Прямой live `anastasia-pack-ship` — без просьбы партнёра запрещён.

| Gate | Команда |
|------|---------|
| Log-golden (5 видео-сессий) | `npm run test:apply-log-golden` |
| Repeat apply | `npm run test:hh-response-repeat-apply` |
| L4 skip / site state | `npm run test:apply-l4-observability` |

**Smoke ≠ E2E:** `test-resume-hh-apply-manifest` — только shape partial, не доказывает запись на hh.ru.

## Трек C2 (north star KPI E + инфраструктура серии)

| Что | Команда |
|-----|---------|
| Сводный отчёт | `npm run devops:funnel-digest` |
| KPI / batch gate | `npm run test:funnel-north-star-metrics`, `test:batch-readiness` |
| S1 preflight (охота) | `npm run devops:s1-preflight` |
| Live ship Эмиль | `npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1` (или `--mode=basket --only=`) |
| Live ship Анастасия | `npm run devops:hunt-day:anastasia -- ship --mode=basket --go --only=` |
| Подготовка писем S1 | `npm run devops:s1-prepare-letters -- --approve-only` · `--regen --limit=25` |
| P0 до среды | `npm run devops:wednesday-p0` |

KPI north star — слот E (`real_hr_invite`); batch/series остаются инструментом инфраструктуры, не целью продукта.

## Итоги пользователю

По `.cursor/rules/partner-brief-ru.mdc` — простой русский, без схем без пояснения.
