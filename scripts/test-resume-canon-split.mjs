/**
 * Анти-смешение канонов: devops ≠ L2 identity; infra ≠ devops hash.
 */
import assert from 'node:assert/strict';
import { getDraftForTrack } from '../lib/hunt-track-resume-drafts.mjs';
import {
  buildItOneSbpEntry,
  buildSoftlineBlock,
  buildFbdBlock,
  getExperienceTitleOnHh,
  EMPLOYMENT_CANON,
} from '../lib/resume-experience-canon.mjs';
import { loadResumeRoutingConfig, classifyVacancyResumeRole, resolveResumeForVacancy } from '../lib/resume-routing.mjs';
import { loadHuntTracks } from '../lib/hunt-tracks.mjs';

const devops = getDraftForTrack('devops');
assert.match(devops.aboutMe, /эксплуатац|DevOps|СБП/i);
assert.doesNotMatch(devops.aboutMe, /переход в DevOps|хочу стать|Технический эксперт L2|не штат/i);
assert.match(devops.aboutMe, /Active Directory/i);

const devopsExp = buildItOneSbpEntry('devops');
assert.match(devopsExp, /эксплуатац|релиз|GitLab CI|мониторинг/i);
assert.doesNotMatch(devopsExp.split('\n')[0] || '', /^-\s*Сопровождал контуры СБП.*2-й линии/i);

assert.equal(getExperienceTitleOnHh('devops', 0), 'DevOps-инженер');
assert.equal(getExperienceTitleOnHh('infra', 0), 'Системный инженер');

const routing = loadResumeRoutingConfig();
assert.ok(routing.resumes.devops.hash);
assert.ok(routing.resumes.infra.hash);
assert.notEqual(routing.resumes.devops.hash, routing.resumes.infra.hash);
assert.match(routing.resumes.devops.hash, /^806e0f3a/i);
assert.match(routing.resumes.infra.hash, /^64a523ca/i);

const tracks = loadHuntTracks();
assert.equal(tracks.tracks.infra.resumeRoutingKey, 'infra');

const infra = getDraftForTrack('infra');
assert.match(infra.aboutMe, /Системный инженер/i);
assert.match(infra.aboutMe, /RackStore|Active Directory/i);
assert.doesNotMatch(infra.aboutMe, /DevOps-инженер/);

assert.equal(getExperienceTitleOnHh('tam', 0), 'Ведущий специалист по работе с партнёрами');
assert.equal(getExperienceTitleOnHh('support_lead', 0), 'Ведущий специалист / координатор смены');
assert.equal(getExperienceTitleOnHh('infra', 1), 'Системный инженер');
assert.match(buildItOneSbpEntry('devops'), /ДПСИТ/i);

assert.doesNotMatch(buildSoftlineBlock('l2l3'), /platform\/K8s|\bK8s\b/i);
assert.match(buildFbdBlock('devops'), /три переезда|связанн/i);
assert.doesNotMatch(buildFbdBlock('devops'), /Мергер|2026/);
assert.equal(EMPLOYMENT_CANON.merger.publicCv, false);

assert.equal(classifyVacancyResumeRole({ title: 'Системный инженер' }), 'infra');
assert.equal(classifyVacancyResumeRole({ title: 'Системный администратор Linux' }), 'infra');
assert.match(resolveResumeForVacancy({ title: 'Системный инженер' }).hash, /^64a523ca/i);
assert.equal(classifyVacancyResumeRole({ title: 'Инженер технической поддержки L2' }), 'support');
// Авангард 18.07: виртуализация → infra; DevOps+virt остаётся devops
assert.equal(classifyVacancyResumeRole({ title: 'Инженер систем виртуализации' }), 'infra');
assert.equal(classifyVacancyResumeRole({ title: 'Инженер виртуализации (VMware)' }), 'infra');
assert.equal(classifyVacancyResumeRole({ title: 'DevOps / SRE Engineer (VMware)' }), 'devops');
assert.match(resolveResumeForVacancy({ title: 'Инженер систем виртуализации' }).hash, /^64a523ca/i);

console.log('test:resume-canon-split OK');
