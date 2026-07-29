/**
 * Срез 1–2 hunt-day: status/plan, lane lock, ship mock, repair mock, outcome normalize.
 */
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-hunt-day-'));
const dataDir = path.join(tmpRoot, 'data');
fs.mkdirSync(path.join(dataDir, 'session'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
fs.writeFileSync(
  path.join(dataDir, 'preferences.json'),
  JSON.stringify(
    {
      duplicateCompanyCooldownDays: 7,
      pointApplyDailyCap: 10,
      pointApplyAutoTracks: ['devops', 'infra'],
      pointApplyTrackQuotas: { devops: 4, infra: 3, l2l3: 3 },
    },
    null,
    2
  )
);
fs.writeFileSync(path.join(dataDir, 'vacancies-queue.json'), '[]\n');

process.env.HH_DATA_DIR = dataDir;
process.env.HH_HUNT_DAY_SYNC = '0';

const {
  buildHuntDayStatus,
  buildHuntDayPlan,
  writeHuntDayJson,
  normalizeHuntDayMode,
  runHuntDayShip,
  runHuntDayRepair,
  runHuntDayShipStub,
  runHuntDayPrep,
  ApplyLaneBusyError,
  packShipScriptForInstance,
  packShipSummaryFileForInstance,
  huntDayNpmScriptForInstance,
  isAnastasiaHuntDayInstance,
  loadAnastasiaDayBasketIds,
} = await import('../lib/hunt-day-orchestrator.mjs');
const {
  acquireApplyLaneLock,
  releaseApplyLaneLock,
  getApplyLaneLockInfo,
  assertApplyLaneFreeForPlan,
  applyLaneLockPath,
} = await import('../lib/apply-lane-lock.mjs');
const { normalizeHuntDayShipOutcome } = await import('../lib/apply-ship-outcome.mjs');
const { resolvePointApplyPool } = await import('../lib/point-apply-precheck.mjs');

assert.equal(normalizeHuntDayMode('POINT'), 'point');
assert.equal(normalizeHuntDayMode('basket'), 'basket');

assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { letterDelivered: true, responseSubmitted: true },
    exitCode: 0,
  }).status,
  'ok'
);
assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { letterDelivered: false, responseSubmitted: true },
    exitCode: 7,
  }).status,
  'naked'
);
assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { letterDelivered: true },
    repaired: true,
  }).status,
  'ok_repaired'
);
assert.equal(
  normalizeHuntDayShipOutcome({
    hhApply: { applySubmitUnverified: true, responseSubmitted: true },
    exitCode: 0,
    errorMessage: 'отклик не подтверждён на hh.ru',
  }).status,
  'verify_fail'
);

const fakePool = async () => ({
  poolId: 'fresh-tier-a',
  poolLabel: 'свежий tier A',
  ladderExhausted: false,
  report: {
    ready: 2,
    totalCandidates: 5,
    message: 'Готово к отклику: 2 из 5',
    blocked: { letterQuality: 2, 'red-flag': 1 },
    blockedLabels: { letterQuality: 'Качество письма', 'red-flag': 'Стоп-сигнал' },
    blockedSamples: {
      letterQuality: [
        { id: 'a1', title: 'DevOps A', company: 'CoA', reason: 'письмо не утверждено' },
      ],
      'red-flag': [{ id: 'b1', title: 'DevOps B', company: 'CoB', reason: 'уже откликались' }],
    },
    readyItems: [
      { id: 'r1', company: 'ReadyCo', title: 'DevOps', scoreOverall: 90 },
      { id: 'skip-me', company: 'SkipCo', title: 'Infra', scoreOverall: 88 },
    ],
  },
});

const status = await buildHuntDayStatus({
  mode: 'point',
  prefs: JSON.parse(fs.readFileSync(path.join(dataDir, 'preferences.json'), 'utf8')),
  huntTracks: ['devops', 'infra'],
  resolvePool: fakePool,
  skipNegotiationsPrep: true,
});
assert.equal(status.slice, 2);
assert.equal(status.mode, 'point');
assert.equal(status.cooldownDays, 7);
assert.equal(status.pool.ready, 2);

const plan = await buildHuntDayPlan({
  mode: 'point',
  prefs: JSON.parse(fs.readFileSync(path.join(dataDir, 'preferences.json'), 'utf8')),
  huntTracks: ['devops'],
  skipIds: ['skip-me'],
  limit: 5,
  dryRun: true,
  resolvePool: fakePool,
  checkLane: true,
  skipNegotiationsPrep: true,
});
assert.equal(plan.readyCount, 1);
assert.equal(plan.candidates[0].id, 'r1');
assert.equal(plan.skippedReady[0].id, 'skip-me');

writeHuntDayJson('hunt-day-plan-latest.json', plan);

