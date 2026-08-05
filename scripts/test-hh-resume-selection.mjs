import assert from 'node:assert/strict';
import {
  readCurrentResponseResumeHash,
  readCurrentResponseResumeTitle,
} from '../lib/hh-resume-upload.mjs';

class FakeLocator {
  constructor({
    items = null,
    text = '',
    visible = true,
    attributes = {},
    locate = () => new FakeLocator({ items: [] }),
  } = {}) {
    this.items = items;
    this.text = text;
    this.visible = visible;
    this.attributes = attributes;
    this.locate = locate;
  }

  locator(selector) {
    return this.locate(selector);
  }

  first() {
    return this.items ? this.items[0] || new FakeLocator({ items: [] }) : this;
  }

  nth(index) {
    return this.items ? this.items[index] || new FakeLocator({ items: [] }) : this;
  }

  async count() {
    return this.items ? this.items.length : 1;
  }

  async isVisible() {
    return this.items ? this.items.length > 0 && this.items[0].visible : this.visible;
  }

  async innerText() {
    return this.text;
  }

  async getAttribute(name) {
    return this.attributes[name] || '';
  }
}

const selectedHash = 'bbbbbbbbbbbbbbbb';
const firstTitle = new FakeLocator({ text: 'DevOps Engineer' });
const selectedTitle = new FakeLocator({ text: 'Data Engineer' });
const selectedRow = new FakeLocator({
  locate: (selector) =>
    selector === '[data-qa="resume-title"]'
      ? new FakeLocator({ items: [selectedTitle] })
      : new FakeLocator({ items: [] }),
});
const checkedRadio = new FakeLocator({
  attributes: { value: selectedHash },
  locate: (selector) =>
    selector.startsWith('xpath=ancestor::')
      ? selectedRow
      : new FakeLocator({ items: [] }),
});
const checkedRadios = new FakeLocator({ items: [checkedRadio] });
const empty = new FakeLocator({ items: [] });
const root = new FakeLocator({
  locate: (selector) => {
    if (selector === 'input[type="radio"]:checked') return checkedRadios;
    if (selector.startsWith('input[type="radio"]:checked,')) return checkedRadios;
    if (selector.startsWith('[data-qa="resume-select-item"][class*="selected"')) return empty;
    if (selector === '[data-qa="resume-title"]') {
      return new FakeLocator({ items: [firstTitle, selectedTitle] });
    }
    return empty;
  },
});
const page = {
  url: () => 'https://hh.ru/applicant/vacancy_response?vacancyId=123',
  locator: () => root,
};

assert.equal(
  await readCurrentResponseResumeTitle(page),
  'Data Engineer',
  'the title must come from the checked resume, not the first resume in the list'
);
assert.equal(await readCurrentResponseResumeHash(page), selectedHash);

console.log('test-hh-resume-selection: OK');
