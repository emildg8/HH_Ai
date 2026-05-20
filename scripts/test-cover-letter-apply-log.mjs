/**
 *   node scripts/test-cover-letter-apply-log.mjs
 */

import { formatCoverLetterPreview } from '../lib/cover-letter-apply-log.mjs';
import { verifyLetterVisibleInChat } from '../lib/hh-chat-selectors.mjs';

const p = formatCoverLetterPreview('Добрый день! DevOps и Docker.', 20);
if (!p.includes('Добрый') || !p.includes('симв')) {
  console.error('FAIL: preview', p);
  process.exit(1);
}

if (typeof verifyLetterVisibleInChat !== 'function') {
  console.error('FAIL: verifyLetterVisibleInChat export');
  process.exit(1);
}

console.log('OK: test-cover-letter-apply-log.mjs');