/* skipIds: лестница не останавливается на единственном skip */
let step = 0;
const ladderPool = await resolvePointApplyPool({
  huntTracks: ['devops'],
  prefs: {},
  skipIds: ['only-fresh'],
  runPrecheck: async (opts) => {
    step += 1;
    if (opts.freshTierA) {
      return {
        ready: 1,
        readyItems: [{ id: 'only-fresh', company: 'Flant', title: 'PM' }],
        totalCandidates: 1,
        message: 'fresh',
      };
    }
    return {
      ready: 1,
      readyItems: [{ id: 'tier-a-ok', company: 'OkCo', title: 'DevOps' }],
      totalCandidates: 2,
      message: 'tier-a',
    };
  },
});
assert.equal(ladderPool.poolId, 'tier-a');
assert.equal(ladderPool.report.ready, 1);
assert.equal(ladderPool.report.readyItems[0].id, 'tier-a-ok');
assert.ok(step >= 2, 'должен пройти оба шага лестницы');

/* lane conflict */
fs.writeFileSync(
  applyLaneLockPath(),
  JSON.stringify({ pid: process.pid, owner: 'other-chat', command: 'ship', at: Date.now() }),
  'utf8'
);
assert.throws(() => assertApplyLaneFreeForPlan('plan'), (err) => err instanceof ApplyLaneBusyError);

const huntDay = path.join(ROOT, 'scripts/devops-hunt-day.mjs');
const env = { ...process.env, HH_DATA_DIR: dataDir };
const busy = spawnSync(process.execPath, [huntDay, '--', 'ship', '--go'], {
  cwd: ROOT,
  env,
  encoding: 'utf8',
});
assert.equal(busy.status, 2, `expected exit 2, got ${busy.status}: ${busy.stderr || busy.stdout}`);
assert.match(String(busy.stderr || ''), /apply-lane занят|plan-conflict/i);
fs.unlinkSync(applyLaneLockPath());

await acquireApplyLaneLock('hunt-day-test', 'ship');
releaseApplyLaneLock('hunt-day-test');
assert.equal(getApplyLaneLockInfo().held, false);

const stub = await runHuntDayShipStub({ holdMs: 0 });
assert.equal(stub.status, 'use_runHuntDayShip');

/* ship dry via mock spawn — пишет session json */
fs.writeFileSync(
  path.join(dataDir, 'logs', 'point-apply-session-latest.json'),
  JSON.stringify({
    attempts: [
      {
        status: 'dry-run',
        selected: { id: 'dry1', company: 'DryCo', title: 'DevOps' },
      },
    ],
  }),
  'utf8'
);

const shipDry = await runHuntDayShip({
  mode: 'point',
  go: false,
  dryRun: true,
  limit: 1,
  huntTracks: ['devops'],
  spawnChild: async () => 0,
});
assert.equal(shipDry.dryRun, true);
assert.equal(shipDry.autoLetterRepair, false);
assert.equal(shipDry.outcomes[0].status, 'dry-run');
assert.ok(fs.existsSync(path.join(dataDir, 'logs', 'hunt-day-ship-latest.json')));

/* repair mock */
const repair = await runHuntDayRepair({
  id: 'rep1',
  deliver: async () => 0,
  log: () => {},
});
assert.equal(repair.command, 'repair');
assert.ok(fs.existsSync(path.join(dataDir, 'logs', 'hunt-day-repair-latest.json')));

const { runHuntDayAfterShipWatch } = await import('../lib/hunt-day-orchestrator.mjs');
const watchSkip = await runHuntDayAfterShipWatch({
  outcomes: [{ id: 'x', status: 'skip' }],
  waitSec: 0,
  spawnChild: async () => {
    throw new Error('should not spawn');
  },
  log: () => {},
});
assert.equal(watchSkip.skipped, true);
assert.equal(watchSkip.reason, 'no-ok-ids');

let watchSpawnArgs = null;
const watchOk = await runHuntDayAfterShipWatch({
  outcomes: [{ id: 'ok1', status: 'ok' }],
  waitSec: 0,
  sendAuto: true,
  spawnChild: async (_script, args) => {
    watchSpawnArgs = args;
    return 0;
  },
  log: () => {},
});
assert.equal(watchOk.skipped, undefined);
assert.ok(watchSpawnArgs.includes('--id=ok1'));
assert.ok(watchSpawnArgs.includes('--send-auto'));
assert.ok(watchSpawnArgs.includes('--wait=0'));

const cliPlan = spawnSync(
  process.execPath,
  [huntDay, '--', 'plan', '--mode=point', '--dry-run', '--limit=3'],
  { cwd: ROOT, env, encoding: 'utf8' }
);
assert.equal(cliPlan.status, 0, cliPlan.stderr || cliPlan.stdout);

/* MC: instance helpers + Anastasia basket */
assert.equal(packShipScriptForInstance('emil'), 'scripts/devops-emil-pack-ship.mjs');
assert.equal(packShipScriptForInstance('anastasia'), 'scripts/devops-anastasia-pack-ship.mjs');
assert.equal(packShipSummaryFileForInstance('anastasia'), 'anastasia-pack-ship-summary.json');
assert.equal(huntDayNpmScriptForInstance('anastasia'), 'devops:hunt-day:anastasia');
assert.equal(isAnastasiaHuntDayInstance('anastasia'), true);

