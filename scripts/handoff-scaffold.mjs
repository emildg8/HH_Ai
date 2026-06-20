#!/usr/bin/env node
/**
 * Скелет HANDOFF-документа.
 *   npm run devops:handoff-scaffold -- --date 2026-06-20
 */

import fs from 'fs';
import path from 'path';
import { ROOT } from '../lib/paths.mjs';

const dateArg = process.argv.find((a) => a.startsWith('--date='));
const date = dateArg ? dateArg.slice(7) : new Date().toISOString().slice(0, 10);
const out = path.join(ROOT, 'docs', `HANDOFF-${date}.md`);

if (fs.existsSync(out)) {
  console.error(`[handoff-scaffold] уже есть: ${path.relative(ROOT, out)}`);
  process.exit(1);
}

const body = `# HANDOFF ${date}

## С чего начать

1. \`npm run test:hygiene\`
2. …

## Сделано

- …

## Проверено

- [ ] тесты
- [ ] дашборд

## Не трогать

- …

## Следующий шаг

- …

## Контекст для агента

- Срез плана: …
`;

fs.writeFileSync(out, body, 'utf8');
console.log(`[handoff-scaffold] ${path.relative(ROOT, out)}`);
