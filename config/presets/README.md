# Пресеты настройки

Скопируйте **содержимое одного файла** в `config/secrets.local.env`  
(или объедините с уже существующим — без дублирования ключей).

| Файл | Режим |
|------|--------|
| [no-llm.env](no-llm.env) | Без API — локальная оценка |
| [openrouter-free.env](openrouter-free.env) | OpenRouter, бесплатные модели |
| [ollama.env](ollama.env) | Локальный Ollama |
| [openrouter-then-ollama.env](openrouter-then-ollama.env) | Сначала OpenRouter, потом Ollama |

Дополнительно настройте профиль: `config/profiles/devops.env`  
Полный гид: [docs/CONFIG-GUIDE.md](../../docs/CONFIG-GUIDE.md)
