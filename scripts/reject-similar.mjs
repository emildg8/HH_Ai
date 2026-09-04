/**
 * Просмотр отклонённых и массовый перенос похожих из pending → rejected.
 *
 *   npm run devops:reject-similar              # dry-run: что будет отклонено
 *   npm run devops:reject-similar -- --list    # только список уже отклонённых
 *   npm run devops:reject-similar -- --apply   # записать в очередь
 *   npm run devops:reject-similar -- --only=qa,pm,analyst
 *   npm run devops:reject-similar -- --learn   # только правила из ваших причин отклонения
 */

import { loadProfile } from '../lib/load-profile.mjs';

loadProfile();

import { loadQueue } from '../lib/store.mjs';
import { rejectSimilarPendingFromReason } from '../lib/reject-similar-apply.mjs';
import {
  DEFAULT_REJECT_RULES,
  findSimilarToReject,
  ruleIdsLearnedFromRejected,
  summarizeRejected,
} from '../lib/reject-role-patterns.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const listOnly = args.includes('--list');
const learn = args.includes('--learn');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ruleIds = onlyArg
  ? onlyArg
      .slice('--only='.length)
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  : null;

function printRejectedSummary() {
  const q = loadQueue();
  const { rejected, byReason } = summarizeRejected(q);
  const pending = q.filter((x) => x.status === 'pending').length;
  const approved = q.filter((x) => x.status === 'approved').length;

  console.log(`Очередь: ${q.length} | pending: ${pending} | rejected: ${rejected.length} | approved: ${approved}`);
  console.log('');

  if (!rejected.length) {
    console.log('Пока нет отклонённых вакансий.');
    return;
  }

  const sorted = [...byReason.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [reason, items] of sorted) {
    console.log(`── ${reason} (${items.length}) ──`);
    for (const it of items) {
      console.log(`  • ${it.title}`);
      if (it.company) console.log(`    ${it.company}`);
    }
    console.log('');
  }

  const learned = ruleIdsLearnedFromRejected(rejected);
  if (learned.size) {
    console.log(
      'По причинам отклонения подходят правила:',
      [...learned].join(', '),
      '— запустите с --learn для только этих категорий.'
    );
  }
}

function printDryRun(matches) {
  if (!matches.length) {
    console.log('Среди pending нет вакансий, подходящих под выбранные правила.');
    return;
  }

  const byRule = new Map();
  for (const { item, rule } of matches) {
    if (!byRule.has(rule.id)) byRule.set(rule.id, { rule, items: [] });
    byRule.get(rule.id).items.push(item);
  }

  console.log(apply ? 'Отклоняем:' : 'Будет отклонено (dry-run, добавьте --apply):');
  console.log('');

  let total = 0;
  for (const { rule, items } of byRule.values()) {
    console.log(`── ${rule.label} → «${rule.reason}» (${items.length}) ──`);
    for (const it of items) {
      console.log(`  • ${it.title}`);
      total++;
    }
    console.log('');
  }
  console.log(`Итого: ${total} вакансий → вкладка «Отклонённые»`);
}

function applyRejections(matches) {
  const seenRuleIds = new Set();
  let n = 0;
  for (const { rule } of matches) {
    if (seenRuleIds.has(rule.id)) continue;
    seenRuleIds.add(rule.id);
    const { applied } = rejectSimilarPendingFromReason({
      feedbackReason: rule.reason,
      source: 'reject-similar-cli',
    });
    n += applied.length;
  }
  console.log(`Готово: отклонено ${n} записей. Обновите дашборд (вкладка «Отклонённые»).`);
}

function main() {
  if (listOnly) {
    printRejectedSummary();
    return;
  }

  const q = loadQueue();
  const learnedIds = learn ? [...ruleIdsLearnedFromRejected(q.filter((x) => x.status === 'rejected'))] : null;

  if (learn && learnedIds.length === 0) {
    console.log('Нет отклонённых с распознаваемой причиной (Тестировщик, PM, Аналитик и т.д.).');
    console.log('Сначала отклоните несколько вручную в дашборде или укажите --only=qa,pm,...');
    process.exit(1);
  }

  const effectiveRuleIds = ruleIds?.length ? ruleIds : learnedIds;

  if (!listOnly) {
    printRejectedSummary();
    console.log('--- Похожие среди pending ---\n');
  }

  const matches = findSimilarToReject(q, {
    ruleIds: effectiveRuleIds?.length ? effectiveRuleIds : undefined,
  });

  printDryRun(matches);

  if (apply) {
    applyRejections(matches);
  } else if (matches.length) {
    console.log('Чтобы применить: npm run devops:reject-similar -- --apply');
    console.log('Категории: --only=qa,pm,analyst,agile,architect,security');
    console.log('Только по вашим отклонениям: --learn');
  }
}

main();
