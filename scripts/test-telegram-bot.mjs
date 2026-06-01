/**
 * Unit-тесты Telegram-бота (без сети).
 */
import { parseBotCommand } from '../lib/telegram-bot/router.mjs';
import { isTelegramUpdateAllowed, authSetupHint } from '../lib/telegram-bot/auth.mjs';
import { formatJobStatusText, formatQueueText } from '../lib/telegram-bot/stats.mjs';

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const p1 = parseBotCommand('/help');
assert(p1.cmd === 'help' && p1.args.length === 0, 'parse /help');

const p2 = parseBotCommand('/funnel 14');
assert(p2.cmd === 'funnel' && p2.args[0] === '14', 'parse /funnel args');

const p2b = parseBotCommand('/help@MyBot');
assert(p2b.cmd === 'help', 'parse /help with bot suffix');

const p3 = parseBotCommand('/harvest');
assert(p3.cmd === 'harvest', 'parse /harvest');

const p4 = parseBotCommand('/chats');
assert(p4.cmd === 'chats', 'parse /chats');

const cfg = { allowedChatIds: ['100', '-200'], allowedUserIds: ['42'] };
assert(isTelegramUpdateAllowed(cfg, { chat: { id: 100 }, from: { id: 999 } }), 'chat whitelist');
assert(isTelegramUpdateAllowed(cfg, { chat: { id: 1 }, from: { id: 42 } }), 'user whitelist');
assert(!isTelegramUpdateAllowed(cfg, { chat: { id: 1 }, from: { id: 2 } }), 'deny unknown');
assert(authSetupHint({ allowedChatIds: [] }).includes('не настроен'), 'hint empty whitelist');

const status = formatJobStatusText();
assert(status.includes('Поиск:'), 'formatJobStatusText');
assert(status.includes('Серия'), 'formatJobStatus batch line');

const queue = formatQueueText();
assert(queue.includes('Pending:'), 'formatQueueText');

if (errors.length) {
  console.error('FAIL test-telegram-bot:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('test-telegram-bot: OK');
