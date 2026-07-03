# Журнал уроков агента — HH Ai

Хронология: **дата | срез | урок | где закреплено**.

Правила: не больше 1–3 записей за сессию; новое `.mdc` — только при повторе или по вашей просьбе.

---

| Дата | Срез | Урок | Закреплено |
|------|------|------|------------|
| 02.07.2026 | I-track/hr-clips | **`probeMeanVolumeDb`**: `-t` вставлялся между `-i` и path → candLeak всегда null; fix: `-t` после input | interview-hr-extract.mjs, SESSION-2026-07-02-hr-extraction-handoff |
| 02.07.2026 | I-track/hr-clips | **`HH_INTERVIEW_DIR=my`** при видео в `my/emil/Интервью` — fallback в `resolveInterviewDir()` | interview-hr-separation.mjs, interview-lane-dir.mjs |
| 03.07.2026 | I-track/live-mock | **copilot-live-mock-infra-lane** pack: 10q devops/l2/tam · batch 10/10 · m3u 30 clips | COPILOT-LIVE-MOCK-INFRA-LANE.md, config/copilot-live-mock-infra-lane.json |
| 03.07.2026 | apply/unify | **`finishRepeatApply`** на канон probe → `deliverCoverLetterPostApply` → assert (как repair) | hh-apply-chat-letter.mjs, cover-letter-deliver-truth.mjs |
| 03.07.2026 | HT6.4/honesty | Auto-approve 10/10 **не ловит** ложные GitLab CI / Python SDET claims — ME ручной patch + regen; keyword_gap стоп = TRUE GAP, не false positive | candidate-skills-inventory.json, approve-letters-by-ids.mjs |
| 02.07.2026 | MC/GNIVC | После `devops:migrate-my-lanes` **ГНИВЦ-СПОТ** уехал в `my/emil/` — импортёр и migrate: repatriate в `my/anastasia/`; резолвер anastasia→root→emil | import-gnivc-knowledge-staging.mjs, devops-migrate-my-lanes.mjs |
| 02.07.2026 | HT6.3/E2E | Offline E2E gate: snapshot vs draft qa-lead в `data-anastasia/`; **warn** employer header «Иннотех» на hh при NDA bullets — не fail | test-ht63-e2e-gate.mjs, ht63-e2e-gate-latest.json |
| 02.07.2026 | MC/QA lane | `AGENT-DOMAIN-TRUTH` + rule: `:3850` → MULTI-PROFILE-INVARIANTS, не DevOps-советы | AGENT-DOMAIN-TRUTH.md, agent-domain-truth.mdc |
| 02.07.2026 | MC/HT6.3 | L4 snapshot Anastasia hash — только `data-anastasia/resume-hh-snapshot/`; legacy `data/` мигрировать `devops:migrate-anastasia-snapshot` | resume-hh-snapshot.mjs, test:mc-ht63-l4-snapshot-anastasia |
| 02.07.2026 | MC/legacy | `npm run dashboard/login/harvest` — DEPRECATED, redirect emil via run-with-instance; явные `:emil`/`:anastasia` для прода | legacy-instance-*.mjs, MULTI-PROFILE-GUIDE |
| 02.07.2026 | apply/Индид | **Три поверхности hh:** список откликов («Без сопроводительного»), chatik iframe, вкладка «Чат» на вакансии — разный UI; `negotiations?vacancyId` редиректит на `/vacancy/` | hh-chat-selectors.mjs, ANASTASIA-HT63-APPLY-RUNBOOK |
| 02.07.2026 | apply/verify | **`letterDelivered` без истины:** verify ловил текст в поле ввода / ключевые слова, не bubble; канон — `verifyCoverLetterDelivered` (probe 72 симв., без textarea) | hh-chat-selectors.mjs, devops-deliver-letter-vacancy.mjs |
| 02.07.2026 | apply/repair | **Дубль в чат:** hh уже вложил excerpt резюме при отклике → repair отправил approved вторым сообщением; fix — `chatHasOutgoingExcerptWithoutApproved` блокирует chat-fallback | hh-chat-selectors.mjs, test-cover-letter-deliver-guards.mjs |
| 02.07.2026 | L4/about | **about-not-persisted ложный** (ProSpace): inputValue после save ≠ текст на hh; канон — `resume-about-verify.mjs` (scrape=истина, retry, все ветки fill, rollback только при about-not-persisted) | resume-about-verify.mjs, hh-resume-editor.mjs, resume-hh-apply-manifest.mjs |
| 02.07.2026 | M0/термины | **ME** в handoff = мультимодальный эксперт (M0), не партнёр-пользователь | MULTIMODAL-ROADMAP §протокол |
| 02.07.2026 | L4/ProSpace | Первый repair-L4 записал **утечку промпта** в «О себе»; fix — restore snapshot + ручной honest platform-текст + verify scrape | repair-l4-latest.json |
| 02.07.2026 | HT.7/letters | **Regen шёл в Ollama (127.0.0.1)** из secrets, не DS Lab — `fetch failed`; fix: `run-devops-regenerate-letters` → `buildDslabChildEnv()` | run-devops-regenerate-letters.mjs, dslab-letter-env.mjs |
| 02.07.2026 | HT.7.2/close | **HT.7.2 infra pilot** закрыт техничски (cb1 pipeline+declined); разблокирован **l2l3 auto_with_approval** | hunt-tracks.json, AGENT-DOMAIN-TRUTH, H-PROFILE §HT.7 |
| 02.07.2026 | HT.7.3/tam/harvest | TAM-ключи с **remote/IT** в `search-keywords-devops.txt` + `search-keywords-tam-remote.txt`; `titleLooksTamRole` без sales «менеджер по работе с клиент» | role-classify.mjs, search-keywords |
| 02.07.2026 | HT.7.2/declined | **Алготрейдинг / trading infra** (134620760): tier A + gate pass, но **hrStack 40%** (нет Ansible/Terraform/Python), резюме DevOps + письмо L2/банк → отказ <24ч. Ниша **вне infra-lane** без evidence — не auto point apply | `lib/point-apply-gate.mjs`, `targeting-policy.json` applyNicheRules |
| 02.07.2026 | HT.7.3/chatik | После отклика hh монтирует chatik **только** после клика `[data-qa="vacancy-response-link-view-topic"]`; поле ввода — `[data-qa="chatik-new-message-text"]` во frame | hh-chat-selectors.mjs, SESSION-2026-07-02-ht73-tam-trinity-chat |
| 02.07.2026 | HT.7.3/apply-truth | `formResult.letterInForm` от мастера — доверяем после submit (модалка пропала); иначе ложный exit 7 и лишний чат | hh-apply-chat-letter.mjs |
| 02.07.2026 | HT.7.3/tam/office | TAM office МСК при remote-only CV — только **userApproved**; JD «план продаж» = presale-сигнал, не auto pool | Trinity 84625d42, AGENT-DOMAIN-TRUTH |
| 02.07.2026 | I-track/Q-gate | **`isTechInterviewQuestion` пропускал small_talk/hr** — flood `[Q]` на bandicam 20-44-30; fix: только `classify === 'technical'` | interview-copilot-qa.mjs, copilot-live-me.mdc, SESSION-2026-07-02-bandicam-2044-me |
| 02.07.2026 | I-track/mock | **Zoom+phone без guest-audio** → ложный «суфлёр не слышит»; канон mock: **hr-only + CABLE** (плеер → CABLE Output → capture Input) | interview-hr-only.mjs, copilot-live-me.mdc |
| 02.07.2026 | I-track/process | **H-track и I-track — разные handoff**; не смешивать в одной вкладке без явной просьбы | SESSION-2026-07-02-I-track-close.md, copilot-live-me.mdc |
| 02.07.2026 | I-track/UX | **Live tape > delay** — читаемость overlay без искусственной задержки flash (бюджет ≤1,5 с) | teleprompter-live-tape.mjs, copilot-live-me.mdc |
| 02.07.2026 | I-track/infra | **`devops:copilot-test-env`** — агент готовит VB-Cable/dshow/test-env сам перед live mock | devops-copilot-test-env.mjs, copilot-live-me.mdc |
| 02.07.2026 | I-track/KB | **KB curated +4 cards** (97→101); bulk md import — NO-GO; staging → approve → fixture | interview-knowledge-staging.mjs, SESSION-2026-07-02-I-track-close |
| 02.07.2026 | I-track/regress | **`hr-only-tech-only.mp4`** — канон клип регресса (tech-only, без HR-intro) | interview-hr-only.mjs, SESSION-2026-07-02-I-track-close |
| 02.07.2026 | I-track/P0 | Intro HR («на ты», «рекомендованный») → `q-filtered`, не `[Q]`; stale до pending finalize; gate ✅ `test:copilot` 02.07 | interview-copilot-qa.mjs, SESSION-2026-07-02-I-track-close |
| 02.07.2026 | I-track/ping | **«утилитопинг»** → normalize `утилита ping` (не голый ping <8); alias `icmp-ping`; bandicam-2044 fixture | interview-question-normalize.mjs, SESSION-2026-07-02-I-track-close §I-Q-1 |
| 02.07.2026 | I-track/hr-clips | **Bandicam mono-mix** (L/R идентичны) — отдельной дорожки кандидата нет; масштаб = hr-clips 10–30, не channel split | INTERVIEW-HR-EXTRACTION-PLAN, SESSION-2026-07-02-hr-extraction-handoff |
| 02.07.2026 | I-track/hr-clips | **`mergePlan` без ffmpeg splice ≠ hybrid**; mp4-клип из raw mix не даёт anti-echo для copilot — render из HR stem обязателен | interview-hr-extract.mjs, INTERVIEW-HR-EXTRACTION-ME-REVIEW |
| 02.07.2026 | I-track/infra | **PyTorch CPU-only** маскируется как «CUDA fallback»; wheel torch ≥2200 MB; torchvision pin под torch 2.5; HF token gated repos | install-pytorch-cuda.ps1, interview_diarize.py |
| 01.07.2026 | HT.7/point-apply | ~~l2l3 manual до HT.7.2~~ → **02.07:** l2l3/tam auto с approval | hunt-tracks.json §pointApply |
| 01.07.2026 | HT.7/wizard | Мастер hh: резюме грузится 60–95 с → wall **300 с** (было 180); на vacancy_response при заполненном поле — submit даже если verify partial | apply-outcome.mjs, hh-response-modal.mjs |
| 01.07.2026 | HT.7/regen | `--force-approved` только снимает tier-фильтр; **approvedText** нужно выставить отдельно (variants[0] → approve) | regenerate-cover-letters.mjs |
| 01.07.2026 | HT.7/apply-truth | HT.7 «ok» легитимен только при связке `responseSubmitted=true` + `verifiedOnHh=true` + `sync-responses` (пример: РВД 134748592) | point-apply-latest.json, devops:apply-point-ready |
| 01.07.2026 | HT.7/apply-truth | HTTP 204 + локальный SUCCESS ≠ отклик на hh: Квазар 133812837 **недоступна** (архив), в negotiations нет — только post-check / партнёр | point-apply-latest.json, apply-truth-video.mdc |
| 21.06.2026 | B1D | Повторный отклик на hh — **не** показывать ложный «успех»; честный skip | `test:hh-response-repeat-apply`, apply-truth-video.mdc |
| 21.06.2026 | B1D/L4 | L4 **partial** (skills fail) ≠ успешный отклик; не считать tier A закрытым | tests/video README, HANDOFF-20 |
| 21.06.2026 | B1D | Data Engineer timeout 240 с — **не чинить** без явного запроса (тестовый прогон) | HANDOFF-20, LEARNING-LOG |
| 22.06.2026 | D | Harvest + настройки во время сбора → чёрный центр; нужны try/catch + refresh списка | код videoD, tests/video |
| 22.06.2026 | ops | Не убивать весь Chrome — только профиль проекта и PID :3849 | browser-safety.mdc |
| 22.06.2026 | docs | Три якоря (HANDOFF, MEGA, MASTER) путали фазу — **канон только MASTER** «Где мы» | MASTER-ROADMAP, SESSION-INDEX, AGENTS.md |
| 22.06.2026 | S1 | Топ score вместо tier A (очередь stale); gate 45 первый прогон; дашборд перезаписывает prefs — не сохранять настройки во время S1 | LEARNING-LOG, s1-prepare-letters |
| 22.06.2026 | S1 | Precheck CLI смотрел топ по баллу без писем — считать как дашборд (вся серия ≥порога) | s1-hunt-preflight.mjs |
| 22.06.2026 | S1 | Перегенерация сбрасывает approvedText — после regen всегда `--approve-only` | s1-prepare-letters.mjs |
| 18.06.2026 | LLM-L0 | План LLM без STT/M0/budget = 7/10; канон три файла: LLM + MULTIMODAL + FEATURE-MAP | MASTER-ROADMAP, LLM-ROADMAP |
| 18.06.2026 | LLM-L0 | Fallback DS Lab→OR без notify — пользователь не видит причину сбоя писем | llm-provider-notify, toast |
| 18.06.2026 | M0 | Pet-навыки не в промпте писем — LLM правильный канал, бедный контекст | MULTIMODAL-ROADMAP M0.2 |
| 22.06.2026 | docs | MASTER пересборка: LLM-L0 + M0 поперечно; SK=этапы M0; S1✅→S2▶ | MASTER, playbook |
| 22.06.2026 | M0.2 | Pack в письмо только tier A свежий; B/C — только CV | test:cover-letter-m0-pack |
| 22.06.2026 | H-TARGET | HT.0 audit + HT.UI-1 labels (copy-only); канон TARGETING-ROADMAP; MASTER sync | TARGETING-ROADMAP, targeting-labels.mjs |
| 18.06.2026 | H-INGEST | План API harvest 7/10 без MASTER/UI/quota — канон HH-INGEST-ROADMAP 10/10; prod default playwright до HI.0 | HH-INGEST-ROADMAP, MASTER, SCENARIOS №61–65 |
| 23.06.2026 | HI.0 | Код probe/quota/normalize без смены harvest; live probe — нужен HH_API_USER_AGENT в secrets (№65) | lib/hh-api-*, probe-hh-api.mjs |
| 26.06.2026 | охота/M0 | «Узкий DevOps» как режим — ложный рычаг; harvest уже широкий; цель — слот E, одна **инфра-лента** + R-tier | AGENT-DOMAIN-TRUTH.md, agent-domain-truth.mdc, role-ladder |
| 26.06.2026 | C2/apply | **letter recap gate** режет ready; **questionnaire partial** — отдельный контур, не fail серии; на hh бывает **отклик без письма** — не считать ok без apply-gate | apply-gate.mjs, batch-precheck-report.mjs |
| 29.06.2026 | H-TRACKS | Параллельные маршруты (DevOps/Infra/L2/TAM) — не «узкий пул»; одна очередь, разные резюме+письма+серия | HUNT-TRACKS-ROADMAP.md, hunt-tracks.mjs |
| 29.06.2026 | hh/sync | «Собеседование» на hh — стадия воронки, не слот E; KPI только `inviteKind=real_hr_invite` | HH-NEGOTIATION-STATUS.md, hh-invite-kind.mjs |
| 29.06.2026 | H-TRACKS/HT.4 | North star E только `real_hr_invite`; viewed-nudge 3–7д; hh_tab_stage/silent → bucket D | funnel-north-star-metrics, chat-follow-up.mjs |
| 29.06.2026 | M0.2/letters | Regen: `secrets.local.env` перезаписывал dslab → Ollama; fix `HH_ENV_PRELOADED` + `buildDslabChildEnv` | regenerate-cover-letters.mjs, dslab-letter-env.mjs |
| 29.06.2026 | M0.2/HR | L2-framing в письме на DevOps JD режет конверсию; письма — мост до HT.5 CV | cover-letter-role-prompt.mjs, MULTIMODAL §M0.2 baseline |
| 29.06.2026 | apply/cooldown | Один отклик RWB → `duplicate_company` 30д на все RWB; precheck devops 2/12, не letterQuality | rwb-stop-signals-audit.mjs, WORK-PLAN §29.06 |
| 29.06.2026 | hh/session | `isLoggedInOnHh` возвращала true по умолчанию → sync/резюме «0» без реального входа; fix + `devops:visible-retry` | hh-session-check.mjs, devops-visible-retry.mjs |
| 29.06.2026 | позиционирование | Северная звезда партнёра = **оффер F**, не только слот E; 4 маршрута охоты достаточны; HR читает L2 не DevOps — канон ЗП/ролей | CANDIDATE-POSITIONING-2026.md, AGENT-DOMAIN-TRUTH.md |
| 29.06.2026 | docs/ME | Фаза 1–2: mass apply снят как цель; точечный автоотклик; серия = инструмент дашборда; архив 2026-06; hygiene green | WORK-PLAN-DOCS-CLEANUP, archive/, test:hygiene |
| 29.06.2026 | I-track/ME | `test-interview-knowledge-staging` в `finally` восстанавливал весь bank — approve (+15 cards) съедался при каждом `test:copilot`; fix: удалять только fixture `staging-fixture-ping-only` | test-interview-knowledge-staging.mjs |
| 29.06.2026 | I-track/ME | Curated import knowledge: staging JSON + approve script; bulk md NO-GO; split `postgres-vacuum` / `pg-streaming-replication`; K8s gap-bridge при `inInventory:false` | interview-knowledge-staging.mjs, COPILOT-ROADMAP §ME import |
| 29.06.2026 | HT.4/nudge | **Ops E2E на hh — агент, не партнёр:** точечный отклик (`apply-point-ready`) + nudge в чат (`send-chat-reply`); этalon 29.06 — ВИМ + Rambler; top-N только с thread | SESSION-2026-06-29-h-track-close, AGENT-DOMAIN-TRUTH |
| 29.06.2026 | apply/point | Точечный отклик: `url-changed` + timeout мастера ≠ fail — post-check sync; ВИМ MLOps подтверждён партнёром | point-apply-latest.json, SESSION-2026-06-29-h-track-close |
| 29.06.2026 | HT.5/CV | hh не принимает тег Playwright; CI/CD → GitLab CI; verify через `--verify-only` + scrape edit/about | hunt-track-resume-drafts.json, hh-resume-scrape.mjs |
| 30.06.2026 | harvest/CLI | `--session-limit` / `--per-keyword-limit` применялись до `loadProfile()` — профиль anastasia игнорировался | harvest.mjs |
| 30.06.2026 | MC/anastasia | ~64% tier A у QA — AQA/SDET titles; лечить **framing CV**, не отдельный harvest; AQA v2.1 = ИИ-инструменты, не SDET в проде | CANDIDATE-WISHES-ANASTASIA, hunt-tracks-qa.json |
| 30.06.2026 | multi-instance | `test:candidate-knowledge-pack` и часть тестов по умолчанию `data/` — для Анастасии явно `HH_DATA_DIR=./data-anastasia` | MULTI-PROFILE-GUIDE |

