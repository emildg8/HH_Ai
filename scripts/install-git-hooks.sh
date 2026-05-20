#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"
SRC="$ROOT/scripts/pre-push-hook.sh"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Не git-репозиторий: $ROOT" >&2
  exit 1
fi

cp -f "$SRC" "$HOOK"
chmod +x "$HOOK"
echo "[install-git-hooks] pre-push установлен"
echo "  npm run secrets:check — вручную перед push"
