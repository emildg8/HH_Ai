# Дорожная карта: оффер и конверсия (один пользователь)

**Цель:** 1–2 оффера · удалёнка/МСК · ЗП от ~150–180k ₽ · рост DevOps/поддержка/TAM.

## Реализовано

| Пункт | Команда / API |
|-------|----------------|
| Статусы откликов hh.ru | `npm run devops:sync-responses` · дашборд «Синхр. отклики hh.ru» · `POST /api/launch-sync-hh-responses` |
| Конверсия | Строка под статусом в дашборде · `GET /api/conversion-stats` |
| Чаты | `npm run devops:sync-chats` · «Синхр. чаты» · черновик «Ответ в чат» на карточке |
| Подготовка к собесу | Кнопка «К собесу» при приглашении · `POST /api/interview-prep` |
| Заметки с собесов | `HH_INTERVIEW_DIR` (по умолчанию `D:\Dev\HH\hh\Интервью`) · «Импорт заметок собесов» |
| До 5 резюме на hh | `config/resume-variants.json` · `npm run devops:sync-resume-variants` · только «О себе» + описание опыта |

## Резюме на hh.ru (костяк + варианты)

1. Скопируйте `config/resume-variants.example.json` → `config/resume-variants.json`.
2. На hh.ru создайте до **5** резюме с названиями из `titleOnHh` (или скопируйте существующее).
3. `npm run devops:list-resumes` — впишите `hash` в json.
4. `npm run devops:generate-resume-texts -- --role=devops` (и support, tam…) — тексты в `data/resume-variants-drafts.json`.
5. `npm run devops:sync-resume-variants` — Playwright заполнит поля на hh.ru (проверьте вручную и сохраните).

`config/resume-routing.json` — какое резюме выбирать **при отклике** на вакансию.

## Видео собеседований

Видео из `D:\Dev\HH\hh\Интервью` в git не входят. Импортируются только `.md`/`.txt` для промптов. Для видео: сделайте выжимки в `data/interview-notes.json` или `.md` в той же папке.

## Рекомендуемый цикл (2 недели)

1. `devops:harvest` → отбор в дашборде  
2. `devops:sync-resume-variants` (раз в неделю)  
3. Батч откликов → `devops:sync-responses` + `devops:sync-chats` (ежедневно)  
4. При приглашении — «К собесу», ответы в чат — «Ответ в чат»  

См. [CONFIG.md](CONFIG.md), [CONTINUATION.md](CONTINUATION.md).
