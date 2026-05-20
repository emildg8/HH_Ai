#!/bin/sh
cd "$(git rev-parse --show-toplevel)" || exit 1
exec node scripts/pre-push-secrets-check.mjs
