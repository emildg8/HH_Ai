import fs from 'fs';
import { PREFS_FILE } from './paths.mjs';

export function loadPreferences() {
  const raw = fs.readFileSync(PREFS_FILE, 'utf8');
  return JSON.parse(raw);
}
