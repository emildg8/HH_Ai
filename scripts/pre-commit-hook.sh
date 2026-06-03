#!/usr/bin/env bash
# Pre-commit: секреты (опционально) + check:dashboard при правках UI
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f scripts/pre-commit-dashboard.mjs ]]; then
  node scripts/pre-commit-dashboard.mjs
fi
