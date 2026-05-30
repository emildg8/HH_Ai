/**
 * До 5 вариантов резюме на hh.ru: общий костяк, разные «О себе» и описание опыта.
 */

import fs from 'fs';
import path from 'path';
import { ROOT, RESUME_VARIANTS_DRAFTS_FILE, DATA_DIR } from './paths.mjs';
import { loadCvBundle } from './cv-load.mjs';
import { extractJsonObject, getOpenRouterApiKey, resolveOpenRouterModelForRequest, isCustomLlmRunnable, getCustomLlmBaseUrl, getCustomLlmModel, getCustomLlmApiKey } from './openrouter-score.mjs';

const CONFIG_PATHS = [
  path.join(ROOT, 'config', 'resume-variants.local.json'),
  path.join(ROOT, 'config', 'resume-variants.json'),
];

let cached = null;

export function loadResumeVariantsConfig() {
  if (cached) return cached;
  for (const p of CONFIG_PATHS) {
    if (fs.existsSync(p)) {
      cached = JSON.parse(fs.readFileSync(p, 'utf8'));
      return cached;
    }
  }
  const ex = path.join(ROOT, 'config', 'resume-variants.example.json');
  if (fs.existsSync(ex)) {
    cached = JSON.parse(fs.readFileSync(ex, 'utf8'));
    return cached;
  }
  cached = { maxVariants: 5, variants: [] };
  return cached;
}

export function resetResumeVariantsCache() {
  cached = null;
}

/**
 * @param {string} role
 */
export function getVariantByRole(role) {
  const cfg = loadResumeVariantsConfig();
  return (cfg.variants || []).find((v) => v.role === role) || null;
}

/**
 * Эталон для sync-resume-from-source: support по умолчанию, иначе sourceHash / sourceRole.
 * @param {ReturnType<typeof loadResumeVariantsConfig>} [cfg]
 */
export function resolveSourceVariant(cfg = loadResumeVariantsConfig()) {
  const variants = cfg.variants || [];
  const explicitHash = String(cfg.sourceHash || '').trim();
  const sourceRole = String(cfg.sourceRole || 'support').trim();

  const byRole = variants.find((v) => v.role === sourceRole && String(v.hash || '').trim());
  if (byRole) {
    return { role: byRole.role, hash: String(byRole.hash).trim(), titleOnHh: byRole.titleOnHh || '' };
  }
  if (explicitHash) {
    return { role: 'sourceHash', hash: explicitHash, titleOnHh: '' };
  }
  const first = variants.find((v) => String(v.hash || '').trim());
  if (first) {
    return { role: first.role, hash: String(first.hash).trim(), titleOnHh: first.titleOnHh || '' };
  }
  return { role: '', hash: '', titleOnHh: '' };
}

/**
 * Нужно ли дополнять вариант относительно эталона.
 * @param {object} probe
 * @param {object} source
 */
export function resumeVariantNeedsFill(probe, source, { force = false } = {}) {
  if (force) return true;
  const srcAbout = String(source?.aboutMe || '').trim();
  const srcExp = String(source?.experienceDescription || '').trim();
  const probeAbout = String(probe?.aboutMe || '').trim();
  const probeExp = String(probe?.experienceDescription || '').trim();

  if (!probeAbout && srcAbout) return true;
  if (!probeExp && srcExp) return true;
  if (probeExp && srcExp && probeExp.length < srcExp.length * 0.45) return true;

  const missingMore = (probe?.missingHints?.length || 0) > (source?.missingHints?.length || 0) + 2;
  if (missingMore) return true;

  if (
    probe?.completenessPercent != null &&
    source?.completenessPercent != null &&
    probe.completenessPercent < source.completenessPercent - 3
  ) {
    return true;
  }
  return false;
}

const ROLE_PROMPTS = {
  devops:
    'Акцент DevOps junior+/middle: Linux, Docker, K8s/OpenShift, CI/CD, мониторинг, Terraform/ansible-культура, инциденты, банковский прод.',
  support:
    'Акцент техподдержка L2/L3: эскалации, SLA, тикеты, серверы, сеть, Windows/Linux, коммуникация с разработкой, база знаний.',
  support_lead:
    'Акцент руководитель службы поддержки: процессы L1–L3, SLA/KPI, эскалации, найм/наставничество, отчётность, связь с продуктом и инфраструктурой.',
  tam: 'Акцент TAM: работа с ключевыми клиентами, техническая экспертиза, эскалации, отчётность, стыковка бизнеса и инженеров.',
  sysengineer:
    'Акцент системный инженер: администрирование, виртуализация, мониторинг, резервное копирование, релизы, документация.',
  sre: 'Акцент SRE: надёжность, SLO/SLI, алерты, postmortem, автоматизация, observability, on-call.',
};

/**
 * Сгенерировать aboutMe + experienceDescription для роли (LLM + CV).
 * @param {string} role
 */
export async function generateVariantTexts(role) {
  const cvBundle = await loadCvBundle();
  const hint = ROLE_PROMPTS[role] || ROLE_PROMPTS.devops;

  const userPrompt = `По резюме кандидата ниже сгенерируй ДВА текста для hh.ru (русский, без выдуманных компаний/дат).

Роль варианта: ${role}. ${hint}

Правила:
- aboutMe: 4–7 предложений, цель — оффер на эту роль, удалёнка/Москва, ЗП ~180k.
- experienceDescription: 6–10 буллетов или абзац «чем занимался на последнем месте» под эту роль (факты только из CV).
- Не менять ФИО, образование, названия работодателей — только формулировки обязанностей.

CV:
${cvBundle.text.slice(0, 14000)}

JSON: {"aboutMe":"...","experienceDescription":"..."}`;

  const apiKey = getOpenRouterApiKey();
  let url = 'https://openrouter.ai/api/v1/chat/completions';
  let model = resolveOpenRouterModelForRequest();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else if (isCustomLlmRunnable()) {
    url = `${getCustomLlmBaseUrl()}/chat/completions`;
    model = getCustomLlmModel();
    const k = getCustomLlmApiKey();
    if (k) headers.Authorization = `Bearer ${k}`;
  } else {
    throw new Error('Нет LLM для генерации текстов резюме');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Редактор резюме. Только JSON {"aboutMe","experienceDescription"}.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${raw.slice(0, 300)}`);
  const data = JSON.parse(raw);
  const parsed = extractJsonObject(data?.choices?.[0]?.message?.content || '{}');

  const drafts = loadVariantsDrafts();
  drafts[role] = {
    aboutMe: String(parsed.aboutMe || '').trim(),
    experienceDescription: String(parsed.experienceDescription || '').trim(),
    generatedAt: new Date().toISOString(),
  };
  saveVariantsDrafts(drafts);
  return drafts[role];
}

export function loadVariantsDrafts() {
  if (!fs.existsSync(RESUME_VARIANTS_DRAFTS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(RESUME_VARIANTS_DRAFTS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveVariantsDrafts(drafts) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RESUME_VARIANTS_DRAFTS_FILE, `${JSON.stringify(drafts, null, 2)}\n`, 'utf8');
}

/**
 * Тексты для применения на hh: drafts → config override.
 * @param {string} role
 */
export function resolveVariantTexts(role) {
  const v = getVariantByRole(role);
  const drafts = loadVariantsDrafts();
  const d = drafts[role] || {};
  return {
    titleOnHh: v?.titleOnHh || '',
    hash: v?.hash || '',
    aboutMe: d.aboutMe || v?.aboutMe || '',
    experienceDescription: d.experienceDescription || v?.experienceDescription || '',
  };
}
