import assert from 'node:assert/strict';
import { buildHrScreeningMock } from '../lib/interview-mock-hr.mjs';
import { buildTechnicalMockInterview } from '../lib/interview-mock.mjs';
import { scanOffersAndSlots, buildOffersTrackerSnapshot } from '../lib/offer-tracker.mjs';
import { renderInterviewHubHtml } from '../dashboard/public/interview-hub-ui.mjs';

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

const html = renderInterviewHubHtml({ offers: [], buckets: { summary: { E: 0, F: 0 } } });
assert.match(html, /interview-hub/);

console.log('test-interview-hub: OK');
