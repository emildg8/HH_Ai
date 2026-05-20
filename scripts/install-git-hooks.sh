#!/usr/bin/env bash
# Установка pre-push hook
#   bash scripts/install-git-hooks.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "Не git-репозиторий: $ROOT" >&2
  exit 1
fi

cat > "$HOOK" << 'EOF'
#!/bin/sh
cd "$(git rev-parse --show-toplevel)" || exit 1
node scripts/pre-push-secrets-check.mjs || exit 1
EOF
chmod +x "$HOOK"
echo "[install-git-hooks] pre-push установлен"
echo "  npm run secrets:check — вручную перед push"
