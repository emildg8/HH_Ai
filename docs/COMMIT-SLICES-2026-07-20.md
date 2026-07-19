# Нарезка коммитов dirty tree — 20.07.2026

> **Не коммитить автоматически.** Этот файл — чеклист для явной просьбы партнёра.  
> На момент среза: ~1580 путей в `git status` (оценка).

## Порядок срезов (рекомендуемый)

### 1. Apply / letter / resume / visibility (ядро H)

- `lib/hh-resume-picker.mjs`
- `lib/hh-response-modal.mjs`
- `lib/hh-resume-visibility.mjs`
- `lib/letter-wave-fingerprint.mjs`
- `lib/point-apply-gate.mjs`
- `lib/letter-ru-sanitize.mjs` (+ соседние letter-* если в том же diff)
- `lib/hunt-day-orchestrator.mjs`
- `scripts/devops-apply-point-ready.mjs`
- `scripts/devops-hunt-day.mjs`
- `scripts/devops-emil-fix-resume-visibility.mjs`
- `scripts/test-hh-resume-picker-cross-track.mjs`
- `scripts/test-letter-wave-fingerprint.mjs`
- `scripts/test-point-apply-gate.mjs`
- `scripts/test-hunt-day-plan.mjs`
- `package.json` (хук `test:letters` → wave fingerprint)

### 2. Docs SESSION + MASTER + LEARNING

- `docs/MASTER-ROADMAP.md`
- `docs/LEARNING-LOG.md`
- `docs/SESSION-2026-07-20-retro-fixes.md`
- `docs/SESSION-2026-07-20-visibility-proof.md`
- `docs/SESSION-2026-07-18-resume-quiz-gate.md`
- `docs/APPLY-CHAIN-STABLE.md`
- `docs/HUNT-DAY-ORCHESTRATOR.md`
- `docs/HUNT-TRACKS-ROADMAP.md`
- `docs/WORK-PLAN-C2-FOLLOWUP.md`
- `docs/README.md`
- `docs/COMMIT-SLICES-2026-07-20.md` (этот файл)

### 3. Scripts one-off (оставить или архив)

- `scripts/fix-hh-otp-letter-2026-07-19.mjs` — keep до подтверждения ОТП на hh
- `scripts/_tmp-*` (~72 шт.) — **кандидаты на delete** после переноса уроков в SESSION; не коммитить оптом

### 4. data-emil baselines (без session/secrets)

- `data-emil/baselines/apply-quality-2026-07-19/`
- `data-emil/baselines/visibility-proof-2026-07-20/`
- `data-emil/baselines/status-drift-2026-07-20/`
- **Не:** `data-emil/session/`, `secrets`, chromium-profile

### 5. Dashboard UI — отдельный PR/коммит

- `dashboard/public/*`

### 6. Config / inventory / MC — отдельно

- `config/*`, inventory JSON, anastasia scripts

### 7. Desktop / .cursor / прочее

- `desktop/`, `.cursor/`, `AGENTS.md` — по необходимости

## Мёртвый код (light, 20.07)

- `runHuntDayShipStub` — оставлен **test-only** (комментарий в `hunt-day-orchestrator.mjs`); CLI не вызывает.

## Фраза для коммита среза 1

```
fix(hunt): sticky infra P2, point-wave fingerprint, visibility false-ok, prep --with-probe
```