fs.writeFileSync(
  path.join(dataDir, 'logs', 'anastasia-day-baskets-summary.json'),
  JSON.stringify({
    baskets: [
      { id: 'aaaa1111-0000-0000-0000-000000000001', company: 'QaCo' },
      { id: 'bbbb2222-0000-0000-0000-000000000002', company: 'LeadCo' },
    ],
  }),
  'utf8'
);
fs.writeFileSync(
  path.join(dataDir, 'vacancies-queue.json'),
  JSON.stringify(
    [
      {
        id: 'aaaa1111-0000-0000-0000-000000000001',
        company: 'QaCo',
        title: 'QA',
        status: 'pending',
      },
      {
        id: 'bbbb2222-0000-0000-0000-000000000002',
        company: 'LeadCo',
        title: 'Lead',
        status: 'pending',
      },
    ],
    null,
    2
  )
);

const prevInstance = process.env.HH_INSTANCE_ID;
process.env.HH_INSTANCE_ID = 'anastasia';
assert.deepEqual(loadAnastasiaDayBasketIds().slice(0, 1), [
  'aaaa1111-0000-0000-0000-000000000001',
]);

const statusBasket = await buildHuntDayStatus({
  mode: 'basket',
  prefs: JSON.parse(fs.readFileSync(path.join(dataDir, 'preferences.json'), 'utf8')),
  skipNegotiationsPrep: true,
});
assert.equal(statusBasket.pool.poolId, 'anastasia-day');
assert.equal(statusBasket.pool.ready, 2);

await assert.rejects(
  () =>
    buildHuntDayPlan({
      mode: 'basket',
      prefs: {},
      packId: 'some-pack',
      checkLane: false,
      skipNegotiationsPrep: true,
    }),
  /--pack=/
);

let spawned = null;
fs.writeFileSync(
  path.join(dataDir, 'logs', 'anastasia-pack-ship-summary.json'),
  JSON.stringify({
    prepared: [{ id: 'aaaa1111-0000-0000-0000-000000000001', company: 'QaCo' }],
  }),
  'utf8'
);
const shipAna = await runHuntDayShip({
  mode: 'basket',
  go: false,
  dryRun: true,
  spawnChild: async (script, args) => {
    spawned = { script, args };
    return 0;
  },
});
assert.equal(spawned.script, 'scripts/devops-anastasia-pack-ship.mjs');
assert.ok(spawned.args.includes('--no-letter-repair'));
assert.ok(spawned.args.includes('--from-day'));
assert.equal(shipAna.summaryFile, 'anastasia-pack-ship-summary.json');
assert.equal(shipAna.outcomes[0].status, 'dry-run');
assert.equal(shipAna.autoLetterRepair, false);

await assert.rejects(
  () =>
    runHuntDayShip({
      mode: 'basket',
      go: false,
      packId: 'x',
      spawnChild: async () => 0,
    }),
  /--pack=/
);

if (prevInstance === undefined) delete process.env.HH_INSTANCE_ID;
else process.env.HH_INSTANCE_ID = prevInstance;

// prep --with-probe: mock spawn probe-questionnaire
fs.writeFileSync(
  path.join(dataDir, 'vacancies-queue.json'),
  JSON.stringify(
    [
      {
        id: 'probe-need-0000-0000-0000-000000000001',
        title: 'DevOps probe',
        company: 'ProbeCo',
        status: 'pending',
        hhApply: {
          questionnaire: {
            status: 'pending_manual',
            questions: [{ id: 'q1', text: 'Готовы к удалёнке?' }],
          },
        },
        coverLetter: { status: 'approved', approvedText: 'Здравствуйте! Linux.' },
      },
    ],
    null,
    2
  )
);

const probeSpawns = [];
const prepWithProbe = await runHuntDayPrep({
  prefs: JSON.parse(fs.readFileSync(path.join(dataDir, 'preferences.json'), 'utf8')),
  limit: 2,
  withProbe: true,
  probeLimit: 1,
  log: () => {},
  resolvePool: async () => ({
    poolId: 'test',
    poolLabel: 'test',
    report: {
      ready: 1,
      readyItems: [{ id: 'probe-need-0000-0000-0000-000000000001', title: 'DevOps probe' }],
      totalCandidates: 1,
      message: 'ok',
    },
    ladderExhausted: false,
  }),
  spawnChild: async (script, args) => {
    probeSpawns.push({ script, args });
    const q = JSON.parse(fs.readFileSync(path.join(dataDir, 'vacancies-queue.json'), 'utf8'));
    const row = q.find((x) => x.id === 'probe-need-0000-0000-0000-000000000001');
    row.hhApply.questionnaire.probedAt = new Date().toISOString();
    row.hhApply.questionnaire.probed = true;
    fs.writeFileSync(path.join(dataDir, 'vacancies-queue.json'), JSON.stringify(q, null, 2));
    return 0;
  },
});
assert.equal(prepWithProbe.questionnaire.enabled, true);
assert.equal(probeSpawns.length, 1);
assert.equal(probeSpawns[0].script, 'scripts/probe-questionnaire.mjs');
assert.ok(probeSpawns[0].args.some((a) => a.startsWith('--id=')));
assert.equal(prepWithProbe.questionnaire.probed[0]?.ok, true);

console.log('OK: test-hunt-day-plan.mjs');
