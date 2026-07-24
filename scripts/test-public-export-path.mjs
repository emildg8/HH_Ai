import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafePublicExportPath } from '../lib/public-export-path.mjs';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-ai-export-path-'));
const root = path.join(sandbox, 'repo');
const outside = path.join(sandbox, 'public-export');

try {
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });

  assert.throws(() => assertSafePublicExportPath(root, root), /contains the repository/);
  assert.throws(() => assertSafePublicExportPath(root, sandbox), /contains the repository/);
  assert.throws(() => assertSafePublicExportPath(root, path.join(root, 'config')), /must be inside/);
  assert.doesNotThrow(() => assertSafePublicExportPath(root, path.join(root, 'dist', 'public')));
  assert.doesNotThrow(() => assertSafePublicExportPath(root, outside));

  const linkedConfig = path.join(sandbox, 'linked-config');
  fs.symlinkSync(path.join(root, 'config'), linkedConfig, 'dir');
  assert.throws(() => assertSafePublicExportPath(root, linkedConfig), /must be inside/);
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}

console.log('test-public-export-path: OK');
