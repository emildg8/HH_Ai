## Summary

<!-- Зачем это изменение (HH Ai / emildg8/HH_Ai) -->

## Test plan

- [ ] `npm run verify:local`
- [ ] `npm run devops:test-dashboard-ui` (если менялся dashboard)
- [ ] `npm run export:public` — в `dist/hh-ai-public` нет секретов

## Docs

- [ ] Обновлены `docs/` или `README.md`, если менялось поведение

## Security

- [ ] Нет `.env`, `data/session`, API-ключей, `data/vacancies-*.json` в коммите
