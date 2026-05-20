/**
 *   node scripts/test-cover-letter-verify.mjs
 */

import {
  isLikelyQuestionnaireFieldBlob,
  isLikelyCoverLetterFieldBlob,
} from '../lib/hh-response-selectors.mjs';

const qBlob =
  'Укажите на какой уровень зарплаты Вы расчитываете? data-qa=employer-question textarea';
const clBlob = 'Сопроводительное письмо к отклику placeholder=Сопроводительное';

if (!isLikelyQuestionnaireFieldBlob(qBlob)) {
  console.error('FAIL: questionnaire blob');
  process.exit(1);
}
if (isLikelyQuestionnaireFieldBlob(clBlob)) {
  console.error('FAIL: cover letter mistaken for questionnaire');
  process.exit(1);
}
if (!isLikelyCoverLetterFieldBlob(clBlob)) {
  console.error('FAIL: cover letter blob');
  process.exit(1);
}

console.log('OK: test-cover-letter-verify.mjs');
