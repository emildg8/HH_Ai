# Экспертиза источников вакансий (фаза 0)

Документ фиксирует решения по мульти-источниковому ingest HH Ai v3.2+.

## Матрица ToS / рисков

| Источник | Автоматизация | Лимит | Риск |
|----------|---------------|-------|------|
| hh.ru | harvest + авто-отклик | `hhApplyChatMaxPerDay` | CAPTCHA, блокировка при спаме |
| Habr Карьера | ingest + ручной отклик | 50–80/день | Смена вёрстки |
| Telegram (@g_jobbot, EkleftJob) | ingest ссылок | delta-посты | ToS MTProto; fallback: t.me/s HTML |
| ATS (Greenhouse, Lever, Ashby) | API/fetch парсеры | 30–50 компаний/sync | Anti-bot на Workday |
| Dice / Welcome to the Jungle | волна 2, ручной | 20–30/день | EN-рынок, дубли |
| Indeed / Glassdoor | не автоматизируем | — | CAPTCHA, ToS |
| FlexJobs / CareerJet / Talent.com | не автоматизируем | — | paywall / мета-дубли |

## Дедуп

- Ключ: `externalKey` (`hh:123`, `habr:456`, `greenhouse:789`)
- Fallback: SHA256 нормализованного URL
- Политика HR: один работодатель / 30 дней на все source

## AI-детекторы

- EN: `vendor/avoid-ai-writing/detector/patterns.js`
- RU: `letter-humanize.mjs` + RU-паттерны в `ai-writing-audit.mjs`
- Gate: `batchLetterMaxAiScore` (default 35)

## Приоритет волны 1 (РФ)

1. hh.ru (боевой авто-отклик)
2. ATS прямые (tier A)
3. Habr (tier B)
4. Telegram-агрегаторы (tier C)

## OpenPostings — что перенесено

Нативные парсеры (без MCP/React):

- Greenhouse API
- Lever API
- Ashby API
- Workday (упрощённый URL)
- generic-html fallback

## Probe-скрипты

```bash
node scripts/probe-habr-search.mjs --dry-run
node scripts/probe-ats-greenhouse.mjs --dry-run
node scripts/probe-dice-search.mjs --dry-run
```

`--live` — с сетью (не в CI).
