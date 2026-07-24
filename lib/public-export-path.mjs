import fs from 'fs';
import path from 'path';

function realPathIncludingMissingSegments(target) {
  const absolute = path.resolve(target);
  let existing = absolute;
  const missing = [];

  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }

  return path.resolve(fs.realpathSync.native(existing), ...missing);
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  );
}

/**
 * Public exports may be created outside the repository or below its dist directory.
 * Reject paths that rmSync could use to erase the repository or one of its source trees.
 */
export function assertSafePublicExportPath(root, output) {
  const realRoot = realPathIncludingMissingSegments(root);
  const realOutput = realPathIncludingMissingSegments(output);
  const realDist = realPathIncludingMissingSegments(path.join(root, 'dist'));

  if (isWithin(realOutput, realRoot)) {
    throw new Error(`Unsafe public export path: ${output} contains the repository`);
  }

  if (isWithin(realRoot, realOutput) && !isWithin(realDist, realOutput)) {
    throw new Error(`Unsafe public export path: repository outputs must be inside ${path.join(root, 'dist')}`);
  }

  return realOutput;
}
