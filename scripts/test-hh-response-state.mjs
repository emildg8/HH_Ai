import assert from 'node:assert/strict';

import {
  isResponseAlreadySubmitted,
  isVacancyResponseFormOpen,
} from '../lib/hh-response-modal.mjs';

function fakeLocator(visible) {
  return {
    first() {
      return this;
    },
    async isVisible() {
      return visible;
    },
  };
}

function fakePage({
  url = 'https://hh.ru/applicant/vacancy_response?vacancyId=123',
  textVisible = false,
  roleVisible = false,
  visibleSelectors = [],
} = {}) {
  const selectors = new Set(visibleSelectors);
  return {
    url: () => url,
    getByText: () => fakeLocator(textVisible),
    getByRole: () => fakeLocator(roleVisible),
    locator: (selector) => fakeLocator(selectors.has(selector)),
  };
}

assert.equal(
  await isResponseAlreadySubmitted(fakePage({ textVisible: true })),
  true,
  'success confirmation must be recognized on the dedicated response URL'
);

assert.equal(
  await isResponseAlreadySubmitted(fakePage()),
  false,
  'the dedicated response URL alone is not proof of submission'
);

assert.equal(
  await isVacancyResponseFormOpen(fakePage()),
  false,
  'the dedicated response URL alone is not proof that the form remains open'
);

assert.equal(
  await isVacancyResponseFormOpen(
    fakePage({ visibleSelectors: ['[data-qa="resume-select-item"]'] })
  ),
  true,
  'visible response controls still identify an open dedicated form'
);

console.log('test-hh-response-state: OK');
