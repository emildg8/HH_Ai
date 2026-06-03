/**
 * Unit-тесты Telegram-бота (без сети).
 */
import { parseBotCommand } from '../lib/telegram-bot/router.mjs';
import { parseReplyButton, parseInlineCommand } from '../lib/telegram-bot/ui.mjs';
import { isTelegramUpdateAllowed, authSetupHint } from '../lib/telegram-bot/auth.mjs';
import { formatJobStatusText, formatQueueText, formatHomeDashboard } from '../lib/telegram-bot/stats.mjs';
import { parseApplyLaunchAction } from '../lib/telegram-bot/apply-wizard.mjs';

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

const p5 = parseBotCommand('/apply 5');
assert(p5.cmd === 'apply' && p5.args[0] === '5', 'parse /apply limit');

const p6 = parseBotCommand('/sync_chats');
assert(p6.cmd === 'sync_chats', 'parse /sync_chats');

const applyBtn = parseInlineCommand('cmd:apply');
assert(applyBtn?.cmd === 'apply', 'inline apply');

const ap = parseApplyLaunchAction('ap:nQ/70/10');
assert(ap?.batchScope === 'noQuestionnaire' && ap.minScore === 70 && ap.limit === 10, 'parse apply launch token');

const apLegacy = parseApplyLaunchAction('apply:5');
assert(apLegacy?.limit === 5 && apLegacy.batchScope === 'noQuestionnaire', 'parse legacy apply limit');

const btn = parseReplyButton('📊 Статус');
assert(btn?.cmd === 'status', 'reply button status');

const home = parseReplyButton('🏠 Главная');
assert(home?.cmd === 'start', 'reply button home');

const nav = parseInlineCommand('nav:home');
assert(nav?.nav === 'home', 'inline nav home');

const inl = parseInlineCommand('cmd:harvest:7');
assert(inl?.cmd === 'harvest' && inl.args[0] === '7', 'inline harvest');

const cfg = { allowedChatIds: ['100', '-200'], allowedUserIds: ['42'] };
assert(isTelegramUpdateAllowed(cfg, { chat: { id: 100 }, from: { id: 999 } }), 'chat whitelist');
assert(isTelegramUpdateAllowed(cfg, { chat: { id: 1 }, from: { id: 42 } }), 'user whitelist');
assert(!isTelegramUpdateAllowed(cfg, { chat: { id: 1 }, from: { id: 2 } }), 'deny unknown');
assert(authSetupHint({ allowedChatIds: [] }).includes('не настроен'), 'hint empty whitelist');

const status = formatJobStatusText();
assert(status.includes('Задачи'), 'formatJobStatusText');
assert(status.includes('Серия'), 'formatJobStatus batch line');

const queue = formatQueueText();
assert(queue.includes('Очередь'), 'formatQueueText');

const homeDash = formatHomeDashboard({ dashboardUrl: 'http://127.0.0.1:3849' });
assert(homeDash.includes('HH Ai'), 'formatHomeDashboard brand');

if (errors.length) {
  console.error('FAIL test-telegram-bot:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('test-telegram-bot: OK');