| 30.06.2026 | HT.6/hh UI | Старый опыт (Softline, ФБД) скрыт до **«Развернуть»**; index 3+ без клика = fail | expandExperienceList, SESSION-2026-06-30-ht66-career-canon |
| 30.06.2026 | HT.6/hh UI | Навыки **удаляются** через × на `/keySkills`; skills-only = replace, не append | hh-resume-editor.mjs |
| 30.06.2026 | HT.6/hh UI | Год окончания — **input** `resume-editor-experience-end-year-input` (fill 2026); месяц — combobox | patchExperienceEndDate |
| 30.06.2026 | HT.6/ME | Буллет ДПСИТ: не писать «IT_One» в тексте — работодатель в шапке | resume-experience-canon.mjs |
| 30.06.2026 | I-track/L3 | Inject «Готовлю…» — weak offline не пушился; `toInjectSyncAnswer` + не наследовать parent follow-up если свой `resolveKnowledgeCard` | interview-copilot-qa.mjs, interview-knowledge-cards.mjs |
| 30.06.2026 | I-track/replay | STT-обрывки «что такое»/«как отменить» — `\b` не работает с кириллицей; seek → `resolveReplayParentQuestion` по плану | interview-knowledge-cards.mjs, interview-copilot-replay.mjs |
| 30.06.2026 | I-track/ME | approved staging без merge при pending=0 — `syncApprovedMissingToBank` + `--resync` | interview-knowledge-staging.mjs, devops-approve-knowledge-staging.mjs |
| 30.06.2026 | HT.6.9b/CV | devops-CV: должность в опыте index 0 — **DevOps-инженер**, не «Технический эксперт L2»; «О себе» — DevOps-факты первыми, 7000+ не в лиде | resume-experience-canon.mjs, hunt-track-resume-drafts.json |

*Следующая запись — после I-L3 live re-check на `hr-only-tech-only` или ответа HR.*
