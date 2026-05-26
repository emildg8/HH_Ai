/**
 * Копирует lib/questionnaire-labels.mjs → dashboard/public (для UI).
 *   npm run sync:questionnaire-labels
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bannerLabels =
  '/** Синхронизировать: npm run sync:questionnaire-labels (из lib/questionnaire-labels.mjs) */\n\n';
const bannerMerge =
  '/** Синхронизировать: npm run sync:questionnaire-labels (из lib/questionnaire-merge.mjs) */\n\n';

const labelsSrc = path.join(root, 'lib', 'questionnaire-labels.mjs');
const labelsDest = path.join(root, 'dashboard', 'public', 'questionnaire-labels.mjs');
const labelsBody = fs.readFileSync(labelsSrc, 'utf8');
fs.writeFileSync(labelsDest, bannerLabels + labelsBody.replace(/^\/\*\*[\s\S]*?\*\/\s*/m, ''), 'utf8');
console.log('[sync] OK → dashboard/public/questionnaire-labels.mjs');

const mergeSrc = path.join(root, 'lib', 'questionnaire-merge.mjs');
const mergeDest = path.join(root, 'dashboard', 'public', 'questionnaire-merge.mjs');
const mergeBody = fs.readFileSync(mergeSrc, 'utf8');
fs.writeFileSync(
  mergeDest,
  bannerMerge +
    mergeBody
      .replace(/^\/\*\*[\s\S]*?\*\/\s*/m, '')
      .replace(/from '\.\/questionnaire-labels\.mjs'/g, "from './questionnaire-labels.mjs'"),
  'utf8'
);
console.log('[sync] OK → dashboard/public/questionnaire-merge.mjs');
