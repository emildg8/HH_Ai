/**
 * Point apply gate: hrStack + trading/low-latency niche.
 *   node scripts/test-point-apply-gate.mjs
 */
import assert from 'node:assert/strict';
import { loadDevOpsEnv } from '../lib/load-devops-env.mjs';
import {
  assessApplyNicheManualOnly,
  loadTargetingPolicy,
} from '../lib/targeting-policy.mjs';
import {
  assessPointApplyBlocked,
  pointApplyHrStackMin,
  pickPointApplyCandidate,
} from '../lib/point-apply-gate.mjs';
import { isPointApplyLetterPrepEligible } from '../lib/point-apply-letter-prep.mjs';

loadDevOpsEnv();

const policy = loadTargetingPolicy();
assert.ok(Array.isArray(policy?.applyNicheRules) && policy.applyNicheRules.length >= 1);

const tradingTitle = assessApplyNicheManualOnly({
  title: 'Системный инженер (торговая инфраструктура)',
  descriptionPreview: 'Международная компания в сфере алгоритмического трейдинга',
});
assert.equal(tradingTitle.manualOnly, true, 'trading title');
assert.equal(tradingTitle.ruleId, 'trading-low-latency');

const cloud = assessApplyNicheManualOnly({
  title: 'Cloud engineer',
  descriptionPreview: 'Linux, observability, удалёнка',
});
assert.equal(cloud.manualOnly, false, 'generic cloud');

assert.equal(pointApplyHrStackMin(), 45);

const tradingBlock = await assessPointApplyBlocked(
  {
    title: 'Системный инженер (торговая инфраструктура)',
    descriptionForLlm:
      'алгоритмической торговли Terraform Ansible Python low-latency колокации',
    coverLetter: { status: 'approved', approvedText: 'Здравствуйте! Linux и мониторинг.' },
  },
  { force: false }
);
assert.equal(tradingBlock.blocked, true);
assert.ok(tradingBlock.reasons.some((r) => /ниша|трейдинг|low-latency/i.test(r)));

const tradingForce = await assessPointApplyBlocked(
  {
    title: 'Системный инженер (торговая инфраструктура)',
    descriptionForLlm: 'алгоритмической торговли',
  },
  { force: true }
);
assert.equal(tradingForce.blocked, false);
assert.equal(tradingForce.forced, true);

const lowHrRec = {
  id: 'fixture-low-hrstack',
  title: 'DevOps engineer',
  scoreOverall: 80,
  descriptionForLlm:
    'Требуется Terraform Ansible Python Kubernetes CI/CD. Опыт в проде обязателен.',
  coverLetter: { status: 'approved', approvedText: 'Здравствуйте! Linux, Grafana, Zabbix.' },
};
const lowHr = await assessPointApplyBlocked(lowHrRec, { force: false });
if (lowHr.hrStack && lowHr.hrStack.score < pointApplyHrStackMin() && lowHr.hrStack.missing?.length) {
  assert.equal(lowHr.blocked, true);
  assert.ok(
    lowHr.reasons.some((r) => /стек \d+%|Terraform|Ansible|prefer=weak|prod-K8s/i.test(r)),
    `expected hrStack/prefer reason, got: ${lowHr.reasons.join(' | ')}`
  );
}

const platformBlock = await assessPointApplyBlocked(
  {
    id: 'fixture-platform',
    title: 'DevOps (Platform Engineer)',
    scoreOverall: 90,
    descriptionForLlm: 'Linux Docker Grafana Kubernetes',
    coverLetter: {
      status: 'approved',
      approvedText:
        'Здравствуйте! Интересует DevOps. До июня 2026 в IT_One Grafana, Linux, Docker, MTTR −15%. Готов обсудить стек.',
    },
  },
  { force: false }
);
assert.equal(platformBlock.blocked, true);
assert.ok(platformBlock.reasons.some((r) => /Platform/i.test(r)));

