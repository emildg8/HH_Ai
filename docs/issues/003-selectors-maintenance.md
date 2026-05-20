## Контекст

hh.ru периодически меняет вёрстку. Селекторы в проекте нужно обновлять вручную через codegen.

## Файлы

- `lib/hh-response-selectors.mjs` — форма отклика, поле письма
- `lib/hh-chat-selectors.mjs` — отклик + чат
- `npm run codegen-hh` — подбор селекторов на живой странице

## Задача

Документировать процесс «сломалось → codegen → PR» и по мере поломок открывать дочерние Issues с конкретной страницей (шаблон **Селекторы hh.ru**).

## Связь

Skill: `.cursor/skills/hh-ru-apply-workflow` · [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
