/**
 *   node scripts/test-cover-letter-apply-log.mjs
 */

import assert from 'node:assert/strict';
import { formatCoverLetterPreview } from '../lib/cover-letter-apply-log.mjs';
import {
  verifyLetterVisibleInChat,
  waitForLetterVisibleInChat,
} from '../lib/hh-chat-selectors.mjs';

const p = formatCoverLetterPreview('Добрый день! DevOps и Docker.', 20);
if (!p.includes('Добрый') || !p.includes('симв')) {
  console.error('FAIL: preview', p);
  process.exit(1);
}

if (typeof verifyLetterVisibleInChat !== 'function') {
  console.error('FAIL: verifyLetterVisibleInChat export');
  process.exit(1);
}

function fakeFrame(visibleText, editorText = '') {
  return {
    async evaluate(run, probe) {
      const clone = {
        innerText: `${visibleText} ${editorText}`,
        textContent: `${visibleText} ${editorText}`,
        querySelectorAll() {
          return [
            {
              remove() {
                clone.innerText = visibleText;
                clone.textContent = visibleText;
              },
            },
          ];
        },
      };
      const previousDocument = globalThis.document;
      globalThis.document = { body: { cloneNode: () => clone } };
      try {
        return run(probe);
      } finally {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
      }
    },
  };
}

function fakePage(mainText, { editorText = '', frameTexts = [] } = {}) {
  const page = fakeFrame(mainText, editorText);
  const frames = frameTexts.map((text) => fakeFrame(text));
  page.mainFrame = () => page;
  page.frames = () => [page, ...frames];
  page.waitForTimeout = async () => {};
  return page;
}

const letter =
  'Добрый день! Рассматриваю вашу вакансию и хочу рассказать о релевантном опыте автоматизации инфраструктуры.';

assert.equal(
  await verifyLetterVisibleInChat(fakePage('Senior DevOps Engineer — Docker, Kubernetes'), letter),
  false,
  'generic vacancy skills must not prove delivery'
);
assert.equal(
  await verifyLetterVisibleInChat(fakePage('', { editorText: letter }), letter),
  false,
  'text left in the unsent editor must not prove delivery'
);
assert.equal(
  await verifyLetterVisibleInChat(fakePage('', { frameTexts: [`Исходящее сообщение: ${letter}`] }), letter),
  true,
  'the sent letter in a chat frame must prove delivery'
);
assert.equal(
  await waitForLetterVisibleInChat(fakePage('', { editorText: letter }), letter, 0),
  false,
  'delivery confirmation must fail closed'
);

console.log('OK: test-cover-letter-apply-log.mjs');
