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

mkdir -p data CV

echo ""
echo "Готово. Дальше:"
echo "  1. config/secrets.local.env — OPENROUTER_API_KEY (опционально)"
echo "  2. config/profiles/devops.env — HH_PROFILE_RESUME_TITLE"
echo "  3. npm run login"
echo "  4. npm run dashboard  ->  http://127.0.0.1:3849"
echo ""
echo "Инструкция: docs/QUICKSTART.md"
