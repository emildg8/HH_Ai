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
if [[ ! -f config/secrets.local.env ]]; then
  if [[ -f config/presets/no-llm.env ]]; then
    cp config/presets/no-llm.env config/secrets.local.env
    echo "  + config/secrets.local.env (режим без LLM — см. npm run setup)"
  else
    copy_if_missing config/secrets.example.env config/secrets.local.env "config/secrets.local.env"
  fi
fi
copy_if_missing config/profiles/devops.env.example config/profiles/devops.env "config/profiles/devops.env"
copy_if_missing config/cover-letter.example.txt config/cover-letter.txt "config/cover-letter.txt"
copy_if_missing config/cover-letter-style-examples.example.txt config/cover-letter-style-examples.txt "config/cover-letter-style-examples.txt"
copy_if_missing config/resume-routing.example.json config/resume-routing.json "config/resume-routing.json"

mkdir -p data CV

echo ""
echo "Проверка настройки:"
node scripts/setup-check.mjs
check_exit=$?

echo ""
echo "Дальше:"
echo "  1. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE"
echo "  2. npm run login && npm run dashboard"
echo ""
echo "Опционально: npm run setup, CV/resume.pdf"
echo "Чеклист: docs/FIRST-RUN.md · docs/QUICKSTART.md"

exit $check_exit
