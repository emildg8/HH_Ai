/**
 * Unit-тесты remote-stats / Vdsina config (без SSH).
 */
import { buildRemoteStatsPayload, loadVdsinaSshConfig, isRemotePushConfigured, loadRemoteHttpPushConfig } from '../lib/remote-stats.mjs';

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

const payload = buildRemoteStatsPayload();
assert(payload.at, 'payload.at');
assert(typeof payload.digest_text === 'string', 'digest_text');
assert(payload.stats && typeof payload.stats === 'object', 'stats');
assert(payload.chatInbox && typeof payload.chatInbox.needs_reply === 'number', 'chatInbox');

const prevHost = process.env.VDSINA_HOST;
delete process.env.VDSINA_HOST;
assert(!isRemotePushConfigured(), 'not configured without host');
process.env.VDSINA_HOST = '1.2.3.4';
assert(isRemotePushConfigured(), 'configured with host');
if (prevHost) process.env.VDSINA_HOST = prevHost;
else delete process.env.VDSINA_HOST;

process.env.HH_REMOTE_STATS_URL = 'https://example.com/api/stats-ingest';
assert(isRemotePushConfigured(), 'configured with stats url');
delete process.env.HH_REMOTE_STATS_URL;

const cfg = loadVdsinaSshConfig();
assert(cfg.user === 'root' || cfg.user.length > 0, 'ssh user default');

if (errors.length) {
  console.error('FAIL test-remote-stats:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('test-remote-stats: OK');
