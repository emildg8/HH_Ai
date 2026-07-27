import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveBaseResumeMdPath } from '../lib/tailor-resume.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-tailor-resume-'));

try {
  const dataCv = path.join(dir, '00-data-engineer.md');
  const devopsCv = path.join(dir, '01-devops.md');
  fs.writeFileSync(dataCv, '# Data Engineer\n', 'utf8');
  fs.writeFileSync(devopsCv, '# DevOps\n', 'utf8');

  assert.throws(
    () => resolveBaseResumeMdPath(dir, ''),
    /несколько \.md-файлов/,
    'multiple CVs must not silently select the first file'
  );
  assert.equal(
    resolveBaseResumeMdPath(dir, '01-devops.md'),
    devopsCv,
    'the configured role-specific CV must be selected'
  );
  assert.throws(
    () => resolveBaseResumeMdPath(dir, '../secret.md'),
    /не найден в CV\//,
    'the configured CV must be a file inside CV/'
  );

  fs.rmSync(dataCv);
  assert.equal(
    resolveBaseResumeMdPath(dir, ''),
    devopsCv,
    'a single CV remains the safe default'
  );

  console.log('OK: tailored resume base selection is unambiguous');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
