import assert from 'node:assert/strict';
import { parseWorkFormatMeta, passesWorkFormatForApply } from '../lib/vacancy-work-format.mjs';
import { assessVacancyForApply } from '../lib/vacancy-targeting.mjs';
import { runHardFilters } from '../lib/filters.mjs';

const wizardBlob = `
Специалист 2 линии технической поддержки
Группа Компаний Визард
Полная занятость
Формат работы: на месте работодателя
Тверь
Удалённая поддержка
Комфортный офис в центре города
`.trim();

const meta = parseWorkFormatMeta(wizardBlob, { requireRemote: false });
assert.equal(meta.explicitOffice, true, 'explicit office');
assert.equal(meta.hasRemote, false, 'удалённая поддержка ≠ удалёнка');
assert.equal(meta.officeOnly, true, 'office only');
assert.equal(meta.city, 'Тверь', 'city Tver');

const harvest = runHardFilters(
  {
    title: 'Специалист 2 линии технической поддержки',
    company: 'ГК Визард',
    salaryRaw: '',
    employment: 'Полная занятость',
    address: 'Тверь',
    description: wizardBlob,
  },
  { requireRemote: false, allowOfficeMoscow: true }
);
assert.equal(harvest.pass, false, 'harvest rejects office outside Moscow');
assert.equal(harvest.stage, 'remote');

const applyMeta = passesWorkFormatForApply(meta, { allowOfficeMoscow: true });
assert.equal(applyMeta.pass, false, 'apply must reject office Tver');
assert.match(applyMeta.reason || '', /офис|удалёнк/i);

const rec = {
  title: 'Специалист 2 линии технической поддержки',
  descriptionPreview: wizardBlob,
  workFormatLine: 'на месте работодателя',
  employment: 'Полная занятость',
  address: 'Тверь',
  workFormat: meta,
};
const assessment = assessVacancyForApply(rec, { prefs: { allowOfficeMoscow: true } });
assert.equal(assessment.eligible, false, 'batch assess rejects');
assert.equal(assessment.category, 'work-format');

const remoteJob = parseWorkFormatMeta('Формат работы: удалённо\nDevOps engineer', {});
assert.equal(remoteJob.hasRemote, true);
assert.equal(remoteJob.officeOnly, false);

console.log('test-vacancy-work-format: ok');
