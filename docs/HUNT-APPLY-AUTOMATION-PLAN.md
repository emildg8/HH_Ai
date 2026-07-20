# План: автоматизация точечных откликов (после pain-wave1)

**Статус:** P0 ✅ в коде (20.07.2026) · P1 partial (plan default limit **15**) · P2 ⬜  
**Контекст:** разбор дня (Каспер / МАГНИТ / Рестрим) · ME FIX по письмам · урок `--only` без `--no-prepare-letters`  
**Связано:** [`HUNT-DAY-ORCHESTRATOR.md`](HUNT-DAY-ORCHESTRATOR.md) · [`HUNT-APPLY-PACE.md`](HUNT-APPLY-PACE.md) · [`SESSION-2026-07-20-pain-wave1.md`](SESSION-2026-07-20-pain-wave1.md)

---

## Сводка

Автоматизировать **фильтры и запреты** (что не gen / не ship / не repair), не «умнее писать 80 писем».

| Слой | Решение |
|------|---------|
| Дневной shortlist | **10–15** кандидатов (план/преп) — шире, чем «3 на глаз» |
| Live ship | **пачками по 1–3** за прогон (`--limit=1…3`), не все 15 сразу |
| Письма | regen/правка **только по shortlist** + учёт волны метрик дня |
| P0 | `--only=` → дефолт без авто-regen лестницы · не repair при declined |

---

## Риски и нюансы

### Риски продукта / охоты

| Риск | Почему больно | Смягчение |
|------|---------------|-----------|
| Shortlist 10–15 = ложное «все ready» | Партнёр жмёт 15 подряд → шаблон волны / cooldown | Ship только `--limit=1…3`; wave fingerprint; подсказка «сегодня уже N ok» |
| Жёсткий remote-gate | Часть сильных JD без формата в карточке (Каспер/Магнит) | Soft-block + override `userApproved` / prefs tier «формат неизвестен» |
| Метрики на генерации | LLM снова вставит −15% / IT_One | Fingerprint на gen + на gate; пул Softline/MSSQL/без |
| no-prepare при `--only=` | Редкий кейс: письмо реально плохое и нужен regen | Явный `--prepare-letters` / `HH_POINT_PREPARE_ON_ONLY=1` |
| Skip repair на declined | Ложный declined-баннер | Уже есть audit false-invited; declined после sync надёжнее, чем в момент ship |
| Авто shortlist «умный» | Спрячет спорный mid / Vault | Shortlist **ранжирует и помечает причины**, не hard-delete; UI «к отклику» остаётся |

### Нюансы реализации

1. **Две ширины:** shortlist prep = 10–15; ship wave = 1–3. Не смешивать в одном флаге `--limit` без подписи `plan` vs `ship`.
2. **Очередь Emil:** live store = `HH_VACANCIES_QUEUE_FILE` → сейчас `data/vacancies-devops.json` при `HH_DATA_DIR=data-emil`. Любой shortlist-CLI должен читать **тот же** queue file, что point-ready.
3. **`--only=` и пул:** форс id вне fresh-tier-a — ок; авто-regen лестницы при only — **запрещён по умолчанию**.
4. **Волна дня:** fingerprint считает applied-today + shortlist прогона. При ship×3 подряд — сначала развести письма на все три, потом слать по одной (или limit=3 если gate ок).
5. **Multi-profile:** только Emil point (`:3849`); Anastasia basket не трогать этим планом.
6. **Не в scope:** HI.1, кнопка «День охоты» в UI, mass regen, правка CV на hh.

### Допущения и риски (канон плана)

- Предполагаем: партнёр принимает shortlist 10–15 как **меню на день**, а не квоту «отправить все».
- Может пойти не так: soft remote-gate отсечёт бренд без формата — нужен явный override.
- Запасной вариант: только P0 (no-prepare + no repair declined), shortlist оставить ручным/`plan` как сейчас.

---

## Этапы

### P0 — сессия ~1–2 ч (обязательно)

| # | Что | Файлы (ориентир) |
|---|-----|------------------|
| P0.1 | При `--only=` дефолт `--no-prepare-letters` (откат: `--prepare-letters` или env) | `devops-apply-point-ready.mjs`, `hunt-day-orchestrator.mjs` |
| P0.2 | Не spawn letter-repair / deliver-letter, если `hhSiteState=declined` (и аналог «отказ» баннер) | `hh-apply-chat-letter.mjs` / point outcome path |
| P0.3 | Строка в [`HUNT-DAY-ORCHESTRATOR.md`](HUNT-DAY-ORCHESTRATOR.md): only → no-prepare; ship 1–3 из shortlist 10–15 | docs |

