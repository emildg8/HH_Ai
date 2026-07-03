/**
 * ME honesty scan — письмо vs letterSafe инвентарь (QA lane).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import { scanLetterInventoryHonesty } from '../lib/letter-inventory-honesty.mjs';

const ANASTASIA_INV = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data-anastasia', 'candidate-skills-inventory.json'), 'utf8')
);

const gitlabBad =
  'Здравствуйте! Откликаюсь на Senior QA Auto/SDET. Опыт настройки GitLab CI и Jenkins в проде, Kubernetes для автотестов.';
const gitlabScan = scanLetterInventoryHonesty(gitlabBad, ANASTASIA_INV);
assert.equal(gitlabScan.pass, false, 'GitLab CI без skill должен падать');
assert.ok(
  gitlabScan.violations.some((v) => /gitlab/i.test(v.claim)),
  `ожидали GitLab violation, got: ${JSON.stringify(gitlabScan.violations)}`
);

const apiGood =
  'Здравствуйте! Откликаюсь на Technical QA Lead. API-тестирование (Postman, Kafka), SQL-валидация, Jira и регрессия.';
const apiScan = scanLetterInventoryHonesty(apiGood, ANASTASIA_INV);
assert.equal(apiScan.pass, true, 'Postman/Kafka из инвентаря — pass');

const bridgeGood =
  'Сильная сторона — manual+API регрессия. Коммерческий Python/PyTest SDET наращиваю (pet + обучение); готова обсудить план входа.';
const bridgeScan = scanLetterInventoryHonesty(bridgeGood, ANASTASIA_INV);
assert.equal(bridgeScan.pass, true, 'честный мост «наращиваю Python» — pass');

console.log('OK: test-letter-inventory-honesty.mjs');
