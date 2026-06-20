import assert from 'node:assert/strict';
import { buildHrScreeningMock } from '../lib/interview-mock-hr.mjs';
import { buildTechnicalMockInterview } from '../lib/interview-mock.mjs';
import { scanOffersAndSlots, buildOffersTrackerSnapshot } from '../lib/offer-tracker.mjs';
import { resolveVacancyRecord } from '../lib/vacancy-record-resolve.mjs';
import { renderInterviewHubHtml } from '../dashboard/public/interview-hub-ui.mjs';
import { coerceInterviewLine } from '../lib/interview-text-lines.mjs';

assert.equal(coerceInterviewLine({ question: 'K8s?' }), 'K8s?');
assert.equal(coerceInterviewLine({ text: 'CI/CD' }), 'CI/CD');

const hr = buildHrScreeningMock({ title: 'DevOps', company: 'Test' });
assert.ok(hr.questions.length >= 4);
assert.ok(hr.suggestedAnswers.length > 20);

const rec = { title: 'DevOps Engineer', company: 'Bank', descriptionPreview: 'Kubernetes Docker Linux CI/CD' };
const tech = await buildTechnicalMockInterview(rec);
assert.ok(tech.questions.length >= 3);

const offers = scanOffersAndSlots([]);
assert.ok(Array.isArray(offers));

const snap = buildOffersTrackerSnapshot();
assert.ok(snap.summary);

for (const o of snap.offers) {
  assert.ok(o.id, `offer must have id: ${o.title}`);
}

const html = renderInterviewHubHtml({
  offers: [{ id: 'hh-neg-123', title: 'DevOps', company: 'Bank', bucket: 'E' }],
  buckets: { summary: { E: 1, F: 0 } },
});
assert.match(html, /interview-hub/);
assert.match(html, /data-hub-action="prompt"/);
assert.match(html, /data-id="hh-neg-123"/);
assert.match(html, /План собеса/);
assert.match(html, /Статусы откликов/);
assert.match(html, /Собес/);

const resolved = resolveVacancyRecord('hh-neg-999999999');
assert.equal(resolved, null);

console.log('test-interview-hub: OK');
