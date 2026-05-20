#!/usr/bin/env bash
# Первый запуск на macOS / Linux
#   bash scripts/install.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "==> HH Ai — установка"
echo "==> Node $(node -v)"

npm install
npx playwright install chromium

copy_if_missing() {
  local src="$1" dest="$2" label="$3"
  if [[ ! -f "$dest" && -f "$src" ]]; then
    cp "$src" "$dest"
    echo "  + $label"
  fi
}

copy_if_missing .env.example .env ".env"
copy_if_missing config/secrets.example.env config/secrets.local.env "config/secrets.local.env"
copy_if_missing config/profiles/devops.env.example config/profiles/devops.env "config/profiles/devops.env"
copy_if_missing config/cover-letter.example.txt config/cover-letter.txt "config/cover-letter.txt"
copy_if_missing config/cover-letter-style-examples.example.txt config/cover-letter-style-examples.txt "config/cover-letter-style-examples.txt"

mkdir -p data CV

echo ""
echo "Проверка настройки:"
node scripts/setup-check.mjs
check_exit=$?

echo ""
echo "Дальше:"
echo "  1. docs/CONFIG-GUIDE.md — LLM, профиль, стиль писем"
echo "  2. config/secrets.local.env — OpenRouter или Ollama"
echo "  3. CV/ — resume.pdf или .md"
echo "  4. npm run login && npm run dashboard"
echo ""
echo "Кратко: docs/QUICKSTART.md"

exit $check_exit
