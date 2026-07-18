# Resume routing P0+P1 — Биржа / Авангард (18.07.2026)

> Срез: wrong CV на форме отклика.  
> Связано: №85 Альтуэра · live 18.07 СПБ Биржа (DevOps вместо L2) · Авангард virt (план DevOps вместо infra).  
> ПЕТЕР-СЕРВИС `134973403` — недоступен кандидату («Вам недоступна эта вакансия») — не добирать.

## Зачем

| Кейс | Было | Стало |
|------|------|--------|
| СПБ Биржа | План L2, на шаге анкеты sticky **DevOps** — gate **не стопал** (односторонняя защита только «support при tech-ideal») | STOP `wrong_resume` при DevOps/infra на `support`/`support_lead`/`tam` |
| Авангард virt | Title «Инженер систем виртуализации» → default **devops** | Узкий паттерн virt/VMware/… → **infra** (после проверки DevOps/SRE в title) |

## Что меняли (файлы)

| Файл | Изменение |
|------|-----------|
| `lib/hh-resume-picker.mjs` | `inferResumeRoleFromHhTitle`, `questionnaireStepResumeBlocksSubmit` |
| `lib/hh-response-modal.mjs` | шаг анкеты вызывает `questionnaireStepResumeBlocksSubmit` |
| `lib/resume-routing.mjs` | virt/VMware/Hyper-V/Proxmox/ESXi → `infra` |
| `scripts/test-hh-resume-picker-cross-track.mjs` | кейсы Альтуэра + Биржа + семья devops↔infra |
| `scripts/test-resume-canon-split.mjs` | Авангард / DevOps+VMware |
| `docs/APPLY-CHAIN-STABLE.md` | строка про двусторонний gate |
| `docs/LEARNING-LOG.md` | урок H/resume-quiz-gate |

## Сознательно не делали (P2)

Sticky **DevOps** при ideal **infra** на шаге анкеты **по-прежнему не стоп** (семья devops↔infra).  
Нужен отдельный шаг: reload+`syncPreferredResume` один раз, если ideal есть в списке hh. Не в этом срезе.

## Проверка

```powershell
npm run test:hh-resume-picker-cross-track
npm run test:resume-canon-split
```

## Откат

### Важно про git

В тех же файлах (`hh-resume-picker`, `hh-response-modal`, `resume-routing`, `LEARNING-LOG`) могли лежать **другие незакоммиченные правки** (Magritte resume UI и т.п.).  
`git revert <sha>` откатит **весь** diff коммита по файлу, не только quiz-gate.

Для отката **только** P0+P1 — **Вариант B** (ниже).

### Вариант A — git revert всего коммита

```powershell
git log --oneline --grep=resume-quiz
git revert <sha>
```

### Вариант B — только quiz-gate / virt (безопасный)

1. `lib/hh-response-modal.mjs` — на шаге анкеты вернуть вызов `isCrossTrackResumeTitle` + условие  
   `cross || (preferredTitle && curTitle && !titleOk && /поддержк|руководитель/i.test(curTitle))`  
   (убрать `questionnaireStepResumeBlocksSubmit`).
2. `lib/hh-resume-picker.mjs` — удалить экспорты `questionnaireStepResumeBlocksSubmit` и `inferResumeRoleFromHhTitle`.
3. `lib/resume-routing.mjs` — убрать из infra-ветки  
   `|| /виртуализац|vmware|hyper-?\s*v|proxmox|\besxi\b/i.test(title)`.
4. В тестах убрать кейсы «Биржа 18.07» / virt→infra.

Маркеры поиска: `questionnaireStepResumeBlocksSubmit` · `tech-cv-on-support-ideal` · `Биржа 18.07`.

## Риски после выката

- Больше `wrong_resume` / skip, когда план support, а hh уже показал DevOps на шаге анкеты — **ожидаемо** (лучше skip, чем чужой CV).
- «DevOps (VMware)» остаётся devops — проверка DevOps/SRE **раньше** infra.
