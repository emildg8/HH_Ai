import assert from 'node:assert/strict';
import { parseUrlMetadata, buildExternalKey, extractJobUrlsFromText } from '../lib/vacancy-id.mjs';
import { INGEST_GOLDEN } from '../lib/ingest-golden-set.mjs';
import { scoreSource } from '../lib/source-quality.mjs';
import { auditText, prepareHumanText } from '../lib/ai-writing-audit.mjs';

for (const g of INGEST_GOLDEN) {
  const m = parseUrlMetadata(g.url);
  assert.equal(m.source, g.expect.source, g.url);
  assert.equal(m.applyMode, g.expect.applyMode, g.url);
  assert.equal(m.externalKey, g.expect.externalKey, g.url);
}

assert.equal(buildExternalKey('hh', '1'), 'hh:1');

const urls = extractJobUrlsFromText('see https://hh.ru/vacancy/111 and https://career.habr.com/vacancies/2');
assert.equal(urls.length, 2);

const tierA = scoreSource({
  source: 'ats',
  title: 'DevOps',
  company: 'Bank',
  createdAt: new Date().toISOString(),
});
assert.equal(tierA.sourceQualityTier, 'A');

const aiBad = auditText('I am thrilled to apply. Furthermore, I am passionate about this unique blend opportunity.');
assert.ok(aiBad.score > 20, 'EN AI patterns detected');

const human = prepareHumanText('Здравствуйте! В связи с вышеизложенным осуществлял мониторинг.', {
  maxScore: 35,
});
assert.ok(human.text.includes('делал') || human.text.length > 10);

console.log('test-vacancy-ingest: OK');
