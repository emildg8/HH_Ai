/**
 * Профиль поиска (DevOps, Backend, …): env-файл + очередь + ключевые слова.
 * HH_PROFILE=devops или config/profiles/<id>.env
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ROOT } from './paths.mjs';
import { loadEnv } from './load-env.mjs';

const PROFILES_DIR = path.join(ROOT, 'config', 'profiles');
const LEGACY_DEVOPS = path.join(ROOT, 'config', 'devops.env');

/**
 * @param {string} [profileId]
 */
export function resolveProfileId(profileId) {
  const fromArg = (profileId || '').trim();
  if (fromArg) return fromArg;
  const fromEnv = (process.env.HH_PROFILE || '').trim();
  if (fromEnv) return fromEnv;
  if (fs.existsSync(LEGACY_DEVOPS)) return 'devops';
  return 'default';
}

/**
 * @param {string} profileId
 * @returns {string | null}
 */
export function profileEnvPath(profileId) {
  const id = resolveProfileId(profileId);
  if (id === 'devops' && fs.existsSync(LEGACY_DEVOPS)) return LEGACY_DEVOPS;
  const inProfiles = path.join(PROFILES_DIR, `${id}.env`);
  if (fs.existsSync(inProfiles)) return inProfiles;
  if (id === 'default') return null;
  return fs.existsSync(inProfiles) ? inProfiles : null;
}

/**
 * @param {string} [profileId]
 */
export function loadProfile(profileId) {
  loadEnv();
  const id = resolveProfileId(profileId);
  process.env.HH_PROFILE = id;

  const envPath = profileEnvPath(id);
  if (envPath) {
    dotenv.config({ path: envPath, override: true });
  }

  return { id, envPath };
}

/** Совместимость: npm run devops:* */
export function loadDevOpsEnv() {
  return loadProfile('devops');
}

/**
 * @returns {Array<{ id: string, envPath: string | null, label: string }>}
 */
export function listProfiles() {
  const out = [];
  if (fs.existsSync(LEGACY_DEVOPS)) {
    out.push({ id: 'devops', envPath: LEGACY_DEVOPS, label: 'DevOps (legacy config/devops.env)' });
  }
  if (fs.existsSync(PROFILES_DIR)) {
    for (const name of fs.readdirSync(PROFILES_DIR)) {
      if (!name.endsWith('.env') || name.endsWith('.example.env')) continue;
      const id = name.replace(/\.env$/, '');
      if (out.some((p) => p.id === id)) continue;
      out.push({
        id,
        envPath: path.join(PROFILES_DIR, name),
        label: id,
      });
    }
  }
  return out;
}
