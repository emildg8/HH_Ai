import assert from 'node:assert/strict';
import {
  negotiationThreadTextMatches,
  selectNegotiationThread,
} from '../lib/hh-chat-selectors.mjs';

assert.equal(
  negotiationThreadTextMatches(
    'Senior DevOps Engineer\nРомашка Tech',
    'Senior DevOps Engineer',
    'ООО Ромашка Tech'
  ),
  true
);
assert.equal(
  negotiationThreadTextMatches(
    'Senior DevOps Engineer\nДругая компания',
    'Senior DevOps Engineer',
    'ООО Ромашка Tech'
  ),
  false
);
assert.equal(negotiationThreadTextMatches('DevOps', 'DevOps', ''), false);

class FakeLocator {
  constructor({ items = null, visible = false, text = '', href = '', click = () => {} } = {}) {
    this.items = items;
    this.visible = visible;
    this.text = text;
    this.href = href;
    this.clickAction = click;
  }

  first() {
    return this.items ? this.items[0] || new FakeLocator() : this;
  }

  nth(index) {
    return this.items?.[index] || new FakeLocator();
  }

  async count() {
    return this.items ? this.items.length : Number(this.visible);
  }

  async isVisible() {
    return this.visible;
  }

  async innerText() {
    return this.text;
  }

  async getAttribute(name) {
    return name === 'href' ? this.href : null;
  }

  async scrollIntoViewIfNeeded() {}

  async click() {
    this.clickAction();
  }
}

function fakePage(rows, firstThread) {
  return {
    async waitForTimeout() {},
    locator(selector) {
      if (selector.includes('a[href*=')) return new FakeLocator();
      if (selector.includes('[data-qa="negotiations-list"]')) return firstThread;
      return new FakeLocator({ items: rows });
    },
    getByRole() {
      return new FakeLocator();
    },
  };
}

let fallbackClicks = 0;
const unrelatedFirstThread = new FakeLocator({
  visible: true,
  text: 'DevOps Engineer\nДругой работодатель',
  click: () => fallbackClicks++,
});
const noMatch = await selectNegotiationThread(fakePage([], unrelatedFirstThread), {
  vacancyId: '123',
  vacancyTitle: 'Senior DevOps Engineer',
  company: 'Ромашка Tech',
});
assert.equal(noMatch, null);
assert.equal(fallbackClicks, 0);

let correctClicks = 0;
const rows = [
  new FakeLocator({ visible: true, text: 'Senior DevOps Engineer\nДругой работодатель' }),
  new FakeLocator({
    visible: true,
    text: 'Senior DevOps Engineer\nРомашка Tech',
    click: () => correctClicks++,
  }),
];
const matched = await selectNegotiationThread(fakePage(rows, unrelatedFirstThread), {
  vacancyId: '123',
  vacancyTitle: 'Senior DevOps Engineer',
  company: 'ООО Ромашка Tech',
});
assert.equal(matched, 'thread:identity');
assert.equal(correctClicks, 1);

console.log('test-hh-chat-thread-selection: OK');
