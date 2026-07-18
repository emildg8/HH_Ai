/**
 * Cross-track resume fallback must not silently submit (Альтуэра/Ригла 16.07 + Биржа 18.07).
 *   node scripts/test-hh-resume-picker-cross-track.mjs
 */
import assert from 'node:assert/strict';
import {
  isCrossTrackResumeTitle,
  pickBestFromEmployerList,
  questionnaireStepResumeBlocksSubmit,
  resumeRolesCompatible,
} from '../lib/hh-resume-picker.mjs';

assert.equal(resumeRolesCompatible('devops', 'devops'), true);
assert.equal(resumeRolesCompatible('devops', 'infra'), true);
assert.equal(resumeRolesCompatible('infra', 'devops'), true);
assert.equal(resumeRolesCompatible('devops', 'support'), false);
assert.equal(resumeRolesCompatible('infra', 'support_lead'), false);
assert.equal(resumeRolesCompatible('devops', 'tam'), false);

assert.equal(isCrossTrackResumeTitle('Руководитель службы поддержки', 'infra'), true);
assert.equal(isCrossTrackResumeTitle('Специалист технической поддержки L2, L3', 'devops'), true);
assert.equal(isCrossTrackResumeTitle('Системный инженер', 'infra'), false);
assert.equal(isCrossTrackResumeTitle('DevOps-инженер', 'devops'), false);

const onlyLead = pickBestFromEmployerList(
  [{ title: 'Руководитель службы поддержки', hash: 'bd538209ff108adea10039ed1f4a594843626f' }],
  'infra'
);
assert.equal(onlyLead.idealInList, false);
assert.ok(onlyLead.pick);
assert.equal(onlyLead.pick.role, 'support_lead');
assert.equal(resumeRolesCompatible('infra', onlyLead.pick.role), false);

// Альтуэра: L2/lead на шаге анкеты при tech-ideal → STOP
assert.equal(
  questionnaireStepResumeBlocksSubmit({
    curTitle: 'Специалист технической поддержки L2, L3',
    preferredTitle: 'DevOps-инженер',
    idealRole: 'devops',
  }).block,
  true
);
assert.equal(
  questionnaireStepResumeBlocksSubmit({
    curTitle: 'Руководитель службы поддержки',
    preferredTitle: 'Системный инженер',
    idealRole: 'infra',
  }).block,
  true
);

// Биржа 18.07: DevOps на шаге анкеты при support-ideal → STOP
assert.equal(
  questionnaireStepResumeBlocksSubmit({
    curTitle: 'DevOps-инженер',
    preferredTitle: 'Специалист технической поддержки L2, L3',
    idealRole: 'support',
  }).block,
  true
);

// Совпадение title / семья devops↔infra → не стоп (P2: sticky infra отдельно)
assert.equal(
  questionnaireStepResumeBlocksSubmit({
    curTitle: 'Специалист технической поддержки L2, L3',
    preferredTitle: 'Специалист технической поддержки L2, L3',
    idealRole: 'support',
  }).block,
  false
);
assert.equal(
  questionnaireStepResumeBlocksSubmit({
    curTitle: 'DevOps-инженер',
    preferredTitle: 'Системный инженер',
    idealRole: 'infra',
  }).block,
  false
);

console.log('ok: test-hh-resume-picker-cross-track');