const readyPool = [
  {
    id: 'blocked-trading',
    title: 'Системный инженер (торговая инфраструктура)',
    scoreOverall: 90,
    descriptionForLlm: 'алгоритмического трейдинга',
    coverLetter: { status: 'approved', approvedText: 'test' },
  },
  {
    id: 'ok-cloud',
    title: 'DevOps engineer',
    scoreOverall: 70,
    descriptionForLlm: 'Linux monitoring Grafana банк СБП Docker',
    coverLetter: { status: 'approved', approvedText: 'test' },
  },
];

const { picked, blockedSamples } = await pickPointApplyCandidate(readyPool, {
  getRec: (id) => readyPool.find((x) => x.id === id) || null,
  force: false,
});
assert.equal(picked?.item.id, 'ok-cloud');
assert.equal(picked?.preferTier, 'preferred');
assert.ok(picked?.shortlistRank >= 1);

const skipPlatformPool = [
  {
    id: 'platform-high',
    title: 'DevOps (Platform Engineer)',
    scoreOverall: 99,
    descriptionForLlm: 'Grafana OpenShift банк Linux Docker Kubernetes',
    coverLetter: {
      status: 'approved',
      approvedText:
        'Здравствуйте! Интересует роль. До июня 2026 в IT_One Grafana, MTTR −15%. Готов обсудить.',
    },
  },
  {
    id: 'ok-mid',
    title: 'DevOps engineer',
    scoreOverall: 55,
    descriptionForLlm: 'Grafana банк Linux Docker',
    coverLetter: {
      status: 'approved',
      approvedText:
        'Здравствуйте! Интересует DevOps. До июня 2026 в IT_One Grafana, MTTR −15%. Готов обсудить.',
    },
  },
];
const skipPlat = await pickPointApplyCandidate(skipPlatformPool, {
  getRec: (id) => skipPlatformPool.find((x) => x.id === id) || null,
  force: false,
});
assert.equal(skipPlat.picked?.item.id, 'ok-mid');
assert.ok(skipPlat.blockedSamples.some((s) => s.id === 'platform-high'));
// trading из readyPool — ниже по fit, в samples может не попасть
void blockedSamples;

const preferLadderPool = [
  {
    id: 'stretch-high-score',
    title: 'DevOps Engineer',
    scoreOverall: 70,
    descriptionForLlm: 'Kubernetes Terraform Docker Linux CI/CD пайплайны',
    coverLetter: {
      status: 'approved',
      approvedText:
        'Здравствуйте! Интересует DevOps. До июня 2026 в IT_One Linux Docker, MTTR −15%. Готов обсудить.',
    },
  },
  {
    id: 'preferred-lower-score',
    title: 'DevOps Engineer',
    scoreOverall: 72,
    descriptionForLlm: 'Grafana Kibana OpenShift банк СБП Linux Docker релизы',
    coverLetter: {
      status: 'approved',
      approvedText:
        'Здравствуйте! Интересует DevOps. До июня 2026 в IT_One Grafana OpenShift, MTTR −15%. Готов обсудить.',
    },
  },
];
const ladder = await pickPointApplyCandidate(preferLadderPool, {
  getRec: (id) => preferLadderPool.find((x) => x.id === id) || null,
  force: false,
});
assert.equal(
  ladder.picked?.item.id,
  'preferred-lower-score',
  `prefer ladder: expected preferred over stretch, got ${ladder.picked?.item.id} tier=${ladder.picked?.preferTier}`
);

assert.equal(
  isPointApplyLetterPrepEligible({
    title: 'DevOps',
    descriptionForLlm: 'только AWS без мониторинга',
  }),
  false
);
assert.equal(
  isPointApplyLetterPrepEligible({
    title: 'DevOps',
    descriptionForLlm: 'Grafana банк Linux',
  }),
  true
);

console.log('OK: test-point-apply-gate.mjs');