**Критерий готовности:** dry-run `--only=<ready>` не трогает чужие ids regen; на fixture declined — нет COVER_COMPOSER / deliver-letter.

### P1 — 0,5–1 день

| # | Что |
|---|-----|
| P1.1 | Shortlist дня **до 10–15**: расширить/`plan --limit=15` с полями `skipReason` / `ready` / `letterGap` / `remoteUnknown` |
| P1.2 | Prep писем **только** по ids shortlist (или `--ids=` из plan JSON); перед gen — запрет метрик, уже занятых в applied-today |
| P1.3 | Ship-ритуал в docs: `plan --limit=15` → выбрать 1–3 → `ship --go --limit=1…3 --only=…` |

**Критерий:** `plan` отдаёт ≤15 с причинами; regen 3 ids не плодит −15%, если сегодня уже был −15%.

### P2 — по необходимости

| # | Что |
|---|-----|
| P2.1 | Soft remote-gate: `requireRemote` + формат unknown → не auto-ship без override |
| P2.2 | Greeting polish: крупные бренды → «Здравствуйте» |
| P2.3 | Framing sanitize: DevOps title → не MSSQL первым абзацем; Vault → доступы/секреты |
| P2.4 | После N ok за день — hint в ship JSON / status (не hard stop) |

---

## План отката

| Изменение | Откат |
|-----------|--------|
| P0.1 no-prepare на only | `--prepare-letters` на команде **или** `HH_POINT_PREPARE_ON_ONLY=1` |
| P0.2 skip repair declined | `HH_LETTER_REPAIR_ON_DECLINED=1` (явный opt-in) |
| P1 shortlist/plan | `plan --limit=` как раньше; игнор новых полей |
| P1 gen metrics | `HH_LETTER_FORCE_MTTR15=1` / git revert fingerprint-on-gen |
| P2 remote soft-gate | prefs override / `HH_REMOTE_UNKNOWN_OK=1` |
| Docs | `git checkout -- docs/HUNT-*.md` |

Аварийный путь охоты без новой логики: ручной shortlist ids +  
`npm run devops:hunt-day:emil -- ship --mode=point --go --limit=1 --only=<uuid> --no-prepare-letters`

---

## Слой тестирования

| Уровень | Что | Команда / артефакт |
|---------|-----|-------------------|
| L0 | only ⇒ no-prepare по умолчанию | unit/флаг-тест point-ready args |
| L0 | declined ⇒ нет repair spawn | fixture/test apply chat outcome |
| L0 | wave metrics на gen (P1) | `test:letter-wave-fingerprint` + кейс applied-today |
| L1 | plan `--limit=15` shape | `test:hunt-day-plan` расширить assert count≤15 + skipReasons |
| L1 | dry-run `--only=` не regen чужих | ручной/скрипт: лог без ПРАВОКАРД-подобных |
| L2 live | не обязателен для P0; при P1 — 1 dry + 1 live по явной просьбе | hunt-day ship |
| Регресс | picker / wave | `test:hh-resume-picker-cross-track`, `test:letter-wave-fingerprint` |

**Smoke ≠ E2E:** dry-run и unit не доказывают запись на hh.ru.

---

## Приёмка

### Чеклист агента
1. P0 отмечен: сделано / отложено с причиной.  
2. Тесты L0(+L1) перечислены, exit 0.  
3. Явно: live гоняли или нет.  
4. Откат одной строкой (env/флаг).  
5. Shortlist в docs: **10–15 plan / 1–3 ship**.

### Чеклист партнёра (~5 мин)
1. `plan --limit=15` — осмысленное меню, не 80.  
2. `ship --only=` без сюрприза regen мусора.  
3. Declined не уходит в бесконечный repair.  
4. Вердикт: **принято** / **только P0** / **вернуть**.

---

## Порядок работ

1. P0.1 → P0.2 → P0.3 docs  
2. Тесты L0  
3. P1.1–P1.3  
4. P2 по запросу  
5. Коммит по просьбе: `fix(hunt): only defaults no-prepare; skip repair on declined` → docs

**Фраза агенту:**  
`Сделай P0 из docs/HUNT-APPLY-AUTOMATION-PLAN.md (only→no-prepare, skip repair declined, docs); shortlist plan 10–15, ship 1–3; коммит по просьбе.`
