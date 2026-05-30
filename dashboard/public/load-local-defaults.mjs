/** Подхват local-dashboard-defaults.mjs (gitignore) и однократная запись в localStorage. */

import { writeUiScale, setUiScaleDefault } from './ui-scale.mjs';
import { writeCardTuning, setCardTuningDefaults } from './ui-card-tuning.mjs';

export async function applyLocalDashboardDefaults() {
  try {
    const probe = await fetch(new URL('./local-dashboard-defaults.mjs', import.meta.url), { method: 'HEAD' });
    if (!probe.ok) return null;
  } catch {
    return null;
  }

  let mod;
  try {
    mod = await import('./local-dashboard-defaults.mjs');
  } catch {
    return null;
  }

  if (mod.LOCAL_UI_SCALE != null) setUiScaleDefault(mod.LOCAL_UI_SCALE);
  if (mod.LOCAL_CARD_TUNING) setCardTuningDefaults(mod.LOCAL_CARD_TUNING);

  const ver = mod.LOCAL_DEFAULTS_VERSION ?? 1;
  const verKey = 'hh-dashboard-local-defaults-ver';
  if (localStorage.getItem(verKey) === String(ver)) return mod;

  if (mod.LOCAL_UI_SCALE != null) writeUiScale(mod.LOCAL_UI_SCALE);
  if (mod.LOCAL_CARD_TUNING) writeCardTuning(mod.LOCAL_CARD_TUNING);
  try {
    localStorage.setItem(verKey, String(ver));
  } catch {
    /* ignore */
  }
  return mod;
}
