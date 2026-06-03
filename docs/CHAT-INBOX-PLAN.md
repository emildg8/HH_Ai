# Чаты hh.ru в дашборде — план



**Цель:** читать переписку, отвечать (черновик → копирование / hh.ru / Playwright), извлекать отклики и отказы, напоминать о себе при приглашении без активности.



## Фазы



### Фаза 1 ✅

- **Inbox** — модалка «Чаты»: список потоков, фильтры, просмотр, черновик, копирование

- **Matcher** — привязка потока к карточке по `vacancyId`, не только `chatUrl`

- **Summary v2** — `needsReply` если последний вопрос работодателя без вашего ответа

- **Outcomes** — `invite` / `decline` из чата → `hhSiteState`

- **Follow-up** — типы `question`, `invite_nudge`; планировщик + драфты-напоминания

- **API:** `GET /api/chat-inbox`, `POST /api/chat-mark-sent`, `GET/PATCH /api/chat-follow-up-schedule`



### Фаза 2 ✅ (основное)

- **Отправка из дашборда** — `POST /api/chat-reply-send` → Playwright `sendLetterInChat` (лимит 10/ч, окно Chromium)

- **Polling inbox** — авто-обновление модалки каждые 30 с; бейдж menubar — каждые 60 с

- **Telegram** — `/chats`, push в слотах планировщика (`telegramNotify`)

- **Nudge batch** — `POST /api/chat-nudge-batch`, кнопка Nudge в inbox



### Backlog

- WebSocket push вместо polling

- Отправка пакетом нескольких ответов с очередью



## Модель данных



```text

hhApply.chatMessages[]  — { text, isMine, kind, at }

hhApply.chatSummary     — total, needsReply, questionNeedsReply, inviteFollowUp, lastKind

hhApply.chatUrl         — ссылка на чат hh

hhApply.chatSyncedAt    — ISO

hhApply.chatReplyDraft  — { reply, source, at }

hhApply.chatLastSentAt  — когда отметили «отправлено»

hhApply.hhSiteState     — viewed | invited | declined | … (из negotiations + chat)

```



## API



| Метод | Путь | Назначение |

|-------|------|------------|

| GET | `/api/chat-inbox` | Список / `?id=` детали |

| POST | `/api/chat-reply-draft` | LLM-черновик |

| POST | `/api/chat-reply-batch` | До 15 черновиков на вопросы |

| POST | `/api/chat-reply-send` | Отправка через Playwright |

| POST | `/api/chat-mark-sent` | Отметить вручную |

| POST | `/api/chat-nudge-batch` | Шаблоны «напомнить о себе» |

| GET/PATCH | `/api/chat-follow-up-schedule` | Планировщик |

| GET | `/api/chat-follow-ups` | Список follow-up задач |

| POST | `/api/launch-sync-hh-chats` | Sync переписки |



## Конфиг



`config/chat-follow-up-schedule.json`:

- слоты 10:00, 18:00 MSK

- `inviteNudgeAfterDays`

- `autoSyncChats`, `autoDraftNudges`, `telegramNotify`



Лимит отправки: `HH_CHAT_SEND_MAX_PER_HOUR` (по умолчанию 10).



## CLI



```bash

npm run devops:sync-chats

npm run devops:send-chat-reply -- --id=RECORD_ID

```



## Безопасность



- Отправка на hh.ru только через Playwright с сессией пользователя

- Авто-отказ в очередь **не** ставим — только `hhSiteState` для воронки

