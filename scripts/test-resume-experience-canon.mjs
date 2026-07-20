/**
 *   node scripts/test-resume-experience-canon.mjs
 */
import assert from 'node:assert/strict';
import {
  buildItOneEntry0,
  buildSoftlineBlock,
  buildFbdBlock,
  getCanonExperienceEntries,
  getExperienceTitleOnHh,
  getArchiveExperiencePatches,
  buildArchiveExperienceText,
  ARCHIVE_EMPLOYERS,
  EMPLOYMENT_CANON,
  MERGER_BLOCK,
  SOFTLINE_BLOCK,
  IT_ONE_GPB_PRIOR_BLOCK,
  STYLE_GUIDE_RU,
} from '../lib/resume-experience-canon.mjs';
import { getExperienceEntriesForTrack, getSkillsForTrackApply } from '../lib/hunt-track-resume-drafts.mjs';

const devopsIt = buildItOneEntry0('devops');
const tamIt = buildItOneEntry0('tam');
const l2It = buildItOneEntry0('l2l3');
assert.ok(!/7000/i.test(devopsIt), 'devops IT_One: без 7000 (ATS/HR)');
assert.ok(!/7000/i.test(tamIt), 'tam IT_One: без тикетного объёма');
assert.ok(/7000/i.test(l2It), 'l2l3: 7000 остаётся');
assert.ok(/OpenShift|Keycloak|Camunda/i.test(devopsIt), 'ДПСИТ-стек в devops IT_One');
assert.ok(/СБП/i.test(devopsIt) && /пром|эмулятор|восстановлен/i.test(devopsIt), 'СБП усилен в devops');
// ДПСИТ ≤2 буллета до «Далее — контуры СБП»
{
  const bullets = devopsIt.split('\n').filter((l) => /^-\s/.test(l));
  const sbpIdx = bullets.findIndex((l) => /Далее\s*[—-]\s*контуры\s*СБП/i.test(l));
  assert.ok(sbpIdx >= 0, 'есть переход на СБП');
  assert.ok(sbpIdx <= 2, `ДПСИТ не больше 2 буллетов до СБП, got ${sbpIdx}`);
  assert.ok(bullets.length - sbpIdx >= 3, 'СБП ≥3 буллета включая переход');
}
assert.ok(/жизненный цикл|завис|баз[еы] знаний|3-й линии|L3/i.test(l2It), 'l2l3 DPSIT: lifecycle / KB / L3');
assert.ok(!/эскалировал на 3/i.test(devopsIt), 'devops: не L2-эскалация lead');
assert.ok(/заявк|SQL|лог/i.test(devopsIt), 'devops DPSIT: диагностика заявки');
assert.ok(!/Softline/i.test(devopsIt));
assert.ok(/Стек:/i.test(devopsIt));
assert.ok(!/7000/i.test(SOFTLINE_BLOCK));
assert.ok(devopsIt !== tamIt);
assert.ok(!/Переношу/i.test(tamIt));
assert.ok(!/ГПБ/i.test(MERGER_BLOCK));
assert.ok(/банковским гарантиям/i.test(MERGER_BLOCK));
assert.ok(!/без смены работодателя/i.test(devopsIt));
assert.ok(!/без смены работодателя/i.test(IT_ONE_GPB_PRIOR_BLOCK));
assert.ok(!/не в трудовой/i.test(MERGER_BLOCK));
assert.equal(EMPLOYMENT_CANON.merger.publicCv, false);

assert.equal(getExperienceTitleOnHh('devops', 0), 'DevOps-инженер');
assert.equal(getExperienceTitleOnHh('infra', 0), 'Системный инженер');
assert.equal(getExperienceTitleOnHh('l2l3', 0), 'Технический эксперт L2');
assert.equal(getExperienceTitleOnHh('tam', 0), 'Ведущий специалист по работе с партнёрами');
assert.equal(getExperienceTitleOnHh('support_lead', 0), 'Ведущий специалист / координатор смены');
assert.ok(!/технический эксперт l2/i.test(getExperienceTitleOnHh('devops', 0)));

