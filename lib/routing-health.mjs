/**
 * Проверка config/resume-routing.json перед батчем.
 */

import { loadResumeRoutingConfig } from './resume-routing.mjs';

const PLACEHOLDER = /^(YOUR_|REPLACE|TODO|xxx)/i;

/**
 * @returns {{ ok: boolean, issues: Array<{ role: string, label: string, issue: string }>, roleCount: number }}
 */
export function getResumeRoutingHealth() {
  const cfg = loadResumeRoutingConfig();
  const issues = [];
  for (const [role, entry] of Object.entries(cfg.resumes || {})) {
    const hash = String(entry?.hash || '').trim();
    const label = String(entry?.label || role);
    if (!hash || hash.length < 8 || PLACEHOLDER.test(hash)) {
      issues.push({
        role,
        label,
        issue: 'не задан hash (npm run devops:list-resumes)',
      });
    }
  }
  const roles = Object.entries(cfg.resumes || {}).map(([role, entry]) => ({
    role,
    label: entry?.label || role,
    hash: String(entry?.hash || '').trim(),
  }));

  return {
    ok: issues.length === 0,
    issues,
    roleCount: roles.length,
    defaultRole: cfg.defaultRole || 'devops',
    roles,
  };
}
