#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRE_PUSH="$ROOT/.git/hooks/pre-push"
PRE_COMMIT="$ROOT/.git/hooks/pre-commit"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Не git-репозиторий: $ROOT" >&2
  exit 1
fi

cp -f "$ROOT/scripts/pre-push-hook.sh" "$PRE_PUSH"
chmod +x "$PRE_PUSH"
cp -f "$ROOT/scripts/pre-commit-hook.sh" "$PRE_COMMIT"
chmod +x "$PRE_COMMIT"
echo "[install-git-hooks] pre-push + pre-commit установлены"
echo "  pre-commit: check:dashboard при изменении dashboard/public/"
echo "  npm run secrets:check — вручную перед push"