const tamSoft = buildSoftlineBlock('tam');
const devopsSoft = buildSoftlineBlock('devops');
const infraSoft = buildSoftlineBlock('infra');
const leadSoft = buildSoftlineBlock('support_lead');
assert.notEqual(tamSoft, devopsSoft);
assert.ok(/заказчик/i.test(tamSoft));
assert.ok(/RackStore|vSAN|vSphere/i.test(infraSoft), 'NAS Softline infra');
assert.ok(/жизненный цикл|Jira/i.test(infraSoft));
assert.ok(/ЦОД|перев[её]з|перен[её]с/i.test(infraSoft), 'Softline: переезд/перенос в ЦОД');
assert.ok(/ЦОД|перев[её]з|перен[её]с/i.test(devopsSoft), 'devops Softline: переезд/перенос в ЦОД');
assert.ok(/интегрир|выкуп|контур/i.test(infraSoft), 'infra Softline: интеграция после выкупа');
assert.ok(/без простоя/i.test(infraSoft), 'infra Softline: миграция без простоя');
assert.ok(/MFA|интегрир/i.test(leadSoft), 'lead Softline: MFA или интеграция контура');
assert.ok(!/MFA|телефон/i.test(devopsSoft.split('\n')[0]), 'devops Softline: MFA/телефония не в первом буллете');
assert.ok(!/Kubernetes|K8s/i.test(infraSoft));
assert.ok(!/backup job|\bDR\b|сотни ВМ/i.test(infraSoft));
assert.ok(/резервн|аварийн|восстановлен|ЦОД|без простоя/i.test(infraSoft));
assert.ok(/RackStore|vSAN|ЦСИ|интегрир/i.test(leadSoft));
assert.ok(/ЦОД|Veeam|Zabbix/i.test(devopsSoft));
assert.ok(!/^-\s*Руководил/m.test(devopsSoft.split('\n')[0]), 'devops Softline: руководство не первым');
assert.ok(!/7000/i.test(infraSoft));
assert.ok(!/нескольк[оа]\s+сот|Девелоник/i.test(infraSoft + devopsSoft), 'без N сотен и Девелоники в публичном Softline');
assert.ok(STYLE_GUIDE_RU.softlineNas);
assert.ok(EMPLOYMENT_CANON.softline.partnerFacts20260720?.contourIntegration);
assert.ok(STYLE_GUIDE_RU.atsSkills);

const fbdDevops = buildFbdBlock('devops');
assert.ok(/три переезда/i.test(fbdDevops), 'ФБД: три переезда офиса');
assert.ok(/связанн/i.test(fbdDevops), 'ФБД: связанное направление (минимум от Мергера)');
assert.ok(!/Мергер|до 2026|2026/i.test(fbdDevops), 'ФБД: без Мергера и без хвоста до 2026');

const devopsEntries = getExperienceEntriesForTrack('devops');
assert.equal(devopsEntries[0].employerKey, 'itOneSbp');
assert.equal(devopsEntries[0].titleOnHh, 'DevOps-инженер');
assert.equal(devopsEntries[1].employerKey, 'softline');
assert.equal(devopsEntries[1].employer, 'Softline');
assert.equal(devopsEntries[2].employerKey, 'fbd');
assert.equal(devopsEntries.length, 3);
assert.ok(!devopsEntries.some((e) => e.employerKey === 'merger'));

const l2Entries = getExperienceEntriesForTrack('l2l3');
assert.equal(l2Entries.length, 2);
assert.equal(l2Entries[1].employerKey, 'softline');
assert.notEqual(l2Entries[0].text, devopsEntries[0].text);

assert.ok(getSkillsForTrackApply('devops').includes('GitLab CI'));
assert.ok(getSkillsForTrackApply('devops').includes('OpenShift'));
assert.ok(getSkillsForTrackApply('infra').includes('Active Directory'));
assert.ok(getSkillsForTrackApply('tam').includes('Jira'));
assert.ok(getSkillsForTrackApply('support_lead').includes('ITIL'));
assert.ok(!/работодателе IT_One/i.test(IT_ONE_GPB_PRIOR_BLOCK));
assert.ok(STYLE_GUIDE_RU.sevenThousand);
assert.ok(STYLE_GUIDE_RU.stackLine);

const archivePatches = getArchiveExperiencePatches();
assert.ok(archivePatches.length >= 4);
assert.ok(archivePatches.some((p) => p.employerKey === 'asp' && p.index === 6));
for (const patch of archivePatches) {
  assert.ok(patch.index >= 3, `archive index must be 3+: ${patch.index}`);
  assert.ok(!/7000/i.test(patch.text), `no 7000 in archive index ${patch.index}`);
  const bulletCount = patch.text.split('\n').filter((l) => /^-\s/.test(l)).length;
  assert.ok(bulletCount <= 2, `max 2 bullets at index ${patch.index}, got ${bulletCount}`);
  assert.ok(/Стек:/i.test(patch.text), `stack line at index ${patch.index}`);
}

const depoText = buildArchiveExperienceText('depo');
assert.ok(ARCHIVE_EMPLOYERS.depo);
assert.ok(!/7000|сбп/i.test(depoText));
assert.equal(depoText.split('\n').filter((l) => /^-\s/.test(l)).length, 2);

console.log('OK: test-resume-experience-canon.mjs');
